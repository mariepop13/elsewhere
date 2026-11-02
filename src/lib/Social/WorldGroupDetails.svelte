<script lang="ts">
    import { doingChat } from 'src/ts/process/index.svelte'
    import { DBState, selectedCharID } from 'src/ts/stores.svelte'
    import { dumpCharImage } from 'src/ts/characters'
    import { selectSingleFile } from 'src/ts/util'
    import { saveImage } from 'src/ts/storage/database.svelte'
    import { rmCharFromGroup } from 'src/ts/process/group'
    import SocialAvatar from './SocialAvatar.svelte'
    let { characterId }: { characterId: string } = $props()
    let candidate = $state('')
    let error = $state('')
    let group = $derived(DBState.db.characters.find(c => c.chaId === characterId && c.type === 'group'))
    let available = $derived(DBState.db.characters.filter(c => c.type !== 'group' && !c.trashTime && group?.type === 'group' && !group.characters.includes(c.chaId)))
    async function photo() {
        const db = DBState.db, original = group
        if (original?.type !== 'group') return
        try {
            const file = await selectSingleFile(['png', 'webp', 'gif', 'jpg', 'jpeg'])
            if (!file || DBState.db !== db || !db.characters.includes(original)) return
            const image = await saveImage(file.data)
            if (DBState.db !== db || !db.characters.includes(original)) return
            const index = db.characters.indexOf(original)
            dumpCharImage(index)
            db.characters[index].image = image
        } catch { error = 'Could not save group photo.' }
    }
    function add() {
        if (group?.type !== 'group' || !available.some(c => c.chaId === candidate)) return
        group.characters.push(candidate)
        group.characterTalks.push(4 / 6)
        group.characterActive.push(true)
        candidate = ''
    }
    function remove(index: number) {
        if (group?.type !== 'group') return
        if (DBState.db.characters[$selectedCharID]?.chaId === characterId) rmCharFromGroup(index)
        else {
            group.characters.splice(index, 1)
            group.characterTalks.splice(index, 1)
            group.characterActive.splice(index, 1)
        }
    }
</script>
{#if group?.type === 'group'}
    <fieldset disabled={$doingChat} class="rounded-xl border border-borderc bg-bgcolor p-4 text-textcolor" aria-label="Group details">
        <div class="flex items-center gap-3">
            <SocialAvatar name={group.name || 'Group'} image={group.image} />
            <button class="rounded-lg border border-borderc px-3 py-2" onclick={photo}>Change group photo</button>
        </div>
        {#if error}<p role="alert" class="text-draculared">{error}</p>{/if}
        <label class="mt-4 flex items-center gap-2"><input type="checkbox" bind:checked={group.orderByOrder} /> Respond in participant order</label>
        <p class="my-3 text-sm text-textcolor2">Participation controls apply to your explicit next response request.</p>
        <ul class="space-y-3">
            {#each group.characters as id, index (id)}
                {@const member = DBState.db.characters.find(c => c.chaId === id)}
                <li class="flex flex-wrap items-center gap-3 border-t border-borderc pt-3">
                    <SocialAvatar name={member?.name || 'Unavailable participant'} image={member?.image} size={32} />
                    <span class="min-w-0 flex-1 truncate">{member?.name || 'Unavailable participant'}</span>
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" bind:checked={group.characterActive[index]} /> Active</label>
                    <label class="flex items-center gap-2 text-sm">Participation <input class="w-24" type="range" min="0" max="1" step="0.05" aria-label={`Participation: ${member?.name || id}`} bind:value={group.characterTalks[index]} /></label>
                    <button class="text-sm text-draculared" aria-label={`Remove ${member?.name || 'participant'}`} onclick={() => remove(index)}>Remove</button>
                </li>
            {/each}
        </ul>
        <div class="mt-4 flex flex-wrap gap-2">
            <select class="min-w-0 flex-1 rounded-lg border border-borderc bg-bgcolor p-2" aria-label="Participant to add" bind:value={candidate}>
                <option value="">Choose a participant</option>
                {#each available as member}<option value={member.chaId}>{member.name}</option>{/each}
            </select>
            <button class="rounded-lg border border-borderc px-3 py-2 disabled:opacity-50" disabled={!candidate} onclick={add}>Add participant</button>
        </div>
        <p class="mt-2 text-xs text-textcolor2">Adding a participant preserves the story without inserting a greeting.</p>
    </fieldset>
{/if}
