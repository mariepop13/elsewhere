<script lang="ts">
    import { v4 } from 'uuid'
    import { onDestroy, tick, untrack } from 'svelte'
    import { ArrowLeft, ArrowRight, Home, MessageCircle, Users, Settings, X, ChevronDown, Sparkles, Sun, Moon, Plus } from '@lucide/svelte'
    import { get } from 'svelte/store'
    import WorldShell from './WorldShell.svelte'
    import WorldMessages from './WorldMessages.svelte'
    import WorldKnowledge from './WorldKnowledge.svelte'
    import WorldGroupDetails from './WorldGroupDetails.svelte'
    import NativeSettings from '../Setting/Settings.svelte'
    import CharConfig from '../SideBars/CharConfig.svelte'
    import { importCharacter, exportChar } from 'src/ts/characterCards'
    import { createNewGroup, createNewCharacter } from 'src/ts/characters'
    import { worldMemoryEngine } from 'src/ts/social/worldKnowledge'
    import { createWorldMessageReadState, worldUnreadConversationCount } from 'src/ts/social/worldMessages'
    import { CharConfigSubMenu, hypaV3ModalOpen } from 'src/ts/stores.svelte'
    import { showHypaV2Alert } from 'src/ts/alert'
    import type { NativeWorldTool } from 'src/ts/social/worldNavigation.svelte'
    import WorldPrivateConversation from './WorldPrivateConversation.svelte'
    import { worldNavigation, type WorldPage } from 'src/ts/social/worldNavigation.svelte'
    import { doingChat } from 'src/ts/process/index.svelte'
    import { changeChatTo } from 'src/ts/globalApi.svelte'
    import { changeChar } from 'src/ts/characters'
    import './socialWorld.css'
    import TokenBudgetControl from '../Setting/TokenBudgetControl.svelte'
    import SocialBrand from './SocialBrand.svelte'
    import SocialMentionInput from './SocialMentionInput.svelte'
    import SocialPostCard from './SocialPostCard.svelte'
    import SocialProfileDialog from './SocialProfileDialog.svelte'
    import { addSocialComment, createSocialQuote, toggleSocialRepost, socialTimeline, ensureSocialHandles, socialTargets, type SocialTarget } from 'src/ts/social/socialInteractions'
    import { language } from 'src/lang'
    import { DBState, socialFeedOpen, settingsOpen, SettingsMenuIndex, MobileGUI, MobileGUIStack, MobileSideBar, selectedCharID } from 'src/ts/stores.svelte'
    import { createSocialFeed, createSocialPost, socialPersonaAuthor, MAX_CAST, MAX_POST_LENGTH, MAX_PROFILE_LENGTH, SocialGeneration, eligibleSocialActors } from 'src/ts/social/socialFeed'
    import { generateSocialPublication, generateSocialResponse, socialModelIdentity, socialModelSupported } from 'src/ts/social/socialProvider'
    import SocialRelationships from './SocialRelationships.svelte'
    import SocialAvatar from './SocialAvatar.svelte'
    import SocialWorldSetup from './SocialWorldSetup.svelte'
    import { applySocialSetup, type SocialSetupDraft } from 'src/ts/social/socialSetup'
    import { saveAsset } from 'src/ts/globalApi.svelte'
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
    let setupOpen = $state(false)
    let setupVersion = 0
    function openSetup() { cancel(); setupVersion++; setupOpen = true }
    function closeSetup() { setupVersion++; setupOpen = false }
    async function saveSetup(draft: SocialSetupDraft, photo?: Uint8Array) {
        const current = feed
        const version = setupVersion
        const snapshot = JSON.stringify({ setup: current.setup, world: current.publicWorld, cast: current.cast })
        const image = photo ? await saveAsset(photo, '', 'png') : draft.you.image
        if (DBState.db.socialFeed !== current || version !== setupVersion || !setupOpen || snapshot !== JSON.stringify({ setup: current.setup, world: current.publicWorld, cast: current.cast })) throw new Error('Setup changed')
        cancel()
        applySocialSetup(current, { ...draft, you: { ...draft.you, image } })
        draft.you.image = image
        status = ''
    }
    onDestroy(() => setupVersion++)
    let composerInput = $state<HTMLTextAreaElement>()
    let page = $derived(worldNavigation.page)
    let conversationOpen = $derived(worldNavigation.conversationOpen)
    let conversation = $derived(worldNavigation.conversation)
    let conversationCard = $derived(conversation ? DBState.db.characters.find(card => card.chaId === conversation?.characterId) : undefined)
    $effect(() => {
        const card = DBState.db.characters[$selectedCharID], chat = card?.chats[card.chatPage]
        if (conversation && card?.chaId === conversation.characterId && chat?.id && chat.id !== conversation.chatId) {
            worldNavigation.conversation = { characterId: card.chaId, chatId: chat.id }
            knowledgeOpen = false; groupOpen = false
        }
    })
    let conversationHeading = $derived(conversationOpen && page === 'Messages' && conversationCard ? { characterId: conversationCard.chaId, name: conversationCard.name, image: conversationCard.image } : undefined)
    let knowledgeOpen = $state(false)
    let groupOpen = $state(false)
    let nativePanel = $state<'settings' | 'character' | undefined>()
    const emptyReadState = createWorldMessageReadState()
    const readState = $derived(DBState.db.worldWorkspace?.messageReadState ?? emptyReadState)
    const unreadConversations = $derived(worldUnreadConversationCount(readState))
    $effect(() => { worldNavigation.conversationObscured = setupOpen || !!nativePanel || $settingsOpen || knowledgeOpen || groupOpen })
    function openSettings(index = -1) { if (get(doingChat)) { status = 'Finish or stop the current chat request before changing settings.'; return }; cancel(); SettingsMenuIndex.set(index); nativePanel = 'settings' }
    async function openNativeTool(kind: NativeWorldTool, characterId: string, chatId?: string) {
        if (get(doingChat)) { status = 'Finish or stop the current request before opening native editors.'; return }
        if (!await openMessage(characterId, chatId)) return
        if (worldNavigation.conversation?.characterId !== characterId || (chatId && worldNavigation.conversation.chatId !== chatId)) return
        const card = DBState.db.characters[get(selectedCharID)], chat = card?.chats[card.chatPage]
        if (!chat) return
        if (kind === 'settings') { openSettings(8); return }
        const memoryEngine = worldMemoryEngine(DBState.db)
        if (kind === 'memory' && memoryEngine === 'Hanurai') { openSettings(2); return }
        if (kind === 'memory' && memoryEngine === 'Hypa V3') {
            if (!chat.hypaV3Data) { status = 'No Hypa V3 summaries saved in this story yet.'; return }
            hypaV3ModalOpen.set(true); return
        }
        if (kind === 'memory' && memoryEngine === 'Hypa V2') {
            chat.hypaV2Data ??= { lastMainChunkID: 0, mainChunks: [], chunks: [] }
            showHypaV2Alert(); return
        }
        CharConfigSubMenu.set(kind === 'lorebook' ? 3 : kind === 'memory' ? 2 : 0)
        nativePanel = 'character'
    }
    let recent = $state(false)
    let audience = $state<'Public' | 'My circle'>('Public')
    let profileId = $state('')
    let quoteOpen = $state(false)
    let quoteDialog = $state<HTMLDialogElement>()
    let systemLight = $state(false)
    let authorChoice = $state(-1)
    let personaAuthor = $derived(socialPersonaAuthor(DBState.db.personas, DBState.db.selectedPersona, authorChoice, { name: DBState.db.username, image: DBState.db.userIcon }))
    let author = $derived(authorChoice === -1 && feed.setup ? feed.setup.you : personaAuthor)
    let targets = $derived(socialTargets(feed, author))
    let profile = $derived(targets.find(target => target.id === profileId))
    let timeline = $derived(socialTimeline(feed, !recent))
    let light = $derived(feed.preferences?.appearance === 'Light' || (feed.preferences?.appearance === 'System' && systemLight))
    $effect(() => {
        const authors = targets
        const current = feed
        untrack(() => {
            ensureSocialHandles(current, authors)
            current.preferences ??= { appearance: 'Dark', compact: false }
            current.commentDrafts ??= {}
            for (const post of current.posts) current.commentDrafts[post.id] ??= { text: '' }
        })
    })
    $effect(() => {
        const query = window.matchMedia('(prefers-color-scheme: light)')
        const update = () => systemLight = query.matches
        update(); query.addEventListener('change', update)
        return () => query.removeEventListener('change', update)
    })
    $effect(() => { if (quoteOpen) { if (!quoteDialog?.open) quoteDialog?.showModal() } else if (quoteDialog?.open) quoteDialog.close() })
    function navigate(next: WorldPage) { cancel(); worldNavigation.page = next; if (next === 'Messages') worldNavigation.conversationOpen = get(doingChat) && !!conversation; status = '' }
    function exitClassic() { if (get(doingChat)) { status = 'Finish or stop the current request before returning to classic Elsewhere.'; return }; cancel(); (DBState.db.worldWorkspace ??= {}).defaultHome = 'classic'; socialFeedOpen.set(false) }
    function showProfile(target: SocialTarget) { profileId = target.id }
    async function openMessage(id: string, chatId?: string) {
        const index = DBState.db.characters.findIndex(character => character.chaId === id)
        if (index < 0) { status = 'This character is no longer in your library.'; return }
        if (get(doingChat)) {
            const active = DBState.db.characters[get(selectedCharID)], activeChat = active?.chats[active.chatPage]
            if (active?.chaId === id && activeChat?.id && (!chatId || chatId === activeChat.id)) {
                worldNavigation.conversation = { characterId: id, chatId: activeChat.id }
                worldNavigation.page = 'Messages'; worldNavigation.conversationOpen = true; profileId = ''
                return true
            }
            status = 'Finish or stop the current chat request before switching conversations.'; return
        }
        cancel()
        const database = DBState.db, cards = database.characters, version = generationVersion
        try { await changeChar(index) } catch { status = 'Could not restore this conversation. Your existing story was kept.'; return }
        if (DBState.db !== database || database.characters !== cards || version !== generationVersion || database.characters[index]?.chaId !== id) return
        if (get(selectedCharID) !== index) { status = 'Finish the current chat request before opening this conversation.'; return }
        if (chatId) { if (!cards[index].chats.some(chat => chat.id === chatId)) { status = 'This story is no longer available.'; return }; changeChatTo(chatId) }
        const selectedChat = cards[index].chats[cards[index].chatPage]
        if (!selectedChat) { status = 'This story is not available yet.'; return }
        selectedChat.id ??= v4()
        profileId = ''
        worldNavigation.conversation = { characterId: id, chatId: selectedChat.id }
        worldNavigation.page = 'Messages'
        worldNavigation.conversationOpen = true
        knowledgeOpen = false; groupOpen = false
        return true
    }
    async function createStory(characterId: string) {
        if (get(doingChat)) { status = 'Finish or stop the current chat request before creating a story.'; return }
        cancel()
        const db = DBState.db, version = generationVersion
        const index = db.characters.findIndex(card => card.chaId === characterId)
        if (index < 0) return
        try { await changeChar(index) } catch { status = 'Could not restore this conversation. Your existing story was kept.'; return }
        if (DBState.db !== db || generationVersion !== version || get(selectedCharID) !== index) return
        const card = db.characters[index]
        if (card?.chaId !== characterId) return
        const id = v4()
        card.chats.push({ id, name: `Story ${card.chats.length + 1}`, message: [], localLore: [], note: '', fmIndex: -1 })
        await openMessage(characterId, id)
    }
    function beginQuote(id: string) {
        if (feed.quoteDraft?.postId !== id) feed.quoteDraft = { postId: id, text: '' }
        quoteOpen = true
    }
    function publishQuote(event: SubmitEvent) {
        event.preventDefault()
        const draft = feed.quoteDraft, source = feed.posts.find(post => post.id === draft?.postId)
        if (!source || !draft?.text.trim()) { status = 'The original post is no longer available.'; return }
        try { cancel(); feed.posts.unshift(createSocialQuote(author, draft.text, source, audience === 'My circle' ? feed.cast.map(actor => actor.characterId) : undefined)); feed.quoteDraft = undefined; quoteOpen = false; status = 'Quote posted.' } catch { status = 'Choose a valid post and at least one character for a circle audience.' }
    }
    function comment(id: string, text: string, parentId?: string): boolean {
        const post = feed.posts.find(post => post.id === id)
        if (!post) return false
        try { cancel(); addSocialComment(post, author, text, parentId); status = 'Comment added.'; return true } catch { status = 'Your comment was kept. Check its length and reply target.'; return false }
    }
    function removePost(id: string) {
        cancel(); feed.posts = feed.posts.filter(post => post.id !== id)
        if (feed.commentDrafts) delete feed.commentDrafts[id]
        status = 'Post deleted.'
    }
    async function sourcePost(id: string) { navigate('Feed'); recent = true; await tick(); document.getElementById(`social-post-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }) }
    let publisherId = $state('')
    let busyPost = $state('')
    let status = $state('')
    const generation = new SocialGeneration()
    let generationVersion = 0
    let supported = $derived(socialModelSupported())
    let modelName = $derived(DBState.db.aiModel === 'openrouter' ? DBState.db.openrouterRequestModel || getModelInfo(DBState.db.aiModel).name : DBState.db.aiModel === 'reverse_proxy' ? DBState.db.customProxyRequestModel || getModelInfo(DBState.db.aiModel).name : getModelInfo(DBState.db.aiModel).name)

    function openModelSettings() { openSettings(1) }
    let selectedPublisher = $derived(feed.cast.find(actor => actor.characterId === publisherId))
    let selectionIdentity = $derived(socialModelIdentity())
    let profilesReady = $derived(feed.cast.length > 0 && feed.cast.every(actor => actor.publicProfile.trim()))

    function cancel() {
        generationVersion++
        generation.cancel()
        busyPost = ''
    }
    onDestroy(cancel)

    function publish(event: SubmitEvent) {
        event.preventDefault()
        if (!feed.draft.trim() || feed.draft.trim().length > MAX_POST_LENGTH) return
        if (audience === 'My circle' && !feed.cast.length) { status = 'Add at least one character to your circle first.'; return }
        cancel()
        const post = createSocialPost(author, feed.draft)
        if (audience === 'My circle') post.visibleToActorIds = feed.cast.map(actor => actor.characterId)
        feed.posts.unshift(post)
        feed.draft = ''
        status = 'Your post is in the world.'
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

</script>

<section class="social-world" class:ew-light={light} class:ew-compact={feed.preferences?.compact} aria-label="Elsewhere social world">
    <SocialWorldSetup open={setupOpen} {feed} author={personaAuthor}
        personas={DBState.db.personas.map((persona, index) => ({ id: persona.id ?? `persona:${index}`, name: persona.name, image: persona.icon }))}
        characters={characters.map(card => ({ id: card.chaId, name: card.name, image: card.image }))}
        onclose={closeSetup} onsave={saveSetup} />
    <div class="world-workspace" class:world-hidden={setupOpen}>
        <WorldShell {page} worldName={feed.setup?.title || 'Your world'} you={author}
            appearance={feed.preferences?.appearance ?? 'Dark'} compact={feed.preferences?.compact}
            activeConversation={conversationHeading} {unreadConversations} onNavigate={navigate} onSetup={openSetup}
            onExit={exitClassic} onTheme={appearance => { (feed.preferences ??= {}).appearance = appearance }}
            onProfile={() => profileId = author.id}>
            <p role="status" class="ew-status world-status">{status}</p>
            <div class="world-page-scroll" class:world-hidden={page !== 'Feed'}><div class="ew-page">
                {#if !feed.enabled}
                    <div class="ew-panel ew-empty"><Users size={34} /><h2>Step into another life.</h2><p>An optional fictional social world, built around your own personas and characters. Your existing conversations stay separate.</p><p>Nothing is generated automatically. Inviting character posts or reactions uses your selected provider and can cost tokens.</p><button class="ew-button ew-primary" onclick={() => feed.enabled = true}>Enable social mode</button><button class="ew-button" onclick={openSetup}>Set up your world</button></div>
                {:else}
                    <div class="ew-columns"><div class="ew-feed-column">
                        <div class="ew-tabs" aria-label="Feed order"><button aria-pressed={!recent} onclick={() => recent = false}>For you</button><button aria-pressed={recent} onclick={() => recent = true}>Recent</button><small>{recent ? 'All public history' : 'Life around your current circle'}</small></div>
                        <form class="ew-composer" onsubmit={publish}><div class="ew-composer-body"><button class="ew-avatar-button" aria-label="Your profile" onclick={() => profileId = author.id}><SocialAvatar name={author.name} image={author.image} size={42} /></button><SocialMentionInput bind:value={feed.draft} bind:input={composerInput} {targets} label="Write a post" placeholder={`What's new in your world, ${author.name}? Try @someone`} maxlength={MAX_POST_LENGTH} rows={2} /></div><div class="ew-composer-footer"><select aria-label="Post audience" bind:value={audience}><option>Public</option><option>My circle</option></select><select aria-label="Post as" bind:value={authorChoice}><option value={-1}>{feed.setup?.you.name ?? DBState.db.username}</option>{#each DBState.db.personas as persona, index}<option value={index}>{persona.name}</option>{/each}</select><small>{feed.draft.length}/{MAX_POST_LENGTH}</small><button class="ew-button ew-primary" type="submit" disabled={!feed.draft.trim()}>Post <ArrowRight size={15} /></button></div></form>
                        {#if feed.quoteDraft}<button class="ew-button" onclick={() => quoteOpen = true}>Resume quote draft</button>{/if}
                        {#if !timeline.length}<div class="ew-empty"><h2>A story waiting to happen.</h2><p>Share a first moment, or invite a character to publish. Your world starts with your choices.</p><button class="ew-button" onclick={openSetup}>{feed.setup ? 'Edit world setup' : 'Set up your world'}</button></div>{/if}
                        {#each timeline as entry (entry.id)}
                            {#if entry.post}
                                <SocialPostCard post={entry.post} repost={entry.repost} {targets} you={author} reposted={!!feed.reposts?.some(repost => repost.postId === entry.post?.id && repost.author.id === author.id)} repostCount={feed.reposts?.filter(repost => repost.postId === entry.post?.id).length ?? 0}
                                    draft={feed.commentDrafts?.[entry.post.id] ?? { text: '' }} busy={busyPost === entry.post.id} canGenerate={!busyPost && profilesReady && supported && !!limits} eligible={eligibleSocialActors(feed, entry.post).length} maxResponse={limits?.maxResponse}
                                    onprofile={showProfile} onrepost={() => { if (entry.post) status = toggleSocialRepost(feed, entry.post.id, author) ? 'Reposted to your feed.' : 'Repost removed.' }} onquote={() => entry.post && beginQuote(entry.post.id)}
                                    oncomment={(text, parentId) => entry.post ? comment(entry.post.id, text, parentId) : false} onreact={() => entry.post && react(entry.post.id)} oncancel={() => { cancel(); status = copy.cancelled }} ondelete={() => entry.post && removePost(entry.post.id)} />
                            {:else}<article class="ew-post"><p class="ew-repost-note">{entry.repost?.author.name} reposted</p><p class="ew-muted">The original post is no longer available.</p><button class="ew-button" onclick={() => feed.reposts = feed.reposts?.filter(repost => repost.id !== entry.repost?.id)}>Remove repost</button></article>{/if}
                        {/each}
                        <div class="ew-panel"><h2 class="ew-post-name">Invite a character post</h2><p class="ew-muted" style="font-size:12px;margin:8px 0">On your request only, using the public world and visible feed.</p><div class="ew-actions"><select aria-label="Publication author" bind:value={publisherId} onchange={cancel}><option value="">Choose a character</option>{#each feed.cast as actor (actor.characterId)}<option value={actor.characterId}>{actor.name}</option>{/each}</select>{#if busyPost === 'publication'}<button class="ew-button" onclick={() => { cancel(); status = copy.cancelled }}>Cancel</button>{:else}<button class="ew-button" disabled={!!busyPost || !selectedPublisher?.publicProfile.trim() || !supported || !limits} onclick={publishCharacter}><Sparkles size={15} />Invite a post</button>{/if}</div><p class="ew-context-note">Up to {limits?.maxResponse ?? '—'} tokens. {copy.budgetCost}</p>{#if !profilesReady}<button class="ew-neighbor-link" onclick={openSetup}>Add public character profiles <ArrowRight size={15} /></button>{/if}{#if !supported}<p class="ew-context-note">{copy.unsupported}</p>{/if}</div>
                    </div><aside class="ew-context-column" aria-label="Your world">
                        <div class="ew-world-card"><span class="ew-eyebrow">YOUR LITTLE CORNER OF THE WORLD</span><svg viewBox="0 0 260 130" role="img" aria-label="An imaginary neighborhood"><path d="M0 112 Q65 94 130 107 T260 109 V127 H0Z" fill="currentColor" opacity=".2"/><path d="M100 113 V63 L127 43 L153 63 V113Z" fill="currentColor" opacity=".25"/><path d="M77 113 V79 H102 V113 M151 113 V76 H181 V113" fill="currentColor" opacity=".35"/><path d="M117 111 V92 H135 V111 M113 65 H122 V76 H113Z M133 65 H142 V76 H133Z M33 109 V79 M221 109 V78" fill="currentColor" opacity=".65"/><circle cx="33" cy="65" r="20" fill="currentColor" opacity=".15"/><circle cx="221" cy="61" r="22" fill="currentColor" opacity=".15"/><path d="M189 18 L192 26 L200 29 L192 32 L189 40 L186 32 L178 29 L186 26Z" fill="currentColor" opacity=".6"/></svg><h2>{feed.setup?.title || 'Your social world'}</h2><p>{feed.publicWorld ? feed.publicWorld.slice(0, 160) : 'Ordinary days make the best stories.'}</p><footer>● {feed.cast.length} {feed.cast.length === 1 ? 'neighbor' : 'neighbors'} in your circle</footer></div>
                        <div class="ew-panel ew-neighbors"><h2>Familiar faces</h2>{#each feed.cast as actor (actor.characterId)}<button class="ew-neighbor" onclick={() => profileId = `character:${actor.characterId}`}><SocialAvatar name={actor.name} image={actor.image} size={36} /><span><strong>{actor.name}</strong><small>{actor.publicProfile || 'Add a public profile'}</small></span><ArrowRight size={14} /></button>{/each}{#if !feed.cast.length}<p class="ew-muted">Choose a few familiar faces to begin.</p>{/if}<button class="ew-neighbor-link" onclick={() => navigate('Relationships')}>Explore my relationships <ArrowRight size={14} /></button></div><p class="ew-context-note">A fictional world. A story that feels like you.<br />No automatic generation. Private chats stay private.</p>
                    </aside></div>
                {/if}
            </div></div>
            <div class="world-page-scroll" class:world-hidden={page !== 'Messages' || conversationOpen}>
                <WorldMessages onNewStory={createStory} onOpenConversation={openMessage} activeConversation={conversation} {readState}
                    onReadStateChange={next => { (DBState.db.worldWorkspace ??= {}).messageReadState = next }} />
            </div>
            {#if conversation}
                {#key `${conversation.characterId}:${conversation.chatId}`}
                    <div class="world-private-page" class:world-hidden={page !== 'Messages' || !conversationOpen}>
                        <WorldPrivateConversation {conversation} visible={!setupOpen && page === 'Messages' && conversationOpen} onBack={() => worldNavigation.conversationOpen = false}
                            onProfile={feed.cast.some(actor => actor.characterId === conversation?.characterId) ? () => profileId = `character:${conversation?.characterId}` : undefined}
                            onKnowledge={() => knowledgeOpen = !knowledgeOpen} onGroup={() => groupOpen = !groupOpen} />
                        {#if knowledgeOpen}<div class="world-context-drawer"><button class="ew-button" onclick={() => knowledgeOpen = false}>Close memory & knowledge</button><WorldKnowledge scope="private" characterId={conversation.characterId} chatId={conversation.chatId} onOpenNativeTool={openNativeTool} onOpenModelSettings={() => openSettings(2)} /></div>{/if}
                        {#if groupOpen}<div class="world-context-drawer"><button class="ew-button" onclick={() => groupOpen = false}>Close group details</button><WorldGroupDetails characterId={conversation.characterId}/></div>{/if}
                    </div>
                {/key}
            {/if}
            <div class="world-page-scroll" class:world-hidden={page !== 'Relationships'}><div class="ew-page">

                    <div class="ew-settings"><WorldKnowledge scope="public" onOpenPost={sourcePost} /><div class="ew-panel"><h2>Starting relationships & knowledge</h2><p>Facts you explicitly choose for this world. Public facts can guide character reactions. Private and paused notes stay out of public generation.</p>{#each feed.cast as actor (actor.characterId)}<div class="ew-settings"><button class="ew-neighbor" onclick={() => profileId = `character:${actor.characterId}`}><SocialAvatar name={actor.name} image={actor.image} size={36} /><strong>{actor.name}</strong></button><label>Starting facts<textarea rows="3" maxlength={MAX_PROFILE_LENGTH} bind:value={actor.startingFacts} oninput={cancel} placeholder="Only facts you choose to add…"></textarea></label><label>Use in this social world<select value={actor.startingFactsVisibility ?? 'public'} onchange={event => { cancel(); actor.startingFactsVisibility = event.currentTarget.value as 'public' | 'private' | 'paused' }}><option value="public">Public</option><option value="private">Private note</option><option value="paused">Paused</option></select></label><button class="ew-button" onclick={() => { cancel(); actor.startingFacts = ''; actor.startingFactsVisibility = 'public' }}>Remove starting facts</button></div>{/each}{#if !feed.cast.length}<button class="ew-button" onclick={openSetup}>Choose your cast</button>{/if}</div></div>
            </div></div>
            <div class="world-page-scroll" class:world-hidden={page !== 'Library'}><div class="ew-page ew-settings">
                <div class="ew-panel"><h1>Your library</h1><p>Your native character cards, groups and personas.</p><div class="ew-actions"><button class="ew-button" disabled={$doingChat} onclick={importCharacter}>Import character cards</button><button class="ew-button" disabled={$doingChat} onclick={createNewCharacter}>New character</button><button class="ew-button" disabled={$doingChat} onclick={createNewGroup}>New group</button><button class="ew-button" onclick={() => openSettings(12)}>Manage personas</button></div></div>
                {#each DBState.db.characters.filter(card => !card.trashTime) as card (card.chaId)}<div class="ew-panel"><div class="ew-neighbor"><SocialAvatar name={card.name} image={card.image} size={42}/><strong>{card.name}</strong><small>{card.type === 'group' ? 'Group' : 'Character card'}</small></div><div class="ew-actions"><button class="ew-button" onclick={() => openMessage(card.chaId)}>Messages</button><button class="ew-button" disabled={$doingChat} onclick={() => openNativeTool('character', card.chaId, card.chats[card.chatPage]?.id)}>Edit native card</button>{#if card.type !== 'group'}<button class="ew-button" onclick={() => exportChar(DBState.db.characters.findIndex(candidate => candidate.chaId === card.chaId))}>Export card</button>{/if}</div></div>{/each}
            </div></div>
            <div class="world-page-scroll" class:world-hidden={page !== 'Settings'}><div class="ew-page">

                    <div class="ew-settings"><div class="ew-panel"><h2>Your world</h2><p>Setup uses your existing character cards and personas without changing them.</p><label>Start Elsewhere in<select value={DBState.db.worldWorkspace?.defaultHome ?? 'world'} onchange={event => { (DBState.db.worldWorkspace ??= {}).defaultHome = event.currentTarget.value as 'world' | 'classic' }}><option value="world">My world</option><option value="classic">Classic Elsewhere</option></select></label><button class="ew-button" onclick={openSetup}>{feed.setup ? 'Edit world setup' : 'Set up a world'}</button></div><div class="ew-panel"><h2>Appearance</h2><label>Theme<select value={feed.preferences?.appearance ?? 'Dark'} onchange={event => { (feed.preferences ??= {}).appearance = event.currentTarget.value as 'Dark' | 'Light' | 'System' }}><option>Dark</option><option>Light</option><option>System</option></select></label><label class="ew-switch"><input type="checkbox" checked={!!feed.preferences?.compact} onchange={event => { (feed.preferences ??= {}).compact = event.currentTarget.checked }} />Compact feed</label></div>
                    <div class="ew-panel"><h2>Generation, at your pace</h2><p>{copy.cost} {copy.automaticLanguage}</p><p>{copy.model}: {modelName}</p><button class="ew-button" onclick={openModelSettings}>Model settings</button><h3>Maximum context size</h3><TokenBudgetControl bind:value={() => feed.maxContext ?? SOCIAL_CONTEXT_MIN, value => { cancel(); feed.maxContext = value }} minimum={SOCIAL_CONTEXT_MIN} maximum={SOCIAL_CONTEXT_MAX} label="Maximum context size" tokensText="tokens" unknownText="" invalidText="Enter a whole number within these limits." fixedText="" disabledText="Disabled" /><h3>Maximum response size</h3><TokenBudgetControl bind:value={() => feed.maxResponse ?? SOCIAL_RESPONSE_MIN, value => { cancel(); feed.maxResponse = value }} minimum={SOCIAL_RESPONSE_MIN} maximum={SOCIAL_RESPONSE_MAX} label="Maximum response size" tokensText="tokens" unknownText="" invalidText="Enter a whole number within these limits." fixedText="" disabledText="Disabled" /><p>{copy.contextEstimate} {copy.reasoningBudget}</p>{#if !limits}<p role="status">{copy.invalidLimits}</p>{/if}<p>Reactions: Manual. Every invitation is an explicit request.</p></div>
                    <div class="ew-panel"><h2>Public and private</h2><p>{copy.privacy}</p><p>{copy.providerStorage}</p><button class="ew-button" onclick={alertRequestLogs}>{copy.requestLogs}</button><p>{copy.draftKept}</p><button class="ew-button" onclick={() => { cancel(); feed.enabled = false }}>Disable social mode</button></div></div>
            </div></div>
            {#if nativePanel || $settingsOpen}<div class="world-native-panel" role="dialog" aria-modal="true" aria-label="Native Elsewhere tools"><header><button class="ew-button" onclick={() => { nativePanel = undefined; settingsOpen.set(false) }}>Back to your world</button>{#if nativePanel === 'settings' || $settingsOpen}<button class="ew-button" onclick={() => SettingsMenuIndex.set(-1)}>All settings</button>{/if}</header><div class="world-native-panel-body">{#if nativePanel === 'settings' || $settingsOpen}<NativeSettings/>{:else}<CharConfig/>{/if}</div></div>{/if}
        </WorldShell>
        <SocialProfileDialog target={profile} {feed} onclose={() => { profileId = ''; cancel() }} onmessage={openMessage} onrelationships={() => { profileId = ''; navigate('Relationships') }} />
        <dialog class="ew-profile-dialog" aria-labelledby="social-quote-heading" bind:this={quoteDialog} oncancel={() => quoteOpen = false} onclose={() => quoteOpen = false} onkeydown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); quoteOpen = false } }}><div class="ew-profile-content"><div class="ew-actions"><h2 id="social-quote-heading" class="ew-grow">Quote a moment.</h2><button class="ew-icon" aria-label="Close quote composer" onclick={() => quoteOpen = false}><X size={20} /></button></div>{#if feed.quoteDraft}<form onsubmit={publishQuote}><p role="status" class="ew-status">{status}</p><p class="ew-context-note">Closing keeps your draft. Restricted posts keep their original audience.</p><SocialMentionInput bind:value={feed.quoteDraft.text} {targets} label="Write a quote post" placeholder="Add your own words…" maxlength={MAX_POST_LENGTH} /><div class="ew-quote-card"><p>{feed.posts.find(post => post.id === feed.quoteDraft?.postId)?.text ?? 'Original post unavailable'}</p></div><button class="ew-button ew-primary" type="submit" disabled={!feed.quoteDraft.text.trim()}>Post quote <ArrowRight size={15} /></button></form>{/if}</div></dialog>
    </div>
</section>

<style>
    .world-workspace{height:100%;width:100%;min-height:0}.world-hidden{display:none!important}.world-page-scroll{height:100%;overflow:auto;min-width:0}.world-private-page{height:100%;min-height:0;position:relative}.world-status{position:absolute;z-index:20;bottom:66px;left:24px;pointer-events:none}.world-status:empty{display:none}.world-context-drawer{position:absolute;z-index:30;top:0;right:0;bottom:0;width:min(100%,520px);overflow:auto;padding:24px;background:var(--world-panel);border-left:1px solid var(--world-line)}.world-context-drawer>button{margin-bottom:20px}.world-native-panel{position:absolute;z-index:40;inset:0;display:flex;flex-direction:column;background:var(--world-canvas);color:var(--world-text)}.world-native-panel header{padding:12px;display:flex;gap:12px;border-bottom:1px solid var(--world-line)}.world-native-panel-body{min-height:0;flex:1;overflow:auto}.world-native-panel-body :global(.char-config){width:100%}
</style>
