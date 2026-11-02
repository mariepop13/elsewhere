import { describe, expect, it } from 'vitest';
import { prepareRelationshipEvent as prepare, recordPreparedEvent as record } from './relationshipEventAdapter';
import { createRelationshipState as create, decodeRelationshipState as decode, encodeRelationshipState as encode, preserveRelationshipSlot as preserve } from './relationshipState';
import { binding, context, initialize, relation, access } from './relationshipTestFixtures';
import { projectAuthorizedRelationship as project } from './relationshipSourceAccess';
const populated = () => { const ctx = context(); return { ...create(binding), ...record(ctx, prepare(initialize(), ctx)) }; };
describe('private versioned optional state codec', () => {
    it('missing stays missing without automatic seed, initialization requires explicit caller action', () => {
        const decoded = decode(undefined, binding); expect(decoded.status).toBe('missing'); expect(preserve(decoded)).toBeUndefined(); expect(create(binding).ledger.events).toEqual([]);
    });
    it('reload validates typed identities and provenance and remains idempotent', () => {
        const serialized = encode(populated()); const decoded = decode(serialized, binding); expect(decoded.status).toBe('ready');
        if (decoded.status !== 'ready') throw new Error();
        const ctx = { ...context(), ledger: decoded.state.ledger, registry: decoded.state.registry };
        expect(record(ctx, prepare(initialize(), ctx)).ledger.events).toHaveLength(1);
        expect(project(decoded.state.ledger, decoded.state.registry, relation, access, ctx.sources).scores.trust).toBe(35);
    });
    it('unsupported and corrupt values are retained exactly, including serialized bytes', () => {
        for (const original of ['{ broken json', '{"version":7,"private":"keep bytes"}', { version: 9, arbitrary: ['preserve', 123] }, { ...populated(), registry: [] }]) {
            const decoded = decode(original, binding); expect(decoded.status).toBe('unavailable'); expect(preserve(decoded)).toBe(original);
        }
    });
    it('same native IDs in replacement saves/worlds/owner identities cannot reuse prior ledger', () => {
        const original = encode(populated());
        for (const expected of [{ ...binding, saveId: 'replacement-save' }, { ...binding, worldId: 'new-world' }, { ...binding, ownerId: 'other-owner' }]) {
            const decoded = decode(original, expected); expect(decoded.status).toBe('unavailable'); if (decoded.status === 'unavailable') expect(decoded.reason).toBe('binding-mismatch'); expect(preserve(decoded)).toBe(original);
        }
    });
    it('rejects orphaned, duplicate, retargeted and altered atomic provenance without data loss', () => {
        for (const mutate of [
            (s: ReturnType<typeof populated>) => { s.registry.push(s.registry[0]); },
            (s: ReturnType<typeof populated>) => { s.registry[0].commandId = 'changed-command'; },
            (s: ReturnType<typeof populated>) => { s.registry[0].source.participants[0] = { kind: 'character', id: relation.subject.id }; },
            (s: ReturnType<typeof populated>) => { s.registry[0].source.worldId = 'elsewhere'; },
        ]) {
            const original = populated(); mutate(original); const decoded = decode(original, binding); expect(decoded.status).toBe('unavailable'); expect(preserve(decoded)).toBe(original);
        }
    });
    it('preserves unsupported action types and corrupted action effects as unavailable state', () => {
        for (const modify of [
            (s: ReturnType<typeof populated>) => { s.ledger.events[0].actionType = 'like'; },
            (s: ReturnType<typeof populated>) => { s.ledger.events[0].changes.trust = { delta: 5 }; },
        ]) {
            const original = populated(); modify(original); const decoded = decode(original, binding);
            expect(decoded.status).toBe('unavailable'); expect(preserve(decoded)).toBe(original);
        }
    });
    it('does not retain arbitrary provider content in validated state', () => {
        const state = populated(); const raw = { ...state, providerText: 'secret provider content', registry: [{ ...state.registry[0], source: { ...state.registry[0].source, providerText: 'more secret' } }] };
        const decoded = decode(raw, binding); expect(decoded.status).toBe('ready'); expect(JSON.stringify(preserve(decoded))).not.toContain('providerText');
    });
});
