// Uses an existing dependency checkout, never installs packages or builds the app.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, writeFile, cp, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
const root = resolve(process.argv[2] || process.cwd())
const require = createRequire(join(root, 'package.json'))
const ts = require('typescript'), { compileModule, compile } = require('svelte/compiler')
const directory = fileURLToPath(new URL('..', import.meta.url))
const temporary = await mkdtemp(join(tmpdir(), 'elsewords-native-test-'))
try {
    await cp(directory, temporary, { recursive: true })
    await writeFile(join(temporary, 'package.json'), '{"type":"module"}')
    await symlink(join(root, 'node_modules'), join(temporary, 'node_modules'))
    for (const name of ['files.ts', 'session.svelte.ts', 'entry.ts', 'requestOptions.ts', 'imageRequest.ts', 'filePicker.ts']) {
        const source = await readFile(join(directory, name), 'utf8')
        let output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 }, reportDiagnostics: true }).outputText
        if (name.endsWith('.svelte.ts')) output = compileModule(output, { filename: name, generate: 'client' }).js.code
        output = output.replace("from './files'", "from './files.js'").replace("from './session.svelte'", "from './session.svelte.js'")
        await writeFile(join(temporary, name.replace(/\.ts$/, '.js')), output)
    }
    const { runFilePickerCases } = await import(pathToFileURL(join(temporary, 'tests/filePickerCases.js')).href)
    const { chooseElsewordsFile } = await import(pathToFileURL(join(temporary, 'filePicker.js')).href)
    await runFilePickerCases(chooseElsewordsFile)
    const { ElsewordsSession } = await import(pathToFileURL(join(temporary, 'session.svelte.js')).href)
    const { runSessionCases } = await import(pathToFileURL(join(temporary, 'tests/sessionCases.js')).href)
    await runSessionCases(ElsewordsSession)
    const { createImageFetcher, imageFailureHint } = await import(pathToFileURL(join(temporary, 'imageRequest.js')).href)
    const imageRequests = []
    const transport = async (url, args) => { imageRequests.push({ url, args }); return { ok: true, status: 200, headers: {}, data: new TextEncoder().encode(JSON.stringify({ data: [] })) } }
    const imageFetch = createImageFetcher(transport)
    await imageFetch('https://openrouter.ai/api/v1/images/models')
    await imageFetch('https://openrouter.ai/api/v1/images', { method: 'POST', headers: { Authorization: 'Bearer fake-test-key' }, body: JSON.stringify({ model: 'fixture/image', prompt: 'Fictional portrait', input_references: [] }) })
    assert.equal(imageRequests[0].args.method, 'GET'); assert.equal(imageRequests[0].args.rawResponse, true)
    assert.deepEqual(imageRequests[1].args.body, { model: 'fixture/image', prompt: 'Fictional portrait', input_references: [] })
    await assert.rejects(imageFetch('https://example.com'), /Unsupported/); assert.equal(imageRequests.length, 2)
    // Reuse the actual image pipeline with a fictitious multimodal catalog.
    // User-visible names are context only, never guessed API slugs or capabilities.
    const imageSource = await readFile(join(directory, '../plugins/apiV3/imageGeneration.ts'), 'utf8')
    await writeFile(join(temporary, 'imageGeneration.js'), ts.transpileModule(imageSource, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 } }).outputText)
    const { generateOpenRouterImage } = await import(pathToFileURL(join(temporary, 'imageGeneration.js')).href)
    const referencePng = (await readFile(join(directory, 'tests/fixtures/ccv2.png'))).toString('base64')
    const fakeCatalog = { data: [{ id: 'fixture/image-with-text-capability', name: 'Synthetic multimodal model', architecture: { input_modalities: ['text', 'image'], output_modalities: ['text', 'image'] }, supported_parameters: { input_references: { type: 'range', min: 0, max: 1 }, resolution: { type: 'enum', values: ['1K'] } } }] }
    const pipelineCalls = []
    const pipelineTransport = async (url, args) => { pipelineCalls.push({ url, args }); return { ok: true, status: 200, headers: {}, data: new TextEncoder().encode(JSON.stringify(url.endsWith('/models') ? fakeCatalog : { data: [{ b64_json: referencePng, media_type: 'image/png' }] })) } }
    const portrait = await generateOpenRouterImage({ prompt: 'Fictitious portrait', referenceImageDataUrl: `data:image/png;base64,${referencePng}` }, { apiKey: 'fake-only-key', modelId: 'fixture/image-with-text-capability', imageOptions: { resolution: '1K' }, fetcher: createImageFetcher(pipelineTransport) })
    assert.ok(portrait.startsWith('data:image/png;base64,')); assert.equal(pipelineCalls.length, 2)
    assert.equal(pipelineCalls[1].args.body.model, 'fixture/image-with-text-capability'); assert.equal(pipelineCalls[1].args.body.resolution, '1K'); assert.ok(pipelineCalls[1].args.body.input_references[0].image_url.url.includes(referencePng))
    pipelineCalls.length = 0
    await assert.rejects(generateOpenRouterImage({ prompt: 'Fictitious portrait' }, { apiKey: 'fake-only-key', modelId: 'fixture/image-with-text-capability', imageOptions: { resolution: '4K' }, fetcher: createImageFetcher(pipelineTransport) }), /configured resolution/)
    assert.equal(pipelineCalls.length, 1, 'Unsupported image configuration rejected before generation; never retry another model')
    let failures = 0
    const failFetch = createImageFetcher(async () => { failures++; return { ok: false, status: 400, headers: {}, data: new TextEncoder().encode(JSON.stringify({ error: { message: 'unsupported aspect_ratio: fake-secret-key; private card sentinel' } })) } })
    await assert.rejects(failFetch('https://openrouter.ai/api/v1/images', { method: 'POST', body: '{}' }), error => error.message.includes('HTTP 400') && error.message.includes('image option') && !error.message.includes('fake-secret-key') && !error.message.includes('private card sentinel'))
    assert.equal(failures, 1); assert.ok(!imageFailureHint({ error: 'fake-secret-key: private card sentinel' }).includes('private card'))
    const { takeElsewordsSession, suspendElsewordsSession } = await import(pathToFileURL(join(temporary, 'entry.js')).href)
    const host = {}, local = { getItem: () => null }
    const retained = takeElsewordsSession(host, local); retained.brief = 'Retained brief'; suspendElsewordsSession(retained)
    assert.equal(takeElsewordsSession(host, local), retained); assert.equal(retained.brief, 'Retained brief'); retained.close()
    assert.notEqual(takeElsewordsSession(host, local), retained)
    const { cardRequestOptions } = await import(pathToFileURL(join(temporary, 'requestOptions.js')).href)
    assert.deepEqual(cardRequestOptions('Only explicit text').formated, [{ role: 'user', content: 'Only explicit text' }])
    assert.equal(cardRequestOptions('x').isolatedContext, true); assert.equal(cardRequestOptions('x').currentChar, undefined)
    const appRoot = fileURLToPath(new URL('../..', import.meta.url))
    await writeFile(join(temporary, 'testContext.js'), `export const db = { instructChatTemplate: 'jinja', JinjaTemplate: '{{ risu_char }}|{{ risu_user }}|{% for message in messages %}{{ message.content }}{% endfor %}', ooba: { formating: { userPrefix: 'User' } }, username: 'Private user sentinel', NAIsettings: { seperator: '\\n', starter: 'Start' }, NAIappendName: true }; export function getDatabase() { return db } export function getCurrentCharacter() { throw new Error('Implicit character read') } export function getUserName() { throw new Error('Implicit persona read') }`)
    for (const [sourcePath, target] of [['process/templates/chatTemplate.ts', 'chatTemplate.js'], ['process/models/nai.ts', 'nai.js'], ['process/stringlize.ts', 'stringlize.js']]) {
        let source = await readFile(join(appRoot, sourcePath), 'utf8')
        source = source.replace(/import \{ getCurrentCharacter, getDatabase \} from 'src\/ts\/storage\/database.svelte';/, "import { getCurrentCharacter, getDatabase } from './testContext.js';")
          .replace(/import \{ getDatabase \} from ["'][^"']*storage\/database.svelte["'];?/, "import { getDatabase } from './testContext.js';")
          .replace(/import \{ getUserName \} from ["'][^"']*util["'];?/, "import { getUserName } from './testContext.js';")
        const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022 } }).outputText
        await writeFile(join(temporary, target), output)
    }
    globalThis.safeStructuredClone = structuredClone
    const { applyChatTemplate } = await import(pathToFileURL(join(temporary, 'chatTemplate.js')).href)
    const { stringlizeNAIChat } = await import(pathToFileURL(join(temporary, 'nai.js')).href)
    const { stringlizeAINChat, getStopStrings } = await import(pathToFileURL(join(temporary, 'stringlize.js')).href)
    assert.equal(applyChatTemplate([{ role: 'user', content: 'Explicit card' }], { isolatedContext: true }), '||Explicit card')
    assert.ok(!getStopStrings(false, true).includes('Private user sentinel:')); assert.ok(getStopStrings().includes('Private user sentinel:'))
    const savedLog = console.log; let promptLogs = 0; console.log = () => { promptLogs++ }
    try { assert.ok(stringlizeNAIChat([{ role: 'user', content: 'Explicit card' }], '', false, true).includes('Explicit card')); assert.ok(stringlizeAINChat([{ role: 'user', content: 'Explicit card' }], '', false, true).includes('Explicit card')) } finally { console.log = savedLog }
    assert.equal(promptLogs, 0)
    const workspace = await readFile(new URL('../../../lib/Elsewords/ElsewordsWorkspace.svelte', import.meta.url), 'utf8')
    // Both native consumers must use the readable host store, not alert.ts's set-only wrapper.
    const hostSource = await readFile(join(directory, 'host.ts'), 'utf8')
    for (const source of [hostSource, workspace]) {
        assert.match(source, /import \{[^}]*alertStore[^}]*\} from ['"][^'"]*stores\.svelte['"]/)
        assert.doesNotMatch(source, /import \{[^}]*alertStore[^}]*\} from ['"][^'"]*\/alert['"]/)
    }
    // Check the inferred JS schema contract without loading the application dependency graph.
    const probe = join(temporary, 'preferences-contract.ts')
    await writeFile(probe, `import { defaultPreferences, loadPreferences, validatePreferences, type Preferences } from './preferences.js';
const form: Preferences = { ...defaultPreferences };
form.sourceMode = 'manual'; form.style = 'close'; form.target = 'Other'; form.tone = false;
const restored: Preferences = loadPreferences(localStorage).values;
const imported: Preferences = validatePreferences({ ...form });
// @ts-expect-error Unsupported modes must stay rejected by the schema type.
form.sourceMode = 'unsupported';
`)
    const program = ts.createProgram([probe, join(temporary, 'imageRequest.ts')], { noEmit: true, allowJs: true, checkJs: false, strict: true, skipLibCheck: true, types: [], target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler })
    const diagnostics = ts.getPreEmitDiagnostics(program)
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: name => name, getCurrentDirectory: () => temporary, getNewLine: () => '\n' }))
    // Preserve actual project compiler semantics: strict=false changes contextual inference.
    // Limit roots and automatic ambient types; no application build or dependency install.
    const configPath = resolve(directory, '../../../tsconfig.json')
    const config = ts.readConfigFile(configPath, ts.sys.readFile)
    assert.equal(config.error, undefined)
    const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, resolve(directory, '../../..'))
    assert.equal(parsedConfig.errors.length, 0)
    const configuredProgram = ts.createProgram([join(directory, 'imageRequest.ts'), join(directory, 'filePicker.ts')], { ...parsedConfig.options, types: [] })
    const configuredDiagnostics = ts.getPreEmitDiagnostics(configuredProgram)
    assert.equal(configuredDiagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(configuredDiagnostics, { getCanonicalFileName: name => name, getCurrentDirectory: () => directory, getNewLine: () => '\n' }))
    const compiled = compile(workspace, { filename: 'ElsewordsWorkspace.svelte', generate: 'client' })
    const meaningful = compiled.warnings.filter(warning => !['css_unused_selector'].includes(warning.code))
    if (meaningful.length) throw new Error(meaningful.map(warning => `${warning.code}: ${warning.message}`).join('\n'))
    console.log('Native session, settings suspension, request/serializer isolation and isolated Svelte compilation passed. No provider or app build used.')
} finally { await rm(temporary, { recursive: true, force: true }) }
