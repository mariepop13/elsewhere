<script lang="ts">
    import { language } from "src/lang";
    import TextAreaInput from "../UI/GUI/TextAreaInput.svelte";
    import Button from "../UI/GUI/Button.svelte";
    import { generateAIImage } from "src/ts/process/stableDiff";
    import { createBlankChar } from "src/ts/characters";
    import { DBState } from "src/ts/stores.svelte";
    let prompt = $state("");
    let negPrompt = $state("");
    let img = $state("");
    let downloadName = $state("");
    let generating = $state(false)
    let referenceImageDataUrl = $state("");
    let referenceImageName = $state("");
    let referenceError = $state("");
    let referenceLoading = $state(false);
    let referenceInput = $state<HTMLInputElement | undefined>();
    let referenceSelection = 0;

    async function selectReferenceImage(event: Event & { currentTarget: HTMLInputElement }) {
        const selection = ++referenceSelection;
        const input = event.currentTarget;
        const file = input.files?.[0];
        referenceImageDataUrl = "";
        referenceImageName = "";
        referenceError = "";
        referenceLoading = false;
        if (!file) return;

        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
            referenceError = language.openRouterImageReferenceInvalid;
            input.value = "";
            return;
        }

        try {
            referenceLoading = true;
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid image data'));
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
            if (selection !== referenceSelection) return;
            referenceImageDataUrl = dataUrl;
            referenceImageName = file.name;
        } catch {
            if (selection !== referenceSelection) return;
            referenceError = language.openRouterImageReferenceReadFailed;
            input.value = "";
        } finally {
            if (selection === referenceSelection) referenceLoading = false;
        }
    }

    function removeReferenceImage() {
        referenceSelection++;
        referenceImageDataUrl = "";
        referenceImageName = "";
        referenceError = "";
        referenceLoading = false;
        if (referenceInput) referenceInput.value = "";
    }

    function generatedImageFilename(source: string): string {
        const dataFormat = /^data:image\/(png|jpeg|webp);base64,/i.exec(source)?.[1];
        const pathFormat = dataFormat ? undefined : /\.(png|jpe?g|webp)$/i.exec(new URL(source, location.href).pathname)?.[1];
        const format = (dataFormat ?? pathFormat ?? 'png').toLowerCase();
        const extension = format === 'jpeg' ? 'jpg' : format;
        const date = new Date();
        const day = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
            .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0')).join('');
        const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
            .map((part) => String(part).padStart(2, '0')).join('');
        return `elsewhere-image-${day}-${time}.${extension}`;
    }

    const run = async () => {
        if(generating || referenceLoading || referenceError){
            return
        }
        generating = true
        img = ""
        downloadName = ""
        try {
            const openrouter = DBState.db.sdProvider === 'openrouter'
            const gen = await generateAIImage(
                prompt, createBlankChar(), openrouter ? '' : negPrompt, 'inlay',
                openrouter ? referenceImageDataUrl || undefined : undefined,
            )
            if(gen){
                img = gen
                downloadName = generatedImageFilename(gen)
            }
        } finally {
            generating = false
        }
    }
</script>

<h2 class="text-4xl text-textcolor my-6 font-black relative">{language.imageGeneration}</h2>

<span class="text-textcolor text-lg">Prompt</span>
<TextAreaInput bind:value={prompt} />

{#if DBState.db.sdProvider === 'openrouter'}
    <label class="mt-4 flex flex-col gap-2 text-textcolor">
        <span>{language.openRouterImageReference}</span>
        <input
            bind:this={referenceInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onchange={selectReferenceImage}
            class="w-full rounded-md border border-darkborderc bg-surface-subtle p-2 text-textcolor file:mr-3 file:rounded-md file:border-0 file:bg-darkbutton file:px-3 file:py-1 file:text-textcolor"
        />
    </label>
    <p class="mt-1 text-sm text-textcolor2">{language.openRouterImageReferenceHelp}</p>
    {#if referenceLoading}
        <p class="mt-2 text-sm text-textcolor2" role="status">{language.loading}...</p>
    {/if}
    {#if referenceError}
        <p class="mt-2 text-sm text-draculared" role="alert">{referenceError}</p>
    {/if}
    {#if referenceImageDataUrl}
        <div class="mt-3 flex flex-col items-start gap-2">
            <img src={referenceImageDataUrl} class="max-h-64 max-w-full rounded-md border border-darkborderc object-contain" alt={referenceImageName} />
            <Button styled="outlined" size="sm" onclick={removeReferenceImage}>{language.remove}</Button>
        </div>
    {/if}
{:else}
    <span class="text-textcolor text-lg">Neg. Prompt</span>
    <TextAreaInput bind:value={negPrompt} />
{/if}

{#if img}
    <span class="text-textcolor text-lg">Generated</span>
    <img src={img} class="max-w-full mt-4" alt="Generated"/>
    <div class="mt-3 flex flex-wrap items-center gap-3">
        <a href={img} download={downloadName} class="inline-flex rounded-md border border-darkborderc bg-darkbutton px-4 py-2 text-textcolor hover:bg-borderc">{language.download}</a>
        <span class="break-all text-sm text-textcolor2">{downloadName}</span>
    </div>
{/if}

<Button className="mt-6" onclick={run} disabled={generating || referenceLoading || !!referenceError}>
    Generate
</Button>
{#if generating}
    <div class="mt-4 flex items-center gap-3 text-textcolor" role="status" aria-live="polite">
        <span class="h-5 w-5 animate-spin rounded-full border-2 border-borderc border-t-textcolor motion-reduce:animate-none" aria-hidden="true"></span>
        <span>{language.imageGenerating}</span>
    </div>
{/if}
