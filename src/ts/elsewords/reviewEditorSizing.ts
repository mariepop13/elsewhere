export interface ReviewEditorSizing {
    value: string
    original: string | null
    compact: boolean
    identity: object
}

/** Size only the editor viewport; never replace its value, focus or selection. */
export function sizeReviewEditor(node: HTMLTextAreaElement, initial: ReviewEditorSizing) {
    const view = node.ownerDocument.defaultView
    if (!view) return { update(_next: ReviewEditorSizing) {}, destroy() {} }
    let options = initial
    let frame: number | null = null
    let destroyed = false
    let appliedHeight = 0
    let manualHeight: number | null = null
    let measuredWidth = 0
    let measuredViewport = 0
    let measuredOriginal = 0
    let observedOriginal: HTMLElement | null = null
    const row = node.closest<HTMLElement>('.comparison')
    const original = () => row?.querySelector<HTMLElement>('[data-review-original]') ?? null
    const numeric = (value: string, fallback: number) => Number.isFinite(parseFloat(value)) ? parseFloat(value) : fallback
    function resize() {
        frame = null
        if (destroyed || !node.isConnected || !node.getBoundingClientRect().width) return
        const style = view!.getComputedStyle(node)
        const minimum = numeric(style.minHeight, options.compact ? 56 : 128)
        const rootSize = numeric(view!.getComputedStyle(node.ownerDocument.documentElement).fontSize, 16)
        const mobile = view!.innerWidth <= 600
        const autoLimit = Math.max(minimum, mobile ? Math.min(32 * rootSize, .6 * view!.innerHeight) : 32 * rootSize)
        const manualLimit = mobile ? Math.max(minimum, .85 * view!.innerHeight) : Infinity
        const sourceHeight = original()?.getBoundingClientRect().height ?? 0
        const width = row?.getBoundingClientRect().width ?? node.getBoundingClientRect().width
        const currentHeight = node.getBoundingClientRect().height
        // Also detect a manual size at the next input when ResizeObserver is unavailable.
        if (appliedHeight > 0 && width === measuredWidth && view!.innerHeight === measuredViewport && sourceHeight === measuredOriginal && Math.abs(currentHeight - appliedHeight) > 1) manualHeight = currentHeight
        const scrollTop = node.scrollTop
        let desired: number
        if (manualHeight !== null) {
            // A deliberate user resize takes priority until another card/result is loaded.
            desired = Math.min(manualLimit, Math.max(minimum, manualHeight))
        } else {
            node.style.height = '0px'
            const border = numeric(style.borderTopWidth, 0) + numeric(style.borderBottomWidth, 0)
            desired = Math.min(autoLimit, Math.max(minimum, sourceHeight, node.scrollHeight + border))
        }
        node.style.height = `${Math.ceil(desired)}px`
        node.scrollTop = scrollTop
        appliedHeight = node.getBoundingClientRect().height
        measuredWidth = row?.getBoundingClientRect().width ?? node.getBoundingClientRect().width
        measuredViewport = view!.innerHeight
        measuredOriginal = sourceHeight
    }
    function schedule() { if (!destroyed && frame === null) frame = view!.requestAnimationFrame(resize) }
    const observer = typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(() => {
        const width = row?.getBoundingClientRect().width ?? node.getBoundingClientRect().width
        const sourceHeight = original()?.getBoundingClientRect().height ?? 0
        if (width !== measuredWidth || view!.innerHeight !== measuredViewport || sourceHeight !== measuredOriginal) { schedule(); return }
        const height = node.getBoundingClientRect().height
        if (appliedHeight > 0 && Math.abs(height - appliedHeight) > 1) { manualHeight = height; appliedHeight = height }
    }) : null
    function observeOriginal() {
        const next = original()
        if (next === observedOriginal) return
        if (observedOriginal) observer?.unobserve(observedOriginal)
        observedOriginal = next
        if (next) observer?.observe(next)
    }
    if (row) observer?.observe(row)
    observer?.observe(node)
    observeOriginal()
    node.addEventListener('input', schedule)
    view.addEventListener('resize', schedule)
    schedule()
    return {
        update(next: ReviewEditorSizing) {
            if (next.identity !== options.identity || next.original !== options.original || next.compact !== options.compact) { manualHeight = null; appliedHeight = 0 }
            options = next
            observeOriginal()
            schedule()
        },
        destroy() {
            destroyed = true
            if (frame !== null) view.cancelAnimationFrame(frame)
            observer?.disconnect()
            node.removeEventListener('input', schedule)
            view.removeEventListener('resize', schedule)
        },
    }
}
