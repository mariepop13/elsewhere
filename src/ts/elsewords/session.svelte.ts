import { finalResponseText } from './responseText.js'
import { clone, cardData, cardForElsewhereExport, cardForElsewhereCreation, cardExportFilename, collectTranslatableFields, createBatches, parseBatchResponse, parseGeneratedCardResponse, applyTranslations, createOutputReview, applyOutputReview, mergeCompletedCard, type Card, type ReviewField } from './cardCore.js'
import { toTranslatableCard, createConfirmedSave, applyTranslatableCard } from './characterAdapter.js'
import { buildPortraitPrompt, responseProblemHint, buildTranslationPrompt, buildTranslationRecoveryPrompt, buildGenerationPrompt, buildGenerationRecoveryPrompt } from './prompts.js'
import { defaultPreferences, loadPreferences, persistPreferences, validatePreferences, type Preferences } from './preferences.js'
import { parseCardFile, imageFromBytes, imageFromDataUrl, fromBase64, embedCardInPng } from './files'
import type { ElsewordsHost } from './host'

type Portrait = { base64: string; url: string }
type GenerationProgress = { kind: 'model' | 'image'; phase: string; elapsedSeconds: number; attempt: number; outcome: 'running' | 'success' | 'error' | 'cancelled' }
type Confirmation = 'save' | 'create' | 'preferences' | null
export class ElsewordsSession {
    tab = $state<'translate' | 'generate'>('translate')
    form = $state<Preferences>({ ...defaultPreferences })
    card = $state<Card | null>(null)
    output = $state<Card | null>(null)
    reviewBase = $state<Card | null>(null)
    review = $state<ReviewField[]>([])
    original = $state<any>(null)
    sourceId = $state<string | null>(null)
    groupId = $state<string | null>(null)
    choices = $state<any[]>([])
    choiceId = $state('')
    origin = $state<'active' | 'imported' | 'generated' | null>(null)
    png = $state<string | null>(null)
    format = $state<'json' | 'png'>('json')
    resultKind = $state<'translation' | 'generated' | null>(null)
    mode = $state<'create' | 'complete'>('create')
    brief = $state('')
    imagePrompt = $state('')
    reference = $state<Portrait | null>(null)
    artwork = $state<Portrait | null>(null)
    busy = $state<string | null>(null)
    progress = $state<GenerationProgress | null>(null)
    private progressTimer: ReturnType<typeof setInterval> | null = null
    private progressStarted = 0
    confirmation = $state<Confirmation>(null)
    replacePortrait = $state(false)
    status = $state('')
    error = $state('')
    debug = $state<{ label: string; error: string; response: string }[]>([])
    legacy = $state<any>(null)
    preferencesImported = $state(false)
    preferencesExist = $state(false)
    private valid = true
    private controller: AbortController | null = null
    private preferencesBroken = false
    constructor(private host: ElsewordsHost, private storage: Storage) {
        try {
            const saved = loadPreferences(storage)
            this.form = saved.values; this.preferencesImported = saved.imported; this.preferencesExist = saved.exists
        } catch (error) { this.preferencesBroken = true; this.error = `Preferences were retained but could not be loaded: ${message(error)}` }
    }
    get pending() { return this.review.some(field => field.draft !== field.translation) }
    get locked() { return Boolean(this.busy || this.confirmation) }
    get canOutput() { return Boolean(this.output && !this.locked && !this.pending) }
    get hasPortrait() { return Boolean(this.artwork && this.resultKind === 'generated' || this.original?.image || this.png) }
    guard() { if (!this.valid) throw new Error('Elsewords was closed. This operation was discarded.') }
    close() { this.stopProgress(); this.progress = null; this.busy = null; this.valid = false; this.controller?.abort(); this.resetSource(); this.brief = ''; this.imagePrompt = ''; this.reference = null; this.artwork = null; this.debug = []; this.legacy = null; this.confirmation = null; this.status = ''; this.error = '' }
    persist() {
        if (this.preferencesBroken) { this.error = 'The original native preferences could not be loaded. They are retained; changes are session-only.'; return }
        try { persistPreferences(this.storage, this.form, this.preferencesImported); this.preferencesExist = true }
        catch (error) { this.error = `Preferences could not be saved: ${message(error)}` }
    }
    private clearMessage() { this.status = ''; this.error = ''; this.debug = [] }
    private resetSource() {
        this.card = null; this.output = null; this.reviewBase = null; this.review = []; this.original = null
        this.origin = null; this.sourceId = null; this.groupId = null; this.png = null; this.format = 'json'; this.resultKind = null
        this.choices = []; this.choiceId = ''; this.reference = null; this.artwork = null; this.debug = []
    }
    private stopProgress() {
        if (this.progressTimer !== null) clearInterval(this.progressTimer)
        this.progressTimer = null
        if (this.progress) this.progress.elapsedSeconds = Math.max(0, Math.floor((performance.now() - this.progressStarted) / 1000))
    }
    private phase(value: string) { if (this.progress && this.valid) this.progress.phase = value }
    private async awaitRequest<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
        if (signal.aborted) throw new Error('The request was cancelled. Previous output was retained.')
        let onAbort: () => void
        const cancelled = new Promise<never>((_, reject) => {
            onAbort = () => reject(new Error('The request was cancelled. Previous output was retained.'))
            signal.addEventListener('abort', onAbort, { once: true })
        })
        try {
            return await Promise.race([operation(), cancelled])
        } catch (error) { cancelled.catch(() => {}); throw error }
        finally { signal.removeEventListener('abort', onAbort!) }
    }
    private async job(kind: string, action: () => Promise<void>) {
        if (this.locked) return
        this.clearMessage(); this.busy = kind
        this.stopProgress(); this.progress = null
        const tracked = kind === 'model' || kind === 'image'
        if (tracked) this.controller = null
        if (tracked) {
            this.progressStarted = performance.now()
            this.progress = { kind, phase: 'Preparing request', elapsedSeconds: 0, attempt: 1, outcome: 'running' }
            this.progressTimer = setInterval(() => { if (this.progress && this.valid) this.progress.elapsedSeconds = Math.max(0, Math.floor((performance.now() - this.progressStarted) / 1000)) }, 1000)
        }
        let outcome: GenerationProgress['outcome'] = 'success'
        try { await action() } catch (error) {
            outcome = this.controller?.signal.aborted ? 'cancelled' : 'error'
            if (this.valid) this.error = message(error)
        } finally {
            this.stopProgress()
            if (this.valid) {
                this.busy = null
                if (this.progress) { this.progress.outcome = outcome; this.progress.phase = outcome === 'success' ? 'Ready to review' : outcome === 'cancelled' ? 'Cancelled' : 'Failed' }
            }
        }
    }
    private stage(character: any, groupId: string | null = null) {
        const source = toTranslatableCard(character)
        this.resetSource(); this.original = clone(character); this.card = source; this.sourceId = character.chaId; this.groupId = groupId; this.origin = 'active'
        if (this.tab === 'generate') this.mode = 'complete'
        this.status = `Loaded ${character.name}. No character changes have been applied.`
    }
    loadActive() {
        if (this.locked) return
        this.clearMessage()
        try {
            const selected = this.host.selected()
            if (!selected) throw new Error('Open a character before loading it.')
            if (selected.type === 'group') {
                const choices = selected.characters.map(id => this.host.characters().find(c => c.chaId === id && c.type !== 'group')).filter(Boolean)
                if (!choices.length) throw new Error('This group has no available characters.')
                this.resetSource(); this.groupId = selected.chaId; this.choices = choices.map(c => ({ chaId: c.chaId, name: c.name })); this.choiceId = choices[0].chaId
                if (this.tab === 'generate') this.mode = 'complete'
                this.status = 'Choose one group character below.'
            } else this.stage(selected)
        } catch (error) { this.error = message(error) }
    }
    loadMember() {
        if (this.locked) return
        try {
            const group = this.host.selected()
            if (group?.type !== 'group' || group.chaId !== this.groupId || !group.characters.includes(this.choiceId)) throw new Error('The open group changed. Load it again.')
            const member = this.host.characters().find(c => c.chaId === this.choiceId)
            this.stage(member, this.groupId)
        } catch (error) { this.error = message(error) }
    }
    importCard() { return this.job('file', async () => {
        this.controller = new AbortController()
        const file = await this.host.chooseFile(['json', 'png'], this.controller.signal); this.guard(); if (!file) { this.status = 'Card selection cancelled. Previous input and output were retained.'; return }
        const parsed = parseCardFile(file.name, file.data); cardData(parsed.card)
        this.resetSource(); this.card = parsed.card; this.png = parsed.png; this.format = parsed.format; this.origin = 'imported'
        if (this.tab === 'generate') this.mode = 'complete'
        this.status = `Loaded ${file.name}. The imported card has not been saved as a character.`
    }) }
    private showOutput(output: Card, original: Card | null, kind: 'translation' | 'generated') {
        this.reviewBase = clone(output); this.output = output; this.review = createOutputReview(output, original); this.resultKind = kind
        this.status = 'Review and edit the result, then confirm before applying it.'
    }
    private diagnostic(label: string, error: unknown, response: string) {
        const finalText = finalResponseText(response)
        this.debug.push({ label, error: message(error), response: finalText.length > 8000 ? finalText.slice(0, 8000) + '\n[Diagnostic display limited to 8000 characters; not evidence of provider truncation.]' : finalText })
    }
    private async request(prompt: string, identity: string) {
        this.guard(); if (this.host.modelIdentity() !== identity) throw new Error('The configured model changed. Start this operation again.')
        const controller = this.controller!
        this.phase('Waiting for text model response')
        const result = await this.awaitRequest(() => this.host.request(prompt, controller.signal), controller.signal)
        this.phase('Validating response')
        this.guard(); if (this.host.modelIdentity() !== identity) throw new Error('The configured model changed. The response was discarded.')
        if (controller.signal.aborted) throw new Error('The request was cancelled. Previous output was retained.')
        return result
    }
    private async recover<T>(prompt: string, parser: (text: string) => T, recovery: (text: string) => string, identity: string) {
        if (this.progress) this.progress.attempt = 1
        const response = await this.request(prompt, identity)
        try { return parser(response) } catch (error) {
            this.diagnostic('Original response', error, response); this.status = 'The response is invalid. Retrying once…'
            if (this.progress) this.progress.attempt = 2
            this.phase('Preparing the single recovery attempt')
            const retry = await this.request(recovery(response), identity)
            try { return parser(retry) } catch (second) {
                this.diagnostic('Recovery response', second, retry)
                throw new Error(`${message(second)} The automatic retry failed. ${responseProblemHint(retry)}`)
            }
        }
    }
    translate() { return this.job('model', async () => {
        if (!this.card) throw new Error('Load a character or import a card first.')
        const target = this.form.target === 'Other' ? this.form.customTarget : this.form.target || this.form.customTarget
        if (!target.trim()) throw new Error('Choose a target language.')
        if (this.form.sourceMode === 'manual' && !this.form.sourceLanguage.trim()) throw new Error('Enter the source language.')
        this.persist(); const source = clone(this.card); const options = clone(this.form)
        const fields = collectTranslatableFields(source, { translateNames: options.names })
        if (!fields.length) throw new Error('This card has no supported text fields.')
        const batches = createBatches(fields); const translations = []; const identity = this.host.modelIdentity()
        this.controller = new AbortController()
        for (let index = 0; index < batches.length; index++) {
            this.status = `Translating batch ${index + 1} of ${batches.length}…`
            const batch = batches[index]
            translations.push(...await this.recover(buildTranslationPrompt(batch, options, target), text => parseBatchResponse(text, batch), text => buildTranslationRecoveryPrompt(text, batch), identity))
        }
        this.guard(); this.showOutput(applyTranslations(source, fields, translations), source, 'translation')
    }) }
    generate() { return this.job('model', async () => {
        const brief = this.brief.trim(); if (!brief) throw new Error('Enter a description or rewrite instructions.')
        const mode = this.mode; const source = this.card ? clone(this.card) : null
        if (mode === 'complete' && !source) throw new Error('Load a card before completing it.')
        this.controller = new AbortController(); const identity = this.host.modelIdentity(); this.status = 'Generating character card…'
        const result = await this.recover(buildGenerationPrompt(brief, mode, source), text => { const parsed = parseGeneratedCardResponse(text); return mode === 'complete' ? mergeCompletedCard(source, parsed) : parsed }, text => buildGenerationRecoveryPrompt(text, brief, mode, source), identity)
        const generated = mode === 'complete' || result.spec === 'chara_card_v3' && result.data ? result : { spec: 'chara_card_v3', spec_version: '3.0', data: cardData(result) }
        const output = generated
        applyOutputReview(output, createOutputReview(output), { generated: true })
        this.guard()
        if (mode === 'create') { this.card = generated; this.origin = 'generated'; this.original = null; this.sourceId = null; this.groupId = null; this.png = null; this.format = 'json' }
        this.showOutput(output, mode === 'complete' ? source : null, 'generated')
    }) }
    cancelRequest() { if (this.busy === 'model' || this.busy === 'image') this.controller?.abort() }
    updatePreview() {
        if (this.locked || !this.reviewBase) return
        try {
            const output = applyOutputReview(this.reviewBase, this.review, { generated: this.resultKind === 'generated' })
            const normalizedFields = collectTranslatableFields(output, { includeEmpty: true })
            this.output = output; this.review.forEach((field, index) => { field.draft = normalizedFields[index].text; field.translation = field.draft }); this.error = ''; this.status = 'Preview updated. No model request was made.'
        } catch (error) { this.error = message(error) }
    }
    cancelEdits() { if (!this.locked) { this.review.forEach(field => { field.draft = field.translation }); this.error = ''; this.status = 'Edits cancelled. The last validated preview was retained.' } }
    ask(type: Confirmation) { if (this.canOutput || type === 'preferences' && !this.locked && this.legacy) { this.confirmation = type; this.replacePortrait = false } }
    cancelConfirmation() { this.confirmation = null; this.replacePortrait = false; this.status = 'Cancelled. No changes were applied.' }
    async confirm() {
        const type = this.confirmation; if (!type || this.busy) return
        const replace = this.replacePortrait
        this.confirmation = null
        if (type === 'preferences') {
            try { persistPreferences(this.storage, this.legacy, true); this.form = clone(this.legacy); this.preferencesImported = true; this.preferencesExist = true; this.preferencesBroken = false; this.legacy = null; this.status = 'All eight translation preferences were imported. Legacy settings were retained.' }
            catch (error) { this.error = message(error) }
            return
        }
        if (!this.output || this.pending) return
        return this.job('save', async () => {
            if (type === 'save') await this.saveExisting(replace)
            else await this.createNew()
        })
    }
    private currentSource() {
        this.guard(); const selected = this.host.selected()
        if (this.groupId) {
            if (selected?.type !== 'group' || selected.chaId !== this.groupId || !selected.characters.includes(this.sourceId)) throw new Error('The open group changed. Reload before saving.')
            return this.host.characters().find(c => c.chaId === this.sourceId)
        }
        if (selected?.chaId !== this.sourceId) throw new Error('The open character changed. Reload before saving.')
        return selected
    }
    private async saveExisting(replace: boolean) {
        if (this.origin !== 'active' || !this.original) throw new Error('Load an open character before applying changes.')
        const original = clone(this.original); const output = clone(this.output)
        const portraitBytes = replace && this.resultKind === 'generated' && this.artwork ? fromBase64(this.artwork.base64) : undefined
        if (replace && !portraitBytes) throw new Error('Select a portrait before replacing the current image.')
        const save = createConfirmedSave({ getCharacter: async () => this.currentSource(), savePortrait: async bytes => { this.guard(); const path = await this.host.savePortrait(bytes); this.guard(); return path }, setCharacter: async updated => {
            const latest = this.currentSource()
            // Recheck after asynchronous asset persistence, merging into current metadata.
            if (JSON.stringify(toTranslatableCard(latest)) !== JSON.stringify(toTranslatableCard(original)) || portraitBytes && latest.image !== original.image) throw new Error('The character changed while saving. Reload it before applying changes.')
            this.guard()
            const merged = applyTranslatableCard(this.currentSource(), output); if (portraitBytes) merged.image = updated.image
            await this.host.setCharacter(original.chaId, merged)
        } }, original, output, { portraitBytes })
        const updated = await save(); this.guard(); this.original = clone(updated)
        if (this.resultKind !== 'translation') this.card = toTranslatableCard(updated)
        this.status = `Saved changes to ${updated.name}${replace ? ' and replaced its portrait' : ''}.`
    }
    private async currentPortrait() {
        const image = this.original?.image
        if (this.origin !== 'active' || !image) throw new Error('The loaded character has no readable portrait.')
        const bytes = await this.host.readImage(image); this.guard()
        return imageFromBytes(new Uint8Array(bytes))
    }
    private async createNew() {
        const card = cardForElsewhereCreation(clone(this.output)); let portrait: string | undefined
        if (this.resultKind === 'generated' && this.artwork) portrait = this.artwork.url
        else if (this.origin === 'active' && this.original?.image) portrait = (await this.currentPortrait()).url
        else if (this.png) portrait = `data:image/png;base64,${this.png}`
        this.guard(); const created = await this.host.create(card, portrait, () => this.guard()); this.guard()
        this.status = `Created ${created.name} as a new character. The existing character was not changed.`
    }
    exportCard(withPortrait = false) { if (!this.canOutput) return; return this.job('file', async () => {
        const card = cardForElsewhereExport(clone(this.output))
        const selectedArtwork = this.resultKind === 'generated' && this.artwork
        const png = withPortrait ? (await this.currentPortrait()).base64 : selectedArtwork ? this.artwork.base64 : this.resultKind === 'translation' && this.format === 'png' ? this.png : null
        this.guard(); const downloaded = await this.host.download(cardExportFilename(card, this.resultKind, png ? 'png' : 'json'), png ? fromBase64(embedCardInPng(png, card)) : JSON.stringify(card, null, 2), () => this.guard())
        this.guard(); this.status = downloaded === false ? 'Download cancelled. The reviewed output was retained.' : 'The reviewed card was handed to the native download flow.'
    }) }
    chooseImage(reference = false) { return this.job('file', async () => {
        this.controller = new AbortController()
        const file = await this.host.chooseFile(['png', 'jpg', 'jpeg', 'webp'], this.controller.signal); this.guard(); if (!file) { this.status = 'Image selection cancelled. Previous portrait and reference were retained.'; return }
        if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('Choose a PNG, JPEG or WebP image.')
        const image = await imageFromBytes(file.data); this.guard()
        if (reference) this.reference = image; else this.artwork = image
        this.status = reference ? 'Reference selected. It will be sent only when generating a portrait.' : 'Portrait selected for PNG export and confirmed creation.'
    }) }
    useCurrentReference() { return this.job('file', async () => { const portrait = await this.currentPortrait(); this.guard(); this.reference = portrait; this.status = 'Current portrait selected as reference. It is not sent until you generate a portrait.' }) }
    generatePortrait() { return this.job('image', async () => {
        const prompt = this.imagePrompt.trim(); if (!prompt) throw new Error('Enter a portrait prompt.')
        this.controller = new AbortController(); const controller = this.controller
        const guard = () => { this.guard(); if (controller.signal.aborted) throw new Error('The request was cancelled. Previous portrait was retained.') }
        this.status = 'Generating portrait…'; this.phase('Awaiting confirmation, then the image response')
        const response = await this.awaitRequest(() => this.host.generatePortrait(buildPortraitPrompt(prompt), this.reference?.url, guard, controller.signal, phase => this.phase(phase)), controller.signal)
        guard(); this.phase('Validating and preparing portrait preview')
        const image = await imageFromDataUrl(response); guard(); this.artwork = image; this.status = 'Portrait ready. The previous character image has not changed.'
    }) }
    inspectLegacy() { return this.job('preferences', async () => {
        this.legacy = null
        const legacy = await this.host.legacyPreferences(); this.guard(); this.legacy = validatePreferences(legacy)
        this.status = 'Review the eight legacy values below before importing. The old plugin storage is shared and will not be deleted.'
    }) }
}
function message(error: unknown) { return error instanceof Error ? error.message : 'The operation failed. Previous data was retained.' }
export function reviewLabel(path: (string | number)[]) {
    const labels = { name: 'Name', description: 'Description', personality: 'Personality', scenario: 'Scenario', first_mes: 'First message', firstMes: 'First message', mes_example: 'Example messages', mesExample: 'Example messages', creator_notes: 'Creator notes', creatorNotes: 'Creator notes', system_prompt: 'System prompt', systemPrompt: 'System prompt', post_history_instructions: 'Post-history instructions', postHistoryInstructions: 'Post-history instructions', alternate_greetings: 'Alternate greeting', alternateGreetings: 'Alternate greeting', character_book: 'Lorebook', extensions: 'Extensions', depth_prompt: 'Depth prompt', prompt: 'Prompt', content: 'Content', entries: 'Entry' }
    return path.map(part => typeof part === 'number' ? String(part + 1) : labels[part] || part.replace(/_/g, ' ')).join(' › ')
}
