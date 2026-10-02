<script lang="ts">
  interface Props {
    isActive: boolean;
  }

  let { isActive }: Props = $props();
</script>

<div
  class="
      group-hover:bg-focus
      absolute
      left-[-4px]
      h-[8px]
      w-[3px]
      rounded-full
      transition-all
      duration-300
      {isActive ? 'bg-focus h-[28px]! shadow-[0_0_12px_var(--risu-theme-focus)]' : 'group-hover:h-[14px]'}
    "
></div>
