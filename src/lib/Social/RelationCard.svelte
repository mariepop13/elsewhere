<script lang="ts">
    import type { RelationshipView, VisibleEvent } from '../../ts/social/relationshipLedger';
    import RelationshipDetails from './RelationshipDetails.svelte';
    // Only receive an access-filtered projection. Do not pass raw ledgers or source text.
    let { view, subjectName, otherName, onsource }: {
        view: RelationshipView;
        subjectName: string;
        otherName: string;
        onsource?: (event: VisibleEvent) => void;
    } = $props();
</script>

<article class="ew-panel relation-card" aria-label={`Relationship: ${subjectName} and ${otherName}`}>
    <header><span class="eyebrow">RELATIONSHIP</span><h2>{subjectName} <span aria-label="toward">→</span> {otherName}</h2></header>
    <RelationshipDetails {view} {onsource} />
</article>

<style>
    .relation-card { padding: 24px; border: 1px solid var(--risu-theme-borderc); border-radius: 14px; background: var(--risu-theme-surface-elevated); color: var(--risu-theme-textcolor); min-width: 0; }
    header { margin-bottom: 18px; }
    .eyebrow { color: var(--risu-theme-textcolor2); font-size: 9px; letter-spacing: .15em; }
    h2 { font-size: 18px; font-weight: 600; margin: 8px 0 0; overflow-wrap: anywhere; }
    h2 span { color: var(--risu-theme-textcolor2); }
    @media (max-width: 480px) { .relation-card { padding: 17px; } }
</style>
