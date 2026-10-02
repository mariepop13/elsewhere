<script lang="ts">
    import { language } from 'src/lang';
    import Accordion from 'src/lib/UI/Accordion.svelte';
    import Check from 'src/lib/UI/GUI/CheckInput.svelte';
    import NumberInput from 'src/lib/UI/GUI/NumberInput.svelte';
    import OptionInput from 'src/lib/UI/GUI/OptionInput.svelte';
    import SelectInput from 'src/lib/UI/GUI/SelectInput.svelte';
    import { openRouterGatewayReasoningEfforts, type OpenRouterModelInfo } from 'src/ts/model/openrouter';
    import { DBState } from 'src/ts/stores.svelte';

    let { model }: { model?: OpenRouterModelInfo } = $props()

    let reasoning = $derived(model?.reasoning)
    let effortOptions = $derived(
        (reasoning?.supportedEfforts === null
            ? openRouterGatewayReasoningEfforts
            : reasoning?.supportedEfforts ?? [])
            .filter((effort) => effort !== 'none')
    )
    let reasoningEnabled = $derived(
        reasoning?.mandatory
            ? true
            : DBState.db.openrouterReasoning?.enabled ?? reasoning?.defaultEnabled ?? false
    )
    let selectedEffort = $derived(
        DBState.db.openrouterReasoning?.effort ?? reasoning?.defaultEffort ?? effortOptions[0] ?? ''
    )
    let tokenBudget = $derived(DBState.db.openrouterReasoning?.maxTokens ?? 0)
    let hasControls = $derived(
        !!reasoning && (!reasoning.mandatory || effortOptions.length > 0 || reasoning.supportsMaxTokens)
    )

    $effect(() => {
        if (reasoning?.mandatory && DBState.db.openrouterReasoning?.enabled === false) {
            const { enabled: _, ...config } = DBState.db.openrouterReasoning
            DBState.db.openrouterReasoning = Object.keys(config).length ? config : undefined
        }
    })

    function updateEnabled(enabled: boolean) {
        DBState.db.openrouterReasoning = {
            ...DBState.db.openrouterReasoning,
            enabled,
        }
    }

    function updateEffort(event: Event & { currentTarget: HTMLSelectElement }) {
        DBState.db.openrouterReasoning = {
            ...DBState.db.openrouterReasoning,
            effort: event.currentTarget.value as typeof openRouterGatewayReasoningEfforts[number],
        }
    }

    function updateTokenBudget(event: Event & { currentTarget: HTMLInputElement }) {
        const maxTokens = Math.floor(Number(event.currentTarget.value))
        const config = { ...DBState.db.openrouterReasoning }
        if (Number.isFinite(maxTokens) && maxTokens > 0) {
            config.maxTokens = maxTokens
        } else {
            delete config.maxTokens
        }
        DBState.db.openrouterReasoning = Object.keys(config).length ? config : undefined
    }
</script>

{#if hasControls}
    <Accordion name={language.openRouterReasoning} styled>
        {#if !reasoning?.mandatory}
            <div class="flex items-center mb-4">
                <Check check={reasoningEnabled} onChange={updateEnabled} name={language.openRouterReasoningEnabled}/>
            </div>
        {/if}

        {#if reasoning?.mandatory || reasoningEnabled}
            {#if effortOptions.length}
                <label class="flex flex-col gap-1 text-textcolor">
                    <span>{language.openRouterReasoningEffort}</span>
                    <SelectInput value={selectedEffort} onchange={updateEffort}>
                        {#each effortOptions as effort}
                            <OptionInput value={effort}>{effort}</OptionInput>
                        {/each}
                    </SelectInput>
                </label>
            {/if}

            {#if reasoning?.supportsMaxTokens}
                <label class="flex flex-col gap-1 text-textcolor">
                    <span>{language.openRouterReasoningTokenBudget}</span>
                    <NumberInput value={tokenBudget} min={1} fullwidth marginBottom onChange={updateTokenBudget}/>
                </label>
            {/if}
        {/if}
    </Accordion>
{/if}
