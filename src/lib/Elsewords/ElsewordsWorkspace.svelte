<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte'
    import { get } from 'svelte/store'
    import { elsewordsOpen, takeElsewordsSession, suspendElsewordsSession } from '../../ts/elsewords/entry'
    import { reviewLabel } from '../../ts/elsewords/session.svelte'
    import { elsewordsHost } from '../../ts/elsewords/host'
    import { cardData } from '../../ts/elsewords/cardCore.js'
    import { SettingsMenuIndex, settingsOpen, alertStore } from '../../ts/stores.svelte'

    const s = takeElsewordsSession(elsewordsHost, localStorage)
    let suspended = false
    const targets = ['English', 'French', 'Spanish', 'German', 'Italian', 'Portuguese', 'Japanese', 'Korean', 'Chinese (Simplified)', 'Arabic', 'Russian', 'Other']
    const preferenceLabels = { sourceMode: 'Source language mode', sourceLanguage: 'Manual source language', target: 'Target language', customTarget: 'Custom target language', style: 'Translation style', instructions: 'Additional instructions', tone: 'Preserve original tone', names: 'Translate descriptive names' }
    let panel: HTMLDivElement
    let returnFocus: HTMLElement | null = null
    let confirmCancel = $state<HTMLButtonElement>()
    let confirmPrevious: HTMLElement | null = null
    let previousConfirmation: string | null = null
    function close() { if (s.busy !== 'save' && !s.confirmation) elsewordsOpen.set(false) }
    function settings(index: number) { if (!s.locked) { suspended = true; suspendElsewordsSession(s); SettingsMenuIndex.set(index); settingsOpen.set(true); elsewordsOpen.set(false) } }
    function keydown(event: KeyboardEvent) {
        if (get(alertStore).type !== 'none') return
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (s.confirmation) s.cancelConfirmation(); else close() }
        if (event.key === 'Tab') {
            const scope = s.confirmation ? panel.querySelector('[role="alertdialog"]') : panel
            const controls = [...scope.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]')].filter(el => !el.closest('[inert]') && el.getClientRects().length)
            const first = controls[0], last = controls.at(-1)
            if (!first) { event.preventDefault(); return }
            if (event.shiftKey && (document.activeElement === first || !scope.contains(document.activeElement))) { event.preventDefault(); last.focus() }
            else if (!event.shiftKey && (document.activeElement === last || !scope.contains(document.activeElement))) { event.preventDefault(); first.focus() }
        }
    }
    function tabKeys(event: KeyboardEvent) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) || s.locked) return
        event.preventDefault(); s.tab = event.key === 'Home' ? 'translate' : event.key === 'End' ? 'generate' : s.tab === 'translate' ? 'generate' : 'translate'
        tick().then(() => panel.querySelector<HTMLButtonElement>(`#elsewords-tab-${s.tab}`)?.focus())
    }
    $effect(() => {
        const confirmation = s.confirmation
        if (confirmation && !previousConfirmation) { confirmPrevious = document.activeElement as HTMLElement; tick().then(() => confirmCancel?.focus()) }
        else if (!confirmation && previousConfirmation) tick().then(() => { if (confirmPrevious?.isConnected) confirmPrevious.focus() })
        previousConfirmation = confirmation
    })
    onMount(() => {
        returnFocus = document.activeElement as HTMLElement
        // Isolate the native modal while keeping later host permission alerts operable.
        const siblings = [...panel.parentElement.children].filter(el => el !== panel && el instanceof HTMLElement) as HTMLElement[]
        const inertBefore = siblings.map(el => el.inert)
        siblings.forEach(el => { el.inert = true })
        panel.querySelector<HTMLButtonElement>('#elsewords-tab-translate')?.focus()
        return () => { siblings.forEach((el, i) => { el.inert = inertBefore[i] }); if (returnFocus?.isConnected) returnFocus.focus() }
    })
    onDestroy(() => { if (!suspended) s.close() })
</script>

