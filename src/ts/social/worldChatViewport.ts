import type { WorldChatDraft } from './worldNavigation.svelte'

/** A reverse-column viewport follows new arrivals only at its actual bottom. */
export function isWorldChatAtBottom(position: number) { return Math.abs(position) < 1 }

/** One mounted native viewport, owned by one save and one conversation draft. */
export function createWorldChatViewport(element: HTMLElement, draft: WorldChatDraft, ownsDraft: () => boolean, onRestored?: (position: number) => void) {
    let visible = false
    let restoring = false
    let disposed = false
    let frame = 0
    let revision = 0
    const measurable = () => element.isConnected && element.clientHeight > 0 && element.clientWidth > 0
    const messages = () => Array.from(element.querySelectorAll<HTMLElement>('[data-world-message-id]'))

    function capture() {
        if (disposed || !visible || restoring || !ownsDraft() || !measurable()) return false
        draft.scrollTop = element.scrollTop // flex-column-reverse positions are negative.
        if (isWorldChatAtBottom(element.scrollTop)) {
            draft.scrollAnchor = undefined // Continue following the latest message.
            return true
        }
        const bounds = element.getBoundingClientRect()
        const anchor = messages().find(message => {
            const rect = message.getBoundingClientRect()
            return rect.bottom > bounds.top && rect.top < bounds.bottom
        })
        draft.scrollAnchor = anchor ? { messageId: anchor.dataset.worldMessageId!, offset: anchor.getBoundingClientRect().top - bounds.top } : undefined
        return true
    }

    function setVisible(next: boolean) {
        if (disposed || visible === next) return
        // Called before the parent changes display, while the old layout is usable.
        if (!next) capture()
        visible = next
        const token = ++revision
        cancelAnimationFrame(frame)
        restoring = next
        if (!next) return
        const position = draft.scrollTop ?? 0
        const anchor = draft.scrollAnchor ? { ...draft.scrollAnchor } : undefined
        let attempts = 0
        const restore = () => {
            if (disposed || token !== revision || !visible || !ownsDraft()) return
            if (!measurable()) {
                if (++attempts < 8) frame = requestAnimationFrame(restore)
                else restoring = false
                return
            }
            element.scrollTop = position
            if (anchor) {
                const message = messages().find(message => message.dataset.worldMessageId === anchor.messageId)
                if (message) element.scrollTop += message.getBoundingClientRect().top - element.getBoundingClientRect().top - anchor.offset
            }
            // Keep programmatic scroll events from replacing the stored viewport.
            frame = requestAnimationFrame(() => {
                if (token === revision && !disposed && ownsDraft()) {
                    restoring = false
                    onRestored?.(element.scrollTop)
                }
            })
        }
        // Native Chats mounts its message children in an effect after this effect.
        frame = requestAnimationFrame(() => { frame = requestAnimationFrame(restore) })
    }

    return {
        capture,
        setVisible,
        dispose() {
            capture()
            disposed = true
            revision++
            cancelAnimationFrame(frame)
        },
    }
}
