<select
    class={"border border-darkborderc focus:border-focus rounded-md shadow-xs text-textcolor bg-surface-subtle focus:ring-focus focus:ring-2 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2" + ((className) ? (' ' + className) : '')}
    class:text-sm={size === 'sm'}
    class:text-md={size === 'md'}
    class:text-lg={size === 'lg'}
    class:text-xl={size === 'xl'}
    class:px-4={size === 'md'}
    class:py-2={size === 'md'}
    class:px-2={size === 'sm'}
    class:py-1={size === 'sm'}
    class:px-6={size === 'lg'}
    class:py-3={size === 'lg'}
    bind:value
    onchange={onchange}
>
    {@render children?.()}
</select>
<script lang="ts">
    interface Props {
        value: string | number;
        className?: string;
        size?: 'sm'|'md'|'lg'|'xl';
        children?: import('svelte').Snippet;
        onchange?: (event: Event & {
            currentTarget: EventTarget & HTMLSelectElement;
        }) => any;
    }

    let {
        value = $bindable(),
        className = "",
        size = 'md',
        children,
        onchange
    }: Props = $props();

</script>