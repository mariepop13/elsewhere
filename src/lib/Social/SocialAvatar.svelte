<script lang="ts">
    import { getCharImage } from 'src/ts/characters'
    let { name, image, size = 40 }: { name: string; image?: string; size?: number } = $props()
    let failedImage = $state('')
</script>
<div class="social-avatar flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-textcolor/10 text-textcolor" style:width={`${size}px`} style:height={`${size}px`} aria-hidden="true">
    {#if image && failedImage !== image}
        {#await getCharImage(image, 'plain')}
            {name.slice(0, 1)}
        {:then src}
            {#if src}<img {src} alt="" class="size-full object-cover" onerror={() => failedImage = image ?? ''} />{:else}{name.slice(0, 1)}{/if}
        {:catch}
            {name.slice(0, 1)}
        {/await}
    {:else}
        {name.slice(0, 1)}
    {/if}
</div>
<style>
    .social-avatar { box-shadow: 0 0 0 2px var(--risu-theme-surface-elevated); }
</style>
