import { describe, expect, it } from 'vitest';
import { prepareRelationshipEvent as prepare, recordPreparedEvent as record, type ExplicitRelationshipCommand } from './relationshipEventAdapter';
import { projectAuthorizedRelationship as project } from './relationshipSourceAccess';
import { access, context, initialize, dm, post, note, relation } from './relationshipTestFixtures';
describe('explicit command adapter', () => {
    it('initializes only chosen metrics with a precise tagged source', () => {
        const ctx = context(); const prepared = prepare(initialize(), ctx); const state = record(ctx, prepared);
        const view = project(state.ledger, state.registry, relation, access, ctx.sources);
        expect(view.scores).toEqual({ familiarity: null, trust: 35, affinity: null, tension: null });
        expect(prepared.event.sourceEventId).toContain('native-message');
        expect(prepared.event.summary).toContain('explicitly');
    });
    it('combines bounded multi-metric adjustments, requires authorized baseline, clamps, forbids resets', () => {
        const ctx = context(); Object.assign(ctx, record(ctx, prepare(initialize(), ctx)));
        const adjust: ExplicitRelationshipCommand = { ...initialize(), commandId: 'command-two', time: 2000, actionType: 'relationship.adjusted', values: { trust: -20 } };
        Object.assign(ctx, record(ctx, prepare(adjust, ctx)));
        expect(project(ctx.ledger, ctx.registry, relation, access, ctx.sources).scores.trust).toBe(15);
        expect(() => prepare({ ...adjust, commandId: 'third', values: { affinity: 5 } }, ctx)).toThrow('baseline');
        expect(() => prepare({ ...initialize(), commandId: 'reset', time: 3000 }, ctx)).toThrow('already established');
        expect(() => prepare({ ...adjust, commandId: 'too-large', values: { trust: 21 } }, ctx)).toThrow();
    });
    it('combines multiple chosen metrics and reports actual clamped effects', () => {
        const ctx = context();
        Object.assign(ctx, record(ctx, prepare({ ...initialize(), values: { trust: 95, tension: 4 } }, ctx)));
        const cmd: ExplicitRelationshipCommand = { ...initialize(), commandId: 'clamped', time: 2000, actionType: 'relationship.adjusted', values: { trust: 20, tension: -20 } };
        Object.assign(ctx, record(ctx, prepare(cmd, ctx)));
        const view = project(ctx.ledger, ctx.registry, relation, access, ctx.sources);
        expect(view.scores.trust).toBe(100); expect(view.scores.tension).toBe(0);
        expect(view.events[0].effects.trust).toEqual({ before: 95, after: 100 });
        expect(view.events[0].effects.tension).toEqual({ before: 4, after: 0 });
    });
    it('never uses private initializers as public baselines', () => {
        const ctx = context(); Object.assign(ctx, record(ctx, prepare(initialize(), ctx))); ctx.sources.push({ source: post, visibility: 'public', exists: true, knownBy: [relation.subject, relation.other] });
        expect(() => prepare({ ...initialize(post), commandId: 'public-adjust', time: 2000, actionType: 'relationship.adjusted', values: { trust: 5 } }, ctx)).toThrow('baseline');
    });
    it('supports explicit qualitative notes without numerical inference', () => {
        const ctx = context(note);
        const cmd: ExplicitRelationshipCommand = { commandId: 'note-command', relation, source: note, time: 2000, scope: 'private', knownBy: [relation.subject], actionType: 'relationship.noted', explanation: 'A records a chosen starting note.', description: 'A remains cautious around B.' };
        const state = record(ctx, prepare(cmd, ctx));
        expect(project(state.ledger, state.registry, relation, access, ctx.sources).description).toBe(cmd.description);
        expect(project(state.ledger, state.registry, relation, access, ctx.sources).scores.trust).toBeNull();
    });
    it('retries exactly once, preserves distinct explicit submissions on the same message, surfaces conflicts', () => {
        const ctx = context(); const first = prepare(initialize(), ctx); Object.assign(ctx, record(ctx, first));
        const retry = record(ctx, prepare(initialize(), ctx));
        expect(retry.ledger).toBe(ctx.ledger); expect(retry.registry).toBe(ctx.registry);
        const second = prepare({ ...initialize(), commandId: 'command-two', time: 2000, actionType: 'relationship.adjusted', values: { trust: 5 } }, ctx);
        expect(record(ctx, second).ledger.events).toHaveLength(2);
        expect(() => prepare({ ...initialize(), explanation: 'Changed retry text' }, ctx)).toThrow('Conflicting');
    });
    it('rejects auto reactions, missing explanations, unsupported groups and stale/deleted sources', () => {
        const ctx = context();
        expect(() => prepare({ ...initialize(), actionType: 'like' } as unknown as ExplicitRelationshipCommand, ctx)).toThrow('Unsupported');
        expect(() => prepare({ ...initialize(), explanation: '' }, ctx)).toThrow();
        expect(() => prepare({ ...initialize(), relation: { ...relation, other: { kind: 'group', id: 'group' } } } as unknown as ExplicitRelationshipCommand, ctx)).toThrow();
        expect(() => prepare(initialize(), { ...ctx, sources: [{ ...ctx.sources[0], exists: false }] })).toThrow('unavailable');
        expect(() => prepare({ ...initialize(), source: { ...dm, sender: relation.other } as typeof dm }, ctx)).toThrow('unavailable');
    });
});
