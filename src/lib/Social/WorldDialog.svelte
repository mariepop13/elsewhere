<script lang="ts">
    import { onDestroy, type Snippet } from 'svelte'
    let { open = $bindable(false), title, active = true, resetKey, closeOnAction = false, children }: {
        open?: boolean; title: string; active?: boolean; resetKey?: unknown
        closeOnAction?: boolean; children: Snippet
    } = $props()
    let dialog: HTMLDialogElement
    let returnFocus: HTMLElement | null = null
    const id = $props.id()
    export function close() {
        const wasOpen = dialog?.open
        open = false
        dialog?.close()
        if (wasOpen && returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus()
    }
    $effect(() => { resetKey; active; return () => close() })
    $effect(() => {
        if (open && active && dialog && !dialog.open) {
            returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
            dialog.showModal()
        } else if ((!open || !active) && dialog?.open) close()
    })
    function backdrop(event: MouseEvent) {
        if (event.target !== dialog) return
        const rect = dialog.getBoundingClientRect()
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close()
    }
    function action(event: MouseEvent) {
        if (closeOnAction && event.target instanceof Element && event.target.closest('button') && !event.defaultPrevented) close()
    }
    onDestroy(() => { if (dialog?.open) close() })
</script>
<dialog bind:this={dialog} aria-labelledby={id} onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }} oncancel={event => { event.preventDefault(); close() }} onclose={() => { if (dialog && !dialog.open) open = false }} onclick={event => { backdrop(event); action(event) }}>
    <header><h2 id={id}>{title}</h2><button type="button" aria-label={`Close ${title}`} onclick={close}>×</button></header>
    <div class="world-dialog-content">{@render children()}</div>
</dialog>
<style>
    dialog{color:var(--world-text,var(--risu-theme-textcolor));background:var(--world-panel,var(--risu-theme-bgcolor));border:1px solid var(--world-line,var(--risu-theme-borderc));border-radius:16px;padding:16px;width:min(520px,calc(100vw - 24px));max-height:calc(100dvh - 32px);overflow:auto;margin:auto;box-sizing:border-box}
    dialog::backdrop{background:rgb(0 0 0 / .45)}
    header{display:flex;align-items:center;gap:12px;margin-bottom:12px}h2{font-size:16px;font-weight:600;flex:1}header button{min-width:44px;min-height:44px;font-size:24px;border-radius:8px}
    .world-dialog-content :global(button){min-height:44px;gap:8px;border-radius:8px;padding:8px;text-align:left}
    .world-dialog-content :global(button:hover){background:var(--world-canvas,var(--risu-theme-darkbg))}
    :global(.world-dialog-content button:focus-visible),header button:focus-visible{outline:2px solid var(--world-mint,var(--risu-theme-selected));outline-offset:2px}
    @media(max-width:700px){dialog{margin:auto auto 12px}}
</style>
