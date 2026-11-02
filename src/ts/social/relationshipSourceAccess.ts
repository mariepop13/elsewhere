import { projectRelationship, relationshipId, type Audience, type Identity, type RelationshipEvent, type RelationshipKey, type RelationshipLedger, type RelationshipView } from './relationshipLedger';
export interface Binding { saveId: string; worldId: string; ownerId: string }
interface Base { saveId: string; worldId: string; participants: [Identity, Identity] }
export type SourceReference =
    | (Base & { kind: 'public_post'; postId: string; author: Identity })
    | (Base & { kind: 'public_comment'; postId: string; commentId: string; author: Identity })
    | (Base & { kind: 'public_reaction'; postId: string; responseId: string; author: Identity })
    | (Base & { kind: 'dm_message'; characterId: string; chatId: string; messageId: string; storyId: string; sender: Identity })
    | (Base & { kind: 'authored_note'; recordId: string; ownerId: string });
export interface Provenance { eventId: string; commandId: string; source: SourceReference }
/** Trusted current snapshots contain IDs/ACL only, never source/provider text. */
export interface SourceSnapshot { source: SourceReference; exists: boolean; visibility: 'public' | 'restricted' | 'private'; knownBy: Identity[] }
export interface AccessContext extends Binding { audience: Audience; storyId?: string; personaId?: string; characterId?: string }
const eq = (a: Identity, b: Identity) => a.kind === b.kind && a.id === b.id;
const id = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 500 && !/^persona:\d+$|^index:/i.test(value);
const identity = (value: Identity): Identity => {
    if (!value || !['persona', 'character'].includes(value.kind) || !id(value.id)) throw new Error('Stable typed identity required');
    return { kind: value.kind, id: value.id };
};
export function validateBinding(binding: Binding): Binding {
    if (!binding || !id(binding.saveId) || !id(binding.worldId) || !id(binding.ownerId)) throw new Error('Missing save/world/owner binding');
    return { saveId: binding.saveId, worldId: binding.worldId, ownerId: binding.ownerId };
}
/** Normalizes a tagged source reference; unrelated/provider fields never enter state. */
export function normalizeSource(raw: SourceReference): SourceReference {
    if (!raw || !id(raw.saveId) || !id(raw.worldId) || !Array.isArray(raw.participants) || raw.participants.length !== 2) throw new Error('Invalid source provenance');
    const participants = raw.participants.map(identity) as [Identity, Identity];
    if (eq(participants[0], participants[1])) throw new Error('Distinct source participants required');
    const base = { saveId: raw.saveId, worldId: raw.worldId, participants };
    const required = (...values: unknown[]) => { if (!values.every(id)) throw new Error('Missing stable source IDs'); };
    switch (raw.kind) {
        case 'public_post': required(raw.postId); return { ...base, kind: raw.kind, postId: raw.postId, author: identity(raw.author) };
        case 'public_comment': required(raw.postId, raw.commentId); return { ...base, kind: raw.kind, postId: raw.postId, commentId: raw.commentId, author: identity(raw.author) };
        case 'public_reaction': required(raw.postId, raw.responseId); return { ...base, kind: raw.kind, postId: raw.postId, responseId: raw.responseId, author: identity(raw.author) };
        case 'dm_message': required(raw.characterId, raw.chatId, raw.messageId, raw.storyId); return { ...base, kind: raw.kind, characterId: raw.characterId, chatId: raw.chatId, messageId: raw.messageId, storyId: raw.storyId, sender: identity(raw.sender) };
        case 'authored_note': required(raw.recordId, raw.ownerId); return { ...base, kind: raw.kind, recordId: raw.recordId, ownerId: raw.ownerId };
        default: throw new Error('Unsupported source kind');
    }
}
export function sourceTuple(source: SourceReference, commandId: string): { sourceId: string; sourceEventId: string } {
    const s = normalizeSource(source);
    if (!id(commandId)) throw new Error('Stable submission command ID required');
    let container: string[], atomic: string;
    if (s.kind === 'dm_message') { container = [s.saveId, s.worldId, s.kind, s.characterId, s.chatId, s.storyId]; atomic = s.messageId; }
    else if (s.kind === 'authored_note') { container = [s.saveId, s.worldId, s.kind, s.ownerId]; atomic = s.recordId; }
    else { container = [s.saveId, s.worldId, 'public_post', s.postId]; atomic = s.kind === 'public_post' ? s.postId : s.kind === 'public_comment' ? s.commentId : s.responseId; }
    return { sourceId: JSON.stringify(container), sourceEventId: JSON.stringify([s.kind, atomic, commandId]) };
}
export function canonicalEventId(relation: RelationshipKey, source: SourceReference, commandId: string, actionType: string): string {
    relationshipId(relation);
    sourceTuple(source, commandId);
    if (!id(actionType)) throw new Error('Missing action type');
    // One stable globally unique submission ID owns one tuple; reuse elsewhere conflicts.
    return commandId;
}
export function sourceAccessible(source: SourceReference, relation: RelationshipKey, scope: 'public' | 'private', knownBy: Identity[], context: AccessContext, snapshots: SourceSnapshot[]): boolean {
    try {
        validateBinding(context);
        const ref = normalizeSource(source);
        if (ref.saveId !== context.saveId || ref.worldId !== context.worldId || relation.worldId !== context.worldId) return false;
        if (!ref.participants.some(i => eq(i, relation.subject)) || !ref.participants.some(i => eq(i, relation.other))) return false;
        const matches = snapshots.filter(snapshot => JSON.stringify(normalizeSource(snapshot.source)) === JSON.stringify(ref));
        if (matches.length !== 1) return false; // Ambiguous snapshots fail closed.
        const current = matches[0];
        if (!current.exists || !Array.isArray(current.knownBy)) return false;
        if (scope === 'private') {
            if (context.audience.mode !== 'participant' || context.personaId !== relation.subject.id) return false;
            const viewer = context.audience.viewer;
            if ((!eq(viewer, relation.subject) && !eq(viewer, relation.other)) || !knownBy.some(i => eq(i, viewer)) || !current.knownBy.some(i => eq(i, viewer))) return false;
        } else {
            if (current.visibility !== 'public') return false;
            // An explicit public event must be known to both source participants.
            if (!ref.participants.every(i => knownBy.some(k => eq(i, k)) && current.knownBy.some(k => eq(i, k)))) return false;
        }
        if (ref.kind === 'dm_message') {
            if (scope !== 'private' || current.visibility !== 'private' || context.storyId !== ref.storyId || context.personaId !== relation.subject.id || context.characterId !== ref.characterId) return false;
            if (relation.subject.kind !== 'persona' || relation.other.kind !== 'character' || ref.characterId !== relation.other.id || !ref.participants.some(i => eq(i, ref.sender))) return false;
        } else if (ref.kind === 'authored_note') {
            if (scope !== 'private' || current.visibility !== 'private' || ref.ownerId !== context.ownerId) return false;
        } else {
            if (current.visibility !== 'public' || !ref.participants.some(i => eq(i, ref.author))) return false; // Restricted/circle posts unsupported in first slice.
        }
        return true;
    } catch { return false; }
}
function resolve(event: RelationshipEvent, registry: Provenance[]): Provenance | undefined {
    const entries = registry.filter(record => record.eventId === event.id);
    if (entries.length !== 1) return;
    const record = entries[0], tuple = sourceTuple(record.source, record.commandId);
    if (tuple.sourceId !== event.sourceId || tuple.sourceEventId !== event.sourceEventId) return;
    return record;
}
/** Safe outward projection: source/provider content is never looked up or returned. */
export function projectAuthorizedRelationship(ledger: RelationshipLedger, registry: Provenance[], relation: RelationshipKey, context: AccessContext, snapshots: SourceSnapshot[]): RelationshipView {
    return projectRelationship(ledger, relation, context.audience, access => {
        const event = ledger.events.find(e => e.sourceId === access.sourceId && e.sourceEventId === access.sourceEventId && e.actionType === access.actionType && relationshipId(e.relation) === relationshipId(relation));
        if (!event) return false;
        const record = resolve(event, registry);
        return !!record && sourceAccessible(record.source, relation, event.scope, event.knownBy, context, snapshots);
    });
}
/** Pass only event.id from the UI. Caller supplies fresh authoritative context/snapshots at click. */
export function resolveSourceOpen(eventId: string, ledger: RelationshipLedger, registry: Provenance[], context: AccessContext, snapshots: SourceSnapshot[]): SourceReference | null {
    try {
        const event = ledger.events.find(e => e.id === eventId);
        if (!event) return null;
        const record = resolve(event, registry);
        return record && sourceAccessible(record.source, event.relation, event.scope, event.knownBy, context, snapshots) ? normalizeSource(record.source) : null;
    } catch { return null; }
}
