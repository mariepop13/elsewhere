
<script lang="ts">
    import type { Snippet } from "svelte";


    interface Props {
        children: Snippet;
        onclick: (e: MouseEvent) => void;
        name?: string
        className?: string;
        id?: string;
    }

    const { children, onclick, name, className, id }: Props = $props();
</script>

<button class={{
    "flex items-center text-textcolor2 hover:text-focus transition-colors focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2": true,
    [className]: !!className
}} id={id} onclick={onclick}>
    {@render children?.()}

    {#if name}
        <span class="ml-1">{name}</span>
    {/if}
</button>
