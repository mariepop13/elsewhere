<script lang="ts">
    import { onDestroy, tick, untrack } from 'svelte'
    import { ArrowLeft, X, ImagePlus } from '@lucide/svelte'
    import SocialBrand from './SocialBrand.svelte'
    import SocialAvatar from './SocialAvatar.svelte'
    import { MAX_CAST, MAX_PROFILE_LENGTH, type SocialAuthor, type SocialFeedState } from 'src/ts/social/socialFeed'
    import { createSocialSetupDraft, validateSocialSetup, type SocialSetupDraft } from 'src/ts/social/socialSetup'
    import { prepareSocialPhoto } from 'src/ts/social/socialPhoto'

    let { open, feed, author, personas, characters, onclose, onsave }: {
        open: boolean; feed: SocialFeedState; author: SocialAuthor;
        personas: { id: string; name: string; image?: string }[];
        characters: { id: string; name: string; image?: string }[];
        onclose: () => void; onsave: (draft: SocialSetupDraft, photo?: Uint8Array) => Promise<void>;
    } = $props()
    const steps = ['World', 'You', 'Cast', 'Starting situation', 'Review & start']
    const headings = ['Make somewhere your own.', 'Find your place.', 'A few familiar faces.', 'Choose the first moment.', 'Ready when you are.']
    let draft = $state(untrack(() => createSocialSetupDraft(feed, author)))
    let source = untrack(() => feed)
    let sourceSnapshot = $state(untrack(() => JSON.stringify(createSocialSetupDraft(feed, author))))
    let currentSnapshot = $derived(JSON.stringify(createSocialSetupDraft(feed, author)))
    let sourceChanged = $derived(currentSnapshot !== sourceSnapshot)
    let step = $state(0)
    let furthest = $state(0)
    let selectedCard = $state('')
    let saving = $state(false)
    let error = $state('')
    let photoError = $state('')
    let photoLoading = $state(false)
    let photo = $state<Uint8Array>()
    let photoUrl = $state('')
    let photoSequence = 0
    let heading = $state<HTMLHeadingElement>()
    let fileInput = $state<HTMLInputElement>()
    let advanced = $state(false)
    let expandedPerson = $state('')
    let valid = $derived(step === 0 ? !!draft.title.trim() : step === 1 ? !!draft.you.name.trim() : step === 2 ? draft.cast.every(actor => !!actor.publicProfile.trim()) : true)

    function clearPhotoPreview() {
        photoSequence++
        photoLoading = false
        if (photoUrl) URL.revokeObjectURL(photoUrl)
        photoUrl = ''
        photo = undefined
    }
    onDestroy(clearPhotoPreview)
    $effect(() => {
        const current = feed
        const snapshot = currentSnapshot
        const closed = !open
        untrack(() => {
            if (current !== source || (closed && snapshot !== sourceSnapshot)) {
                clearPhotoPreview()
                source = current
                sourceSnapshot = snapshot
                draft = createSocialSetupDraft(current, author)
                step = furthest = 0
                error = photoError = ''
            }
        })
    })
    $effect(() => { if (open) { step; tick().then(() => heading?.focus()) } })

    async function choosePhoto(event: Event) {
        const input = event.currentTarget as HTMLInputElement
        const file = input.files?.[0]
        input.value = ''
        if (!file) return
        const sequence = ++photoSequence
        photoLoading = true
        photoError = ''
        try {
            const prepared = await prepareSocialPhoto(file)
            if (sequence !== photoSequence) return
            if (photoUrl) URL.revokeObjectURL(photoUrl)
            photo = prepared
            photoUrl = URL.createObjectURL(new Blob([new Uint8Array(prepared)], { type: 'image/png' }))
        } catch {
            if (sequence === photoSequence) photoError = 'Choose a readable PNG, JPG or WebP under 5 MB and 32 million pixels (12,000 pixels per side maximum).'
        } finally { if (sequence === photoSequence) photoLoading = false }
    }
    function removePhoto() {
        clearPhotoPreview()
        draft.you.image = undefined
        photoError = ''
        if (fileInput) fileInput.value = ''
    }
    function selectPersona(event: Event) {
        const persona = personas.find(persona => persona.id === (event.currentTarget as HTMLSelectElement).value)
        if (!persona) return
        clearPhotoPreview()
        draft.you = { id: persona.id, name: persona.name, image: persona.image, publicProfile: draft.you.publicProfile }
    }
    function addActor() {
        const card = characters.find(card => card.id === selectedCard)
        if (!card || draft.cast.length >= MAX_CAST || draft.cast.some(actor => actor.characterId === card.id)) return
        draft.cast.push({ characterId: card.id, name: card.name, image: card.image, publicProfile: '', startingFacts: '' })
        selectedCard = ''
    }
    async function save() {
        if (saving || photoLoading || sourceChanged || !validateSocialSetup(draft)) return
        saving = true
        error = ''
        try { await onsave(draft, photo); clearPhotoPreview(); onclose() }
        catch { error = 'The world could not be saved. Your setup is still here. Try again.' }
        finally { saving = false }
    }
    function go(next: number) { step = next; furthest = Math.max(furthest, next); error = '' }
