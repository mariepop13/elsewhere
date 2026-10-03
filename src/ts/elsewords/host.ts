import { get } from 'svelte/store'
import { DBState, selectedCharID, alertStore } from '../stores.svelte'
import { getDatabase } from '../storage/database.svelte'
import { requestChatDataMain } from '../process/request/request'
import { generateOpenRouterImage } from '../plugins/apiV3/imageGeneration'
import { createCharacterFromCard, confirmUninterrupted } from '../plugins/apiV3/characterCreation'
import { prepareCharacterFromCard } from '../characterCards'
import { saveAsset, readImage, checkCharOrder, downloadFile, LocalWriter, globalFetch } from '../globalApi.svelte'
import { alertConfirm } from '../alert'
import { isTauri } from '../platform'
import { chooseElsewordsFile } from './filePicker'
import { SafeLocalPluginStorage } from '../plugins/pluginSafeClass'
import { imageFromBytes } from './files'
import { createImageFetcher } from './imageRequest'
import { cardRequestOptions } from './requestOptions'

export const elsewordsHost = {
    selected: () => DBState.db.characters[get(selectedCharID)],
    characters: () => DBState.db.characters,
    modelIdentity: () => {
        const db = getDatabase()
        // Local-only guard; never includes credentials or appears in prompts/logs.
        return JSON.stringify([db.aiModel, db.seperateModelsForAxModels, db.seperateModels, db.openrouterRequestModel, db.openrouterProvider, db.customProxyRequestModel, db.customAPIFormat, db.forceReplaceUrl, db.nanogptRequestModel, db.ollamaModel, db.ollamaCloudModel, db.ollamaModelSource, db.ollamaRequestFormat, db.ollamaURL, db.textgenWebUIBlockingURL, db.textgenWebUIStreamURL, db.koboldURL, db.instructChatTemplate, db.JinjaTemplate, db.customModels?.map(m => [m.id, m.internalId, m.format, m.url])])
    },
    async request(prompt: string, signal: AbortSignal) {
        const response = await requestChatDataMain(cardRequestOptions(prompt), 'model', signal)
        if (response.type !== 'success') throw new Error(typeof response.result === 'string' ? response.result : 'The model request failed.')
        if (typeof response.result !== 'string') throw new Error('This model did not return a text result.')
        return response.result
    },
    async generatePortrait(prompt: string, referenceImageDataUrl?: string, guard: () => void = () => {}, signal?: AbortSignal, onPhase: (phase: string) => void = () => {}) {
        const db = getDatabase()
        const imageIdentity = JSON.stringify([db.openrouterImageModel, db.openrouterImageOptions])
        onPhase('Awaiting portrait confirmation')
        if (!await confirmUninterrupted(`Generate an Elsewords portrait using the configured OpenRouter image model?${referenceImageDataUrl ? ' The selected reference image will be sent.' : ''}`, alertConfirm, alertStore)) throw new Error('Portrait generation was cancelled.')
        guard()
        if (JSON.stringify([getDatabase().openrouterImageModel, getDatabase().openrouterImageOptions]) !== imageIdentity) throw new Error('The configured image model or options changed. Generate the portrait again.')
        const fetcher = createImageFetcher(async (url, args) => {
            guard()
            const current = getDatabase()
            if (JSON.stringify([current.openrouterImageModel, current.openrouterImageOptions]) !== imageIdentity) throw new Error('The image model or options changed. Start portrait generation again.')
            onPhase(url.endsWith('/models') ? 'Checking image model capabilities' : 'Waiting for image response')
            return globalFetch(url, { ...args, abortSignal: signal ?? args.abortSignal })
        })
        const portrait = await generateOpenRouterImage({ prompt, referenceImageDataUrl }, { apiKey: db.openrouterKey, modelId: db.openrouterImageModel, imageOptions: db.openrouterImageOptions, fetcher })
        guard()
        const current = getDatabase()
        if (JSON.stringify([current.openrouterImageModel, current.openrouterImageOptions]) !== imageIdentity) throw new Error('The image model or options changed. The portrait response was discarded.')
        return portrait
    },
    chooseFile: chooseElsewordsFile,
    readImage,
    savePortrait: saveAsset,
    async setCharacter(id: string, character: any) {
        const index = DBState.db.characters.findIndex(c => c.chaId === id)
        if (index < 0) throw new Error('The character was removed. Reload it before saving.')
        DBState.db.characters[index] = character
    },
    async create(card: any, portraitDataUrl: string | undefined, guard: () => void) {
        return createCharacterFromCard({ card, portraitDataUrl }, {
            pluginName: 'Elsewords',
            // The native workspace already presents the named creation confirmation.
            confirm: async () => { guard(); return true },
            importCard: async value => { guard(); const character = await prepareCharacterFromCard(value, message => confirmUninterrupted(message, alertConfirm, alertStore)); guard(); return character },
            savePortrait: async bytes => { guard(); const path = await saveAsset(bytes); guard(); return path },
            decodeImage: async bytes => { await imageFromBytes(bytes) },
            getCharacters: () => { guard(); return DBState.db.characters },
            updateCharacterOrder: checkCharOrder,
        })
    },
    async download(name: string, data: Uint8Array | string, guard: () => void = () => {}) {
        guard()
        if (!isTauri) { await downloadFile(name, data); return true }
        const extension = name.endsWith('.png') ? 'png' : 'json'
        const writer = new LocalWriter()
        // Desktop save dialog supplies location and overwrite confirmation.
        if (!await writer.init(name.slice(0, -(extension.length + 1)), [extension])) return false
        guard()
        await writer.write(typeof data === 'string' ? new TextEncoder().encode(data) : data)
        await writer.close()
        return true
    },
    async legacyPreferences() { return new SafeLocalPluginStorage().getItem('settings') },
}
export type ElsewordsHost = typeof elsewordsHost
