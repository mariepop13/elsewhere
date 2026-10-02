<script lang="ts">
    import { untrack } from 'svelte';
    import TokenBudgetControl from '../../lib/Setting/TokenBudgetControl.svelte';
    let { initial = 4096, ceiling = 128000, minimum = 1, disabled = false }: { initial?: number; ceiling?: number; minimum?: number; disabled?: boolean } = $props();
    let value = $state(untrack(() => initial));
    let maximum: number | undefined = $state(untrack(() => ceiling));
</script>
<TokenBudgetControl bind:value {minimum} {maximum} {disabled} label="Token budget" tokensText="tokens" fixedText="Only one valid budget." disabledText="Disabled" unknownText="Unknown maximum; enter a number." invalidText="Saved value preserved; edit the number."/>
<output aria-label="Saved budget">{value}</output>
<button onclick={() => { maximum = 1024; }}>Smaller model</button>
<button onclick={() => { maximum = undefined; }}>Unknown model</button>
