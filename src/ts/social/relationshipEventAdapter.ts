import { appendRelationshipEvent, metrics, relationshipId, type Identity, type Metric, type RelationshipEvent, type RelationshipKey, type RelationshipLedger } from './relationshipLedger';
import { canonicalEventId, normalizeSource, projectAuthorizedRelationship, sourceAccessible, sourceTuple, type AccessContext, type Provenance, type SourceReference, type SourceSnapshot } from './relationshipSourceAccess';
interface BaseCommand { commandId: string; relation: RelationshipKey; source: SourceReference; time: number; scope: 'public' | 'private'; knownBy: Identity[]; explanation: string; description?: string }
export type ExplicitRelationshipCommand =
    | (BaseCommand & { actionType: 'relationship.initialized'; values: Partial<Record<Metric, number>> })
    | (BaseCommand & { actionType: 'relationship.adjusted'; values: Partial<Record<Metric, number>> })
    | (BaseCommand & { actionType: 'relationship.noted'; description: string; values?: never });
export interface AdapterContext { ledger: RelationshipLedger; registry: Provenance[]; access: AccessContext; sources: SourceSnapshot[] }
export interface PreparedRelationshipEvent { event: RelationshipEvent; provenance: Provenance }
/** Explicit commands only; never called from likes, post count, sentiment or page load. */
export function prepareRelationshipEvent(command: ExplicitRelationshipCommand, context: AdapterContext): PreparedRelationshipEvent {
    if (!command || !['relationship.initialized', 'relationship.adjusted', 'relationship.noted'].includes(command.actionType)) throw new Error('Unsupported explicit action');
    relationshipId(command.relation);
    if (command.relation.subject.kind !== 'persona' || command.relation.other.kind !== 'character') throw new Error('First slice supports persona toward individual character');
    if (context.access.audience.mode !== 'participant' || context.access.audience.viewer.kind !== 'persona' || context.access.audience.viewer.id !== command.relation.subject.id || context.access.personaId !== command.relation.subject.id) throw new Error('Explicit commands require the trusted subject viewpoint');
    const source = normalizeSource(command.source);
    if (!sourceAccessible(source, command.relation, command.scope, command.knownBy, context.access, context.sources)) throw new Error('Source unavailable for this viewpoint');
    const tuple = sourceTuple(source, command.commandId);
    const id = canonicalEventId(command.relation, source, command.commandId, command.actionType);
    const changes: RelationshipEvent['changes'] = {};
    if (command.actionType === 'relationship.noted') {
        if ('values' in command || !command.description?.trim()) throw new Error('A note requires a description and no numerical changes');
    } else {
        if (!command.values || !Object.keys(command.values).length || Object.keys(command.values).some(key => !metrics.includes(key as Metric))) throw new Error('Choose supported metric values');
        for (const metric of metrics) {
            const value = command.values[metric];
            if (value === undefined) continue;
            if (!Number.isFinite(value)) throw new Error('Finite game score required');
            changes[metric] = command.actionType === 'relationship.initialized' ? { set: value } : { delta: value };
        }
    }
    const event: RelationshipEvent = { id, relation: command.relation, ...tuple, actionType: command.actionType, time: command.time, scope: command.scope, knownBy: command.knownBy, summary: command.explanation, ...(command.description === undefined ? {} : { description: command.description }), changes };
    // Validates explanation/time/allowlist/ranges, and surfaces conflicting retries first.
    const next = appendRelationshipEvent(context.ledger, event);
    if (next !== context.ledger) {
        // Baseline checks replay only evidence preceding this event, in this exact scope.
        // Private evidence must never establish a public baseline.
        const before = { version: 1 as const, events: next.events.slice(0, next.events.findIndex(item => item.id === id)) };
        const access = command.scope === 'public' ? { ...context.access, audience: { mode: 'public' as const } } : context.access;
        const view = projectAuthorizedRelationship(before, context.registry, command.relation, access, context.sources);
        for (const metric of metrics) if (changes[metric]) {
            if (command.actionType === 'relationship.initialized' && view.scores[metric] !== null) throw new Error('Metric already established; record a bounded adjustment');
            if (command.actionType === 'relationship.adjusted' && view.scores[metric] === null) throw new Error('Not enough interactions: establish a visible baseline first');
        }
    }
    // Return ledger-whitelisted copy, never retain caller/provider extras.
    const accepted = next.events.find(item => item.id === id)!;
    return { event: accepted, provenance: { eventId: accepted.id, commandId: command.commandId, source } };
}
export function recordPreparedEvent(context: Pick<AdapterContext, 'ledger' | 'registry'>, prepared: PreparedRelationshipEvent): { ledger: RelationshipLedger; registry: Provenance[] } {
    const ledger = appendRelationshipEvent(context.ledger, prepared.event);
    const existing = context.registry.find(record => record.eventId === prepared.event.id);
    if (existing && JSON.stringify(existing) !== JSON.stringify(prepared.provenance)) throw new Error('Conflicting provenance');
    return { ledger, registry: existing ? context.registry : [...context.registry, prepared.provenance] };
}
