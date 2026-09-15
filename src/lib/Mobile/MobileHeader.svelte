<script lang="ts">
    import { ArrowLeft, MenuIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { MobileGUIStack, MobileSearch, selectedCharID, SettingsMenuIndex, MobileSideBar } from "src/ts/stores.svelte";

    let settingsPageTitle = $derived.by(() => {
        switch ($SettingsMenuIndex) {
            case 0: return `${language.account} & ${language.files}`;
            case 1:
            case 13: return language.chatBot;
            case 2: return language.otherBots;
            case 3: return language.display;
            case 4: return language.plugin;
            case 6: return language.advancedSettings;
            case 10: return language.language;
            case 11: return language.accessibility;
            case 12: return language.persona;
            case 14: return language.modules;
            case 15: return language.hotkey;
            case 77: return language.supporterThanks;
            default: return language.settings;
        }
    });
</script>
<div class="mobile-header w-full px-4 h-16 border-b border-b-darkborderc bg-darkbg flex justify-start items-center gap-2">
    {#if $selectedCharID !== -1 && $MobileSideBar > 0}
        <button class="mobile-header-action" aria-label={language.goback} onclick={() => {
            MobileSideBar.set(0)
        }}>
            <ArrowLeft />
        </button>
        <div class="mobile-header-context min-w-0">
            <span class="mobile-header-kicker">{language.Chat}</span>
            <span class="mobile-header-title font-bold text-lg truncate">{language.menu}</span>
        </div>
    {:else if $selectedCharID !== -1}
        <button class="mobile-header-action" aria-label={language.goback} onclick={() => {
            selectedCharID.set(-1)
        }}>
            <ArrowLeft />
        </button>
        <div class="mobile-header-context min-w-0">
            <span class="mobile-header-kicker">{language.Chat}</span>
            <span class="mobile-header-title font-bold text-lg truncate">{DBState.db.characters[$selectedCharID].name}</span>
        </div>
        <div class="flex-1 flex justify-end">
            <button class="mobile-header-action" aria-label={language.menu} onclick={() => {
                MobileSideBar.set(1)
            }}>
                <MenuIcon />
            </button>
        </div>
    {:else if $MobileGUIStack === 2 && $SettingsMenuIndex > -1}
        <button class="mobile-header-action" aria-label={language.goback} onclick={() => {
            SettingsMenuIndex.set(-1)
        }}>
            <ArrowLeft />
        </button>
        <div class="mobile-header-context min-w-0">
            <span class="mobile-header-kicker">{language.settings}</span>
            <span class="mobile-header-title font-bold text-lg truncate">{settingsPageTitle}</span>
        </div>
    {:else if $MobileGUIStack === 1}
        <div class="flex min-w-0 flex-1 items-stretch">
            <input placeholder={language.search + '...'} bind:value={$MobileSearch} class="mobile-search peer transition-colors outline-hidden text-textcolor p-2 min-w-0 border bg-surface-subtle rounded-md input-text text-xl grow mx-1 border-darkborderc resize-none overflow-y-hidden overflow-x-hidden max-w-full">
        </div>
    {:else if $MobileGUIStack === 2}
        <div class="mobile-header-context min-w-0">
            <span class="mobile-header-kicker">Risuai</span>
            <span class="mobile-header-title font-bold text-lg truncate">{language.settings}</span>
        </div>
    {:else}
        <div class="mobile-header-context min-w-0">
            <span class="mobile-header-kicker">Risuai</span>
            <span class="mobile-header-title font-bold text-lg truncate">Risuai</span>
        </div>

    {/if}
</div>

<style>
    .mobile-header {
        min-width: 0;
        background-color: var(--risu-theme-surface-elevated);
        box-shadow: 0 1px 0 var(--risu-theme-darkborderc);
    }

    .mobile-header-context {
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        justify-content: center;
        line-height: 1.15;
    }

    .mobile-header-kicker {
        color: var(--risu-theme-focus);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.625rem;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    .mobile-header-action {
        display: inline-flex;
        min-width: 2.75rem;
        min-height: 2.75rem;
        align-items: center;
        justify-content: center;
        border-radius: 0.375rem;
        color: var(--risu-theme-textcolor2);
    }

    .mobile-header-action:hover {
        background-color: var(--risu-theme-surface-subtle);
        color: var(--risu-theme-textcolor);
    }

    .mobile-header-title {
        display: block;
        color: var(--risu-theme-textcolor);
    }

    .mobile-search:focus {
        border-color: var(--risu-theme-focus);
    }
</style>