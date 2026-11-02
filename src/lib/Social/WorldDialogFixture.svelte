<script lang="ts">
    import WorldDialog from './WorldDialog.svelte'
    let { active = true, resetKey = 'first' }: { active?: boolean; resetKey?: string } = $props()
    let open = $state(false)
    let count = $state(0)
    let paneKey = $state(0)
    export function replacePane() { paneKey++ }
    export function hide() { active = false }
    export function replaceOwner() { resetKey = 'replacement' }
</script>
<button aria-haspopup="dialog" aria-expanded={open} onclick={() => open = true}>Open actions</button>
{#key paneKey}
<WorldDialog bind:open title="Fixture actions" {active} {resetKey} closeOnAction>
    <button onclick={() => count++}>Native action</button>
</WorldDialog>
{/key}
<output>{count}</output>
