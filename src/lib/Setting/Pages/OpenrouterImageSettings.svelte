<script lang="ts">
    import { language } from 'src/lang'
    import OptionInput from 'src/lib/UI/GUI/OptionInput.svelte'
    import SelectInput from 'src/lib/UI/GUI/SelectInput.svelte'
    import TextInput from 'src/lib/UI/GUI/TextInput.svelte'
    import ModelGrid from 'src/lib/UI/ModelGrid.svelte'
    import type { ModelGridItem } from 'src/ts/model/modelGrid'
    import { getOpenRouterImageModels, type OpenRouterImageModel } from 'src/ts/plugins/apiV3/imageGeneration'
    import { DBState } from 'src/ts/stores.svelte'

    type SelectOption = 'aspectRatio' | 'resolution' | 'quality' | 'outputFormat'

    function toGridItem(model: OpenRouterImageModel): ModelGridItem {
        const separator = model.name.indexOf(':')
        return {
            id: model.id,
            providerName: separator >= 0 ? model.name.slice(0, separator).trim() : model.id.split('/')[0],
            displayName: separator >= 0 ? model.name.slice(separator + 1).trim() : model.name,
            description: model.supportsReferences ? language.openRouterImageReferenceSupported : '',
            context_length: 0,
            sortPrice: Infinity,
            prices: [],
        }
    }

    function selectModel(id: string) {
        if (id === DBState.db.openrouterImageModel) return
        DBState.db.openrouterImageModel = id
        DBState.db.openrouterImageOptions = {}
    }

    function updateOption(key: SelectOption, value: string) {
        const options = { ...DBState.db.openrouterImageOptions }
        if (value) options[key] = value
        else delete options[key]
        DBState.db.openrouterImageOptions = options
    }

    function updateSeed(event: Event & { currentTarget: HTMLInputElement }) {
        const input = event.currentTarget
        if (input.value !== '' && (!input.checkValidity() || !Number.isSafeInteger(Number(input.value)))) {
            input.value = String(DBState.db.openrouterImageOptions.seed ?? '')
            return
        }
        const options = { ...DBState.db.openrouterImageOptions }
        if (input.value === '') delete options.seed
        else options.seed = Number(input.value)
        DBState.db.openrouterImageOptions = options
    }
</script>

<section class="mt-2 rounded-md border border-darkborderc bg-darkbg p-4">
    <h3 class="mb-3 text-xl font-semibold text-textcolor">{language.openRouterImageSettings}</h3>
    <label class="flex flex-col gap-1 text-textcolor">
        <span>OpenRouter {language.apiKey}</span>
        <TextInput hideText={DBState.db.hideApiKey} marginBottom={false} size="sm" bind:value={DBState.db.openrouterKey} />
    </label>

    <span class="mt-4 block text-textcolor">{language.openRouterImageModel}</span>
    {#await getOpenRouterImageModels()}
        <ModelGrid value={DBState.db.openrouterImageModel} loading showSortControls={false} />
    {:then imageModels}
        {@const selectedModel = imageModels.find((model) => model.id === DBState.db.openrouterImageModel)}
        <ModelGrid value={DBState.db.openrouterImageModel} items={imageModels.map(toGridItem)} showSortControls={false} onselect={selectModel} />

        {#if selectedModel}
            <p class="my-3 text-sm text-textcolor2">{language.openRouterImageOptionsHelp}</p>
            {#if selectedModel.capabilities.aspectRatio?.length}
                <label class="mb-3 flex flex-col gap-1 text-textcolor">
                    <span>{language.openRouterImageAspectRatio}</span>
                    <SelectInput value={DBState.db.openrouterImageOptions.aspectRatio ?? ''} onchange={(event) => updateOption('aspectRatio', event.currentTarget.value)}>
                        <OptionInput value="">{language.openRouterImageProviderDefault}</OptionInput>
                        {#each selectedModel.capabilities.aspectRatio as value}<OptionInput {value}>{value}</OptionInput>{/each}
                    </SelectInput>
                </label>
            {/if}
            {#if selectedModel.capabilities.resolution?.length}
                <label class="mb-3 flex flex-col gap-1 text-textcolor">
                    <span>{language.openRouterImageResolution}</span>
                    <SelectInput value={DBState.db.openrouterImageOptions.resolution ?? ''} onchange={(event) => updateOption('resolution', event.currentTarget.value)}>
                        <OptionInput value="">{language.openRouterImageProviderDefault}</OptionInput>
                        {#each selectedModel.capabilities.resolution as value}<OptionInput {value}>{value}</OptionInput>{/each}
                    </SelectInput>
                </label>
            {/if}
            {#if selectedModel.capabilities.quality?.length}
                <label class="mb-3 flex flex-col gap-1 text-textcolor">
                    <span>{language.openRouterImageQuality}</span>
                    <SelectInput value={DBState.db.openrouterImageOptions.quality ?? ''} onchange={(event) => updateOption('quality', event.currentTarget.value)}>
                        <OptionInput value="">{language.openRouterImageProviderDefault}</OptionInput>
                        {#each selectedModel.capabilities.quality as value}<OptionInput {value}>{value}</OptionInput>{/each}
                    </SelectInput>
                </label>
            {/if}
            {#if selectedModel.capabilities.outputFormat?.length}
                <label class="mb-3 flex flex-col gap-1 text-textcolor">
                    <span>{language.openRouterImageOutputFormat}</span>
                    <SelectInput value={DBState.db.openrouterImageOptions.outputFormat ?? ''} onchange={(event) => updateOption('outputFormat', event.currentTarget.value)}>
                        <OptionInput value="">{language.openRouterImageProviderDefault}</OptionInput>
                        {#each selectedModel.capabilities.outputFormat as value}<OptionInput {value}>{value.toUpperCase()}</OptionInput>{/each}
                    </SelectInput>
                </label>
            {/if}
            {#if selectedModel.capabilities.seed}
                <label class="mb-3 flex flex-col gap-1 text-textcolor">
                    <span>{language.seed}</span>
                    <input
                        type="number"
                        min={selectedModel.capabilities.seed.min}
                        max={selectedModel.capabilities.seed.max}
                        step="1"
                        value={DBState.db.openrouterImageOptions.seed ?? ''}
                        placeholder={language.openRouterImageProviderDefault}
                        onchange={updateSeed}
                        class="rounded-md border border-darkborderc bg-surface-subtle px-4 py-2 text-textcolor focus:border-focus focus:outline-2 focus:outline-focus"
                    />
                </label>
            {/if}
        {/if}
    {:catch}
        <p class="text-textcolor2">{language.openRouterImageModelsFailed}</p>
    {/await}
</section>
