import { describe, expect, it } from 'vitest';
import { appendRelationshipEvent as append, createRelationshipLedger as create, projectRelationship as project, restoreRelationshipLedger as restore, serializeRelationshipLedger as serialize, relationshipId, type RelationshipEvent, type RelationshipKey } from './relationshipLedger';
const A = { kind: 'persona', id: 'A' } as const;
const B = { kind: 'character', id: 'B' } as const;
const C = { kind: 'character', id: 'C' } as const;
const key: RelationshipKey = { worldId: 'bella-felix', subject: A, other: B };
const publicAudience = { mode: 'public' } as const;
const allow = () => true;
const event = (override: Partial<RelationshipEvent> = {}): RelationshipEvent => ({
    id: 'dm-message-1:confide', relation: key, sourceId: 'dm:A:B', sourceEventId: 'message-1', actionType: 'confide', time: 1000,
    scope: 'private', knownBy: [A, B], summary: 'A confided a personal concern to B.',
    description: 'A has begun opening up to B in private.', changes: { trust: { set: 35 } }, ...override,
});
describe('explicit relationship ledger', () => {
    it('keeps unknown scores unknown, never substitutes 50 or infers romance', () => {
        expect(project(create(), key, publicAudience, allow).scores).toEqual({ familiarity: null, trust: null, affinity: null, tension: null });
        const view = project(append(create(), event({ scope: 'public', knownBy: [], description: undefined, changes: { familiarity: { set: 10 } } })), key, publicAudience, allow);
        expect(view.scores).toEqual({ familiarity: 10, trust: null, affinity: null, tension: null });
        expect(view.description).toBe('Not enough interactions');
    });
    it('A confiding to B changes only authorized private views, leaving C/public byte-identical', () => {
        const ledger = append(create(), event());
        for (const viewer of [A, B]) {
            const view = project(ledger, key, { mode: 'participant', viewer }, allow);
            expect(view.scores.trust).toBe(35);
            expect(view.description).toContain('opening up');
            expect(view.events[0].sourceId).toBe('dm:A:B');
        }
        expect(project(ledger, key, publicAudience, allow)).toEqual(project(create(), key, publicAudience, allow));
        expect(project(ledger, key, { mode: 'participant', viewer: C }, allow)).toEqual(project(create(), key, { mode: 'participant', viewer: C }, allow));
    });
    it('honors a narrower allowlist even for a participant and rejects outsiders in private knownBy', () => {
        const ledger = append(create(), event({ knownBy: [A] }));
        expect(project(ledger, key, { mode: 'participant', viewer: B }, allow).events).toEqual([]);
        expect(() => append(create(), event({ knownBy: [A, B, C] }))).toThrow('only participants');
    });
    it('never calls the source resolver for private events in public/outsider projections', () => {
        let calls = 0;
        const access = () => { calls++; return true; };
        const ledger = append(create(), event());
        project(ledger, key, publicAudience, access);
        project(ledger, key, { mode: 'participant', viewer: C }, access);
        expect(calls).toBe(0);
    });
    it('filters source access before deriving scores, descriptions, recent events and existence', () => {
        const ledger = append(create(), event({ scope: 'public', knownBy: [] }));
        const empty = project(create(), key, publicAudience, allow);
        expect(project(ledger, key, publicAudience, () => false)).toEqual(empty);
        expect(project(ledger, key, publicAudience, () => { throw new Error('deleted'); })).toEqual(empty);
    });
    it('keeps public projection identical after a private change to an existing public relationship', () => {
        const publicLedger = append(create(), event({ id: 'public', sourceId: 'post-1', scope: 'public', knownBy: [], description: 'They have met publicly.', changes: { trust: { set: 10 } } }));
        const combined = append(publicLedger, event({ time: 2000, changes: { trust: { delta: 15 } } }));
        expect(project(combined, key, publicAudience, allow)).toEqual(project(publicLedger, key, publicAudience, allow));
        expect(project(combined, key, { mode: 'participant', viewer: A }, allow).scores.trust).toBe(25);
    });
    it('deduplicates by event id and canonical source-event/action after serialization', () => {
        const first = append(create(), event());
        expect(append(first, event())).toBe(first);
        expect(append(first, event({ id: 'transport-retry-id' }))).toBe(first);
        const reloaded = restore(serialize(first));
        expect(append(reloaded, event()).events).toHaveLength(1);
        expect(project(reloaded, key, { mode: 'participant', viewer: A }, allow)).toEqual(project(first, key, { mode: 'participant', viewer: A }, allow));
        expect(() => append(first, event({ changes: { trust: { set: 90 } } }))).toThrow('Conflicting');
    });
    it('permits distinct atomic source events within the same thread, without silent loss', () => {
        const ledger = append(append(create(), event()), event({ id: 'event-2', sourceEventId: 'message-2', time: 2000, changes: { trust: { delta: 5 } } }));
        expect(ledger.events).toHaveLength(2);
        expect(project(ledger, key, { mode: 'participant', viewer: A }, allow).scores.trust).toBe(40);
    });
    it('isolates worlds, direction and persona/character ids', () => {
        const ledger = append(create(), event({ scope: 'public', knownBy: [] }));
        for (const relation of [{ ...key, worldId: 'other-world' }, { ...key, subject: B, other: A }, { ...key, subject: { kind: 'character', id: 'A' } as const }]) {
            expect(relationshipId(relation)).not.toBe(relationshipId(key));
            expect(project(ledger, relation, publicAudience, allow).scores.trust).toBeNull();
        }
    });
    it('bounds deltas and scores, ignores deltas on unknown and replays time order', () => {
        const initial = event({ scope: 'public', knownBy: [], changes: { familiarity: { set: 95 } } });
        const later = event({ id: 'later', sourceEventId: 'message-2', time: 2000, scope: 'public', knownBy: [], changes: { familiarity: { delta: 20 }, tension: { delta: 5 } } });
        const view = project(append(append(create(), later), initial), key, publicAudience, allow);
        expect(view.scores.familiarity).toBe(100);
        expect(view.scores.tension).toBeNull();
        expect(view.events[0].effects.familiarity).toEqual({ before: 95, after: 100 });
        expect(() => append(create(), event({ changes: { trust: { delta: 21 } } }))).toThrow();
        expect(() => append(create(), event({ changes: { trust: { set: -1 } } }))).toThrow();
    });
    it('returns the last three authorized events without private displacement', () => {
        let ledger = create();
        for (let i = 0; i < 5; i++) ledger = append(ledger, event({ id: `public-${i}`, sourceEventId: `message-${i}`, time: i, scope: 'public', knownBy: [], changes: { familiarity: { set: i } } }));
        ledger = append(ledger, event({ id: 'secret', sourceEventId: 'secret', time: 9999 }));
        expect(project(ledger, key, publicAudience, allow).events.map(e => e.id)).toEqual(['public-4', 'public-3', 'public-2']);
    });
    it('rejects malformed provenance, schema versions, scope and nonfinite scores', () => {
        for (const override of [{ sourceId: '' }, { sourceEventId: '' }, { actionType: '' }, { summary: '' }, { time: NaN }, { knownBy: [] }, { scope: 'friends' }]) {
            expect(() => append(create(), event(override as Partial<RelationshipEvent>))).toThrow();
        }
        expect(() => restore('{"version":2,"events":[]}')).toThrow();
        expect(() => append(create(), event({ changes: { trust: { set: Infinity } } }))).toThrow();
    });
    it('does not mutate inputs or retain injected metadata', () => {
        const input = event();
        const ledger = append(create(), input);
        input.changes.trust = { set: 90 };
        expect(project(ledger, key, { mode: 'participant', viewer: A }, allow).scores.trust).toBe(35);
        expect(serialize(ledger)).not.toContain('effects');
    });
});
