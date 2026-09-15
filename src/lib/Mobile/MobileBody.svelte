<script lang="ts">
    import { MobileGUIStack, MobileSideBar, selectedCharID } from "src/ts/stores.svelte";
    import Settings from "../Setting/Settings.svelte";
    import RealmMain from "../UI/Realm/RealmMain.svelte";
    import MobileCharacters from "./MobileCharacters.svelte";
    import ChatScreen from "../ChatScreens/ChatScreen.svelte";
    import CharConfig from "../SideBars/CharConfig.svelte";
    import { WrenchIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import SideChatList from "../SideBars/SideChatList.svelte";
    import DevTool from "../SideBars/DevTool.svelte";
    import { isLite } from "src/ts/lite";
    
    import { DBState } from 'src/ts/stores.svelte';
</script>

{#if $MobileSideBar > 0 && !$isLite}
<div class="mobile-sidebar-tabs w-full shrink-0 px-2 py-1 text-textcolor2 border-b border-b-darkborderc bg-darkbg flex justify-start items-center gap-2">
    <button class="mobile-sidebar-tab flex-1 border-r border-r-darkborderc" class:mobile-sidebar-tab-active={$MobileSideBar === 1} aria-current={$MobileSideBar === 1 ? 'page' : undefined} onclick={() => {
        $MobileSideBar = 1
    }}>
        {language.Chat}
    </button>
    <button class="mobile-sidebar-tab flex-1 border-r border-r-darkborderc" class:mobile-sidebar-tab-active={$MobileSideBar === 2} aria-current={$MobileSideBar === 2 ? 'page' : undefined} onclick={() => {
        $MobileSideBar = 2
    }}>
        {language.character}
    </button>
    <button class="mobile-sidebar-tab" class:mobile-sidebar-tab-active={$MobileSideBar === 3} aria-current={$MobileSideBar === 3 ? 'page' : undefined} aria-label={language.advanced} onclick={() => {
        $MobileSideBar = 3
    }}>
        <WrenchIcon size={18} />
    </button>
</div>
{/if}
<div class="mobile-body w-full min-w-0 min-h-0 flex-1 overflow-y-auto bg-bgcolor relative">
    {#if $MobileSideBar > 0}
        <div class="mobile-sidebar-stage w-full min-w-0 flex flex-col p-3 h-full">
            {#if $MobileSideBar === 1}
                <SideChatList bind:chara={DBState.db.characters[$selectedCharID]} />
            {:else if $MobileSideBar === 2}
                <CharConfig />
            {:else if $MobileSideBar === 3}
                <DevTool />
            {/if}
        </div>
    {:else if $selectedCharID !== -1}
        <ChatScreen />
    {:else if $MobileGUIStack === 0}
        <RealmMain />
    {:else if $MobileGUIStack === 1}
        <MobileCharacters />
    {:else if $MobileGUIStack === 2}
        <Settings />
    {/if}
</div>

<style>
    .mobile-body {
        background-color: var(--risu-theme-canvas);
        overscroll-behavior: contain;
    }

    .mobile-sidebar-stage {
        min-height: 100%;
    }

    .mobile-sidebar-tabs {
        background-color: var(--risu-theme-surface-elevated);
        box-shadow: 0 1px 0 var(--risu-theme-darkborderc);
    }

    .mobile-sidebar-tab {
        min-height: 2.75rem;
        min-width: 0;
        padding-inline: 0.75rem;
        border-bottom: 3px solid transparent;
        color: var(--risu-theme-textcolor2);
    }

    .mobile-sidebar-tab:hover {
        background-color: var(--risu-theme-surface-subtle);
        color: var(--risu-theme-textcolor);
    }

    .mobile-sidebar-tab-active {
        border-bottom-color: var(--risu-theme-focus);
        color: var(--risu-theme-textcolor);
    }
</style>