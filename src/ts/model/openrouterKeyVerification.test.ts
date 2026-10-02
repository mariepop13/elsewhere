import { afterEach, describe, expect, it, vi } from 'vitest'
import { createKeyVerification, inspectOpenRouterKey, type KeyVerificationSnapshot, type KeyVerificationStatus } from './openrouterKeyVerification'

afterEach(() => vi.useRealTimers())
describe('explicit OpenRouter key inspection', () => {
    it('does not send an absent key', async () => {
        const transport = vi.fn()
        expect(await inspectOpenRouterKey('  ', transport, new AbortController().signal)).toBe('absent')
        expect(transport).not.toHaveBeenCalled()
    })
    it('uses only fixed authenticated metadata GET with logs disabled', async () => {
        const transport = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { is_free_tier: false, label: 'fake-metadata-never-rendered', limit_remaining: 0 } })))
        const signal = new AbortController().signal
        expect(await inspectOpenRouterKey(' fixture-key ', transport, signal)).toBe('valid')
        expect(transport).toHaveBeenCalledOnce()
        expect(transport).toHaveBeenCalledWith('https://openrouter.ai/api/v1/key', {
            method: 'GET', headers: { Authorization: 'Bearer fixture-key' }, signal, logFetch: false, requestTimeoutMs: 20000,
        })
    })
    it.each([401, 403])('reports refusal without reading error body (%s)', async status => {
        const response = new Response('fixture-secret-error', { status })
        const json = vi.spyOn(response, 'json')
        expect(await inspectOpenRouterKey('fixture-key', vi.fn().mockResolvedValue(response), new AbortController().signal)).toBe('refused')
        expect(json).not.toHaveBeenCalled()
    })
    it.each([402, 429, 500])('does not confuse quota/rate/server errors with invalid authentication (%s)', async status => {
        expect(await inspectOpenRouterKey('fixture-key', vi.fn().mockResolvedValue(new Response('ignored', { status })), new AbortController().signal)).toBe('unknown')
    })
    it.each([502, 504])('reports network/gateway failure (%s)', async status => {
        expect(await inspectOpenRouterKey('fixture-key', vi.fn().mockResolvedValue(new Response('ignored', { status })), new AbortController().signal)).toBe('network')
    })
    it.each(['<html>server login</html>', '{}', '{"data":[]}', '{"data":{}}'])('rejects unexpected successful responses: %s', async body => {
        expect(await inspectOpenRouterKey('fixture-key', vi.fn().mockResolvedValue(new Response(body)), new AbortController().signal)).toBe('unknown')
    })
    it('discards thrown credential/error details', async () => {
        expect(await inspectOpenRouterKey('fixture-key', vi.fn().mockRejectedValue(new Error('fixture-key')), new AbortController().signal)).toBe('network')
    })
})
describe('ephemeral verification identity', () => {
    function setup() {
        let credentials: KeyVerificationSnapshot = { key: 'fixture-a', context: 'openrouter/main' }
        const statuses: KeyVerificationStatus[] = []
        let resolve: (status: KeyVerificationStatus) => void = () => {}
        const inspect = vi.fn((_key, _signal) => new Promise<KeyVerificationStatus>(r => { resolve = r }))
        const check = createKeyVerification(() => credentials, inspect, status => statuses.push(status))
        return { check, inspect, statuses, change: (next: KeyVerificationSnapshot) => { credentials = next }, finish: (status: KeyVerificationStatus) => resolve(status) }
    }
    it('never auto-verifies on key/provider change', () => {
        const s = setup()
        s.check.invalidate()
        expect(s.statuses).toEqual(['unverified'])
        expect(s.inspect).not.toHaveBeenCalled()
        s.change({ key: '', context: 'other' }); s.check.invalidate()
        expect(s.statuses.at(-1)).toBe('absent')
    })
    it.each(['key', 'provider'])('drops stale success on %s change even before reactive invalidation', async kind => {
        const s = setup()
        const promise = s.check.verify()
        s.change({ key: kind === 'key' ? 'fixture-b' : 'fixture-a', context: kind === 'provider' ? 'other' : 'openrouter/main' })
        s.finish('valid'); await promise
        expect(s.statuses).toEqual(['checking'])
        s.check.invalidate()
        expect(s.statuses.at(-1)).toBe('unverified')
    })
    it('invalidates completed results and aborts pending requests', async () => {
        const s = setup()
        let promise = s.check.verify(); s.finish('valid'); await promise
        expect(s.statuses.at(-1)).toBe('valid')
        s.check.invalidate(); expect(s.statuses.at(-1)).toBe('unverified')
        promise = s.check.verify()
        s.check.invalidate()
        expect(s.inspect.mock.calls.at(-1)?.[1].aborted).toBe(true)
        s.finish('valid'); await promise
        expect(s.statuses.at(-1)).toBe('unverified')
    })
    it('drops in-flight result after disposal', async () => {
        const s = setup(); const promise = s.check.verify()
        s.check.dispose(); s.finish('valid'); await promise
        expect(s.statuses).toEqual(['checking'])
    })
    it('aborts on timeout without exposing exceptions', async () => {
        vi.useFakeTimers()
        const states: KeyVerificationStatus[] = []
        const check = createKeyVerification(() => ({ key: 'fixture-a', context: 'openrouter' }),
            (_key, signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('fixture-key')))),
            status => states.push(status))
        const promise = check.verify()
        await vi.advanceTimersByTimeAsync(20000); await promise
        expect(states).toEqual(['checking', 'unknown'])
    })
})
