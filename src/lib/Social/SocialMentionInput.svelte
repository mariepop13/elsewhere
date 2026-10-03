<script lang="ts">
    import { tick } from 'svelte'
    import type { SocialTarget } from 'src/ts/social/socialInteractions'
    let { value = $bindable(''), targets, label, placeholder = '', maxlength = 2000, rows = 3, input = $bindable(), oninput = () => {} }: {
        value: string; targets: SocialTarget[]; label: string; placeholder?: string; maxlength?: number; rows?: number; input?: HTMLTextAreaElement; oninput?: () => void;
    } = $props()
    let cursor = $state(0)
    let focused = $state(false)
    let dismissed = $state(false)
    let selected = $state(0)
    let token = $derived(value.slice(0, cursor).match(/(?:^|\s)@([a-zA-Z0-9_]*)$/))
    let suggestions = $derived(focused && !dismissed && token ? targets.filter(target => target.handle && `${target.handle} ${target.name}`.toLowerCase().includes(token![1].toLowerCase())).slice(0, 5) : [])
    const listId = $props.id()
    function update() { cursor = input?.selectionStart ?? value.length; dismissed = false; selected = 0; oninput() }
    async function choose(target: SocialTarget) {
        if (!token) return
        const start = cursor - token[1].length - 1
        const mention = `@${target.handle} `
        value = value.slice(0, start) + mention + value.slice(cursor)
        cursor = start + mention.length
        dismissed = true
        oninput()
        await tick(); input?.focus(); input?.setSelectionRange(cursor, cursor)
    }
    function keydown(event: KeyboardEvent) {
        if (!suggestions.length) return
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + suggestions.length) % suggestions.length }
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); choose(suggestions[selected]) }
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dismissed = true }
    }
</script>
<div class="ew-mention-input">
    <textarea bind:this={input} bind:value {placeholder} {maxlength} {rows} aria-label={label} aria-controls={suggestions.length ? listId : undefined}
        oninput={update} onclick={() => cursor = input?.selectionStart ?? 0} onkeydown={keydown} onfocus={() => focused = true} onblur={() => focused = false}></textarea>
    {#if suggestions.length}
        <div class="ew-suggestions" id={listId} role="group" aria-label="Mention suggestions">
            {#each suggestions as target, index (target.id)}<button type="button" class:ew-highlight={selected === index} onmousedown={event => event.preventDefault()} onclick={() => choose(target)}><strong>{target.name}</strong><span>@{target.handle}</span></button>{/each}
        </div>
    {/if}
</div>