{#snippet sourcePicker()}
    <div class="actions">
        <button disabled={s.locked} onclick={() => s.loadActive()}>Load open Elsewhere character</button>
        <button disabled={s.locked} onclick={() => s.importCard()}>Import JSON or PNG card</button>
    </div>
    {#if s.choices.length}
        <label>Group character<select disabled={s.locked} bind:value={s.choiceId}>{#each s.choices as choice}<option value={choice.chaId}>{choice.name}</option>{/each}</select></label>
        <button disabled={s.locked} onclick={() => s.loadMember()}>Load selected character</button>
    {:else if s.card}
        <p class="muted">Loaded: {cardData(s.card).name}</p>
    {/if}
{/snippet}

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div bind:this={panel} class="elsewords-workspace fixed inset-0 z-50 bg-bgcolor text-textcolor" role="dialog" aria-modal="true" aria-labelledby="elsewords-title" tabindex="-1" onkeydown={keydown}>
    <div class="workspace-content" inert={Boolean(s.confirmation)}>
        <header>
            <div><p class="eyebrow">Character workshop</p><h1 id="elsewords-title">Elsewords</h1><p class="header-description">Translate or create a card, then refine the whole result before saving.</p></div>
            <button aria-label="Close Elsewords" disabled={s.busy === 'save'} onclick={close}>Close</button>
        </header>
        <div class="tabs" role="tablist" aria-label="Character card tools">
            <button id="elsewords-tab-translate" role="tab" aria-selected={s.tab === 'translate'} aria-controls="elsewords-tools" tabindex={s.tab === 'translate' ? 0 : -1} disabled={s.locked} onclick={() => s.tab = 'translate'} onkeydown={tabKeys}>Translate</button>
            <button id="elsewords-tab-generate" role="tab" aria-selected={s.tab === 'generate'} aria-controls="elsewords-tools" tabindex={s.tab === 'generate' ? 0 : -1} disabled={s.locked} onclick={() => s.tab = 'generate'} onkeydown={tabKeys}>Generate character</button>
        </div>
        <div class="layout">
            <div class="card tools" id="elsewords-tools" role="tabpanel" aria-labelledby={`elsewords-tab-${s.tab}`}>
                {#if s.tab === 'translate'}
                    <div class="step-heading"><span class="step-number">1</span><div><h2>Choose a card</h2><p class="muted">Your original stays intact until you confirm a save.</p></div></div>
                    {@render sourcePicker()}
                    <div class="step-heading"><span class="step-number">2</span><div><h2>Translate</h2><p class="muted">Choose a language and the style of your result.</p></div></div>
                    <div class="form-grid">
                        <label>Source language<select disabled={s.locked} bind:value={s.form.sourceMode} onchange={() => queueMicrotask(() => s.persist())}><option value="auto">Detect automatically</option><option value="manual">Choose manually</option></select></label>
                        <label>Manual source language<input disabled={s.locked || s.form.sourceMode !== 'manual'} bind:value={s.form.sourceLanguage} oninput={() => queueMicrotask(() => s.persist())} placeholder="For example: Japanese" /></label>
                        <label>Target language<select disabled={s.locked} bind:value={s.form.target} onchange={() => queueMicrotask(() => s.persist())}><option value="">Choose a language</option>{#each targets as target}<option>{target}</option>{/each}</select></label>
                        <label>Other target language<input disabled={s.locked || s.form.target !== 'Other'} bind:value={s.form.customTarget} oninput={() => queueMicrotask(() => s.persist())} placeholder="Specify a language" /></label>
                        <label>Translation style<select disabled={s.locked} bind:value={s.form.style} onchange={() => queueMicrotask(() => s.persist())}><option value="natural">Natural</option><option value="faithful">Faithful</option><option value="close">Close</option></select></label>
                        <label class="wide">Additional instructions<textarea disabled={s.locked} bind:value={s.form.instructions} oninput={() => queueMicrotask(() => s.persist())} placeholder="Optional translation guidance"></textarea></label>
                    </div>
                    <label class="check"><input type="checkbox" disabled={s.locked} bind:checked={s.form.tone} onchange={() => queueMicrotask(() => s.persist())} />Preserve original tone</label>
                    <label class="check"><input type="checkbox" disabled={s.locked} bind:checked={s.form.names} onchange={() => queueMicrotask(() => s.persist())} />Translate descriptive names</label>
                    <button class="primary" disabled={s.locked || !s.card || s.choices.length > 0} onclick={() => s.translate()}>Translate</button>
                {:else}
                    <div class="step-heading"><span class="step-number">1</span><div><h2>Create or complete a card</h2><p class="muted">Start with a description, or rewrite a card you load below.</p></div></div>
                    <p class="muted">Uses only your description and an explicitly loaded card. Chat history and persona are not included.</p>
                    <label>Character description or rewrite instructions<textarea disabled={s.locked} bind:value={s.brief} placeholder="Describe a character or explain how to rewrite the loaded card"></textarea></label>
                    <fieldset disabled={s.locked}><legend>Generation mode</legend>
                        <label class="check"><input type="radio" bind:group={s.mode} value="create" onchange={() => { s.choices = []; s.choiceId = '' }} />Create new card</label>
                        <label class="check"><input type="radio" bind:group={s.mode} value="complete" />Complete existing character</label>
                    </fieldset>
                    {@render sourcePicker()}
                    <button class="primary" disabled={s.locked || s.mode === 'complete' && (!s.card || s.choices.length > 0)} onclick={() => s.generate()}>Generate character</button>
                    <details class="portrait">
                        <summary>Portrait and reference image <span class="muted">Optional</span></summary>
                        <label>Portrait prompt<textarea disabled={s.locked} bind:value={s.imagePrompt} placeholder="Describe the portrait separately"></textarea></label>
                        <div class="actions">
                            {#if s.origin === 'active' && s.original?.image}<button disabled={s.locked} onclick={() => s.useCurrentReference()}>Use current portrait as reference</button>{/if}
                            <button disabled={s.locked} onclick={() => s.chooseImage(true)}>Select reference image</button>
                            <button disabled={s.locked || !s.reference} onclick={() => s.reference = null}>Remove reference</button>
                        </div>
                        {#if s.reference}<img src={s.reference.url} alt="Selected reference preview" />{/if}
                        <div class="actions">
                            <button class="primary" disabled={s.locked} onclick={() => s.generatePortrait()}>Generate portrait</button>
                            <button disabled={s.locked} onclick={() => s.chooseImage()}>Select existing portrait</button>
                            <button disabled={s.locked || !s.artwork} onclick={() => s.artwork = null}>Remove portrait</button>
                        </div>
                        {#if s.artwork}<img src={s.artwork.url} alt="Character portrait preview" />{/if}
                        <p class="muted">The selected reference is sent only when generating a portrait. Selected artwork is included in generated PNG cards and new characters. Existing portraits are replaced only when you choose that option during confirmation.</p>
                        <button disabled={s.locked} onclick={() => settings(17)}>Open image model settings</button>
                    </details>
                {/if}
                <p class="muted">Uses Elsewhere’s configured main text model. Opening model settings retains this session; return through Elsewords to continue. Closing discards late results; image requests already sent may still incur a cost.</p>
                <div class="actions"><button disabled={s.locked} onclick={() => settings(1)}>Open text model settings</button>{#if s.busy === 'model' || s.busy === 'image'}<button onclick={() => s.cancelRequest()}>Cancel request</button>{/if}</div>
                {#if s.progress}
                    <div class="generation-progress" role="status" aria-live="polite" aria-atomic="true">
                        <strong>{s.progress.kind === 'image' ? 'Portrait' : 'Character text'}: {s.progress.phase}</strong>
                        <span aria-live="off">{s.progress.elapsedSeconds}s elapsed</span>
                        {#if s.progress.attempt > 1}<span>Recovery attempt 2 of 2</span>{/if}
                        {#if s.progress.outcome === 'running'}<p class="muted">Waiting for an observable response. Completion time is unknown.</p>{/if}
                    </div>
                {/if}
                {#if s.error || s.status}<p class="status-panel" class:error={Boolean(s.error)} role="status" aria-live="polite">{s.error || s.status}</p>{/if}
                {#if s.debug.length}<details><summary>Response diagnostics (this session only)</summary><p class="muted">May contain character text. Do not share publicly.</p>{#each s.debug as entry}<h3>{entry.label}</h3><p>{entry.error}</p><pre>{entry.response}</pre>{/each}</details>{/if}
                <details class="migration"><summary>Import previous Elsewords preferences</summary>
                    <p class="muted">The old plugin uses shared local storage. Review the values before import. Its storage and repository will be retained. Disable the installed plugin manually to avoid duplicate entries.</p>
                    <button disabled={s.locked} onclick={() => s.inspectLegacy()}>Read previous preferences</button>
                    {#if s.preferencesImported}<p>Previous preferences have been imported.</p>{/if}
                    {#if s.legacy}<dl>{#each Object.entries(s.legacy) as [key, value]}<dt>{preferenceLabels[key]}</dt><dd>{String(value)}</dd>{/each}</dl><button disabled={s.locked} onclick={() => s.ask('preferences')}>Import these eight values…</button>{/if}
                </details>
            </div>
            <section class="card review" aria-label="Output review">
                <div class="review-heading"><div><p class="eyebrow">Review before saving</p><h2>{s.tab === 'translate' ? 'Your translation' : 'Your character card'}</h2></div>{#if s.output}<span class="state-badge">{s.pending ? 'Draft edits' : 'Ready to review'}</span>{/if}</div>
                {#if s.output && s.resultKind === (s.tab === 'translate' ? 'translation' : 'generated')}
                    <div class="summary"><h3>{cardData(s.output).name}</h3><p>{cardData(s.output).description || 'No description in this card.'}</p></div>
                    <div class="actions">
                        {#if s.origin === 'active'}<button class="primary" disabled={!s.canOutput} onclick={() => s.ask('save')}>Save character changes…</button>{/if}
                        <button class:primary={s.origin !== 'active'} disabled={!s.canOutput} onclick={() => s.ask('create')}>Save as new character…</button>
                        <button disabled={!s.canOutput} onclick={() => s.exportCard()}>Download {s.resultKind === 'generated' && s.artwork || s.resultKind === 'translation' && s.format === 'png' ? 'PNG' : 'JSON'} card</button>
                        {#if s.origin === 'active' && s.original?.image}<button disabled={!s.canOutput} onclick={() => s.exportCard(true)}>Download PNG with portrait</button>{/if}
                    </div>
                    <p class="muted">Edit the entire output, then update its preview before applying or downloading. Role variables such as {'{{char}}'} and {'{{user}}'} stay literal. Editing does not call a model.</p>
                    <p role="status">{s.pending ? 'Edits pending. Update the preview or cancel edits.' : 'Preview is up to date.'}</p>
                    <div class="actions"><button class="primary" disabled={s.locked} onclick={() => s.updatePreview()}>Update preview</button><button disabled={s.locked} onclick={() => s.cancelEdits()}>Cancel edits</button></div>
                    {#each s.review as field, index (field.id)}
                        <section class="field-review" aria-labelledby={`elsewords-field-${index}`}>
                            <h3 id={`elsewords-field-${index}`}>{reviewLabel(field.path)}</h3>
                            <div class="comparison" class:output-only={field.original === null}>
                                {#if field.original !== null}<div><strong>Original (read only)</strong><pre>{field.original}</pre></div>{/if}
                                <label>{s.resultKind === 'translation' ? 'Translation' : 'Generated output'} (editable)<textarea class:compact={field.path.at(-1) === 'name'} aria-label={`Edit ${reviewLabel(field.path)}`} disabled={s.locked} bind:value={field.draft}></textarea></label>
                            </div>
                        </section>
                    {/each}
                    <details><summary>View full card JSON</summary><pre>{JSON.stringify(s.output, null, 2)}</pre></details>
                {:else}<div class="empty-review"><div class="empty-mark" aria-hidden="true">Aa</div><h3>A place to refine your card</h3><p>Choose a card to translate, or describe a new character. Your result will appear here with editable fields.</p><p class="muted">Compare the original and your output. Nothing is applied until you confirm.</p></div>{/if}
            </section>
        </div>
    </div>
    {#if s.confirmation}
        <div class="confirmation-shade">
            <div class="card confirmation" role="alertdialog" aria-modal="true" aria-labelledby="elsewords-confirm-title">
                <h2 id="elsewords-confirm-title">{s.confirmation === 'save' ? `Save changes to ${s.original?.name}?` : s.confirmation === 'create' ? `Create ${cardData(s.output).name} as a new character?` : 'Import the reviewed preferences?'}</h2>
                {#if s.confirmation === 'save'}
                    <p>This applies all reviewed text fields. It cannot be undone from Elsewords. The current profile image is retained unless you choose to replace it.</p>
                    {#if s.resultKind === 'generated' && s.artwork}<label class="check"><input type="checkbox" bind:checked={s.replacePortrait} />Replace the current profile image with the selected portrait</label>{/if}
                {:else if s.confirmation === 'create'}<p>Your existing character will remain unchanged.{s.hasPortrait ? ' The applicable portrait will be included.' : ''}</p>
                {:else}<p>All eight values shown in the import preview will replace {s.preferencesExist ? 'your current native preferences' : 'the defaults'}. The old plugin settings will not be changed.</p>{/if}
                <div class="actions"><button bind:this={confirmCancel} onclick={() => s.cancelConfirmation()}>Cancel</button><button class="primary" onclick={() => s.confirm()}>{s.confirmation === 'save' ? 'Yes, save changes' : s.confirmation === 'create' ? 'Yes, create new character' : 'Yes, import preferences'}</button></div>
            </div>
        </div>
    {/if}
</div>

<style>
    .elsewords-workspace { overflow-y: auto; overscroll-behavior: contain; background: var(--risu-theme-canvas); }
    .workspace-content { max-width: 1480px; margin: auto; padding: clamp(1rem, 3vw, 2.5rem); }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; padding-bottom: 1.25rem; }
    .eyebrow { color: var(--risu-theme-textcolor2); font-size: .75rem; letter-spacing: .08em; text-transform: uppercase; font-weight: 650; margin: 0 0 .4rem; }
    h1 { font-size: clamp(1.6rem, 3vw, 2rem); font-weight: 700; line-height: 1.15; letter-spacing: -.02em; }
    h2 { font-size: 1.15rem; font-weight: 650; line-height: 1.4; margin: 0; }
    h3 { font-weight: 650; margin: .75rem 0; }
    .header-description { color: var(--risu-theme-textcolor2); margin-top: .6rem; max-width: 42rem; line-height: 1.6; }
    .muted { color: var(--risu-theme-textcolor2); font-size: .875rem; margin: .65rem 0; line-height: 1.55; }
    .tabs { display: flex; flex-wrap: wrap; gap: .4rem; margin: 0 0 1.5rem; padding: .35rem; width: fit-content; max-width: 100%; border: 1px solid var(--risu-theme-darkborderc); border-radius: .85rem; background: var(--risu-theme-surface-subtle); }
    .tabs button { border-color: transparent; background: transparent; padding-inline: 1.3rem; }
    .tabs button[aria-selected='true'] { background: var(--risu-theme-action-primary); border-color: var(--risu-theme-action-primary); }
    .actions { display: flex; flex-wrap: wrap; gap: .55rem; margin: 1rem 0; }
    .layout { display: grid; grid-template-columns: minmax(320px, .8fr) minmax(0, 1.5fr); gap: 1.5rem; align-items: start; }
    .card { background: var(--risu-theme-surface-elevated); border: 1px solid var(--risu-theme-darkborderc); border-radius: 1rem; padding: clamp(1rem, 2vw, 1.5rem); min-width: 0; }
    .step-heading { display: flex; gap: .75rem; align-items: flex-start; margin: .25rem 0 1rem; }
    .step-heading:not(:first-child) { border-top: 1px solid var(--risu-theme-darkborderc); margin-top: 1.5rem; padding-top: 1.5rem; }
    .step-heading .muted { margin: .35rem 0 0; }
    .step-number { display: grid; place-items: center; width: 1.85rem; height: 1.85rem; flex-shrink: 0; border-radius: .6rem; background: var(--risu-theme-surface-subtle); color: var(--risu-theme-textcolor2); font-size: .85rem; font-weight: 650; }
    label { display: flex; flex-direction: column; gap: .5rem; margin-bottom: .9rem; font-size: .9rem; font-weight: 500; }
    input, select, textarea { background: var(--risu-theme-canvas); color: inherit; border: 1px solid var(--risu-theme-darkborderc); border-radius: .6rem; padding: .7rem .8rem; min-width: 0; max-width: 100%; width: 100%; font-weight: 400; }
    textarea { min-height: 7rem; resize: vertical; line-height: 1.65; }
    textarea.compact { min-height: 3.5rem; }
    .check { flex-direction: row; align-items: center; font-weight: 400; gap: .6rem; } .check input { width: auto; }
    fieldset { border: 1px solid var(--risu-theme-darkborderc); padding: .9rem; border-radius: .65rem; margin: 1rem 0; }
    button { background: var(--risu-theme-surface-subtle); color: inherit; border: 1px solid var(--risu-theme-darkborderc); border-radius: .6rem; padding: .65rem .9rem; cursor: pointer; font-size: .875rem; font-weight: 550; line-height: 1.4; transition: background .15s, border-color .15s; }
    button:hover:not(:disabled) { border-color: var(--risu-theme-focus); }
    button.primary { background: var(--risu-theme-action-primary); border-color: var(--risu-theme-action-primary); }
    button:disabled, input:disabled, textarea:disabled, select:disabled { opacity: .5; cursor: default; }
    button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible { outline: 2px solid var(--risu-theme-focus); outline-offset: 3px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; } .wide { grid-column: 1 / -1; }
    .review-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .75rem; margin-bottom: 1.25rem; }
    .state-badge { border: 1px solid var(--risu-theme-darkborderc); border-radius: 2rem; padding: .35rem .6rem; color: var(--risu-theme-textcolor2); font-size: .75rem; }
    .summary { border-left: 3px solid var(--risu-theme-action-primary); padding-left: 1rem; }
    .summary p { display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.6; }
    .comparison { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; } .comparison.output-only { grid-template-columns: minmax(0, 1fr); }
    .comparison strong { display: block; color: var(--risu-theme-textcolor2); font-size: .8rem; font-weight: 500; margin-bottom: .5rem; }
    .field-review { border-top: 1px solid var(--risu-theme-darkborderc); padding-top: .9rem; margin-top: 1.25rem; }
    pre, dd, .summary p { white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
    pre { background: var(--risu-theme-canvas); border: 1px solid var(--risu-theme-darkborderc); padding: .8rem; border-radius: .6rem; font-size: .85rem; line-height: 1.65; max-height: 32rem; overflow: auto; }
    .empty-review { min-height: 24rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2rem 1rem; }
    .empty-review p { max-width: 30rem; line-height: 1.65; }
    .empty-mark { display: grid; place-items: center; width: 4rem; height: 4rem; border: 1px solid var(--risu-theme-darkborderc); background: var(--risu-theme-surface-subtle); border-radius: 1rem; color: var(--risu-theme-textcolor2); font-size: 1.5rem; margin-bottom: .5rem; }
    details { margin: 1rem 0; } summary { cursor: pointer; font-size: .9rem; font-weight: 550; padding-block: .4rem; }
    .generation-progress { display: grid; gap: .35rem; padding: .85rem; border: 1px solid var(--risu-theme-darkborderc); border-radius: .65rem; background: var(--risu-theme-canvas); }
    .status-panel { border: 1px solid var(--risu-theme-darkborderc); border-radius: .65rem; background: var(--risu-theme-canvas); padding: .85rem; font-size: .9rem; line-height: 1.6; overflow-wrap: anywhere; }
    .error { color: var(--risu-theme-danger-500); }
    .portrait, .migration { border-top: 1px solid var(--risu-theme-darkborderc); margin-top: 1.5rem; padding-top: .75rem; }
    img { max-width: 100%; max-height: 20rem; object-fit: contain; border-radius: .65rem; margin-block: .5rem; }
    dt { font-weight: 650; margin-top: .6rem; } dd { margin: .25rem 0 .75rem; }
    .confirmation-shade { position: fixed; inset: 0; background: #0008; display: flex; align-items: center; justify-content: center; padding: 1rem; }
    .confirmation { max-width: 36rem; max-height: 90dvh; overflow: auto; }
    @media (prefers-reduced-motion: reduce) { button { transition: none; } }
    @media (max-width: 1100px) { .layout { grid-template-columns: minmax(0, 1fr); } .empty-review { min-height: 15rem; } }
    @media (max-width: 600px) { .comparison, .form-grid { grid-template-columns: minmax(0, 1fr); } .wide { grid-column: auto; } .tabs { width: 100%; } .tabs button { flex: 1; padding-inline: .65rem; } header { gap: .75rem; } .actions button { max-width: 100%; } }
</style>
