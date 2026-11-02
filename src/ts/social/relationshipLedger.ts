/** Explicit game evidence only. No inference from post counts, sentiment or romance. */
export const metrics = ['familiarity', 'trust', 'affinity', 'tension'] as const;
export type Metric = (typeof metrics)[number];
export type Scores = Record<Metric, number | null>;
export interface Identity { kind: 'persona' | 'character'; id: string }
export interface RelationshipKey { worldId: string; subject: Identity; other: Identity }
export type Change = { set: number } | { delta: number };
export interface RelationshipEvent {
    id: string;
    relation: RelationshipKey;
    sourceId: string;
    sourceEventId: string; // Stable atomic source event (e.g. message id within a DM thread)
    actionType: string;
    time: number; // UTC Unix milliseconds
    scope: 'public' | 'private';
    knownBy: Identity[];
    summary: string;
    description?: string; // Explicit qualitative relationship state, never inferred from scores.
    changes: Partial<Record<Metric, Change>>;
}
export interface RelationshipLedger { version: 1; events: RelationshipEvent[] }
export type Audience = { mode: 'public' } | { mode: 'participant'; viewer: Identity };
export interface SourceAccess {
    relation: RelationshipKey;
    sourceId: string;
    sourceEventId: string;
    actionType: string;
    scope: 'public' | 'private';
    audience: Audience;
}
export interface VisibleEvent {
    id: string;
    sourceId: string;
    actionType: string;
    time: number;
    scope: 'public' | 'private';
    summary: string;
    effects: Partial<Record<Metric, { before: number | null; after: number }>>;
}
export interface RelationshipView {
    relation: RelationshipKey;
    scores: Scores;
    description: string;
    events: VisibleEvent[];
}
const unknownScores = (): Scores => ({ familiarity: null, trust: null, affinity: null, tension: null });
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const token = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 500;
const cleanIdentity = (identity: Identity): Identity => ({ kind: identity.kind, id: identity.id });
const cleanKey = (key: RelationshipKey): RelationshipKey => ({ worldId: key.worldId, subject: cleanIdentity(key.subject), other: cleanIdentity(key.other) });
const same = (a: Identity, b: Identity) => a.kind === b.kind && a.id === b.id;
function assertIdentity(value: Identity): void {
    if (!value || !['persona', 'character'].includes(value.kind) || !token(value.id)) throw new Error('Invalid identity');
}
export function relationshipId(key: RelationshipKey): string {
    if (!key || !token(key.worldId)) throw new Error('Invalid world');
    assertIdentity(key.subject);
    assertIdentity(key.other);
    if (same(key.subject, key.other)) throw new Error('A relationship needs two distinct identities');
    return JSON.stringify([key.worldId, key.subject.kind, key.subject.id, key.other.kind, key.other.id]);
}
function normalize(raw: RelationshipEvent): RelationshipEvent {
    relationshipId(raw?.relation);
    if (!token(raw.id) || !token(raw.sourceId) || !token(raw.sourceEventId) || !token(raw.actionType)) throw new Error('Missing event provenance');
    if (!Number.isSafeInteger(raw.time) || raw.time < 0 || raw.time > 8640000000000000) throw new Error('Invalid event time');
    if (raw.scope !== 'public' && raw.scope !== 'private') throw new Error('Invalid scope');
    if (typeof raw.summary !== 'string' || !raw.summary.trim() || raw.summary.length > 2000) throw new Error('Missing explanation');
    if (raw.description !== undefined && (typeof raw.description !== 'string' || !raw.description.trim() || raw.description.length > 2000)) throw new Error('Invalid description');
    if (!Array.isArray(raw.knownBy)) throw new Error('Missing knownBy allowlist');
    const identities = new Map<string, Identity>();
    for (const identity of raw.knownBy) {
        assertIdentity(identity);
        if (raw.scope === 'private' && !same(identity, raw.relation.subject) && !same(identity, raw.relation.other)) throw new Error('Private allowlist must contain only participants');
        identities.set(JSON.stringify([identity.kind, identity.id]), { kind: identity.kind, id: identity.id });
    }
    if (raw.scope === 'private' && identities.size === 0) throw new Error('Private evidence needs authorized participants');
    if (!raw.changes || typeof raw.changes !== 'object' || Array.isArray(raw.changes)) throw new Error('Invalid changes');
    const changes: RelationshipEvent['changes'] = {};
    if (Object.keys(raw.changes).some(name => !metrics.includes(name as Metric))) throw new Error('Unknown metric');
    for (const name of metrics) {
        const change = raw.changes[name];
        if (change === undefined) continue;
        if (!change || typeof change !== 'object' || Object.keys(change).length !== 1) throw new Error('Invalid change');
        if ('set' in change && Number.isFinite(change.set) && change.set >= 0 && change.set <= 100) changes[name as Metric] = { set: change.set };
        else if ('delta' in change && Number.isFinite(change.delta) && Math.abs(change.delta) <= 20) changes[name as Metric] = { delta: change.delta };
        else throw new Error('Sets must be 0–100; deltas must be between -20 and 20');
    }
    if (!Object.keys(changes).length && !raw.description) throw new Error('An event needs a change or qualitative description');
    // Construct a whitelist, so unrelated source data cannot enter serialization/projections.
    return {
        id: raw.id, relation: cleanKey(raw.relation), sourceId: raw.sourceId, sourceEventId: raw.sourceEventId, actionType: raw.actionType,
        time: raw.time, scope: raw.scope,
        knownBy: [...identities.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([, identity]) => identity),
        summary: raw.summary, ...(raw.description === undefined ? {} : { description: raw.description }), changes,
    };
}
const sourceActionId = (event: RelationshipEvent) => JSON.stringify([relationshipId(event.relation), event.sourceId, event.sourceEventId, event.actionType]);
const fingerprint = (event: RelationshipEvent) => JSON.stringify({ ...event, id: undefined });
const chronological = (a: RelationshipEvent, b: RelationshipEvent) => a.time - b.time || (sourceActionId(a) < sourceActionId(b) ? -1 : sourceActionId(a) > sourceActionId(b) ? 1 : 0);
export const createRelationshipLedger = (): RelationshipLedger => ({ version: 1, events: [] });
/** Immutable ingestion. Same id or canonical source event/action cannot double-apply, even after reload. */
export function appendRelationshipEvent(ledger: RelationshipLedger, raw: RelationshipEvent): RelationshipLedger {
    if (ledger.version !== 1) throw new Error('Unsupported ledger version');
    const event = normalize(raw);
    const previous = ledger.events.find(item => item.id === event.id || sourceActionId(item) === sourceActionId(event));
    if (previous) {
        if (fingerprint(previous) !== fingerprint(event)) throw new Error('Conflicting duplicate event');
        return ledger;
    }
    return { version: 1, events: [...ledger.events, event].sort(chronological) };
}
export function restoreRelationshipLedger(serialized: string): RelationshipLedger {
    const raw = JSON.parse(serialized);
    if (!raw || raw.version !== 1 || !Array.isArray(raw.events)) throw new Error('Invalid ledger');
    return raw.events.reduce((ledger: RelationshipLedger, event: RelationshipEvent) => appendRelationshipEvent(ledger, event), createRelationshipLedger());
}
export function serializeRelationshipLedger(ledger: RelationshipLedger): string {
    // Validate and whitelist on persistence as well as restoration.
    return JSON.stringify(restoreRelationshipLedger(JSON.stringify(ledger)));
}
/** MUST run at the access boundary. Never deliver the full ledger to an unauthorized client. */
export function projectRelationship(
    ledger: RelationshipLedger, relation: RelationshipKey, audience: Audience,
    canAccessSource: (source: SourceAccess) => boolean,
): RelationshipView {
    const id = relationshipId(relation);
    if (audience.mode === 'participant') assertIdentity(audience.viewer);
    const scores = unknownScores();
    let description = 'Not enough interactions';
    const events: VisibleEvent[] = [];
    const visible = ledger.events.filter(event => {
        if (relationshipId(event.relation) !== id) return false;
        if (event.scope === 'private' && (audience.mode !== 'participant'
            || (!same(audience.viewer, relation.subject) && !same(audience.viewer, relation.other))
            || !event.knownBy.some(identity => same(identity, audience.viewer)))) return false;
        // Fail closed: missing source, deletion or revoked access removes all its influence.
        try { return canAccessSource({ relation: cleanKey(relation), sourceId: event.sourceId, sourceEventId: event.sourceEventId, actionType: event.actionType, scope: event.scope, audience: clone(audience) }) === true; }
        catch { return false; }
    }).sort(chronological);
    for (const event of visible) {
        const effects: VisibleEvent['effects'] = {};
        for (const metric of metrics) {
            const change = event.changes[metric];
            if (!change) continue;
            const before = scores[metric];
            // Unknown has no invented baseline. Adapters must send an explicit set first.
            if ('delta' in change && before === null) continue;
            const after = 'set' in change ? change.set : Math.min(100, Math.max(0, before! + change.delta));
            scores[metric] = after;
            effects[metric] = { before, after };
        }
        if (event.description) description = event.description;
        events.push({ id: event.id, sourceId: event.sourceId, actionType: event.actionType, time: event.time, scope: event.scope, summary: event.summary, effects });
    }
    return { relation: cleanKey(relation), scores, description, events: events.slice(-3).reverse() };
}
