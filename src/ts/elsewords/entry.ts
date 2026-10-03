import { writable } from 'svelte/store'
export const elsewordsOpen = writable(false)
export function openElsewords() { elsewordsOpen.set(true) }

import { ElsewordsSession } from './session.svelte'
import type { ElsewordsHost } from './host'
let suspended: ElsewordsSession | null = null
export function takeElsewordsSession(host: ElsewordsHost, storage: Storage) {
    const session = suspended ?? new ElsewordsSession(host, storage)
    suspended = null
    return session
}
export function suspendElsewordsSession(session: ElsewordsSession) { suspended = session }
