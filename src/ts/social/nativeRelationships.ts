import type { SocialFeedState } from './socialFeed';
import { createRelationshipState, decodeRelationshipState, encodeRelationshipState, type RelationshipState } from './relationshipState';
import { prepareRelationshipEvent, recordPreparedEvent, type ExplicitRelationshipCommand } from './relationshipEventAdapter';
import { projectAuthorizedRelationship, resolveSourceOpen, normalizeSource, type AccessContext, type Binding, type SourceReference, type SourceSnapshot } from './relationshipSourceAccess';
import type { Identity, RelationshipKey } from './relationshipLedger';

interface Note { id: string; relation: RelationshipKey; text: string }
export interface NativeRelationshipWorkspace { version: 1; binding: Binding; state: unknown; notes: Note[] }
export type NativeRelationshipLoad = { status: 'ready'; workspace: NativeRelationshipWorkspace; state: RelationshipState } | { status: 'missing' | 'unavailable'; original: unknown };
/** Called only by the explicit setup button, never during hydration or rendering. */
export function createNativeRelationships(id: () => string): NativeRelationshipWorkspace {
    const binding = { saveId: id(), worldId: id(), ownerId: id() };
    return { version: 1, binding, state: JSON.parse(encodeRelationshipState(createRelationshipState(binding))), notes: [] };
}
export function loadNativeRelationships(original: unknown): NativeRelationshipLoad {
    if (original === undefined) return { status: 'missing', original };
    try {
        const workspace = original as NativeRelationshipWorkspace;
        if (workspace.version !== 1 || !Array.isArray(workspace.notes)) throw new Error('Unavailable workspace');
        const decoded = decodeRelationshipState(workspace.state, workspace.binding);
        if (decoded.status !== 'ready') throw new Error('Unavailable ledger');
        const ids = new Set<string>();
        for (const note of workspace.notes) {
            if (!note || typeof note.id !== 'string' || !note.id || ids.has(note.id) || typeof note.text !== 'string' || note.text.length > 4002 || note.relation.worldId !== workspace.binding.worldId || note.relation.subject.kind !== 'persona' || note.relation.other.kind !== 'character') throw new Error('Invalid note');
            ids.add(note.id);
        }
        return { status: 'ready', workspace, state: decoded.state };
    } catch { return { status: 'unavailable', original }; }
}
export function nativeRelationshipKey(workspace: NativeRelationshipWorkspace, personaId: string, characterId: string): RelationshipKey {
    return { worldId: workspace.binding.worldId, subject: { kind: 'persona', id: personaId }, other: { kind: 'character', id: characterId } };
}
export function nativeRelationshipAccess(workspace: NativeRelationshipWorkspace, relation: RelationshipKey, publicView = false): AccessContext {
    return { ...workspace.binding, personaId: relation.subject.id, characterId: relation.other.id, audience: publicView ? { mode: 'public' } : { mode: 'participant', viewer: relation.subject } };
}
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const authorIdentity = (post: SocialFeedState['posts'][number]): Identity => post.author.characterId ? { kind: 'character', id: post.author.characterId } : { kind: 'persona', id: post.author.id };
export function nativePublicSource(workspace: NativeRelationshipWorkspace, relation: RelationshipKey, post: SocialFeedState['posts'][number]): SourceReference {
    return { saveId: workspace.binding.saveId, worldId: workspace.binding.worldId, kind: 'public_post', postId: post.id, author: authorIdentity(post), participants: [relation.subject, relation.other] };
}
/** Resolve current existence/ACL from native records, not the saved provenance itself. */
export function nativeRelationshipSnapshots(workspace: NativeRelationshipWorkspace, state: RelationshipState, feed: SocialFeedState, personaIds: string[], characterIds: string[]): SourceSnapshot[] {
    const seen = new Set<string>();
    return state.registry.flatMap<SourceSnapshot>(({ source }) => {
        const token = JSON.stringify(normalizeSource(source)); if (seen.has(token)) return []; seen.add(token);
        const knownBy = source.participants;
        const pairExists = knownBy.every(identity => identity.kind === 'persona' ? personaIds.includes(identity.id) : characterIds.includes(identity.id));
        if (source.kind === 'authored_note') {
            const note = workspace.notes.find(note => note.id === source.recordId);
            return [{ source, exists: pairExists && !!note && same([note.relation.subject, note.relation.other], source.participants), visibility: 'private' as const, knownBy }];
        }
        if (source.kind === 'public_post') {
            const posts = feed.posts.filter(post => post.id === source.postId);
            const post = posts.length === 1 ? posts[0] : undefined;
            return [{ source, exists: pairExists && !!post && same(authorIdentity(post), source.author), visibility: post?.visibleToActorIds === undefined ? 'public' as const : 'restricted' as const, knownBy }];
        }
        // Historical DM provenance is unavailable in this first native slice.
        return [{ source, exists: false, visibility: 'private' as const, knownBy: [] }];
    });
}
export function nativeRelationshipView(loaded: Extract<NativeRelationshipLoad, { status: 'ready' }>, relation: RelationshipKey, feed: SocialFeedState, personaIds: string[], characterIds: string[], publicView = false) {
    return projectAuthorizedRelationship(loaded.state.ledger, loaded.state.registry, relation, nativeRelationshipAccess(loaded.workspace, relation, publicView), nativeRelationshipSnapshots(loaded.workspace, loaded.state, feed, personaIds, characterIds));
}
/** Synchronous transaction: revalidate current state, prepare, record, encode, then replace one native slot. */
export function recordNativeRelationship(original: unknown, command: ExplicitRelationshipCommand, currentRelation: RelationshipKey, feed: SocialFeedState, personaIds: string[], characterIds: string[]): NativeRelationshipWorkspace {
    const loaded = loadNativeRelationships(original);
    if (loaded.status !== 'ready' || !same(command.relation, currentRelation) || !personaIds.includes(currentRelation.subject.id) || !characterIds.includes(currentRelation.other.id)) throw new Error('Relationship viewpoint changed or unavailable');
    let workspace = loaded.workspace;
    if (command.source.kind === 'authored_note') {
        const noteSource = command.source;
        if (command.source.ownerId !== workspace.binding.ownerId || command.scope !== 'private') throw new Error('Invalid private note');
        const text = [command.description, command.explanation].filter(Boolean).join('\n\n');
        if (text.length > 4002) throw new Error('Private note is too long');
        const existing = workspace.notes.find(note => note.id === noteSource.recordId);
        if (existing && (!same(existing.relation, command.relation) || existing.text !== text)) throw new Error('Conflicting note retry');
        if (!existing && loaded.state.registry.some(record => record.source.kind === 'authored_note' && record.source.recordId === noteSource.recordId)) throw new Error('This source note was deleted');
        if (!existing) workspace = { ...workspace, notes: [...workspace.notes, { id: noteSource.recordId, relation: command.relation, text }] };
    }
    // A newly selected public source also needs a fresh snapshot before it has provenance.
    const snapshots = nativeRelationshipSnapshots(workspace, { ...loaded.state, registry: [...loaded.state.registry, { eventId: command.commandId, commandId: command.commandId, source: command.source }] }, feed, personaIds, characterIds);
    const context = { ledger: loaded.state.ledger, registry: loaded.state.registry, access: nativeRelationshipAccess(workspace, currentRelation), sources: snapshots };
    const result = recordPreparedEvent(context, prepareRelationshipEvent(command, context));
    return { ...workspace, state: JSON.parse(encodeRelationshipState({ ...loaded.state, ...result })) };
}
export function openNativeRelationshipSource(original: unknown, eventId: string, currentRelation: RelationshipKey, feed: SocialFeedState, personaIds: string[], characterIds: string[], publicView = false): SourceReference | null {
    const loaded = loadNativeRelationships(original);
    if (loaded.status !== 'ready') return null;
    const event = loaded.state.ledger.events.find(event => event.id === eventId);
    if (!event || !same(event.relation, currentRelation)) return null;
    return resolveSourceOpen(eventId, loaded.state.ledger, loaded.state.registry, nativeRelationshipAccess(loaded.workspace, currentRelation, publicView), nativeRelationshipSnapshots(loaded.workspace, loaded.state, feed, personaIds, characterIds));
}
