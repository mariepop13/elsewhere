<script lang="ts">
    import { AccessibilityIcon, ActivityIcon, PackageIcon, BotIcon, BoxIcon, CodeIcon, ContactIcon, LanguagesIcon, MonitorIcon, Sailboat, UserIcon, CircleXIcon, KeyboardIcon, SparkleIcon } from "@lucide/svelte";
    import { language } from "src/lang";
    import DisplaySettings from "./Pages/DisplaySettings.svelte";
    import UserSettings from "./Pages/UserSettings.svelte";
    import BotSettings from "./Pages/BotSettings.svelte";
    import OtherBotSettings from "./Pages/OtherBotSettings.svelte";
    import PluginSettings from "./Pages/PluginSettings.svelte";
    import FilesSettings from "./Pages/FilesSettings.svelte";
    import AdvancedSettings from "./Pages/AdvancedSettings.svelte";
    import { additionalSettingsMenu, easyPanelStore, MobileGUI, SettingsMenuIndex, settingsOpen } from "src/ts/stores.svelte";
    import { DBState } from "src/ts/stores.svelte";
    import Communities from "./Pages/Communities.svelte";
    import GlobalLoreBookSettings from "./Pages/GlobalLoreBookSettings.svelte";
    import Lorepreset from "./lorepreset.svelte";
    import GlobalRegex from "./Pages/GlobalRegex.svelte";
    import LanguageSettings from "./Pages/LanguageSettings.svelte";
    import AccessibilitySettings from "./Pages/AccessibilitySettings.svelte";
    import PersonaSettings from "./Pages/PersonaSettings.svelte";
    import PromptSettings from "./Pages/PromptSettings.svelte";
    import ThanksPage from "./Pages/ThanksPage.svelte";
    import ModuleSettings from "./Pages/Module/ModuleSettings.svelte";
  import { isLite } from "src/ts/lite";
    import HotkeySettings from "./Pages/HotkeySettings.svelte";
    import PluginDefinedIcon from "../Others/PluginDefinedIcon.svelte";

    let openLoreList = $state(false)
    let currentSettingsLabel = $derived.by(() => {
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
            case 16: return language.easyPanel;
            case 77: return language.supporterThanks;
            default: return language.settings;
        }
    });

    if(window.innerWidth >= 900 && $SettingsMenuIndex === -1 && !$MobileGUI){
        $SettingsMenuIndex = 1
    }

