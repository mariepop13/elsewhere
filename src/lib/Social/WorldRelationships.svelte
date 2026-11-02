<script lang="ts">
    import { v4 } from 'uuid'
    import { doingChat } from 'src/ts/process/index.svelte'
    import { untrack } from 'svelte'
    import { DBState } from 'src/ts/stores.svelte'
    import { saving } from 'src/ts/globalApi.svelte'
    import type { SocialFeedState } from 'src/ts/social/socialFeed'
    import { createNativeRelationships, loadNativeRelationships, nativeRelationshipKey, nativeRelationshipView, nativePublicSource, recordNativeRelationship, openNativeRelationshipSource } from 'src/ts/social/nativeRelationships'
    import type { SourceReference } from 'src/ts/social/relationshipSourceAccess'
    import type { ExplicitRelationshipCommand } from 'src/ts/social/relationshipEventAdapter'
    import RelationCard from './RelationCard.svelte'
    import RelationshipEditor from './RelationshipEditor.svelte'

    let { feed, characterId, personaId, onpost }: { feed: SocialFeedState; characterId: string; personaId?: string; onpost: (id: string) => void } = $props()
    let publicView = $state(false)
    let selectedPost = $state('')
    let noteId = $state('')
    let openedEventId = $state('')
    let status = $state('')
    const ownerDatabase = untrack(() => DBState.db)
    let loaded = $derived(loadNativeRelationships(DBState.db.worldWorkspace?.relationshipWorkspace))
    let persona = $derived(DBState.db.personas.filter(persona => persona.id === personaId).length === 1 ? DBState.db.personas.find(persona => persona.id === personaId) : undefined)
    let personaIds = $derived(DBState.db.personas.flatMap(p => p.id ? [p.id] : []))
    let characters = $derived(DBState.db.characters.filter(card => card.type !== 'group' && !card.trashTime))
    let characterIds = $derived(characters.map(card => card.chaId))
    let character = $derived(characters.filter(card => card.chaId === characterId).length === 1 ? characters.find(card => card.chaId === characterId) : undefined)
    let relation = $derived(loaded.status === 'ready' && persona?.id && character ? nativeRelationshipKey(loaded.workspace, persona.id, character.chaId) : undefined)
    let view = $derived(loaded.status === 'ready' && relation ? nativeRelationshipView(loaded, relation, feed, personaIds, characterIds, publicView) : undefined)
    let source = $derived.by((): SourceReference | undefined => {
        if (loaded.status !== 'ready' || !relation) return undefined
        if (publicView) {
            const post = feed.posts.find(post => post.id === selectedPost)
            return post ? nativePublicSource(loaded.workspace, relation, post) : undefined
        }
        return noteId ? { ...loaded.workspace.binding, kind: 'authored_note', ownerId: loaded.workspace.binding.ownerId, recordId: noteId, participants: [relation.subject, relation.other] } : undefined
    })
    let publicPosts = $derived(relation ? feed.posts.filter(post => post.visibleToActorIds === undefined && (post.author.characterId === relation.other.id || (!post.author.characterId && post.author.id === relation.subject.id))) : [])
    let openedNote = $derived.by(() => {
        if (loaded.status !== 'ready' || !relation || publicView || !openedEventId || DBState.db !== ownerDatabase) return undefined
        const ref = openNativeRelationshipSource(DBState.db.worldWorkspace?.relationshipWorkspace, openedEventId, relation, feed, personaIds, characterIds)
        return ref?.kind === 'authored_note' ? loaded.workspace.notes.find(note => note.id === ref.recordId) : undefined
    })
    let contextKey = $derived(JSON.stringify([personaId, characterId, loaded.status === 'ready' ? loaded.workspace.binding : loaded.status, publicView]))
    $effect(() => { contextKey; untrack(clearEditor) })
    let memories = $derived.by(() => {
        if (loaded.status !== 'ready' || !relation || !view || publicView || DBState.db !== ownerDatabase) return []
        return view.events.flatMap(event => {
            const ref = openNativeRelationshipSource(DBState.db.worldWorkspace?.relationshipWorkspace, event.id, relation, feed, personaIds, characterIds)
            const note = ref?.kind === 'authored_note' ? loaded.workspace.notes.find(note => note.id === ref.recordId) : undefined
            return note ? [{ eventId: event.id, text: note.text }] : []
        })
    })
    function setup() {
        if ($doingChat || !persona?.id || !character || DBState.db !== ownerDatabase || loaded.status !== 'missing') return
        DBState.db.worldWorkspace ??= {}
        DBState.db.worldWorkspace.relationshipWorkspace = createNativeRelationships(v4)
    }
    function clearEditor() { noteId = ''; selectedPost = ''; openedEventId = ''; status = '' }
    function record(command: ExplicitRelationshipCommand) {
        if ($doingChat || DBState.db !== ownerDatabase || !relation || !source || JSON.stringify(command.source) !== JSON.stringify(source)) throw new Error('Source or save changed. Select the interaction again.')
        const next = recordNativeRelationship(DBState.db.worldWorkspace?.relationshipWorkspace, command, relation, feed, personaIds, characterIds)
        // Existing database autosave owns durability; acknowledge the native state transaction.
        DBState.db.worldWorkspace.relationshipWorkspace = next
        if (command.source.kind === 'authored_note') noteId = ''
    }
    function openSource(eventId: string) {
        if (!relation || DBState.db !== ownerDatabase) return
        const ref = openNativeRelationshipSource(DBState.db.worldWorkspace?.relationshipWorkspace, eventId, relation, feed, personaIds, characterIds, publicView)
        if (!ref) { openedEventId = ''; status = 'This source is no longer available in this viewpoint.'; return }
        if (ref.kind === 'public_post') onpost(ref.postId)
        else if (ref.kind === 'authored_note') openedEventId = eventId
    }
    function deleteNote() {
        if ($doingChat || loaded.status !== 'ready' || !openedNote || DBState.db !== ownerDatabase) return
        const deletedId = openedNote.id
        DBState.db.worldWorkspace.relationshipWorkspace = { ...loaded.workspace, notes: loaded.workspace.notes.filter(note => note.id !== deletedId) }
        clearEditor()
    }