</script>

{#snippet portrait(size = 52)}
    {#if photoUrl}<img src={photoUrl} alt={`${draft.you.name || 'Your character'} profile`} class="profile-photo" style:width={`${size}px`} style:height={`${size}px`} />
    {:else}<SocialAvatar name={draft.you.name} image={draft.you.image} {size} />{/if}
{/snippet}

{#if open}
    <section class="setup-shell" aria-label="World setup">
        <header class="setup-header"><SocialBrand /><button disabled={saving} onclick={onclose}><ArrowLeft size={18} />Return to feed</button></header>
        <div class="setup-layout">
            <aside class="setup-sidebar">
                <h2>A place.<br />A few familiar faces.</h2>
                <p>Your world starts with your choices.</p>
                <nav aria-label="World setup steps">
                    {#each steps as label, index}<button aria-current={step === index ? 'step' : undefined} disabled={saving || index > furthest} onclick={() => go(index)}><span>{index + 1}</span>{label}</button>{/each}
                </nav>
                <p class="sidebar-note">Nothing is generated automatically.</p>
            </aside>
            <main class="setup-main">
                <p class="setup-progress">Step {step + 1} of 5</p>
                <h1 tabindex="-1" bind:this={heading}>{headings[step]}</h1>
                <p class="setup-lead">{step === 0 ? 'Give your social world a name and a little context.' : step === 1 ? 'Choose how you appear in this world. Private persona prompts stay private.' : step === 2 ? 'Use characters from your library. Write only what is public here.' : step === 3 ? 'One opening event is enough. Add starting connections only if you want them.' : 'Save your choices, then decide when to make the first move.'}</p>
                <fieldset disabled={saving} class="setup-content">
                    {#if step === 0}
                        <label>World name <span aria-hidden="true">*</span><input maxlength="80" required bind:value={draft.title} placeholder="A city of floating gardens" /></label>
                        <label>Public world context<textarea rows="4" maxlength={MAX_PROFILE_LENGTH} bind:value={draft.publicWorld} placeholder="The place, its atmosphere, and what everyone can know." ></textarea></label>
                        <label>Time &amp; era<input maxlength="400" bind:value={draft.era} placeholder="A modern city, a distant future…" /></label><label>Key places<textarea rows="2" maxlength="400" bind:value={draft.places} placeholder="The places where everyday life happens." ></textarea></label><label>Overall mood<select bind:value={draft.mood}><option value="">Choose a mood</option><option>Cozy &amp; playful</option><option>Mysterious</option><option>Dramatic</option><option>Adventurous</option></select></label><p class="setup-note">This updates your current social world. Existing posts, cards and private chats are kept.</p>
                    {:else if step === 1}
                        <label>Use a persona<select value={draft.you.id} onchange={selectPersona}><option value={draft.you.id}>{draft.you.name} (current social identity)</option>{#each personas.filter(persona => persona.id !== draft.you.id) as persona}<option value={persona.id}>{persona.name}</option>{/each}</select></label>
                        <div class="photo-row">{@render portrait(76)}<div><input class="photo-input" aria-label="Choose profile photo" bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onchange={choosePhoto} /><button class="setup-secondary" type="button" onclick={() => fileInput?.click()}><ImagePlus size={17} />{photoUrl || draft.you.image ? 'Change photo' : 'Choose photo'}</button>{#if photoUrl || draft.you.image}<button class="setup-secondary" type="button" onclick={removePhoto}>Remove photo</button>{/if}</div></div>
                        <p class="setup-note">Optional. PNG, JPG or WebP, up to 5 MB. Saved in this app when you save the world; never sent to the model.</p>
                        {#if photoLoading}<p role="status">Preparing photo…</p>{/if}{#if photoError}<p role="alert" class="setup-error">{photoError}</p>{/if}
                        <label>Display name <span aria-hidden="true">*</span><input maxlength="80" required bind:value={draft.you.name} /></label>
                        <label>Your public profile<textarea rows="3" maxlength={MAX_PROFILE_LENGTH} bind:value={draft.you.publicProfile} placeholder="Your role and what other characters can know about you." ></textarea></label>
                        <div class="persona-preview">{@render portrait()}<div><strong>{draft.you.name || 'You'}</strong><p>{draft.you.publicProfile || 'Your public profile will appear here.'}</p></div></div>
                    {:else if step === 2}
                        <p class="setup-note">Up to {MAX_CAST} characters. You can also begin on your own.</p>
                        {#if !characters.length}<p>Add or import a character using the existing character library, then return here.</p>{/if}
                        {#if draft.cast.length < MAX_CAST && characters.length}<label>Add from character library<select bind:value={selectedCard} onchange={addActor}><option value="">Choose a character</option>{#each characters.filter(card => !draft.cast.some(actor => actor.characterId === card.id)) as card}<option value={card.id}>{card.name}</option>{/each}</select></label>{/if}
                        {#each draft.cast as actor (actor.characterId)}<div class="cast-card"><div class="cast-header"><SocialAvatar name={actor.name} image={actor.image} size={44} /><strong>{actor.name}</strong><button type="button" aria-label={`Remove ${actor.name}`} onclick={() => draft.cast = draft.cast.filter(value => value.characterId !== actor.characterId)}><X size={18} /></button></div>{#if !characters.some(card => card.id === actor.characterId)}<p class="setup-note">The original card is no longer in the library. Its saved social identity is kept.</p>{/if}<label>Public personality and facts <span aria-hidden="true">*</span><textarea rows="3" maxlength={MAX_PROFILE_LENGTH} bind:value={actor.publicProfile} placeholder="Voice, personality, and facts known in this world." ></textarea></label></div>{/each}
                    {:else if step === 3}
                        <label>Opening event<textarea rows="4" maxlength={MAX_PROFILE_LENGTH} bind:value={draft.startingSituation} placeholder="It is opening night at the garden festival. Everyone is arriving." ></textarea></label>
                        <p class="setup-note">Optional public context for future posts. Saving it does not create a post or call AI.</p>
                        <details bind:open={advanced}><summary>Relationships & starting knowledge <span>Optional</span></summary><p class="setup-note">Only public starting facts. This does not invent private memories or add relationship scores.</p>{#each draft.cast as actor (actor.characterId)}<div class="starting-person"><button type="button" class="starting-toggle" aria-expanded={expandedPerson === actor.characterId} onclick={() => expandedPerson = expandedPerson === actor.characterId ? '' : actor.characterId}><SocialAvatar name={actor.name} image={actor.image} size={32} /><span><strong>{actor.name}</strong><small>{actor.startingFactsVisibility === 'private' ? 'Private note' : actor.startingFactsVisibility === 'paused' ? 'Paused note' : actor.startingFacts || 'No starting facts added'}</small></span><span>Edit</span></button>{#if expandedPerson === actor.characterId}<label>Starting relationships and knowledge<textarea rows="3" maxlength={MAX_PROFILE_LENGTH} bind:value={actor.startingFacts} placeholder="How they know you, and what they already know publicly." ></textarea></label><label>Visibility<select value={actor.startingFactsVisibility ?? 'public'} onchange={event => actor.startingFactsVisibility = event.currentTarget.value as 'public' | 'private' | 'paused'}><option value="public">Public</option><option value="private">Private note</option><option value="paused">Paused</option></select></label>{/if}</div>{/each}{#if !draft.cast.length}<p class="setup-note">Choose characters in Cast to add starting facts.</p>{/if}</details>
                    {:else}
                        <div class="review-row"><div><h2>{draft.title}</h2><p>{draft.publicWorld || 'No additional world context.'}</p>{#if draft.era}<p>{draft.era}</p>{/if}{#if draft.places}<p>{draft.places}</p>{/if}{#if draft.mood}<p>{draft.mood}</p>{/if}</div><button type="button" onclick={() => go(0)}>Edit world</button></div>
                        <div class="review-row">{@render portrait()}<div><h2>{draft.you.name}</h2><p>{draft.you.publicProfile || 'No additional public profile.'}</p></div><button type="button" onclick={() => go(1)}>Edit you</button></div>
                        <div class="review-row"><div><h2>Your cast</h2>{#each draft.cast as actor}<p><strong>{actor.name}</strong>: {actor.publicProfile}</p>{#if actor.startingFacts}<p>{actor.startingFactsVisibility === 'private' ? 'Private note (excluded from public generation)' : actor.startingFactsVisibility === 'paused' ? 'Paused (excluded from public generation)' : actor.startingFacts}</p>{/if}{/each}{#if !draft.cast.length}<p>Starting on your own.</p>{/if}</div><button type="button" onclick={() => go(2)}>Edit cast</button></div>
                        <div class="review-row"><div><h2>Opening moment</h2><p>{draft.startingSituation || 'No opening event set.'}</p></div><button type="button" onclick={() => go(3)}>Edit situation</button></div>
                        <p class="setup-note">Save and open your current feed. Existing posts remain. No generation and no model cost. Character posts and reactions remain separate, explicit actions in the feed, using your selected model and normal provider charges.</p>
                    {/if}
                </fieldset>
                {#if sourceChanged}<p role="alert" class="setup-error">The saved world changed while you were editing. Return to the feed and reopen setup to load those changes.</p>{/if}
                {#if error}<p role="alert" class="setup-error">{error}</p>{/if}
                {#if !valid}<p role="status" class="setup-error">Complete the required fields to continue.</p>{/if}
                <footer><p>Your draft stays while this feed is open. Save to keep it after reopening the app.</p><div><button disabled={saving} class="setup-secondary" onclick={() => step ? go(step - 1) : onclose()}>{step ? 'Back' : 'Cancel'}</button>{#if step < 4}<button class="setup-primary" disabled={!valid || saving} onclick={() => go(step + 1)}>Continue</button>{:else}<button class="setup-primary" disabled={!validateSocialSetup(draft) || photoLoading || sourceChanged || saving} onclick={save}>{saving ? 'Saving…' : 'Save world & open feed'}</button>{/if}</div></footer>
            </main>
        </div>
    </section>
{/if}

<style>
    .setup-shell { width: 100%; min-width: 0; flex: 1; align-self: stretch; height:100%; overflow:auto; background:var(--risu-theme-bgcolor); color:var(--risu-theme-textcolor); text-align:left; }
    .setup-header { min-height:72px; padding:12px 32px; display:flex; align-items:center; justify-content:space-between; gap:16px; border-bottom:1px solid var(--risu-theme-borderc); background:var(--risu-theme-surface-elevated); }
    button { cursor:pointer; min-height:44px; padding:10px 14px; border-radius:7px; }
    button:disabled { opacity:.5; cursor:not-allowed; }
    .setup-header button { display:flex; align-items:center; gap:8px; }
    .setup-layout { display:grid; grid-template-columns:310px minmax(0,1fr); width:100%; margin:auto; min-height:calc(100% - 72px); }
    .setup-sidebar { padding:40px 24px; border-right:1px solid var(--risu-theme-borderc); background:var(--risu-theme-darkbg); }
    .setup-sidebar h2 { font-size:25px; font-weight:600; line-height:1.4; }
    .setup-sidebar p { margin-top:18px; color:var(--risu-theme-textcolor2); font-size:13px; }
    nav { display:grid; gap:12px; margin-top:32px; }
    nav button { display:flex; align-items:center; gap:12px; text-align:left; }
    nav button > span { display:grid; place-items:center; width:28px; height:28px; border:1px solid var(--risu-theme-borderc); border-radius:50%; flex:none; }
    nav button[aria-current=step] { background:var(--risu-theme-selected); }
    .sidebar-note { border-top:1px solid var(--risu-theme-borderc); padding-top:24px; }
    .setup-main { width:100%; max-width:820px; padding:40px 48px; margin:auto; min-width:0; }
    .setup-progress { font-size:12px; color:var(--risu-theme-textcolor2); }
    h1 { margin:14px 0; font-size:clamp(26px,3vw,36px); font-weight:600; line-height:1.25; letter-spacing:-.8px; }
    .setup-lead { font-size:14px; line-height:1.8; color:var(--risu-theme-textcolor2); }
    .setup-content { display:grid; gap:20px; margin-top:28px; padding:26px; border:1px solid var(--risu-theme-borderc); border-radius:14px; background:var(--risu-theme-surface-elevated); min-width:0; }
    label { display:block; font-size:13px; }
    input:not([type=file]),textarea,select { display:block; width:100%; min-width:0; margin-top:8px; border:1px solid var(--risu-theme-borderc); border-radius:7px; padding:11px 12px; background:var(--risu-theme-bgcolor); color:var(--risu-theme-textcolor); font:inherit; }
    textarea { resize:vertical; }
    .setup-note { color:var(--risu-theme-textcolor2); font-size:12px; line-height:1.8; }
    .photo-row { display:flex; gap:18px; align-items:center; flex-wrap:wrap; }
    .photo-row > div { display:flex; gap:8px; flex-wrap:wrap; }
    .photo-input { position:absolute; width:1px; height:1px; opacity:0; overflow:hidden; }
    .profile-photo { border-radius:50%; object-fit:cover; flex:none; }
    .setup-secondary { display:inline-flex; align-items:center; justify-content:center; gap:8px; border:1px solid var(--risu-theme-borderc); }
    .setup-primary { background:var(--risu-theme-action-primary); color:var(--risu-theme-bgcolor); font-weight:600; }
    .persona-preview,.cast-header { display:flex; align-items:center; gap:14px; min-width:0; }
    .persona-preview p { margin-top:6px; font-size:13px; white-space:pre-wrap; overflow-wrap:anywhere; }
    .cast-card { border-top:1px solid var(--risu-theme-borderc); padding-top:18px; }
    .cast-header { margin-bottom:16px; }
    .cast-header strong { flex:1; overflow-wrap:anywhere; }
    details { border-top:1px solid var(--risu-theme-borderc); padding-top:20px; min-width:0; }
    summary { cursor:pointer; font-size:14px; min-height:44px; }
    summary > span { font-size:12px; color:var(--risu-theme-textcolor2); }
    .starting-person { border-top:1px solid var(--risu-theme-borderc); margin-top:14px; padding-top:8px; }
    .starting-toggle { display:flex; gap:12px; align-items:center; text-align:left; width:100%; padding-inline:0; }
    .starting-toggle > span:first-of-type { flex:1; min-width:0; }
    .starting-toggle small { display:block; color:var(--risu-theme-textcolor2); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%; font-size:12px; }
    .review-row { display:flex; align-items:flex-start; gap:14px; border-bottom:1px solid var(--risu-theme-borderc); padding-bottom:18px; min-width:0; flex-wrap:wrap; }
    .review-row > div { flex:1; min-width:100px; }
    .review-row h2 { font-weight:600; }
    .review-row p { font-size:13px; line-height:1.7; white-space:pre-wrap; overflow-wrap:anywhere; margin-top:6px; }
    footer { display:flex; align-items:center; justify-content:space-between; gap:18px; margin-top:24px; }
    footer p { font-size:12px; color:var(--risu-theme-textcolor2); max-width:220px; }
    footer > div { display:flex; gap:12px; flex-wrap:wrap; }
    .setup-error { font-size:13px; color:var(--risu-theme-draculared); margin-top:12px; }
    .setup-shell :is(button,input,textarea,select,summary):focus-visible { outline:2px solid var(--risu-theme-focus); outline-offset:3px; }
    h1:focus { outline:none; }
    @media(max-width:700px) { .setup-header { padding:10px 16px; min-height:64px; } .setup-layout { display:block; } .setup-sidebar { padding:12px 10px; border-right:0; border-bottom:1px solid var(--risu-theme-borderc); } .setup-sidebar h2,.setup-sidebar p { display:none; } nav { display:flex; gap:3px; margin:0; } nav button { flex:1; min-width:0; padding:6px 2px; flex-direction:column; gap:6px; font-size:10px; text-align:center; line-height:1.4; } .setup-main { padding:28px 16px; } .setup-content { padding:20px 16px; } footer { flex-direction:column; align-items:stretch; } footer p { max-width:none; } footer > div { justify-content:space-between; } }
</style>
