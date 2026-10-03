import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('./socialTokenBudget', () => ({ preflightSocialContexts: async () => {}, preflightSocialPublication: async () => {} }))
import { flushSync, mount, unmount } from 'svelte'
import Harness from '../../test/fixtures/socialInteractionsHarness.svelte'
let component: ReturnType<typeof mount>
afterEach(async () => { if (component) await unmount(component); document.body.innerHTML = '' })
function render() { component = mount(Harness, { target: document.body }); flushSync() }
function act(name: string) { flushSync(() => [...document.querySelectorAll('button')].find(button => button.textContent === name)!.click()) }
function saved() { return JSON.parse(document.querySelector('output')!.textContent!) }

describe('first interactions on native Svelte state', () => {
    it('persists and renders the first comment when its optional array was absent', () => {
        render(); expect(saved().posts[0].comments).toBeUndefined()
        act('Comment')
        expect(saved().posts[0].comments).toHaveLength(1)
        expect(saved().posts[0].comments[0].text).toBe('First public comment')
        act('Comment'); expect(saved().posts[0].comments).toHaveLength(2)
    })
    it('persists the first canonical repost, undoes it and does not clone the original', () => {
        render(); expect(saved().reposts).toBeUndefined()
        act('Repost'); const state = saved()
        expect(state.reposts).toHaveLength(1)
        expect(state.reposts[0].postId).toBe(state.posts[0].id)
        expect(state.posts).toHaveLength(1)
        act('Repost'); expect(saved().reposts).toEqual([])
        act('Repost'); expect(saved().reposts).toHaveLength(1)
    })
    it('allocates persistent handles when its optional dictionary was absent', () => {
        render(); act('Allocate handles')
        expect(saved().handles).toEqual({ 'native-persona': 'mara', 'second-persona': 'mara_2' })
        act('Allocate handles')
        expect(saved().handles).toEqual({ 'native-persona': 'mara', 'second-persona': 'mara_2' })
    })
})
