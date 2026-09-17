<script lang="ts">
  interface Props {
    isDisabled?: boolean;
    onClick: () => void;
    children?: import('svelte').Snippet;
  }

  let { isDisabled = false, onClick, children }: Props = $props();
</script>

<button
  disabled={isDisabled}
  onclick={onClick}
  class="flex h-[56px] w-[56px] cursor-pointer select-none items-center justify-center
   transition-colors rounded-full
   border border-darkborderc text-textcolor
   hover:border-focus hover:bg-surface-subtle
   focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2
   disabled:cursor-not-allowed disabled:opacity-50
   {isDisabled ? 'cursor-not-allowed!' : ''}"
>
  {@render children?.()}
</button>
