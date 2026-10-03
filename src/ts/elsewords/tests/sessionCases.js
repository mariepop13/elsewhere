import assert from 'node:assert/strict'
import { defaultPreferences, preferenceKey, loadPreferences, persistPreferences } from '../preferences.js'
import { toTranslatableCard } from '../characterAdapter.js'
import { createBatches, collectTranslatableFields, cardData } from '../cardCore.js'

function storage() { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key), data } }
const character = () => ({ chaId: 'one', type: 'character', name: 'Luna', desc: 'Hello {{user}}', personality: 'Kind', scenario: 'Library', firstMessage: 'Hi {{user}}', exampleMessage: 'Example', globalLore: [], image: '', chats: [{ message: [{ data: 'Private chat sentinel' }] }], privateMetadata: 'Keep me' })
const generated = () => ({ spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'Nova', description: 'A moon librarian.', personality: 'Patient.', scenario: 'A quiet library.', first_mes: 'Welcome {{user}}.', mes_example: 'Nova: Welcome.', extensions: {} } })
function fixture(Session) {
    const original = character(); let selected = original, identity = 'main'
    const calls = { requests: [], writes: [], creates: [], downloads: [], images: [] }
    const host = {
        selected: () => selected, characters: () => [original], modelIdentity: () => identity,
        request: async (prompt, signal) => { calls.requests.push({ prompt, signal }); return JSON.stringify(generated()) },
        setCharacter: async (id, value) => { calls.writes.push(value); Object.assign(original, value) },
        create: async (card, portrait, guard) => { guard(); calls.creates.push({ card, portrait }); return { chaId: 'new', name: card.data.name } },
        download: async (name, bytes) => { calls.downloads.push({ name, bytes }) },
        legacyPreferences: async () => ({ ...defaultPreferences, target: 'French', tone: false, names: false, instructions: '  keep exact  ' }),
        chooseFile: async () => null,
        savePortrait: async () => 'assets/new.png', readImage: async () => new Uint8Array(),
        generatePortrait: async (prompt, reference, guard) => { guard(); calls.images.push({ prompt, reference }); return 'invalid' },
    }
    const local = storage(), session = new Session(host, local)
    const translation = async () => {
        session.loadActive(); const fields = collectTranslatableFields(session.card, { translateNames: session.form.names })
        const response = JSON.stringify(Object.fromEntries(createBatches(fields).flat().map(({ id, text }) => [id, `Translated: ${text}`])))
        host.request = async (prompt, signal) => { calls.requests.push({ prompt, signal }); return response }
        session.form.target = 'French'; await session.translate()
        assert.equal(session.error, '')
    }
    return { session, local, host, original, calls, translation, select: value => selected = value, model: value => identity = value }
}
export async function runSessionCases(Session) {
    {
        const oldInterval = globalThis.setInterval, oldClear = globalThis.clearInterval, oldPerformance = Object.getOwnPropertyDescriptor(globalThis, 'performance');
        const timers = new Map(); let tick = 0, id = 0;
        globalThis.setInterval = callback => { timers.set(++id, callback); return id; }; globalThis.clearInterval = timer => timers.delete(timer);
        Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => tick } });
        try {
            const f = fixture(Session); f.session.brief = 'Fictitious librarian'; let resolve;
            f.host.request = async () => new Promise(done => { resolve = done });
            let pending = f.session.generate(); assert.equal(f.session.progress.phase, 'Waiting for text model response'); assert.equal(f.session.progress.outcome, 'running'); assert.equal(timers.size, 1);
            tick = 2400; [...timers.values()].forEach(callback => callback()); assert.equal(f.session.progress.elapsedSeconds, 2);
            resolve(JSON.stringify(generated())); await pending; assert.equal(f.session.progress.outcome, 'success'); assert.equal(f.session.progress.phase, 'Ready to review'); assert.equal(timers.size, 0);
            const prior = JSON.stringify(f.session.output); let requests = 0; f.host.request = async () => { requests++; return requests === 1 ? 'bad' : JSON.stringify(generated()); }; await f.session.generate(); assert.equal(f.session.progress.attempt, 2); assert.equal(f.session.progress.outcome, 'success'); assert.equal(timers.size, 0);
            f.host.request = async () => { assert.equal(f.session.progress.attempt, 1, 'Each translation batch starts with attempt one'); return '{}'; };
            await f.session.recover('next batch', JSON.parse, () => 'retry', 'main');
            const aborted = new AbortController(); aborted.abort(); let invoked = false;
            await assert.rejects(f.session.awaitRequest(async () => { invoked = true; }, aborted.signal), /cancelled/); assert.equal(invoked, false);
            f.host.request = async () => 'bad'; await f.session.generate(); assert.equal(f.session.progress.outcome, 'error'); assert.equal(timers.size, 0);
            f.host.request = async () => new Promise(done => { resolve = done }); pending = f.session.generate(); f.session.cancelRequest(); await pending; assert.equal(f.session.progress.outcome, 'cancelled'); assert.equal(f.session.locked, false); assert.equal(timers.size, 0); resolve(JSON.stringify(generated())); await Promise.resolve(); assert.equal(JSON.stringify(f.session.output), prior);
            f.session.imagePrompt = 'A cucurbit portrait'; let portraitDone, capturedSignal, capturedPrompt;
            f.host.generatePortrait = async (prompt, reference, guard, signal, phase) => { capturedSignal = signal; capturedPrompt = prompt; phase('Checking image model capabilities'); phase('Waiting for image response'); return new Promise(done => { portraitDone = done }); };
            pending = f.session.generatePortrait(); assert.equal(f.session.progress.phase, 'Waiting for image response'); f.session.cancelRequest(); await pending; assert.equal(capturedSignal.aborted, true); assert.equal(f.session.progress.outcome, 'cancelled'); assert.equal(f.session.busy, null); assert.equal(timers.size, 0); portraitDone('invalid'); await Promise.resolve(); assert.equal(f.session.artwork, null); assert.match(capturedPrompt, /Never quote, transcribe, engrave/); assert.match(capturedPrompt, /reference lettering/);
            f.host.request = async () => new Promise(done => { resolve = done }); pending = f.session.generate(); f.session.close(); await pending; assert.equal(f.session.progress, null); assert.equal(f.session.busy, null); assert.equal(timers.size, 0); resolve(JSON.stringify(generated()));
        } finally { globalThis.setInterval = oldInterval; globalThis.clearInterval = oldClear; Object.defineProperty(globalThis, 'performance', oldPerformance); }
    }
    {
        const f = fixture(Session); f.session.reference = { base64: 'retained', url: 'data:image/png;base64,retained' };
        f.host.chooseFile = async () => null;
        for (let index = 0; index < 3; index++) { await f.session.chooseImage(true); assert.equal(f.session.locked, false); assert.equal(f.session.busy, null); assert.equal(f.session.reference.base64, 'retained'); assert.match(f.session.status, /cancelled/); }
        f.session.brief = 'Create a librarian'; await f.session.generate(); assert.ok(f.session.output, 'Cancel leaves the workspace actionable');
        f.session.imagePrompt = 'A portrait with the word HELLO on a sign'; await f.session.generatePortrait(); assert.match(f.calls.images[0].prompt, /unless the user explicitly requests/); assert.ok(f.calls.images[0].prompt.includes('word HELLO'));
    }
    {
        for (const [response, expected] of [['', /no final text/], ['<think>Fictional reasoning</think>', /reasoning without a final card/], ['{"spec":', /incomplete or did not match/], ['not a card', /incomplete or did not match/]]) {
            const f = fixture(Session); f.session.brief = 'Create librarian'; f.host.request = async prompt => { f.calls.requests.push({ prompt }); return response; }; await f.session.generate(); assert.equal(f.calls.requests.length, 2); assert.equal(f.session.debug.length, 2); assert.match(f.session.error, expected); assert.equal(f.session.output, null); assert.equal(f.session.locked, false);
        }
        const f = fixture(Session); f.session.brief = 'Create librarian'; let count = 0; f.host.request = async () => ++count === 1 ? '{"spec":' : JSON.stringify(generated()); await f.session.generate(); assert.equal(count, 2); assert.ok(f.session.output); assert.equal(f.session.error, '');
    }
    {
        const f = fixture(Session); f.session.loadActive(); f.session.mode = 'complete'; f.session.brief = 'Rewrite the librarian';
        f.session.card = { spec: 'chara_card_v2', spec_version: '2.0', extra: 'retain wrapper', data: { ...toTranslatableCard(f.original).data, customMetadata: 'retain data' } };
        let requests = 0;
        f.host.request = async () => { requests++; const card = generated(); if (requests > 1) card.data.description = '{{char}} welcomes {{user}} to the moon library.'; return JSON.stringify(card) };
        await f.session.generate();
        assert.equal(requests, 2, 'Missing completion macros use the one bounded recovery');
        assert.equal(f.session.error, ''); assert.equal(f.session.output.spec, 'chara_card_v2'); assert.equal(f.session.output.spec_version, '2.0');
        assert.equal(f.session.output.extra, 'retain wrapper'); assert.equal(f.session.output.data.customMetadata, 'retain data');
        assert.ok(f.session.output.data.description.includes('{{char}}')); assert.ok(f.session.output.data.description.includes('{{user}}'));
    }

    {
        const f = fixture(Session); await f.translation(); assert.equal(f.calls.writes.length, 0)
        const desc = f.session.review.find(field => field.path[0] === 'description'); desc.draft = 'Edited {{user}}'
        assert.equal(f.session.canOutput, false); await f.session.exportCard(); f.session.ask('save'); assert.equal(f.session.confirmation, null)
        const count = f.calls.requests.length; f.session.updatePreview(); assert.equal(f.calls.requests.length, count)
        assert.equal(cardData(f.session.output).description, 'Edited {{user}}'); assert.equal(f.session.canOutput, true)
        desc.draft = 'Removed variable'; f.session.updatePreview(); assert.match(f.session.error, /Preserve/); assert.equal(cardData(f.session.output).description, 'Edited {{user}}')
        f.session.cancelEdits(); f.session.ask('save'); f.session.cancelConfirmation(); assert.equal(f.calls.writes.length, 0)
        f.session.ask('save'); f.session.review[0].draft = 'mutated while confirmed'; await f.session.confirm(); assert.equal(f.calls.writes.length, 0)
        f.session.cancelEdits(); f.session.ask('save'); await f.session.confirm(); assert.equal(f.calls.writes.length, 1)
        assert.equal(f.original.desc, 'Edited {{user}}'); assert.equal(f.original.chats[0].message[0].data, 'Private chat sentinel'); assert.equal(f.original.privateMetadata, 'Keep me')
        await f.session.exportCard(); assert.equal(JSON.parse(f.calls.downloads[0].bytes).data.description, 'Edited {{user}}')
        assert.ok(f.calls.requests.every(call => !call.prompt.includes('Private chat sentinel') && !call.prompt.includes('Keep me')))
        f.session.close(); assert.equal(f.session.card, null); assert.equal(f.session.output, null); assert.equal(f.session.review.length, 0)
    }
    {
        const f = fixture(Session); await f.translation(); f.original.desc = 'Concurrent edit'; f.session.ask('save'); await f.session.confirm()
        assert.equal(f.calls.writes.length, 0); assert.match(f.session.error, /changed/)
    }
    {
        const f = fixture(Session); const group = { type: 'group', chaId: 'group', characters: ['one'] }; f.select(group); f.session.loadActive()
        assert.equal(f.session.choices.length, 1); f.session.loadMember(); assert.equal(f.session.groupId, 'group')
        const source = toTranslatableCard(f.original); f.session.output = source; f.session.reviewBase = source
        group.characters = []; f.session.ask('save'); await f.session.confirm(); assert.equal(f.calls.writes.length, 0); assert.match(f.session.error, /group changed/)
    }
    {
        const f = fixture(Session); f.session.brief = 'Create a librarian'; await f.session.generate()
        assert.equal(f.session.error, ''); assert.ok(f.session.review.every(field => field.original === null)); f.session.ask('create'); f.session.cancelConfirmation(); assert.equal(f.calls.creates.length, 0)
        f.session.ask('create'); await f.session.confirm(); assert.equal(f.calls.creates.length, 1); assert.equal(f.calls.writes.length, 0)
        const personality = f.session.review.find(field => field.path[0] === 'personality'); personality.draft = 'TBD'; f.session.updatePreview(); assert.match(f.session.error, /placeholder/); assert.equal(f.session.canOutput, false); f.session.cancelEdits()
        f.session.review.find(field => field.path[0] === 'description').draft = 'Pending correction'
        const output = JSON.stringify(f.session.output); f.host.request = async () => 'bad response'
        await f.session.generate(); assert.equal(JSON.stringify(f.session.output), output); assert.equal(f.session.pending, true); assert.equal(f.session.debug.length, 2)
    }
    {
        const f = fixture(Session); await f.translation(); const previous = JSON.stringify(f.session.output)
        let release; f.host.request = async () => new Promise(resolve => { release = resolve })
        const pending = f.session.translate(); f.session.cancelRequest(); release('bad'); await pending
        assert.equal(JSON.stringify(f.session.output), previous); assert.match(f.session.error, /cancelled/)
        const closed = fixture(Session); closed.session.brief = 'Create librarian'; let resolve
        closed.host.request = async () => new Promise(done => { resolve = done }); const work = closed.session.generate(); closed.session.close(); resolve(JSON.stringify(generated())); await work
        assert.equal(closed.session.output, null); assert.equal(closed.calls.creates.length, 0)
    }
    {
        const f = fixture(Session); f.session.brief = 'Create librarian'
        f.host.request = async () => { f.model('different'); return JSON.stringify(generated()) }
        await f.session.generate(); assert.equal(f.session.output, null); assert.match(f.session.error, /model changed/)
    }
    {
        const f = fixture(Session); await f.session.inspectLegacy(); assert.equal(f.local.getItem(preferenceKey), null)
        f.session.ask('preferences'); f.session.cancelConfirmation(); assert.equal(f.local.getItem(preferenceKey), null)
        f.session.ask('preferences'); await f.session.confirm(); const stored = loadPreferences(f.local)
        assert.equal(stored.values.target, 'French'); assert.equal(stored.values.tone, false); assert.equal(stored.values.names, false); assert.equal(stored.values.instructions, '  keep exact  ')
        const again = new Session(f.host, f.local); assert.equal(again.form.instructions, '  keep exact  '); assert.equal(again.preferencesImported, true)
        const before = f.local.getItem(preferenceKey); f.host.legacyPreferences = async () => ({ target: 'French', secret: 'unrelated' }); await f.session.inspectLegacy(); assert.match(f.session.error, /ambiguous/); assert.equal(f.local.getItem(preferenceKey), before)
        assert.ok(!before.includes('Private chat sentinel'))
        const inactive = { ...defaultPreferences, sourceLanguage: ' Japanese ', customTarget: ' Custom ', instructions: 'x'.repeat(15000), tone: false, names: false }; persistPreferences(f.local, inactive); assert.deepEqual(loadPreferences(f.local).values, inactive)
    }
}
