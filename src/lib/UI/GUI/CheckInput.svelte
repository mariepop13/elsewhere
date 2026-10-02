<script lang="ts">

    interface Props {
        check?: boolean;
        onChange?: (check:boolean) => any,
        margin?: boolean;
        name?: string;
        hiddenName?: boolean;
        reverse?: boolean;
        className?: string;
        grayText?: boolean;
        children?: import('svelte').Snippet;
    }

    let {
        check = $bindable(),
        onChange = (check:boolean) => {},
        margin = true,
        name = '',
        hiddenName = false,
        reverse = false,
        className = "",
        grayText = false,
        children
    }: Props = $props();
</script>

<label 
    class={"flex items-center gap-2 cursor-pointer" + (className ? " " + className : "") + (grayText ? " text-textcolor2" : " text-textcolor")}
    class:mr-2={margin}
    aria-describedby="{name} {check ? 'abled' : 'disabled'}"
    aria-labelledby="{name} {check ? 'abled' : 'disabled'}"
>
    {#if reverse}
        <span>{name} {@render children?.()}</span>
    {/if}
    <input 
        class="peer sr-only"
        type="checkbox" 
        alt={name}
        bind:checked={check}
        onchange={() => {
            onChange(check)
        }}
        aria-describedby="{name} {check ? 'abled' : 'disabled'}"
        aria-labelledby="{name} {check ? 'abled' : 'disabled'}"
    />
    <span 
        class="w-5 h-5 min-w-5 min-h-5 rounded-md border-2 border-darkborderc flex justify-center items-center {check ? 'bg-focus border-focus' : 'bg-surface-subtle'} transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-focus peer-focus-visible:outline-offset-2"
        aria-hidden="true"
        aria-describedby="{name} {check ? 'abled' : 'disabled'}"
        aria-labelledby="{name} {check ? 'abled' : 'disabled'}"
    >
        {#if check}
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-3 h-3 text-canvas" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
            </svg>
        {/if}
    </span>
    {#if !hiddenName && !reverse}
        <span>{name} {@render children?.()}</span>
    {/if}
</label>