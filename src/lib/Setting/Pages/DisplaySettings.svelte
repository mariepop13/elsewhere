<script lang="ts">
    import { language } from "src/lang";
    import { DBState } from "src/ts/stores.svelte";
    import SettingRenderer from "../SettingRenderer.svelte";
    import {
        displayOtherSettingsItems,
        displaySizeSettingsItems,
        displayThemeSettingsItems,
    } from "src/ts/setting/displaySettingsData.svelte";

    let submenu = $state(DBState.db.useLegacyGUI ? -1 : 0);
</script>

<h2 class="mb-2 text-2xl font-bold mt-2">{language.display}</h2>

{#if submenu !== -1}
    <div class="settings-tabs flex w-full rounded-md border border-darkborderc mb-4 overflow-x-auto h-16 min-h-16 overflow-y-clip">
        <button
            onclick={() => {
                submenu = 0;
            }}
            class="settings-tab p-2 flex-1 border-r border-darkborderc"
            class:settings-tab-active={submenu === 0}
            aria-pressed={submenu === 0}
        >
            <span>{language.theme}</span>
        </button>
        <button
            onclick={() => {
                submenu = 1;
            }}
            class="settings-tab p-2 flex-1 border-r border-darkborderc"
            class:settings-tab-active={submenu === 1}
            aria-pressed={submenu === 1}
        >
            <span>{language.sizeAndSpeed}</span>
        </button>
        <button
            onclick={() => {
                submenu = 2;
            }}
            class="settings-tab p-2 flex-1 border-r border-darkborderc"
            class:settings-tab-active={submenu === 2}
            aria-pressed={submenu === 2}
        >
            <span>{language.others}</span>
        </button>
    </div>
{/if}

{#if submenu === 0 || submenu === -1}
    <SettingRenderer items={displayThemeSettingsItems} />
{/if}

{#if submenu === 1 || submenu === -1}
    <SettingRenderer items={displaySizeSettingsItems} />
{/if}

{#if submenu === 2 || submenu === -1}
    <SettingRenderer items={displayOtherSettingsItems} />
{/if}

<style>
    .settings-tab {
        color: var(--risu-theme-textcolor2);
        border-bottom: 3px solid transparent;
        transition: background-color var(--risu-animation-speed), color var(--risu-animation-speed), border-color var(--risu-animation-speed);
    }

    .settings-tab:hover {
        background-color: var(--risu-theme-surface-subtle);
        color: var(--risu-theme-textcolor);
    }

    .settings-tab-active {
        background-color: var(--risu-theme-surface-subtle);
        border-bottom-color: var(--risu-theme-focus);
        color: var(--risu-theme-textcolor);
    }
</style>
