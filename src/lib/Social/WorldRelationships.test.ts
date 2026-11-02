import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushSync, mount, unmount } from 'svelte'
import Relationships from './WorldRelationships.svelte'
import { createSocialFeed } from '../../ts/social/socialFeed'
import { createNativeRelationships, nativeRelationshipKey, recordNativeRelationship, loadNativeRelationships } from '../../ts/social/nativeRelationships'
import type { ExplicitRelationshipCommand } from '../../ts/social/relationshipEventAdapter'
vi.mock('src/ts/stores.svelte', () => ({ DBState: { db: {} } }))
vi.mock('src/ts/globalApi.svelte', () => ({ saving: { error: '' } }))
vi.mock('src/ts/process/index.svelte', async () => { const { writable } = await import('svelte/store'); return { doingChat: writable(false) } })
import { DBState } from 'src/ts/stores.svelte'
import { doingChat } from 'src/ts/process/index.svelte'
let component: ReturnType<typeof mount> | undefined
let feed = createSocialFeed()
function database() {
    let id = 0; const workspace = createNativeRelationships(() => `fixture-${++id}`), relation = nativeRelationshipKey(workspace, 'alice', 'jun')
    const command: ExplicitRelationshipCommand = { commandId: 'note-event', relation, source: { ...workspace.binding, kind: 'authored_note', recordId: 'note', participants: [relation.subject, relation.other] }, actionType: 'relationship.initialized', scope: 'private', knownBy: [relation.subject, relation.other], time: 1, explanation: 'PRIVATE EXPLANATION', description: 'PRIVATE MEMORY', values: { trust: 40 } }
    return { personas: [{ id: 'alice', name: 'Alice' }, { id: 'bea', name: 'Bea' }], characters: [{ chaId: 'jun', name: 'Jun', type: 'character', chats: [] }, { chaId: 'nell', name: 'Nell', type: 'character', chats: [] }], worldWorkspace: { relationshipWorkspace: recordNativeRelationship(workspace, command, relation, feed, ['alice', 'bea'], ['jun', 'nell']) } }
}
beforeEach(() => { feed = createSocialFeed(); DBState.db = database() as never })
afterEach(async () => { if (component) await unmount(component); component = undefined; document.body.innerHTML = ''; doingChat.set(false); vi.restoreAllMocks() })
function render(personaId = 'alice', characterId = 'jun') { component = mount(Relationships, { target: document.body, props: { feed, personaId, characterId, onpost: vi.fn() } }); flushSync() }
it('shows the exact character/persona projection and authorized recent memories without writing', () => {
    const before = JSON.stringify(DBState.db); render()
    expect(document.body.textContent).toContain('Alice'); expect(document.body.textContent).toContain('40%')
    expect(document.body.textContent).toContain('PRIVATE MEMORY'); expect(document.querySelector('select')!.textContent).not.toContain('Nell')
    expect(JSON.stringify(DBState.db)).toBe(before)
})
it('does not carry private scores or memories to another persona', () => {
    render('bea'); expect(document.body.textContent).not.toContain('PRIVATE'); expect(document.body.textContent).not.toContain('40%')
})
it('hides revoked knowledge and unavailable source notes', () => {
    const loaded = loadNativeRelationships(DBState.db.worldWorkspace?.relationshipWorkspace)
    if (loaded.status !== 'ready') throw Error('Fixture state missing')
    const raw = loaded.workspace.state as { ledger: { events: { knownBy: unknown[] }[] } }
    raw.ledger.events[0].knownBy = [{ kind: 'character', id: 'jun' }]
    DBState.db.worldWorkspace!.relationshipWorkspace = loaded.workspace
    render(); expect(document.body.textContent).not.toContain('PRIVATE'); expect(document.body.textContent).not.toContain('40%')
})
it('public viewpoint excludes private explanations and memories', () => {
    render(); const select = document.querySelector<HTMLSelectElement>('select')!, querySelector = select.querySelector.bind(select)
    // Happy DOM only implements OPTION :checked through selected state.
    vi.spyOn(select, 'querySelector').mockImplementation(selector => selector === ':checked' ? [...select.options].find(option => option.selected) ?? null : querySelector(selector))
    select.value = 'public'; select.dispatchEvent(new Event('change', { bubbles: true })); flushSync()
    expect(document.body.textContent).not.toContain('PRIVATE'); expect(document.body.textContent).not.toContain('40%')
    expect(document.body.textContent).not.toContain('Record a private interaction')
})
it('blocks edits during generation, leaves the save intact and restores controls afterward', () => {
    render(); const before = JSON.stringify(DBState.db); doingChat.set(true); flushSync()
    const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Record a private interaction')!
    expect(button.disabled).toBe(true); button.click(); expect(JSON.stringify(DBState.db)).toBe(before)
    doingChat.set(false); flushSync(); expect(button.disabled).toBe(false)
})
it('a stale mounted owner cannot seed a replacement save', async () => {
    DBState.db.worldWorkspace!.relationshipWorkspace = undefined; render(); DBState.db = database() as never
    DBState.db.worldWorkspace!.relationshipWorkspace = undefined
    document.querySelector<HTMLButtonElement>('button')!.click(); flushSync(); expect(DBState.db.worldWorkspace!.relationshipWorkspace).toBeUndefined()
})
