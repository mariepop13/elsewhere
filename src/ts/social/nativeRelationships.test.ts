import { describe, expect, it } from 'vitest';
import { createNativeRelationships, loadNativeRelationships, nativeRelationshipKey, nativeRelationshipView, nativePublicSource, recordNativeRelationship, openNativeRelationshipSource } from './nativeRelationships';
import type { NativeRelationshipWorkspace } from './nativeRelationships';
import type { SocialFeedState } from './socialFeed';
import type { ExplicitRelationshipCommand } from './relationshipEventAdapter';
import type { SourceReference } from './relationshipSourceAccess';

const feed = (): SocialFeedState => ({ version: 1, enabled: true, publicWorld: '', cast: [], posts: [{ id: 'post', author: { id: 'persona-a', name: 'Player' }, text: 'A public greeting', createdAt: 1, liked: false, responses: [] }], draft: '' });
function setup() {
    let count = 0;
    const workspace = createNativeRelationships(() => `uuid-${++count}`);
    const relation = nativeRelationshipKey(workspace, 'persona-a', 'character-b');
    const source: SourceReference = { ...workspace.binding, kind: 'authored_note', recordId: 'note-one', participants: [relation.subject, relation.other] };
    const command: ExplicitRelationshipCommand = { commandId: 'command-one', relation, source, scope: 'private', knownBy: source.participants, time: 1000, explanation: 'A deliberate starting state', actionType: 'relationship.initialized', values: { trust: 40 } };
    return { workspace, relation, command, f: feed(), personas: ['persona-a'], characters: ['character-b'] };
}
const ready = (workspace: NativeRelationshipWorkspace) => { const loaded = loadNativeRelationships(workspace); if (loaded.status !== 'ready') throw new Error('Expected ready'); return loaded; };
describe('native relationship slot integration', () => {
    it('reloads the maximum two valid authored fields including their separator', () => {
        const s = setup();
        const saved = recordNativeRelationship(s.workspace, { ...s.command, explanation: 'x'.repeat(2000), description: 'y'.repeat(2000) }, s.relation, s.f, s.personas, s.characters);
        expect(saved.notes[0].text).toHaveLength(4002);
        expect(loadNativeRelationships(JSON.parse(JSON.stringify(saved))).status).toBe('ready');
    });
    it('does not seed missing or unsupported saves and preserves opaque originals', () => {
        expect(loadNativeRelationships(undefined).status).toBe('missing');
        const opaque = { version: 9, privateFuture: ['keep'] };
        expect(loadNativeRelationships(opaque)).toEqual({ status: 'unavailable', original: opaque });
        const unavailable = loadNativeRelationships(opaque);
        expect(unavailable.status !== 'ready' && unavailable.original).toBe(opaque);
    });
    it('saves and reloads explicit chosen scores without deriving private scores publicly', () => {
        const s = setup();
        expect(nativeRelationshipView(ready(s.workspace), s.relation, s.f, s.personas, s.characters).scores.trust).toBeNull();
        const saved = recordNativeRelationship(s.workspace, s.command, s.relation, s.f, s.personas, s.characters);
        const loaded = ready(JSON.parse(JSON.stringify(saved)));
        expect(nativeRelationshipView(loaded, s.relation, s.f, s.personas, s.characters).scores.trust).toBe(40);
        const publicView = nativeRelationshipView(loaded, s.relation, s.f, s.personas, s.characters, true);
        expect(publicView.scores.trust).toBeNull(); expect(publicView.events).toEqual([]);
        expect(nativeRelationshipView(loaded, s.relation, s.f, ['another-persona'], s.characters).events).toEqual([]);
    });
    it('acknowledgement retries remain idempotent and stale second initializations fail', () => {
        const s = setup(), saved = recordNativeRelationship(s.workspace, s.command, s.relation, s.f, s.personas, s.characters);
        const retry = recordNativeRelationship(saved, s.command, s.relation, s.f, s.personas, s.characters);
        expect(ready(retry).state.ledger.events).toHaveLength(1);
        expect(() => recordNativeRelationship(saved, { ...s.command, commandId: 'second', source: { ...s.command.source, kind: 'authored_note', recordId: 'note-two', ownerId: saved.binding.ownerId } }, s.relation, s.f, s.personas, s.characters)).toThrow('already established');
        expect(saved.notes).toHaveLength(1);
    });
    it('rechecks deleted private sources on render/click and never resurrects them on retry', () => {
        const s = setup(), saved = recordNativeRelationship(s.workspace, s.command, s.relation, s.f, s.personas, s.characters);
        expect(openNativeRelationshipSource(saved, s.command.commandId, s.relation, s.f, s.personas, s.characters)?.kind).toBe('authored_note');
        const deleted = { ...saved, notes: [] };
        expect(nativeRelationshipView(ready(deleted), s.relation, s.f, s.personas, s.characters).scores.trust).toBeNull();
        expect(openNativeRelationshipSource(deleted, s.command.commandId, s.relation, s.f, s.personas, s.characters)).toBeNull();
        expect(() => recordNativeRelationship(deleted, s.command, s.relation, s.f, s.personas, s.characters)).toThrow('deleted');
    });
    it('validates public source existence, author, audience and exact source clicks', () => {
        const s = setup(), source = nativePublicSource(s.workspace, s.relation, s.f.posts[0]);
        const command: ExplicitRelationshipCommand = { ...s.command, source, scope: 'public' };
        const saved = recordNativeRelationship(s.workspace, command, s.relation, s.f, s.personas, s.characters);
        expect(nativeRelationshipView(ready(saved), s.relation, s.f, s.personas, s.characters, true).scores.trust).toBe(40);
        expect(openNativeRelationshipSource(saved, command.commandId, s.relation, s.f, s.personas, s.characters, true)).toEqual(source);
        s.f.posts[0].visibleToActorIds = ['character-b'];
        expect(nativeRelationshipView(ready(saved), s.relation, s.f, s.personas, s.characters, true).events).toEqual([]);
        expect(openNativeRelationshipSource(saved, command.commandId, s.relation, s.f, s.personas, s.characters)).toBeNull();
        delete s.f.posts[0].visibleToActorIds;
        s.f.posts[0].author.id = 'other-persona';
        expect(openNativeRelationshipSource(saved, command.commandId, s.relation, s.f, s.personas, s.characters)).toBeNull();
        s.f.posts = [];
        expect(nativeRelationshipView(ready(saved), s.relation, s.f, s.personas, s.characters).scores.trust).toBeNull();
    });
    it('fails closed across replacement saves, character/persona deletion and changed viewpoint', () => {
        const s = setup(); let i = 0;
        const other = createNativeRelationships(() => `replacement-${++i}`);
        expect(() => recordNativeRelationship(other, s.command, nativeRelationshipKey(other, 'persona-a', 'character-b'), s.f, s.personas, s.characters)).toThrow();
        expect(() => recordNativeRelationship(s.workspace, s.command, s.relation, s.f, [], s.characters)).toThrow();
        expect(() => recordNativeRelationship(s.workspace, s.command, s.relation, s.f, s.personas, [])).toThrow();
        expect(() => recordNativeRelationship(s.workspace, s.command, nativeRelationshipKey(s.workspace, 'other-persona', 'character-b'), s.f, s.personas, s.characters)).toThrow();
    });
});
