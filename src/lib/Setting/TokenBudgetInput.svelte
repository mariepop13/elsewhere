<script lang="ts">
    import TokenLimitDetails from './TokenLimitDetails.svelte';
    import Check from 'src/lib/UI/GUI/CheckInput.svelte';
    import TokenBudgetControl from './TokenBudgetControl.svelte';
    import { DBState } from 'src/ts/stores.svelte';
    import { getModelInfo } from 'src/ts/model/modellist';
    import { LLMFlags } from 'src/ts/model/types';
    import { selectionForModel, contextSettingMaximum, validateTokenBudget } from 'src/ts/model/tokenCapabilities';
    import { cachedTokenCapabilities, loadTokenCapabilities } from 'src/ts/model/tokenCapabilities.svelte';
    import { language } from 'src/lang';
    let { value = $bindable(), modelId, kind = 'output', outputBudget, contextBudget, sharedModelId, label, showModelDetails = true }: { value: number; modelId: string; kind?: 'context' | 'output' | 'reasoning'; outputBudget?: number; contextBudget?: number; sharedModelId?: string; label?: string; showModelDetails?: boolean } = $props();
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
<TokenBudgetControl
    disabled={kind === 'reasoning' && reasoningDisabled}
    minimum={kind === 'reasoning' ? (claude ? 1024 : modelId === 'openrouter' ? 1 : -1) : 1}
    maximum={maximum} bind:value
    label={label ?? (kind === 'context' ? language.maxContextSize : kind === 'reasoning' ? language.thinkingTokens : language.maxResponseSize)}
    tokensText={language.tokenBudgetUnits} unknownText={language.tokenBudgetUnknownSlider}
    invalidText={language.tokenBudgetInvalidSlider} fixedText={language.tokenBudgetFixedSlider}
    disabledText={language.disabled}
/>
{#if showModelDetails}<TokenLimitDetails {cap} {sharedCap} />{/if}
{#if errors.length}
    <div class="mb-3 text-xs text-draculared" aria-live="polite">
        {#each errors as error}<p role="alert">{error}</p>{/each}
    </div>
{/if}
