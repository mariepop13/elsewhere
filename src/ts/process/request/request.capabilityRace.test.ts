import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'

// Execute the exact dispatcher with synthetic dependencies; no app bootstrap,
// credentials, metadata network, provider transport or implicit persona reads.
const source = readFileSync('src/ts/process/request/request.ts', 'utf8')
const dispatcher = source.slice(source.indexOf('export async function requestChatDataMain('), source.indexOf('async function requestNovelAI(')).replace('export async', 'async')
const compiled = ts.transpileModule(dispatcher, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 } }).outputText
function fixture() {
    const db: any = { aiModel: 'openrouter', subModel: 'openrouter', maxResponse: 100, maxContext: 1000, temperature: 70, openrouterRequestModel: 'fixture/original', genTime: 1, seperateModels: {} }
    let release: (value: object) => void = () => {}
    const load = vi.fn(() => new Promise(resolve => { release = resolve }))
    const dispatch = vi.fn(async (_arg: unknown) => ({ type: 'success', result: 'Synthetic output' }))
    const validate = vi.fn(() => [] as string[])
    const context = createContext({ getDatabase: () => db, getModelInfo: (id: string) => ({ id, format: 'openai' }), safeStructuredClone: structuredClone,
        selectionForModel: (_: unknown, modelId: string) => ({ provider: 'openrouter', modelId }), loadTokenCapabilities: load,
        validateTokenBudget: validate, reformater: (value: unknown) => value, LLMFormat: { OpenAICompatible: 'openai' }, requestOpenAI: dispatch })
    runInContext(compiled, context)
    const controller = new AbortController()
    return { db, load, dispatch, validate, controller, release: () => release({}), run: () => context.requestChatDataMain({ formated: [], isolatedContext: true }, 'model', controller.signal) }
}
describe('capability lookup dispatch boundary', () => {
    it('does not start metadata or dispatch for a pre-cancelled request', async () => {
        const f = fixture(); f.controller.abort(); expect(await f.run()).toMatchObject({ type: 'fail', noRetry: true }); expect(f.load).not.toHaveBeenCalled(); expect(f.dispatch).not.toHaveBeenCalled()
    })
    it('does not dispatch after cancellation during metadata lookup', async () => {
        const f = fixture(); const pending = f.run(); f.controller.abort(); f.release(); expect(await pending).toMatchObject({ type: 'fail', noRetry: true }); expect(f.dispatch).not.toHaveBeenCalled()
    })
    it.each(['model', 'route', 'auxiliary selection', 'custom endpoint'])('does not dispatch when %s changes during lookup', async change => {
        const f = fixture(); const pending = f.run()
        if (change === 'model') f.db.openrouterRequestModel = 'fixture/replacement'
        if (change === 'route') f.db.openrouterProvider = { only: ['fixture-route'] }
        if (change === 'auxiliary selection') { f.db.seperateModelsForAxModels = true; f.db.seperateModels.model = 'fixture/other' }
        if (change === 'custom endpoint') f.db.forceReplaceUrl = 'https://fixture.invalid/changed'
        f.release(); expect(await pending).toMatchObject({ type: 'fail', result: 'The configured model changed. Start this operation again.', noRetry: true }); expect(f.dispatch).not.toHaveBeenCalled()
    })
    it('preserves token validation and isolated dispatch when identity is unchanged', async () => {
        const f = fixture(); const pending = f.run(); f.release(); expect(await pending).toMatchObject({ type: 'success' }); expect(f.validate).toHaveBeenCalledOnce(); expect(f.dispatch).toHaveBeenCalledOnce(); expect(f.dispatch.mock.calls[0]?.[0]).toMatchObject({ isolatedContext: true })
    })
    it('still rejects an invalid token budget before dispatch', async () => {
        const f = fixture(); f.validate.mockReturnValue(['Synthetic token budget error']); const pending = f.run(); f.release(); expect(await pending).toMatchObject({ type: 'fail', result: 'Synthetic token budget error', noRetry: true }); expect(f.dispatch).not.toHaveBeenCalled()
    })
})
