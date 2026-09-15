<!-- TODO: REMOVE AND REFACTOR TO BASE BUTTON UI COMPONENT -->

<script lang="ts">
  interface Props {
    onClick?: any;
    additionalStyle?: string | Promise<string>;
    children?: import('svelte').Snippet;
  }

  let { onClick = () => {}, additionalStyle = "", children }: Props = $props();
</script>

{#await additionalStyle}
  <button onclick={onClick} class="ico">{@render children?.()}</button>
{:then as}
  <button onclick={onClick} class="ico" style={as}>{@render children?.()}</button>
{/await}

<style>
  .ico {
    cursor: pointer;
    border-radius: 0.375rem;
    height: 3.5rem;
    width: 3.5rem;
    min-height: 3.5rem;
    border: 1px solid var(--risu-theme-darkborderc);
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.18),
      0 4px 6px -2px rgb(0 0 0 / 0.12);
    background-color: var(--risu-theme-surface-subtle);
    color: var(--risu-theme-textcolor);
    display: flex;
    justify-content: center;
    align-items: center;
    transition-property: background-color, border-color, color, fill, stroke;
    transition-duration: 150ms;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }

  .ico:hover {
    background-color: var(--risu-theme-action-primary);
    color: var(--risu-theme-textcolor);
  }

  .ico:focus-visible {
    outline: 2px solid var(--risu-theme-focus);
    outline-offset: 2px;
  }
</style>
