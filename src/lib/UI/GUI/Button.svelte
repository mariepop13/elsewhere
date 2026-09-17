<button
    onclick={onclick}
    {disabled}
    class="{
        styled === 'primary' ? (selected ? 'bg-focus border-focus text-canvas hover:bg-focus/85' : 'bg-action-primary border-action-primary hover:bg-focus')
        : styled === 'outlined' ? 'bg-transparent border-darkborderc text-textcolor2 hover:bg-surface-subtle hover:border-focus hover:text-textcolor'
        : (selected ? 'bg-ambient/85 border-ambient' : 'bg-ambient border-ambient hover:bg-ambient/85')
    } border text-textcolor rounded-md shadow-xs transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50{className ? (" " + className) : ""}"
    class:cursor-not-allowed={disabled}
    class:px-4 = {size == "md"}
    class:px-2 = {size == "sm"}
    class:px-6 = {size == "lg"}
    class:py-2 = {size == "md"}
    class:py-1 = {size == "sm"}
    class:py-3 = {size == "lg"}
    class:text-md = {size == "md"}
    class:text-sm = {size == "sm"}
    class:text-lg = {size == "lg"}>
    {@render children?.()}
</button>
<script lang="ts">

    interface Props {
        selected?: boolean;
        styled?: 'primary'|'danger'|'outlined';
        className?: string;
        size?: "sm" | "md" | "lg";
        disabled?: boolean;
        children?: import('svelte').Snippet;
        onclick?: (event: MouseEvent & {
            currentTarget: EventTarget & HTMLButtonElement;
        }) => any
    }

    let {
        selected = false,
        styled = 'primary',
        className = "",
        size = "md",
        disabled = false,
        children,
        onclick
    }: Props = $props();
</script>