</script>
<div class="h-full w-full flex justify-center rs-setting-cont settings-shell" class:bg-bgcolor={$MobileGUI} class:setting-bg={!$MobileGUI}>
    <div class="h-full max-w-(--breakpoint-lg) w-full flex relative rs-setting-cont-2 settings-layout">
        {#if (window.innerWidth >= 700 && !$MobileGUI) || $SettingsMenuIndex === -1}
            <div class="settings-nav flex h-full flex-col p-4 pt-8 gap-2 overflow-y-auto relative rs-setting-cont-3 shrink-0"
                class:w-full={window.innerWidth < 700 || $MobileGUI}
                class:bg-darkbg={!$MobileGUI} class:bg-bgcolor={$MobileGUI}
            >
                <div class="settings-index-heading">
                    <span class="settings-index-wordmark">Risuai<span aria-hidden="true">//</span></span>
                    <span class="settings-index-caption">{language.settings}</span>
                </div>
                <nav class="settings-index-list" aria-label={language.settings}>
                {#if !$isLite}
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 1 || $SettingsMenuIndex === 13}
                        aria-current={$SettingsMenuIndex === 1 || $SettingsMenuIndex === 13 ? 'page' : undefined}
                        onclick={() => {
                            $SettingsMenuIndex = 1

                    }}>
                        <BotIcon />
                        <span>{language.chatBot}</span>
                    </button>
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 12}
                        aria-current={$SettingsMenuIndex === 12 ? 'page' : undefined}
                        onclick={() => {
                            $SettingsMenuIndex = 12
                    }}>
                        <ContactIcon />
                        <span>{language.persona}</span>
                    </button>
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 2}
                        aria-current={$SettingsMenuIndex === 2 ? 'page' : undefined}
                        onclick={() => {
                            $SettingsMenuIndex = 2
                    }}>
                        <Sailboat />
                        <span>{language.otherBots}</span>
                    </button>
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 3}
                        aria-current={$SettingsMenuIndex === 3 ? 'page' : undefined}
                        onclick={() => {
                            $SettingsMenuIndex = 3
                    }}>
                        <MonitorIcon />
                        <span>{language.display}</span>
                    </button>
                {/if}
                <button class="settings-nav-item flex gap-2 items-center"
                    class:settings-nav-item-active={$SettingsMenuIndex === 10}
                    aria-current={$SettingsMenuIndex === 10 ? 'page' : undefined}
                    onclick={() => {
                        $SettingsMenuIndex = 10
                }}>
                    <LanguagesIcon />
                    <span>{language.language}</span>
                </button>
                {#if !$isLite}
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 11}
                        aria-current={$SettingsMenuIndex === 11 ? 'page' : undefined}
                        onclick={() => {
                            $SettingsMenuIndex = 11
                    }}>
                        <AccessibilityIcon />
                        <span>{language.accessibility}</span>
                    </button>
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 14}
                        aria-current={$SettingsMenuIndex === 14 ? 'page' : undefined}
                        onclick={() => {
                            $SettingsMenuIndex = 14
                    }}>
                        <PackageIcon />
                        <span>{language.modules}</span>
                    </button>
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 4}
                        aria-current={$SettingsMenuIndex === 4 ? 'page' : undefined}
                        onclick={() => {
                        $SettingsMenuIndex = 4
                    }}>
                        <CodeIcon />
                        <span>{language.plugin}</span>
                    </button>
                {/if}
                <button class="settings-nav-item flex gap-2 items-center"
                    class:settings-nav-item-active={$SettingsMenuIndex === 0}
                    aria-current={$SettingsMenuIndex === 0 ? 'page' : undefined}
                    onclick={() => {
                        $SettingsMenuIndex = 0
                }}>
                    <UserIcon />
                    <span>{language.account} & {language.files}</span>
                </button>
                <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 15}
                        aria-current={$SettingsMenuIndex === 15 ? 'page' : undefined}
                        onclick={() => {
                        $SettingsMenuIndex = 15
                    }}>
                        <KeyboardIcon />
                        <span>{language.hotkey}</span>
                    </button>
                {#if !$isLite}
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 6}
                        aria-current={$SettingsMenuIndex === 6 ? 'page' : undefined}
                        onclick={() => {
                        $SettingsMenuIndex = 6
                    }}>
                        <ActivityIcon />
                        <span>{language.advancedSettings}</span>
                    </button>
                    <button class="settings-nav-item flex gap-2 items-center"
                        class:settings-nav-item-active={$SettingsMenuIndex === 77}
                        aria-current={$SettingsMenuIndex === 77 ? 'page' : undefined}
                        onclick={() => {
                        $SettingsMenuIndex = 77
                    }}>
                        <BoxIcon />
                        <span>{language.supporterThanks}</span>
                    </button>
                    {#each additionalSettingsMenu as menu}
                        <button class="settings-nav-item flex gap-2 items-center"
                            onclick={() => {
                                menu.callback()
                        }}>
                            <PluginDefinedIcon ico={menu} />
                            <span>{menu.name}</span>
                        </button>
                    {/each}

                    {#if DBState.db.enableRisuaiProTools}
                        <button class="settings-nav-item flex gap-2 items-center"
                            class:settings-nav-item-active={$SettingsMenuIndex === 16}
                            aria-current={$SettingsMenuIndex === 16 ? 'page' : undefined}
                            onclick={() => {
                            easyPanelStore.open = true
                        }}>
                            <!-- From Lucide Icons, licensed under MIT/ISC License, modified to fit the design. see license from bundled lucide icons. -->
                            <svg width={24} height={24}>
                                <defs>
                                    <linearGradient id={`grad1`} x1='0' y1='0' x2='1' y2='0'>
                                    <stop offset='0%' style="stop-color:var(--risu-theme-action-primary)"/>
                                    <stop offset='100%' style="stop-color:var(--risu-theme-focus)"/>
                                    </linearGradient>
                                </defs>
                                    <SparkleIcon color="url(#grad1)" />
                            </svg>
                            <span>{language.easyPanel}</span>
                        </button>
                    {/if}
                {/if}
                </nav>
                {#if window.innerWidth < 700 && !$MobileGUI}
                    <button class="settings-close absolute top-2 right-2 text-textcolor" onclick={() => {
                        settingsOpen.set(false)
                    }}> <CircleXIcon size={DBState.db.settingsCloseButtonSize} /> </button>
                {/if}
            </div>
        {/if}
        {#if (window.innerWidth >= 700 && !$MobileGUI) || $SettingsMenuIndex !== -1}
            {#key $SettingsMenuIndex}
                <div class="settings-content grow py-6 px-4 bg-bgcolor flex flex-col text-textcolor overflow-y-auto relative rs-setting-cont-4 min-w-0">
                    <header class="settings-workspace-header">
                        <h1>{currentSettingsLabel}</h1>
                    </header>
                    <div class="settings-workspace-body">
                    {#if $SettingsMenuIndex === 0}
                        <UserSettings />
                    {:else if $SettingsMenuIndex === 1}
                        <BotSettings goPromptTemplate={() => {
                            $SettingsMenuIndex = 13
                        }} />
                    {:else if $SettingsMenuIndex === 2}
                        <OtherBotSettings />
                    {:else if $SettingsMenuIndex === 3}
                        <DisplaySettings />
                    {:else if $SettingsMenuIndex === 4}
                        <PluginSettings />
                    {:else if $SettingsMenuIndex === 5}
                        <FilesSettings />
                    {:else if $SettingsMenuIndex === 6}
                        <AdvancedSettings />
                    {:else if $SettingsMenuIndex === 7}
                        <Communities />
                    {:else if $SettingsMenuIndex === 8}
                        <GlobalLoreBookSettings bind:openLoreList />
                    {:else if $SettingsMenuIndex === 9}
                        <GlobalRegex/>
                    {:else if $SettingsMenuIndex === 10}
                        <LanguageSettings/>
                    {:else if $SettingsMenuIndex === 11}
                        <AccessibilitySettings/>
                    {:else if $SettingsMenuIndex === 12}
                        <PersonaSettings/>
                    {:else if $SettingsMenuIndex === 14}
                        <ModuleSettings/>
                    {:else if $SettingsMenuIndex === 13}
                        <PromptSettings onGoBack={() => {
                            $SettingsMenuIndex = 1
                        }}/>
                    {:else if $SettingsMenuIndex === 15 && window.innerWidth >= 768}
                        <HotkeySettings/>
                    {:else if $SettingsMenuIndex === 77}
                        <ThanksPage/>
                    {/if}
                    </div>
            </div>
            {/key}
            {#if !$MobileGUI}
                <button class="settings-close absolute top-2 right-2 text-textcolor" onclick={() => {
                    if(window.innerWidth >= 700){
                        settingsOpen.set(false)
                    }
                    else{
                        $SettingsMenuIndex = -1
                    }
                }}>
                    <CircleXIcon size={DBState.db.settingsCloseButtonSize} />
                </button>
            {/if}
        {/if}
    </div>
</div>
{#if openLoreList}
    <Lorepreset close={() => {openLoreList = false}} />
{/if}
<style>
    .setting-bg {
        background: linear-gradient(
            to right,
            var(--risu-theme-surface-elevated) 50%,
            var(--risu-theme-canvas) 50%
        );
    }

    .settings-layout {
        border-inline: 1px solid var(--risu-theme-darkborderc);
        background-color: var(--risu-theme-canvas);
    }

    .settings-nav {
        min-width: 0;
        width: 16.5rem;
        background-color: var(--risu-theme-surface-elevated);
        border-right: 1px solid var(--risu-theme-darkborderc);
    }

    .settings-index-heading {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding: 0 0.75rem 1.5rem;
        border-bottom: 1px solid var(--risu-theme-darkborderc);
    }

    .settings-index-wordmark {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 0.08em;
    }

    .settings-index-wordmark {
        color: var(--risu-theme-textcolor);
    }

    .settings-index-wordmark span {
        color: var(--risu-theme-focus);
    }

    .settings-index-caption {
        color: var(--risu-theme-textcolor2);
        font-size: 0.8rem;
    }

    .settings-index-list {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding-top: 1.25rem;
    }

    .settings-nav-item {
        min-width: 0;
        min-height: 2.75rem;
        width: 100%;
        padding: 0.625rem 0.75rem;
        border-left: 3px solid transparent;
        border-radius: 0.375rem;
        color: var(--risu-theme-textcolor2);
        text-align: left;
        transition: background-color var(--risu-animation-speed), color var(--risu-animation-speed), border-color var(--risu-animation-speed);
    }

    .settings-nav-item :global(span) {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .settings-nav-item:hover {
        background-color: var(--risu-theme-surface-subtle);
        color: var(--risu-theme-textcolor);
    }

    .settings-nav-item-active {
        border-left-color: var(--risu-theme-focus);
        background-color: var(--risu-theme-surface-subtle);
        color: var(--risu-theme-textcolor);
    }

    .settings-content {
        background-color: var(--risu-theme-canvas);
    }

    .settings-workspace-header,
    .settings-workspace-body {
        width: min(100%, 52rem);
        margin-inline: auto;
    }

    .settings-workspace-header {
        padding: 0.5rem 0 1.75rem;
        border-bottom: 1px solid var(--risu-theme-darkborderc);
    }

    .settings-workspace-header h1 {
        margin: 0;
        color: var(--risu-theme-textcolor);
        font-size: clamp(1.75rem, 3vw, 2.25rem);
        font-weight: 500;
        letter-spacing: -0.035em;
        line-height: 1.1;
    }

    .settings-workspace-body {
        min-width: 0;
        padding: 1.75rem 0 3rem;
    }

    .settings-close:hover {
        color: var(--risu-theme-focus);
    }

    @media (max-width: 699px) {
        .settings-layout {
            border-inline: 0;
        }

        .settings-nav {
            width: 100%;
            border-right: 0;
        }

        .settings-index-heading {
            padding-top: 0.5rem;
        }

        .settings-content {
            padding-inline: 1rem;
        }

        .settings-workspace-header {
            padding-top: 0;
        }
    }
</style>