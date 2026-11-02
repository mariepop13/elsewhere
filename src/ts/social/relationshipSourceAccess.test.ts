import { describe, expect, it } from 'vitest';
import { prepareRelationshipEvent as prepare, recordPreparedEvent as record } from './relationshipEventAdapter';
import { projectAuthorizedRelationship as project, resolveSourceOpen as open, sourceAccessible, type SourceReference } from './relationshipSourceAccess';
import { A, B, C, access, context, initialize, dm, post, relation } from './relationshipTestFixtures';
const setup = (source: SourceReference = dm) => { const ctx = context(source); return { ctx, ...record(ctx, prepare(initialize(source), ctx)) }; };
describe('fresh source ACL and exact navigation', () => {
    it('A/B privately see DM; C/public receive no scores, text, events or private source traces', () => {
        const state = setup();
        for (const viewer of [A,B]) expect(project(state.ledger, state.registry, relation, { ...access, audience: { mode: 'participant', viewer } }, state.ctx.sources).scores.trust).toBe(35);
        for (const audience of [{ mode: 'public' } as const, { mode: 'participant', viewer: C } as const]) {
            const view = project(state.ledger, state.registry, relation, { ...access, audience }, state.ctx.sources);
            expect(view.events).toEqual([]); expect(view.scores.trust).toBeNull(); expect(view.description).toBe('Not enough interactions');
            expect(open('command-one', state.ledger, state.registry, { ...access, audience }, state.ctx.sources)).toBeNull();
        }
    });
    it('source revocation/deletion removes all influence and fresh click fails after a visible projection', () => {
        const state = setup(); const eventId = project(state.ledger, state.registry, relation, access, state.ctx.sources).events[0].id;
        expect(open(eventId, state.ledger, state.registry, access, state.ctx.sources)).toEqual(dm);
        for (const sources of [[], [{ ...state.ctx.sources[0], exists: false }], [{ ...state.ctx.sources[0], knownBy: [B] }]]) {
            expect(project(state.ledger, state.registry, relation, access, sources).scores.trust).toBeNull();
            expect(open(eventId, state.ledger, state.registry, access, sources)).toBeNull();
        }
    });
    it('exact message, native history, story, save and persona snapshot are mandatory', () => {
        const state = setup();
        for (const ctx of [{ ...access, storyId: 'replacement-story' }, { ...access, saveId: 'replacement-save' }, { ...access, worldId: 'other-world' }, { ...access, personaId: 'rebound-persona' }, { ...access, characterId: 'other-character' }]) expect(open('command-one', state.ledger, state.registry, ctx, state.ctx.sources)).toBeNull();
        for (const field of ['messageId','chatId','sender'] as const) {
            const source = { ...dm, [field]: field === 'sender' ? B : 'different' };
            expect(open('command-one', state.ledger, state.registry, access, [{ ...state.ctx.sources[0], source }])).toBeNull();
        }
    });
    it('circle/restricted posts cannot become public, even if actor can read them', () => {
        const state = setup(post); const publicAccess = { ...access, audience: { mode: 'public' as const } };
        expect(project(state.ledger, state.registry, relation, publicAccess, state.ctx.sources).scores.trust).toBe(35);
        const restricted = [{ ...state.ctx.sources[0], visibility: 'restricted' as const }];
        expect(project(state.ledger, state.registry, relation, publicAccess, restricted).events).toEqual([]);
        expect(open('command-one', state.ledger, state.registry, publicAccess, restricted)).toBeNull();
    });
    it('resolves exact comment/reaction IDs and current authors rather than broad post lookup', () => {
        for (const source of [
            { ...post, kind: 'public_comment' as const, commentId: 'exact-comment', author: A },
            { ...post, kind: 'public_reaction' as const, responseId: 'exact-response', author: B },
        ]) {
            const state = setup(source);
            expect(open('command-one', state.ledger, state.registry, access, state.ctx.sources)).toEqual(source);
            const changed = { ...source, author: C };
            expect(open('command-one', state.ledger, state.registry, access, [{ ...state.ctx.sources[0], source: changed }])).toBeNull();
        }
    });
    it('requires current knownBy and authored public knownBy, rejects ambiguous snapshots and missing registry', () => {
        const state = setup(post);
        expect(sourceAccessible(post, relation, 'public', [], access, state.ctx.sources)).toBe(false);
        expect(project(state.ledger, [], relation, access, state.ctx.sources).events).toEqual([]);
        expect(project(state.ledger, state.registry, relation, access, [...state.ctx.sources, ...state.ctx.sources]).events).toEqual([]);
    });
    it('honors tighter event allowlists even when current source grants both participants', () => {
        const ctx = context(); const state = record(ctx, prepare({ ...initialize(), knownBy: [A] }, ctx));
        expect(project(state.ledger, state.registry, relation, { ...access, audience: { mode: 'participant', viewer: B } }, ctx.sources).events).toEqual([]);
    });
});
