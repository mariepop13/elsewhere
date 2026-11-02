<script lang="ts">
    import { metrics, type Metric, type RelationshipView, type Identity } from '../../ts/social/relationshipLedger';
    import type { ExplicitRelationshipCommand } from '../../ts/social/relationshipEventAdapter';
    import type { SourceReference } from '../../ts/social/relationshipSourceAccess';
    let { view, source, scope, knownBy, createCommandId, oncommand, canRecord = true }: {
        view: RelationshipView; source: SourceReference; scope: 'public' | 'private'; knownBy: Identity[];
        createCommandId: () => string; oncommand: (command: ExplicitRelationshipCommand) => void | Promise<void>; canRecord?: boolean;
    } = $props();
    const labels: Record<Metric, string> = { familiarity: 'Familiarity', trust: 'Trust', affinity: 'Affinity', tension: 'Tension' };
    const empty = (): Record<Metric, string> => ({ familiarity: '', trust: '', affinity: '', tension: '' });
    let mode = $state<ExplicitRelationshipCommand['actionType']>('relationship.noted');
    let values = $state(empty());
    let explanation = $state('');
    let description = $state('');
    let pending = $state<ExplicitRelationshipCommand | null>(null);
    let busy = $state(false);
    let error = $state('');
    let status = $state('');
    function edited() { pending = null; error = ''; status = ''; }
    async function submit(event: SubmitEvent) {
        event.preventDefault();
        if (busy || !canRecord) return;
        error = ''; status = '';
        try {
            if (pending && (JSON.stringify(pending.relation) !== JSON.stringify(view.relation) || JSON.stringify(pending.source) !== JSON.stringify(source) || pending.scope !== scope || JSON.stringify(pending.knownBy) !== JSON.stringify(knownBy))) pending = null;
            if (!explanation.trim()) throw new Error('Explain why you are recording this interaction.');
            if (mode === 'relationship.noted' && !description.trim()) throw new Error('Write a qualitative relationship note.');
            const chosen: Partial<Record<Metric, number>> = {};
            if (mode !== 'relationship.noted') {
                for (const metric of metrics) {
                    if (!values[metric].trim()) continue;
                    const value = Number(values[metric]);
                    const minimum = mode === 'relationship.initialized' ? 0 : -20;
                    const maximum = mode === 'relationship.initialized' ? 100 : 20;
                    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${labels[metric]} must be between ${minimum} and ${maximum}.`);
                    if (!pending && mode === 'relationship.initialized' && view.scores[metric] !== null) throw new Error(`${labels[metric]} is already established. Choose Record a change.`);
                    if (!pending && mode === 'relationship.adjusted' && view.scores[metric] === null) throw new Error(`${labels[metric]}: Not enough interactions. Establish a starting state first.`);
                    chosen[metric] = value;
                }
                if (!Object.keys(chosen).length) throw new Error('Choose at least one metric. Blank metrics stay unchanged.');
            }
            // A failed retry reuses the same ID/time. Edits or a changed source start a new submission.
            if (pending && (JSON.stringify(pending.relation) !== JSON.stringify(view.relation) || JSON.stringify(pending.source) !== JSON.stringify(source) || pending.scope !== scope || JSON.stringify(pending.knownBy) !== JSON.stringify(knownBy))) pending = null;
            if (!pending) {
                const base = { commandId: createCommandId(), relation: view.relation, source, time: Date.now(), scope, knownBy, explanation: explanation.trim(), ...(description.trim() ? { description: description.trim() } : {}) };
                pending = mode === 'relationship.noted' ? { ...base, actionType: mode, description: description.trim() } : { ...base, actionType: mode, values: chosen };
            }
            busy = true;
            const command = pending;
            if (!command) throw new Error('Missing explicit submission.');
            await oncommand(JSON.parse(JSON.stringify(command)) as ExplicitRelationshipCommand);
            pending = null; values = empty(); explanation = ''; description = '';
            status = 'Interaction recorded.';
        } catch (failure) { error = failure instanceof Error ? failure.message : 'Could not record this interaction. Retry when the source is available.'; }
        finally { busy = false; }
    }
</script>

<form class="relationship-editor" onsubmit={submit}>
    <h3>Record an interaction</h3>
    <p>Choose an explicit starting state, change, or note. These percentages are game scores. Affinity does not imply romance.</p>
    {#if !canRecord}<p role="status">Relationship recording is unavailable for this source or viewpoint.</p>{/if}
    <fieldset disabled={busy || !canRecord}>
        <legend class="sr-only">Explicit relationship action</legend>
        <label>Action<select value={mode} onchange={(event) => { mode = event.currentTarget.value as ExplicitRelationshipCommand['actionType']; edited(); }}><option value="relationship.noted">Add a note</option><option value="relationship.initialized">Establish starting state</option><option value="relationship.adjusted">Record a change</option></select></label>
        <p class="source-note">Linked to {source.kind === 'dm_message' ? 'a specific DM message' : source.kind === 'authored_note' ? 'your authored note' : 'a specific public interaction'} · {scope === 'private' ? 'Private' : 'Public'}</p>
        {#if mode !== 'relationship.noted'}
            <div class="metric-inputs">
                {#each metrics as metric}
                    <label>{labels[metric]}<span class="current">{view.scores[metric] === null ? 'Not enough interactions' : `Current: ${view.scores[metric]}%`}</span><input type="number" step="any" min={mode === 'relationship.initialized' ? 0 : -20} max={mode === 'relationship.initialized' ? 100 : 20} placeholder={mode === 'relationship.initialized' ? 'Leave unknown' : 'Leave unchanged'} value={values[metric]} oninput={(event) => { values[metric] = event.currentTarget.value; edited(); }} /></label>
                {/each}
            </div>
            <p class="source-note">{mode === 'relationship.initialized' ? 'Set only the starting scores you choose (0–100).' : 'Changes range from −20 to +20 and require an established score.'}</p>
        {/if}
        <label>Relationship description{mode === 'relationship.noted' ? ' (required)' : ' (optional)'}<textarea rows="3" maxlength="2000" required={mode === 'relationship.noted'} bind:value={description} oninput={edited} placeholder="Describe their relationship in your own words."></textarea></label>
        <label>Explanation<textarea rows="2" maxlength="2000" required bind:value={explanation} oninput={edited} placeholder="What happened, and why does it matter?"></textarea></label>
        <button class="ew-button" type="submit">{busy ? 'Recording…' : pending ? 'Retry recording' : 'Record interaction'}</button>
    </fieldset>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if status}<p role="status">{status}</p>{/if}
</form>

<style>
    .relationship-editor { color: var(--risu-theme-textcolor); padding: 20px; border: 1px solid var(--risu-theme-borderc); border-radius: 12px; background: var(--risu-theme-surface-elevated); }
    h3 { font-weight: 600; font-size: 15px; margin: 0 0 12px; }
    p { font-size: 12px; line-height: 1.6; color: var(--risu-theme-textcolor2); }
    fieldset { border: 0; padding: 0; margin: 16px 0 0; min-width: 0; }
    label { display: flex; flex-direction: column; gap: 7px; font-size: 12px; margin: 14px 0; }
    input, select, textarea { width: 100%; padding: 10px; border: 1px solid var(--risu-theme-borderc); border-radius: 8px; color: var(--risu-theme-textcolor); background: var(--risu-theme-surface-subtle); }
    textarea { resize: vertical; }
    .metric-inputs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 18px; }
    .current, .source-note { color: var(--risu-theme-textcolor2); font-size: 11px; }
    .error { color: var(--risu-theme-textcolor); }
    button { min-height: 40px; padding: 8px 12px; margin-top: 12px; border: 1px solid var(--risu-theme-borderc); border-radius: 8px; color: var(--risu-theme-textcolor); background: var(--risu-theme-surface-subtle); font-size: 12px; }
    :is(input, select, textarea, button):focus-visible { outline: 2px solid var(--risu-theme-focus); outline-offset: 3px; }
    fieldset:disabled { opacity: .6; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    @media (max-width: 480px) { .metric-inputs { grid-template-columns: 1fr; } .relationship-editor { padding: 17px; } }
</style>
