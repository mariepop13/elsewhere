<script lang="ts">
    import { v4 } from 'uuid'
    import { doingChat } from 'src/ts/process/index.svelte'
    import { DBState } from 'src/ts/stores.svelte'
    import type { Database } from 'src/ts/storage/database.svelte'
    import { worldHistoryLabel, worldUnreadCount, type WorldMessageReadState } from 'src/ts/social/worldMessages'

    let { character, readState, onOpen, onNew }: {
        character: Database['characters'][number]
        readState?: WorldMessageReadState
        onOpen: (chatId: string) => void
        onNew: () => void
    } = $props()
</script>

<div class="conversation-versions">
    <p>Keep different paths here. Opening a version preserves every other conversation.</p>
    {#each character.chats as chat, index}
        {@const label = worldHistoryLabel(chat, index)}
        {@const persona = DBState.db.personas.find(persona => persona.id === chat.bindedPersona)}
        {@const unread = chat.id && readState ? worldUnreadCount(readState, character.chaId, chat.id) : 0}
        <section class="conversation-version" aria-label={label}>
            <button disabled={$doingChat} aria-current={index === character.chatPage ? 'true' : undefined}
                onclick={() => { chat.id ??= v4(); onOpen(chat.id) }}>
                <strong>{label}</strong>
                <span>{index === character.chatPage ? 'Current conversation' : 'Open this version'}{unread ? ' · Unread' : ''}</span>
            </button>
            <label>Speak as
                <select disabled={$doingChat} aria-label={`Persona for ${label}`} bind:value={chat.bindedPersona}>
                    <option value="">Current persona</option>
                    {#if chat.bindedPersona && !persona}<option value={chat.bindedPersona}>Unavailable bound persona</option>{/if}
                    {#each DBState.db.personas.filter(persona => persona.id) as persona}<option value={persona.id}>{persona.name}</option>{/each}
                </select>
            </label>
        </section>
    {/each}
    <button class="conversation-new-version" disabled={$doingChat} onclick={onNew}>New conversation version</button>
    {#if $doingChat}<p role="status">Finish or stop the current request before switching versions.</p>{/if}
</div>

<style>
    .conversation-versions{display:flex;flex-direction:column;gap:14px;min-width:0}
    p{font-size:13px;line-height:1.6;color:var(--world-muted)}
    .conversation-version{display:grid;gap:10px;border:1px solid var(--world-line);border-radius:12px;padding:12px}
    .conversation-version button{display:flex;flex-direction:column;align-items:flex-start;min-width:0;width:100%}
    .conversation-version button[aria-current="true"]{background:var(--world-canvas)}
    strong{overflow-wrap:anywhere}span{font-size:12px;color:var(--world-muted)}
    label{display:grid;gap:6px;font-size:13px}
    select{min-height:44px;width:100%;min-width:0;border:1px solid var(--world-line);border-radius:8px;padding:8px;background:var(--world-canvas);color:var(--world-text)}
    select:focus-visible{outline:2px solid var(--risu-theme-focus);outline-offset:2px}
    button:disabled,select:disabled{opacity:.5}
    .conversation-new-version{border:1px solid var(--world-line)}
</style>
