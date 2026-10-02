<script lang="ts">
    import { onDestroy, tick, untrack } from 'svelte'
    import { ArrowLeft, Heart, MessageCircle, Send, Users, X, CircleHelp, ChevronDown, Sparkles } from '@lucide/svelte'
    import { language } from 'src/lang'
    import { DBState, socialFeedOpen, settingsOpen, SettingsMenuIndex, MobileGUI, MobileGUIStack, MobileSideBar, selectedCharID } from 'src/ts/stores.svelte'
    import { createSocialFeed, createSocialPost, socialPersonaAuthor, MAX_CAST, MAX_POST_LENGTH, MAX_PROFILE_LENGTH, SocialGeneration, eligibleSocialActors, type SocialReactionKind } from 'src/ts/social/socialFeed'
    import { generateSocialPublication, generateSocialResponse, socialModelIdentity, socialModelSupported } from 'src/ts/social/socialProvider'
    import SocialRelationships from './SocialRelationships.svelte'
    import SocialAvatar from './SocialAvatar.svelte'
    import { alertRequestLogs } from 'src/ts/alert'
    import { SocialGenerationError } from 'src/ts/social/socialErrors'
    import { getSocialLimits, initializeSocialLimits, SOCIAL_CONTEXT_MIN, SOCIAL_CONTEXT_MAX, SOCIAL_RESPONSE_MIN, SOCIAL_RESPONSE_MAX } from 'src/ts/social/socialLimits'
    import { getModelInfo } from 'src/ts/model/modellist'

    if (!DBState.db.socialFeed) DBState.db.socialFeed = createSocialFeed()
    initializeSocialLimits(DBState.db.socialFeed)
    const emptyFeed = createSocialFeed()
    $effect(() => {
        if (!DBState.db.socialFeed) DBState.db.socialFeed = createSocialFeed()
        untrack(() => initializeSocialLimits(DBState.db.socialFeed))
    })
    let feed = $derived(DBState.db.socialFeed ?? emptyFeed)
    let copy = $derived(language.social)
    let limits = $derived.by(() => { try { return getSocialLimits(feed) } catch { return undefined } })
    let characters = $derived(DBState.db.characters.filter(character => character.type !== 'group'))
    let castExpanded = $state(false)
    let composerExpanded = $state(false)
    let composerInput = $state<HTMLTextAreaElement>()
    let composerTrigger = $state<HTMLButtonElement>()

    async function openComposer() {
        composerExpanded = true
        await tick()
        composerInput?.focus()
    }
    async function closeComposer() {
        composerExpanded = false
        await tick()
        composerTrigger?.focus()
    }
    let selectedCard = $state('')
    let publisherId = $state('')
    let authorChoice = $state(-1)
    let author = $derived(socialPersonaAuthor(DBState.db.personas, DBState.db.selectedPersona, authorChoice, { name: DBState.db.username, image: DBState.db.userIcon }))
    let busyPost = $state('')
    let status = $state('')
    let deletePost = $state('')
    const generation = new SocialGeneration()
    let generationVersion = 0
    let supported = $derived(socialModelSupported())
    let modelName = $derived(DBState.db.aiModel === 'openrouter' ? DBState.db.openrouterRequestModel || getModelInfo(DBState.db.aiModel).name : DBState.db.aiModel === 'reverse_proxy' ? DBState.db.customProxyRequestModel || getModelInfo(DBState.db.aiModel).name : getModelInfo(DBState.db.aiModel).name)

    function openModelSettings() {
        cancel()
        SettingsMenuIndex.set(1)
        if ($MobileGUI) {
            selectedCharID.set(-1)
            MobileSideBar.set(0)
            MobileGUIStack.set(2)
            socialFeedOpen.set(false)
        } else {
            settingsOpen.set(true)
        }
    }
    let selectedPublisher = $derived(feed.cast.find(actor => actor.characterId === publisherId))
    let selectionIdentity = $derived(socialModelIdentity())
    let profilesReady = $derived(feed.cast.length > 0 && feed.cast.every(actor => actor.publicProfile.trim()))

    function cancel() {
        generationVersion++
        generation.cancel()
        busyPost = ''
    }
    onDestroy(cancel)

    function addActor() {
        const card = characters.find(character => character.chaId === selectedCard)
        if (!card || feed.cast.length >= MAX_CAST || feed.cast.some(actor => actor.characterId === card.chaId)) return
        cancel()
        feed.cast.push({ characterId: card.chaId, name: card.name, image: card.image, publicProfile: '' })
        selectedCard = ''
    }

    function publish(event: SubmitEvent) {
        event.preventDefault()
        if (!feed.draft.trim() || feed.draft.trim().length > MAX_POST_LENGTH) return
        if (busyPost === 'publication') cancel()
        feed.posts.unshift(createSocialPost(author, feed.draft))
        feed.draft = ''
        status = ''
        closeComposer()
    }

    async function react(postId: string) {
        if (busyPost || !profilesReady || !supported || !limits) return
        const current = feed
        const modelSelection = selectionIdentity
        const interfaceLanguage = DBState.db.language
        const version = ++generationVersion
        busyPost = postId
        status = ''
        try {
            const result = await generation.generate(current, postId, generateSocialResponse,
                () => DBState.db.socialFeed === current && selectionIdentity === modelSelection && DBState.db.language === interfaceLanguage, undefined, interfaceLanguage)
            if (version === generationVersion) status = result === 'cancelled' ? copy.cancelled : result === 'saved' ? copy.done : ''
        } catch (error) {
            if (version === generationVersion) {
                if (error instanceof SocialGenerationError) {
                    const messages = { request_error: copy.requestFailed, invalid_response: copy.invalidResponse, incomplete_response: copy.incompleteResponse, empty_response: copy.emptyResponse, invalid_limits: copy.invalidLimits, context_limit: copy.contextExceeded }
                    status = `${messages[error.code]}${error.reason ? ` ${copy.validationReasons[error.reason]}` : ''}${error.status ? ` (${copy.requestStatus} ${error.status})` : ''} ${copy.postKept}`
                } else status = copy.failed
            }
        } finally {
            if (version === generationVersion) busyPost = ''
        }
    }

    async function publishCharacter() {
        if (busyPost || !selectedPublisher?.publicProfile.trim() || !supported || !limits) return
        const current = feed
        const modelSelection = selectionIdentity
        const interfaceLanguage = DBState.db.language
        const actorId = publisherId
        const version = ++generationVersion
        busyPost = 'publication'
        status = ''
        try {
            const result = await generation.publish(current, actorId, generateSocialPublication,
                () => DBState.db.socialFeed === current && selectionIdentity === modelSelection && publisherId === actorId && DBState.db.language === interfaceLanguage, undefined, interfaceLanguage)
            if (version === generationVersion) status = result === 'saved' ? copy.postPublished : result === 'cancelled' ? copy.cancelled : ''
        } catch (error) {
            if (version === generationVersion) {
                if (error instanceof SocialGenerationError) {
                    const messages = { request_error: copy.requestFailed, invalid_response: copy.invalidResponse, incomplete_response: copy.incompleteResponse, empty_response: copy.emptyResponse, invalid_limits: copy.invalidLimits, context_limit: copy.contextExceeded }
                    status = `${messages[error.code]}${error.reason ? ` ${copy.validationReasons[error.reason]}` : ''}${error.status ? ` (${copy.requestStatus} ${error.status})` : ''} ${copy.postKept}`
                } else status = copy.failed
            }
        } finally {
            if (version === generationVersion) busyPost = ''
        }
    }

    function reactionSymbol(kind: SocialReactionKind) {
        return { like: '♡', love: '♥', curious: '✦', none: '↳' }[kind]
    }

    function reactionLabel(kind: SocialReactionKind) {
        return { like: copy.likeReaction, love: copy.loveReaction, curious: copy.curiousReaction, none: copy.noneReaction }[kind]
    }
