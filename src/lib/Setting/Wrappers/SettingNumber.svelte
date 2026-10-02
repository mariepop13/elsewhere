<script lang="ts">
    import type { SettingItem, SettingContext } from 'src/ts/setting/types';
    import { UNINITIALIZED, getLabel, getSettingValue, setSettingValue } from 'src/ts/setting/utils';
    import { untrack } from 'svelte';
    import TokenBudgetInput from '../TokenBudgetInput.svelte';
    import NumberInput from 'src/lib/UI/GUI/NumberInput.svelte';
    import Help from 'src/lib/Others/Help.svelte';

    interface Props {
        item: SettingItem;
        ctx: SettingContext;
    }

    let { item, ctx }: Props = $props();

    let localValue: any = $state(untrack(() => getSettingValue(item, ctx)));

    // Sync: DB → local (one-way read)
    $effect(() => {
        localValue = getSettingValue(item, ctx);
    });

    // Write-back: local → DB (guarded)
    $effect(() => {
        const val = localValue;
        if (val === UNINITIALIZED) return;
        untrack(() => {
            if (val !== getSettingValue(item, ctx)) {
                setSettingValue(item, val, ctx);
            }
        });
    });
</script>

<span class="text-textcolor {item.classes ?? ''}">
    {getLabel(item)}
    {#if item.helpKey}<Help key={item.helpKey as any}/>{/if}
</span>
{#if item.bindKey === 'maxContext' || item.bindKey === 'maxResponse'}
<TokenBudgetInput modelId={ctx.db.aiModel} sharedModelId={item.bindKey === 'maxResponse' ? ctx.db.subModel : undefined} kind={item.bindKey === 'maxContext' ? 'context' : 'output'} contextBudget={ctx.db.maxContext} bind:value={localValue}/>
{:else}
<NumberInput
    marginBottom={true}
    size="sm"
    min={item.options?.min}
    max={item.options?.max}
    bind:value={localValue}
/>

{/if}
