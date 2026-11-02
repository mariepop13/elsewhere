<script lang="ts">
    import { onMount, type Snippet } from 'svelte'
    import { ArrowLeft, BookOpen, ChevronDown, ChevronRight, Globe, LockKeyhole, MessageCircle, Moon, Settings, Sparkles, Sun, Users } from '@lucide/svelte'
    import type { SocialAuthor } from 'src/ts/social/socialFeed'
    import type { WorldPage, WorldConversationHeading } from 'src/ts/social/worldNavigation.svelte'
    import SocialAvatar from './SocialAvatar.svelte'
    import SocialBrand from './SocialBrand.svelte'
    import './worldShell.css'

    type Appearance = 'Dark' | 'Light' | 'System'
    interface Props {
        page: WorldPage
        worldName: string
        you: SocialAuthor
        appearance: Appearance
        compact?: boolean
        unreadConversations?: number
        activeConversation?: WorldConversationHeading
        children: Snippet
        onNavigate: (page: WorldPage) => void
        onSetup: () => void
        onExit: () => void
        onTheme: (appearance: Appearance) => void
        onProfile: () => void
    }

    let { page, worldName, you, appearance, compact = false, unreadConversations = 0, activeConversation, children,
        onNavigate, onSetup, onExit, onTheme, onProfile }: Props = $props()
    let systemLight = $state(false)
    let light = $derived(appearance === 'Light' || (appearance === 'System' && systemLight))
    let privateConversation = $derived(page === 'Messages' && !!activeConversation)
    const navigation = [
        { page: 'Feed', label: 'World', icon: Globe },
        { page: 'Messages', label: 'Messages', icon: MessageCircle },
        { page: 'Relationships', label: 'Relationships', icon: Users },
        { page: 'Library', label: 'Library', icon: BookOpen },
        { page: 'Settings', label: 'Settings', icon: Settings },
    ] as const
    let pageLabel = $derived(navigation.find(item => item.page === page)?.label ?? 'World')

    onMount(() => {
        const query = window.matchMedia('(prefers-color-scheme: light)')
        const update = () => systemLight = query.matches
        update()
        query.addEventListener('change', update)
        return () => query.removeEventListener('change', update)
    })
</script>

<section class="world-shell" class:world-shell-light={light} class:world-shell-compact={compact} aria-label="Elsewhere world">
    <header class="world-shell-header">
        <div class="world-shell-brand"><SocialBrand /></div>
        <nav class="world-shell-breadcrumbs" aria-label="Breadcrumb">
            <button onclick={() => onNavigate('Feed')}>{worldName || 'Your world'}</button>
            <ChevronRight size={13} aria-hidden="true" />
            {#if privateConversation}
                <button onclick={() => onNavigate('Messages')}>Messages</button>
                <ChevronRight size={13} aria-hidden="true" />
                <span aria-current="page">{activeConversation?.name}</span>
            {:else}
                <span aria-current="page">{pageLabel}</span>
            {/if}
            <button class="world-shell-mobile-action world-shell-mobile-setup" onclick={onSetup} aria-label="Edit world setup"><ChevronDown size={16} /></button>
            <button class="world-shell-mobile-action" onclick={onProfile} aria-label={`View profile for ${you.name}`}><Users size={16} /></button>
        </nav>
        <div class="world-shell-header-actions">
            {#if privateConversation}
                <span class="world-shell-private"><LockKeyhole size={13} aria-hidden="true" />Private conversation</span>
            {/if}
            <button class="world-shell-icon" aria-label={light ? 'Switch to dark appearance' : 'Switch to light appearance'} onclick={() => onTheme(light ? 'Dark' : 'Light')}>
                {#if light}<Moon size={18} />{:else}<Sun size={18} />{/if}
            </button>
            <button class="world-shell-icon" aria-label="Return to classic Elsewhere" title="Return to classic Elsewhere" onclick={onExit}><ArrowLeft size={18} /></button>
        </div>
    </header>
    <div class="world-shell-body">
        <aside class="world-shell-sidebar" aria-label="Your world">
            <button class="world-shell-world-picker" onclick={onSetup} aria-label="Edit world setup"><span class="world-shell-dot" aria-hidden="true"></span><span>{worldName || 'Your world'}</span><ChevronDown size={15} /></button>
            <button class="world-shell-setup" onclick={onSetup}>Edit world setup</button>
            <nav class="world-shell-navigation" aria-label="World navigation">
                {#each navigation as item}
                    <button aria-current={page === item.page ? 'page' : undefined} onclick={() => onNavigate(item.page)}><item.icon size={20} aria-hidden="true" /><span>{item.label}</span>{#if item.page === 'Messages' && unreadConversations}<span class="world-unread" aria-label={`${unreadConversations} unread conversations`}>{unreadConversations}</span>{/if}</button>
                {/each}
            </nav>
            <div class="world-shell-note"><Sparkles size={22} aria-hidden="true" /><p>Another life.<br />Little moments that<br />feel real.</p><small>Your story unfolds here.</small></div>
            <button class="world-shell-person" onclick={onProfile} aria-label={`View profile for ${you.name}`}><SocialAvatar name={you.name} image={you.image} size={40} /><span><strong>{you.name}</strong><small>Your place in the world</small></span></button>
        </aside>
        <div class="world-shell-content">
            {@render children()}
        </div>
    </div>
    <nav class="world-shell-bottomnav" aria-label="Mobile world navigation">
        {#each navigation as item}
            <button aria-current={page === item.page ? 'page' : undefined} onclick={() => onNavigate(item.page)}><item.icon size={20} aria-hidden="true" /><span>{item.label}</span>{#if item.page === 'Messages' && unreadConversations}<span class="world-unread" aria-label={`${unreadConversations} unread conversations`}>{unreadConversations}</span>{/if}</button>
        {/each}
    </nav>
</section>
