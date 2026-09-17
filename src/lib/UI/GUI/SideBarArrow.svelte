<script lang="ts">
    import { ArrowLeft, ArrowRight } from "@lucide/svelte";
    import { DynamicGUI, MobileGUI, sideBarClosing, sideBarStore } from "src/ts/stores.svelte";

</script>

{#if !$MobileGUI}
    {#if $sideBarStore && !$DynamicGUI}
        <button onclick={() => {sideBarClosing.set(true)}} class="absolute top-3 left-0 h-12 w-12 border-r border-b border-t border-transparent rounded-r-md bg-surface-elevated hover:border-focus transition-colors flex items-center justify-center text-textcolor z-20 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2">
            <ArrowLeft />
        </button>
    {:else}
        <button onclick={() => {
            sideBarClosing.set(false);
            sideBarStore.set(true)}} class="absolute top-3 left-0 h-12 w-12 border-r border-b border-t border-action-primary rounded-r-md bg-surface-elevated hover:border-focus transition-colors flex items-center justify-center text-textcolor opacity-50 hover:opacity-90 z-20 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2">
            <ArrowRight />
        </button>
    {/if}
{/if}