</script>

<section class="ew-panel world-relationships" aria-label="Character relationship">
    <h3>Your relationship</h3>
    <p>With {persona?.name ?? 'your active persona'}. Record the relationship you choose. Scores are fictional game state; affinity does not imply romance. Nothing is generated or scored automatically.</p>
    {#if saving.error}<p role="alert">Local saving failed. Your changes remain in memory while saving retries. Keep this page open until saving succeeds.</p>{/if}
    {#if loaded.status === 'missing'}
        <button class="ew-button" disabled={$doingChat || !persona?.id || !character} onclick={setup}>Enable explicit relationships for this save</button>
    {:else if loaded.status === 'unavailable'}
        <p role="status">This relationship data cannot be opened by this version. It is preserved unchanged; recording is disabled.</p>
    {:else if !persona?.id}
        <p>Select a native persona with a stable identity in Settings to record relationships.</p>
    {:else if !character}
        <p>This character is no longer available in your library. Its saved relationship data is preserved.</p>
    {:else if relation && view}
        <div class="ew-settings">
            <label>View<select value={publicView ? 'public' : 'private'} onchange={event => { publicView = event.currentTarget.value === 'public'; clearEditor() }}><option value="private">My private perspective</option><option value="public">Public evidence only</option></select></label>
        </div>
        <RelationCard {view} subjectName={persona.name} otherName={character.name} onsource={event => openSource(event.id)} />
        {#if memories.length}<section aria-label="Recorded relationship memories"><h3>Recent memories</h3><p>Notes available to {persona.name} in this relationship.</p><ul>{#each memories as memory (memory.eventId)}<li><p class="note-text">{memory.text}</p><button class="ew-button" onclick={() => openSource(memory.eventId)}>Open recorded memory</button></li>{/each}</ul></section>{/if}
        {#if publicView}
            <label>Public source<select value={selectedPost} onchange={event => selectedPost = event.currentTarget.value}><option value="">Choose a public publication</option>{#each publicPosts as post (post.id)}<option value={post.id}>{post.author.name}: {post.text.slice(0, 80)}</option>{/each}</select></label>
        {:else}
            <button class="ew-button" disabled={$doingChat} onclick={() => { noteId = v4(); openedEventId = ''; status = '' }}>Record a private interaction</button>
        {/if}
        {#if source}
            {#key JSON.stringify([relation, source, publicView])}
                <RelationshipEditor canRecord={!$doingChat} {view} {source} scope={publicView ? 'public' : 'private'} knownBy={[relation.subject, relation.other]} createCommandId={v4} oncommand={record} />
            {/key}
        {/if}
        {#if openedNote}
            <section class="ew-panel" aria-label="Private relationship source"><h3>Recorded memory</h3><p class="note-text">{openedNote.text}</p><button class="ew-button" onclick={() => openedEventId = ''}>Close note</button><button class="ew-button" disabled={$doingChat} onclick={deleteNote}>Delete note and its effects</button></section>
        {/if}
        {#if $doingChat}<p role="status">Finish or stop the current request before recording an interaction.</p>{/if}
        {#if status}<p role="status">{status}</p>{/if}
    {/if}
</section>

<style>
    .world-relationships { display: grid; gap: 16px; min-width: 0; margin-bottom: 24px; }
    p { line-height: 1.6; overflow-wrap: anywhere; }
    .note-text { white-space: pre-wrap; }
    label { display: grid; gap: 8px; min-width: 0; }
    select { width: 100%; min-width: 0; padding: 10px; border-radius: 10px; color: var(--world-text); background: var(--world-panel); border: 1px solid var(--world-line); }
    button:focus-visible, select:focus-visible { outline: 2px solid var(--risu-theme-focus); outline-offset: 3px; }
</style>
