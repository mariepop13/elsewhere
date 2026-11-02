<script lang="ts">
    import { metrics, type Metric, type RelationshipView, type VisibleEvent } from '../../ts/social/relationshipLedger';
    let { view, onsource }: { view: RelationshipView; onsource?: (event: VisibleEvent) => void } = $props();
    const labels: Record<Metric, string> = { familiarity: 'Familiarity', trust: 'Trust', affinity: 'Affinity', tension: 'Tension' };
    const date = (time: number) => new Date(time).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const effect = (before: number | null, after: number) => before === null ? `Established at ${after}%` : `${before}% → ${after}%`;
</script>

<div class="relationship-details">
    <p class="description">{view.description}</p>
    <p class="note">Game scores shaped by explicit interactions.</p>
    <div class="gauges">
        {#each metrics as metric}
            <div class="gauge">
                <div class="gauge-heading"><span>{labels[metric]}</span><strong>{view.scores[metric] === null ? 'Not enough interactions' : `${view.scores[metric]}%`}</strong></div>
                {#if view.scores[metric] !== null}
                    <meter min="0" max="100" value={view.scores[metric]} aria-label={labels[metric]}>{view.scores[metric]}%</meter>
                {:else}
                    <div class="unknown-track" aria-hidden="true"></div>
                {/if}
            </div>
        {/each}
    </div>
    <h3>Recent interactions</h3>
    {#if view.events.length === 0}
        <p class="note">Not enough interactions</p>
    {:else}
        <ol>
            {#each view.events.slice(0, 3) as event (event.id)}
                <li>
                    <div class="event-meta"><time datetime={new Date(event.time).toISOString()}>{date(event.time)}</time><span>{event.scope === 'private' ? 'Private' : 'Public'}</span></div>
                    <p>{event.summary}</p>
                    {#each metrics as metric}
                        {@const change = event.effects[metric]}
                        {#if change}<small>{labels[metric]} · {effect(change.before, change.after)}</small>{/if}
                    {/each}
                    {#if onsource}<button type="button" class="ew-accent" onclick={() => onsource?.(event)}>View source<span class="sr-only">: {event.summary}</span></button>{/if}
                </li>
            {/each}
        </ol>
    {/if}
</div>

<style>
    .relationship-details { color: var(--risu-theme-textcolor); font-size: 13px; }
    .description { line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
    .note, .event-meta, small { color: var(--risu-theme-textcolor2); font-size: 11px; }
    .note { margin: 8px 0 18px; }
    .gauges { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 24px; }
    .gauge-heading { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 8px; margin-bottom: 8px; }
    .gauge-heading strong { font-size: 11px; font-weight: 500; color: var(--risu-theme-textcolor2); }
    meter, .unknown-track { width: 100%; height: 7px; display: block; border: none; border-radius: 8px; background: var(--risu-theme-surface-subtle); }
    meter { accent-color: var(--risu-theme-action-primary); }
    meter::-webkit-meter-bar { border: none; background: var(--risu-theme-surface-subtle); border-radius: 8px; }
    meter::-webkit-meter-optimum-value { background: var(--risu-theme-action-primary); border-radius: 8px; }
    meter::-moz-meter-bar { background: var(--risu-theme-action-primary); border-radius: 8px; }
    h3 { font-weight: 600; margin: 24px 0 12px; }
    ol { padding: 0; margin: 0; list-style: none; }
    li { padding: 12px 0; border-top: 1px solid var(--risu-theme-borderc); }
    li p { margin: 8px 0; line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
    small { display: block; line-height: 1.8; }
    .event-meta { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    button { min-height: 36px; padding: 4px 0; font-size: 11px; color: var(--risu-theme-action-primary); }
    button:focus-visible { outline: 2px solid var(--risu-theme-focus); outline-offset: 4px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    @media (max-width: 480px) { .gauges { grid-template-columns: 1fr; } }
</style>
