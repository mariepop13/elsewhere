import { createRelationshipLedger, restoreRelationshipLedger, serializeRelationshipLedger, type RelationshipLedger } from './relationshipLedger';
import { normalizeSource, sourceTuple, validateBinding, type Binding, type Provenance } from './relationshipSourceAccess';
export interface RelationshipState extends Binding { version: 1; ledger: RelationshipLedger; registry: Provenance[] }
export type DecodedRelationshipState =
    | { status: 'missing'; original: undefined }
    | { status: 'ready'; state: RelationshipState; original: unknown }
    | { status: 'unavailable'; reason: 'unsupported' | 'invalid' | 'binding-mismatch'; original: unknown };
export function createRelationshipState(binding: Binding): RelationshipState {
    return { version: 1, ...validateBinding(binding), ledger: createRelationshipLedger(), registry: [] };
}
function validate(raw: RelationshipState): RelationshipState {
    const binding = validateBinding(raw);
    const ledger = restoreRelationshipLedger(JSON.stringify(raw.ledger));
    for (const event of ledger.events) {
        if (event.relation.subject.kind !== 'persona' || event.relation.other.kind !== 'character' || !['relationship.initialized', 'relationship.adjusted', 'relationship.noted'].includes(event.actionType)) throw new Error('Unsupported persisted action or direction');
        const changes = Object.values(event.changes);
        if (event.actionType === 'relationship.noted' ? (changes.length !== 0 || !event.description) : (changes.length === 0 || changes.some(change => event.actionType === 'relationship.initialized' ? !('set' in change) : !('delta' in change)))) throw new Error('Invalid persisted action effects');
    }
    if (!Array.isArray(raw.registry)) throw new Error('Missing provenance registry');
    const seen = new Set<string>();
    const registry = raw.registry.map(entry => {
        if (!entry || typeof entry.eventId !== 'string' || seen.has(entry.eventId)) throw new Error('Invalid/duplicate provenance');
        seen.add(entry.eventId);
        const source = normalizeSource(entry.source);
        if (source.saveId !== binding.saveId || source.worldId !== binding.worldId || (source.kind === 'authored_note' && source.ownerId !== binding.ownerId)) throw new Error('Invalid provenance binding');
        const tuple = sourceTuple(source, entry.commandId);
        const event = ledger.events.find(e => e.id === entry.eventId);
        if (!event || event.relation.worldId !== binding.worldId || event.sourceId !== tuple.sourceId || event.sourceEventId !== tuple.sourceEventId || event.id !== entry.commandId) throw new Error('Mismatched provenance event');
        if ((source.kind === 'dm_message' || source.kind === 'authored_note') && event.scope !== 'private') throw new Error('Private source has public scope');
        if (!source.participants.some(i => i.kind === event.relation.subject.kind && i.id === event.relation.subject.id) || !source.participants.some(i => i.kind === event.relation.other.kind && i.id === event.relation.other.id)) throw new Error('Mismatched participants');
        return { eventId: entry.eventId, commandId: entry.commandId, source };
    });
    if (ledger.events.some(e => !seen.has(e.id))) throw new Error('Missing event provenance');
    return { version: 1, ...binding, ledger, registry };
}
/** Native load callers receive an unavailable result, never a startup exception or empty reset. */
export function decodeRelationshipState(original: unknown, expected: Binding): DecodedRelationshipState {
    if (original === undefined) return { status: 'missing', original: undefined };
    try {
        const raw = typeof original === 'string' ? JSON.parse(original) : original;
        if (!raw || typeof raw !== 'object') throw new Error('Invalid slot');
        if (raw.version !== 1) return { status: 'unavailable', reason: 'unsupported', original };
        const state = validate(raw);
        const binding = validateBinding(expected);
        if (state.saveId !== binding.saveId || state.worldId !== binding.worldId || state.ownerId !== binding.ownerId) return { status: 'unavailable', reason: 'binding-mismatch', original };
        return { status: 'ready', state, original };
    } catch { return { status: 'unavailable', reason: 'invalid', original }; }
}
export function encodeRelationshipState(state: RelationshipState): string {
    if (state.version !== 1) throw new Error('Unsupported state version');
    const safe = validate(state);
    return JSON.stringify({ ...safe, ledger: JSON.parse(serializeRelationshipLedger(safe.ledger)) });
}
/** On unsupported/corrupt state, native save must write back exactly the original opaque value. */
export function preserveRelationshipSlot(decoded: DecodedRelationshipState): unknown {
    return decoded.status === 'ready' ? JSON.parse(encodeRelationshipState(decoded.state)) : decoded.original;
}
