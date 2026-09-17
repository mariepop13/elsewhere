<option value={value} selected={selected} class="bg-surface-elevated appearance-none">{@render children?.()}</option>
<script lang="ts">
    interface Props {
        value: string | number;
        selected?: boolean;
        children?: import('svelte').Snippet;
    }

    let { value, selected = false, children }: Props = $props();
</script>