</script>

<section class="social-screen flex h-full w-full min-w-0 flex-col bg-bgcolor text-textcolor" aria-label={copy.title}>
    <header class="social-header">
        <button class="social-icon" aria-label={copy.back} title={copy.back} onclick={() => socialFeedOpen.set(false)}><ArrowLeft size={22} /></button>
        <h1 class="min-w-0 grow text-xl font-semibold">{copy.title}</h1>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions (Escape bubbles from the native summary and help controls.) -->
        <details class="social-help" onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus() } }}>
            <summary class="social-icon cursor-pointer" aria-label={copy.help} title={copy.help}><CircleHelp size={21} /></summary>
            <div class="social-help-content">
                <h2 class="mb-2 font-semibold">{copy.help}</h2>
                <p>{copy.privacy}</p>
                <p>{copy.cost}</p>
                <p>{copy.outputLimit} {limits?.maxResponse ?? "—"}</p>
                <p>{copy.providerStorage}</p>
                <button class="social-button mt-2" onclick={alertRequestLogs}>{copy.requestLogs}</button>
                <p>{copy.noRequests} {copy.draftKept}</p>
                {#if !supported}<p>{copy.unsupported}</p>{/if}
                {#if feed.enabled}<button class="social-button mt-2" onclick={() => { cancel(); feed.enabled = false; status = '' }}>{copy.disable}</button>{/if}
            </div>
        </details>
    </header>
    <div class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-6">
            <p class="min-w-0 break-words text-sm text-textcolor2">{copy.model}: {modelName}</p>
            <button class="social-button" onclick={openModelSettings}>{copy.modelSettings}</button>
        </div>
        {#if !feed.enabled}
            <div class="mx-auto flex max-w-xl flex-col items-start gap-5 px-5 py-12 sm:py-20">
                <Users size={36} />
                <h2 class="text-3xl font-semibold leading-tight">{copy.intro}</h2>
                <p class="text-textcolor2">{copy.optIn}</p>
                <p class="text-sm leading-relaxed text-textcolor2">{copy.privacy}</p>
                <p class="text-sm leading-relaxed text-textcolor2">{copy.cost}</p>
                <button class="social-button social-primary" onclick={() => feed.enabled = true}>{copy.enable}</button>
            </div>
        {:else}
            <div class="social-column mx-auto w-full max-w-2xl px-4 pb-10 pt-5 sm:px-6 sm:pt-8">
                <details class="universe-panel mb-5" bind:open={castExpanded}>
                    <summary class="universe-summary">
                        <div class="flex min-w-0 grow items-center gap-3">
                            <div class="flex shrink-0 -space-x-2">
                                {#each feed.cast as actor (actor.characterId)}<SocialAvatar name={actor.name} image={actor.image} size={38} />{/each}
                                {#if !feed.cast.length}<Users size={24} />{/if}
                            </div>
                            <div class="min-w-0">
                                <span class="block font-semibold">{copy.universe}</span>
                                <span class="block truncate text-xs text-textcolor2">{feed.cast.length ? feed.cast.map(actor => actor.name).join(', ') : copy.emptyCast}</span>
                            </div>
                        </div>
                        <ChevronDown size={18} class={castExpanded ? 'rotate-180' : ''} />
                    </summary>
                    <div class="universe-fields">
                        <label class="flex flex-col gap-2 text-sm">
                            <span>{copy.world}</span>
                            <textarea class="social-input" rows="2" maxlength={MAX_PROFILE_LENGTH} placeholder={copy.worldHint} bind:value={feed.publicWorld} oninput={cancel}></textarea>
                        </label>
                        {#if characters.length === 0}<p class="text-sm text-textcolor2">{copy.emptyLibrary}</p>{/if}
                        {#if feed.cast.length < MAX_CAST && characters.length > 0}
                            <label class="flex flex-col gap-2 text-sm">
                                <span>{copy.select} <span class="text-textcolor2">({feed.cast.length}/{MAX_CAST})</span></span>
                                <select class="social-input" bind:value={selectedCard} onchange={addActor}>
                                    <option value="">{copy.choose}</option>
                                    {#each characters.filter(character => !feed.cast.some(actor => actor.characterId === character.chaId)) as character (character.chaId)}<option value={character.chaId}>{character.name}</option>{/each}
                                </select>
                            </label>
                        {/if}
                        {#each feed.cast as actor (actor.characterId)}
                            <div class="universe-actor">
                                <div class="mb-3 flex items-center gap-3">
                                    <SocialAvatar name={actor.name} image={actor.image} size={48} />
                                    <span class="min-w-0 grow break-words font-medium">{actor.name}</span>
                                    <button class="social-icon" aria-label={`${copy.remove} ${actor.name}`} onclick={() => { cancel(); feed.cast = feed.cast.filter(value => value.characterId !== actor.characterId) }}><X size={18} /></button>
                                </div>
                                {#if !characters.some(character => character.chaId === actor.characterId)}<p class="mb-2 text-xs text-textcolor2">{copy.missing}</p>{/if}
                                <label class="flex flex-col gap-2 text-sm">
                                    <span>{copy.publicProfile}</span>
                                    <textarea class="social-input" rows="3" maxlength={MAX_PROFILE_LENGTH} placeholder={copy.profileHint} bind:value={actor.publicProfile} oninput={cancel}></textarea>
                                </label>
                            </div>
                        {/each}
                    </div>
                </details>
                <SocialRelationships {feed} />
                <details class="universe-panel mb-5">
                    <summary class="universe-summary flex-wrap gap-2"><span class="font-semibold">{copy.generationSettings}</span><span class="text-xs text-textcolor2">{language.maxContextSize}: {feed.maxContext ?? '—'} · {language.maxResponseSize}: {feed.maxResponse ?? '—'}</span></summary>
                    <div class="universe-fields">
                        <p class="text-sm text-textcolor2">{copy.commonLimits}</p>
                        <p class="text-sm text-textcolor2">{copy.automaticLanguage}</p>
                        <label class="flex flex-col gap-2 text-sm"><span id="social-context-label">{language.maxContextSize}</span><input aria-labelledby="social-context-label" aria-describedby="social-context-help" class="social-input" type="number" min={SOCIAL_CONTEXT_MIN} max={SOCIAL_CONTEXT_MAX} step="1" bind:value={feed.maxContext} oninput={cancel} /><span id="social-context-help" class="text-xs text-textcolor2">{SOCIAL_CONTEXT_MIN}–{SOCIAL_CONTEXT_MAX} {copy.tokens}. {copy.contextEstimate}</span></label>
                        <label class="flex flex-col gap-2 text-sm"><span id="social-response-label">{language.maxResponseSize}</span><input aria-labelledby="social-response-label" aria-describedby="social-response-help" class="social-input" type="number" min={SOCIAL_RESPONSE_MIN} max={SOCIAL_RESPONSE_MAX} step="1" bind:value={feed.maxResponse} oninput={cancel} /><span id="social-response-help" class="text-xs text-textcolor2">{SOCIAL_RESPONSE_MIN}–{SOCIAL_RESPONSE_MAX} {copy.tokens}. {copy.reasoningBudget}</span></label>
                        <p class="text-xs text-textcolor2">{copy.initialLimits}</p>
                        {#if !limits}<p role="status" class="text-sm text-draculared">{copy.invalidLimits}</p>{/if}
                        <p class="text-xs text-textcolor2">{copy.batchMaximum}: {limits ? limits.maxResponse * Math.min(feed.cast.length, MAX_CAST) : '—'} {copy.tokens} ({Math.min(feed.cast.length, MAX_CAST)} {copy.castMembers}). {copy.budgetCost}</p>
                    </div>
                </details>
                <div class="social-composer mb-5">
                    <h2 class="mb-2 font-semibold">{copy.characterPublication}</h2>
                    <p class="mb-3 text-sm text-textcolor2">{copy.characterPublicationHint}</p>
                    <label class="flex flex-col gap-2 text-sm">
                        <span id="social-publication-author-label">{copy.publicationAuthor}</span>
                        <select aria-labelledby="social-publication-author-label" class="social-input" bind:value={publisherId} onchange={cancel}>
                            <option value="">{copy.choose}</option>
                            {#each feed.cast as actor (actor.characterId)}<option value={actor.characterId}>{actor.name}</option>{/each}
                        </select>
                    </label>
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                        {#if busyPost === 'publication'}
                            <span class="text-sm text-textcolor2">{copy.generatingPublication}</span>
                            <button class="social-button" onclick={() => { cancel(); status = copy.cancelled }}>{copy.cancel}</button>
                        {:else}
                            <button class="social-button social-primary flex items-center gap-2" disabled={!!busyPost || !selectedPublisher?.publicProfile.trim() || !supported || !limits} onclick={publishCharacter}><Sparkles size={17} />{copy.generatePublication}</button>
                        {/if}
                    </div>
                    <p class="mt-2 text-xs text-textcolor2">{copy.publicationMaximum}: {limits?.maxResponse ?? '—'} {copy.tokens}. {copy.budgetCost}</p>
                </div>
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions (Escape bubbles from the composer controls.) -->
                <form class="social-composer mb-5" onsubmit={publish} onkeydown={event => { if (event.key === 'Escape' && composerExpanded) { event.preventDefault(); event.stopPropagation(); closeComposer() } }}>
                    {#if !composerExpanded}
                        <div class="flex items-center gap-3">
                            <SocialAvatar name={author.name} image={author.image} size={44} />
                            <button type="button" class="composer-trigger" bind:this={composerTrigger} aria-expanded="false" onclick={openComposer}>{feed.draft.trim() ? copy.resumeDraft : copy.whatsNew}</button>
                        </div>
                    {:else}
                        <div class="mb-3 flex items-center gap-3">
                            <SocialAvatar name={author.name} image={author.image} size={44} />
                            <label class="flex min-w-0 grow flex-col gap-1 text-xs text-textcolor2">
                                <span>{copy.as}</span>
                                <select class="social-author-select" bind:value={authorChoice}>
                                    <option value={-1}>{DBState.db.username} ({copy.currentPersona})</option>
                                    {#each DBState.db.personas as persona, index}<option value={index}>{persona.name}</option>{/each}
                                </select>
                            </label>
                            <button type="button" class="social-icon" aria-label={copy.closeComposer} title={copy.draftKept} onclick={closeComposer}><X size={18} /></button>
                        </div>
                        <textarea id="social-post-input" aria-label={copy.write} class="composer-input" rows="3" placeholder={copy.whatsNew} maxlength={MAX_POST_LENGTH} bind:this={composerInput} bind:value={feed.draft}></textarea>
                        <div class="mt-3 flex items-center justify-between gap-2">
                            <span class="text-xs text-textcolor2">{feed.draft.length}/{MAX_POST_LENGTH}</span>
                            <button type="submit" class="social-button social-primary flex items-center gap-2" disabled={!feed.draft.trim()}><Send size={16} />{copy.publish}</button>
                        </div>
                    {/if}
                </form>
                <p class="mb-3 text-xs text-textcolor2">{copy.selectiveReactions}</p>
                <p role="status" class="text-sm text-textcolor2" class:mb-4={!!status}>{status}</p>
                {#if feed.posts.length === 0}
                    <div class="px-4 py-10 text-center">
                        <h2 class="text-xl font-medium">{copy.emptyFeed}</h2>
                        <p class="mt-2 text-textcolor2">{copy.emptyHint}</p>
                    </div>
                {/if}
                {#each feed.posts as post (post.id)}
                    <article id={`social-post-${post.id}`} class="social-post mb-5">
                        <div class="flex items-center gap-3">
                            <SocialAvatar name={post.author.name} image={post.author.image} size={48} />
                            <div class="min-w-0 grow">
                                <h2 class="break-words font-semibold">{post.author.name}</h2>
                                <time class="text-xs text-textcolor2" datetime={new Date(post.createdAt).toISOString()}>{new Date(post.createdAt).toLocaleString()}</time>
                            </div>
                            <button class="social-icon text-textcolor2" aria-label={copy.delete} onclick={() => deletePost = post.id}><X size={17} /></button>
                        </div>
                        <p class="post-content whitespace-pre-wrap break-words">{post.text}</p>
                        {#if deletePost === post.id}
                            <div class="mb-3 flex flex-wrap items-center gap-2 rounded bg-textcolor/5 p-3" role="group" aria-label={copy.confirmDelete}>
                                <p class="w-full text-sm">{copy.confirmDelete}</p>
                                <button class="social-button" onclick={() => { if (busyPost === post.id) cancel(); feed.posts = feed.posts.filter(value => value.id !== post.id); deletePost = '' }}>{copy.delete}</button>
                                <button class="social-button" onclick={() => deletePost = ''}>{copy.keep}</button>
                            </div>
                        {/if}
                        <div class="post-actions">
                            <button class="social-button flex items-center gap-2" aria-pressed={post.liked} onclick={() => post.liked = !post.liked}><Heart size={18} fill={post.liked ? 'currentColor' : 'none'} />{post.liked ? copy.unlike : copy.like}</button>
                            {#if busyPost === post.id}
                                <span class="text-sm text-textcolor2">{copy.generating}</span>
                                <button class="social-button" onclick={() => { cancel(); status = copy.cancelled }}>{copy.cancel}</button>
                            {:else if feed.cast.length && !eligibleSocialActors(feed, post).length && profilesReady}
                                <div class="flex flex-wrap gap-2" aria-label={copy.allReacted}>
                                    <span class="text-xs text-textcolor2">{copy.allReacted}</span>
                                    {#each post.responses.filter(response => response.reaction !== 'none') as response (response.id)}
                                        <span class="reaction-chip" title={`${response.actor.name}: ${reactionLabel(response.reaction)}`}><span aria-hidden="true">{reactionSymbol(response.reaction)}</span>{response.actor.name}</span>
                                    {/each}
                                </div>
                            {:else}
                                <button class="social-button flex items-center gap-2" disabled={!!busyPost || !profilesReady || !supported || !limits} onclick={() => react(post.id)}><Sparkles size={17} />{copy.generate}</button>
                            {/if}
                        </div>
                        {#if eligibleSocialActors(feed, post).length && limits}<p class="mt-2 text-xs text-textcolor2">{copy.batchMaximum}: {limits.maxResponse * eligibleSocialActors(feed, post).length} {copy.tokens} ({eligibleSocialActors(feed, post).length} × {limits.maxResponse}). {copy.budgetCost}</p>{/if}
                        {#if !profilesReady}<button class="mt-2 text-left text-xs text-textcolor2 underline underline-offset-4" onclick={() => castExpanded = true}>{copy.ready}</button>{/if}
                        {#if !supported}<p class="mt-2 text-xs text-textcolor2">{copy.unsupported}</p>{/if}
                        {#if post.responses.length}
                            <div class="post-comments">
                                {#each post.responses as response (response.id)}
                                    <div class="flex gap-3" aria-label={copy.response}>
                                        <SocialAvatar name={response.actor.name} image={response.actor.image} size={36} />
                                        <div class="min-w-0 grow">
                                            <p class="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold">{response.actor.name}<span class="reaction-symbol" title={reactionLabel(response.reaction)} aria-label={reactionLabel(response.reaction)}>{reactionSymbol(response.reaction)}</span></p>
                                            {#if response.comment}<p class="whitespace-pre-wrap break-words text-sm leading-relaxed">{response.comment}</p>{/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </article>
                {/each}
            </div>
        {/if}
    </div>
</section>

<style>
    .social-header { display: flex; flex: none; align-items: center; gap: .75rem; padding: .65rem 1rem; background: var(--risu-theme-surface-elevated); border-bottom: 1px solid color-mix(in srgb, var(--risu-theme-textcolor) 10%, transparent); position: relative; z-index: 2; }
    .social-help summary { list-style: none; }
    .social-help summary::-webkit-details-marker { display: none; }
    .social-help-content { position: absolute; right: 1rem; top: calc(100% + .5rem); width: min(24rem, calc(100vw - 2rem)); padding: 1.25rem; border-radius: .75rem; background: var(--risu-theme-surface-elevated); box-shadow: 0 8px 32px color-mix(in srgb, var(--risu-theme-textcolor) 15%, transparent); border: 1px solid color-mix(in srgb, var(--risu-theme-textcolor) 15%, transparent); font-size: .875rem; line-height: 1.6; max-height: calc(100dvh - 6rem); overflow-y: auto; }
    .social-help-content p + p { margin-top: .8rem; }
    .universe-panel, .social-composer, .social-post { background: var(--risu-theme-surface-elevated); border-radius: .75rem; border: 1px solid color-mix(in srgb, var(--risu-theme-textcolor) 9%, transparent); }
    .universe-summary { display: flex; align-items: center; gap: .75rem; padding: 1rem; cursor: pointer; list-style: none; }
    .universe-summary::-webkit-details-marker { display: none; }
    .universe-fields { display: flex; flex-direction: column; gap: 1.25rem; padding: 0 1rem 1rem; }
    .universe-actor { border-top: 1px solid color-mix(in srgb, var(--risu-theme-textcolor) 10%, transparent); padding-top: 1rem; }
    .social-composer { padding: 1rem; }
    .composer-trigger { min-width: 0; flex: 1; text-align: left; padding: .75rem 1rem; border-radius: 1.5rem; background: var(--risu-theme-surface-subtle); color: var(--risu-theme-textcolor2); min-height: 2.75rem; }
    .composer-input { width: 100%; resize: vertical; min-height: 6rem; padding: .5rem 0; background: transparent; font-size: 1.05rem; line-height: 1.6; }
    .social-author-select { width: 100%; min-width: 0; background: var(--risu-theme-surface-elevated); color: var(--risu-theme-textcolor); font-size: .875rem; min-height: 2rem; }
    .social-input { width: 100%; min-width: 0; border: 1px solid color-mix(in srgb, var(--risu-theme-textcolor) 20%, transparent); border-radius: .375rem; padding: .65rem; color: var(--risu-theme-textcolor); background: var(--risu-theme-bgcolor); }
    .social-post { padding: 1.25rem; }
    .post-content { margin: 1rem 0; font-size: 1.05rem; line-height: 1.65; }
    .post-actions { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; padding-top: .5rem; border-top: 1px solid color-mix(in srgb, var(--risu-theme-textcolor) 8%, transparent); }
    .post-comments { display: flex; flex-direction: column; gap: 1.1rem; margin-top: .75rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--risu-theme-textcolor) 8%, transparent); }
    .reaction-chip { display: inline-flex; align-items: center; gap: .4rem; padding: .3rem .6rem; font-size: .75rem; border-radius: 1rem; background: var(--risu-theme-surface-subtle); }
    .reaction-symbol { color: var(--risu-theme-textcolor2); font-size: .9rem; }
    .social-button { min-height: 2.75rem; padding: .55rem .7rem; border-radius: .5rem; }
    .social-primary { background: var(--risu-theme-selected); padding-inline: 1rem; }
    .social-icon { display: inline-flex; min-width: 2.75rem; min-height: 2.75rem; align-items: center; justify-content: center; border-radius: .5rem; flex: none; }
    .social-button:hover, .social-icon:hover, .composer-trigger:hover { background-color: var(--risu-theme-surface-subtle); }
    .social-button:disabled { opacity: .5; cursor: not-allowed; }
    .social-screen :is(button, textarea, select, summary):focus-visible { outline: 2px solid var(--risu-theme-focus); outline-offset: 3px; }
    @media (max-width: 360px) { .social-column { padding-inline: .75rem; } .social-post { padding: 1rem; } .post-actions { gap: .25rem; } }
</style>
