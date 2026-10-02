<script lang="ts">
    import Check from 'src/lib/UI/GUI/CheckInput.svelte';
    import NumberInput from 'src/lib/UI/GUI/NumberInput.svelte';
    import { DBState } from 'src/ts/stores.svelte';
    import { getModelInfo } from 'src/ts/model/modellist';
    import { LLMFlags } from 'src/ts/model/types';
    import { selectionForModel, contextSettingMaximum, validateTokenBudget } from 'src/ts/model/tokenCapabilities';
    import { cachedTokenCapabilities, loadTokenCapabilities } from 'src/ts/model/tokenCapabilities.svelte';
    import { language } from 'src/lang';
    let { value = $bindable(), modelId, kind = 'output', outputBudget, contextBudget, sharedModelId }: { value: number; modelId: string; kind?: 'context' | 'output' | 'reasoning'; outputBudget?: number; contextBudget?: number; sharedModelId?: string } = $props();
    let reasoningDisabled = $derived(value === -1000 || value == null);
    let effectiveOutput = $derived(outputBudget ?? DBState.db.maxResponse);
    let model = $derived(getModelInfo(modelId));
    let selection = $derived(selectionForModel(model, DBState.db.openrouterRequestModel, DBState.db.openrouterProvider));
    let cap = $derived(cachedTokenCapabilities(selection));
    let sharedSelection = $derived(sharedModelId ? selectionForModel(getModelInfo(sharedModelId), DBState.db.openrouterRequestModel, DBState.db.openrouterProvider) : undefined);
    let sharedCap = $derived(sharedSelection ? cachedTokenCapabilities(sharedSelection) : undefined);
    $effect(() => { void loadTokenCapabilities(selection); if (sharedSelection) void loadTokenCapabilities(sharedSelection); });
    let claude = $derived(model.flags.includes(LLMFlags.claudeThinking) || model.flags.includes(LLMFlags.claudeAdaptiveThinking));
    let maximum = $derived.by(() => {
        if (kind === 'context') return contextSettingMaximum(cap, effectiveOutput);
        if (kind === 'reasoning') return claude || modelId === 'openrouter' ? Math.max(1, effectiveOutput - 1) : cap.thinking?.max;
        const values = [cap.output, sharedCap?.output].filter((v): v is number => v !== undefined);
        return values.length ? Math.min(...values) : undefined;
    });
    let errors = $derived.by(() => {
        if (kind === 'reasoning' && reasoningDisabled && modelId !== 'openrouter') return [];
        const budget = { output: kind === 'output' ? value : effectiveOutput, context: kind === 'context' ? value : contextBudget, reasoning: kind === 'reasoning' ? value : undefined, reasoningKind: (claude ? 'claude' : modelId === 'openrouter' ? 'openrouter' : 'google') as 'claude' | 'openrouter' | 'google' };
        return [...validateTokenBudget(cap, budget), ...(sharedCap && kind === 'output' ? validateTokenBudget(sharedCap, budget) : [])];
    });
</script>

{#if kind === 'reasoning' && modelId !== 'openrouter'}
    <Check check={!reasoningDisabled} name={language.thinkingTokens} onChange={(enabled) => { value = enabled ? (claude ? 1024 : -1) : -1000; }}/>
{/if}
<NumberInput disabled={kind === 'reasoning' && reasoningDisabled} min={kind === 'reasoning' && !claude && modelId !== 'openrouter' ? -1 : 1} max={maximum} bind:value marginBottom/>
<div class="text-xs text-textcolor2 mb-3" aria-live="polite">
    <p>{language.tokenLimitsAdvertised}: {cap.requestedId}. {language.maxContextSize}: {cap.context ?? language.tokenLimitsUnknown}{cap.contextKind === 'input' ? ` (${language.tokenLimitsInputOnly})` : ''}. {language.maxResponseSize}: {cap.output ?? language.tokenLimitsUnknown}.</p>
    {#if sharedCap}<p>{language.tokenLimitsShared}: {sharedCap.requestedId}. {language.maxResponseSize}: {sharedCap.output ?? language.tokenLimitsUnknown}.</p>{/if}
    <p>{language.tokenLimitsSharedReasoning}</p>
    <p>{language.tokenLimitsEstimate}</p>
    {#if cap.routeCoverage === 'catalog' || cap.routeMinimum}<p>{language.tokenLimitsRouting}</p>{/if}
    {#if cap.source}<a href={cap.source} target="_blank" rel="noreferrer" class="underline">{language.tokenLimitsSource}</a> ({cap.observedAt}){/if}
    {#each errors as error}<p class="text-draculared" role="alert">{error}</p>{/each}
</div>
