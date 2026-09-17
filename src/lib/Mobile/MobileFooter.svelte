<script lang="ts">

  import { SettingsIcon, GlobeIcon, HouseIcon, Volume2Icon, Braces, ActivityIcon, BookIcon, SmileIcon, UserIcon } from "@lucide/svelte";
  import { language } from "src/lang";
  import { CharConfigSubMenu, MobileGUIStack, MobileSideBar, selectedCharID } from "src/ts/stores.svelte";

</script>
{#if $selectedCharID === -1}

    <div class="mobile-footer-nav w-full gap-1 px-2 py-2 text-lg border-t border-t-darkborderc bg-darkbg flex items-center justify-center text-textcolor2">
        <button class="mobile-footer-item flex-1 min-w-0 max-w-20 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$MobileGUIStack === 0} aria-current={$MobileGUIStack === 0 ? 'page' : undefined} onclick={() => {
            MobileGUIStack.set(0)
        }}>
            <GlobeIcon size={24} />
            <span class="text-xs">RisuRealm</span>
        </button>
        <button class="mobile-footer-item flex-1 min-w-0 max-w-20 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$MobileGUIStack === 1} aria-current={$MobileGUIStack === 1 ? 'page' : undefined} onclick={() => {
            MobileGUIStack.set(1)
        }}>
            <HouseIcon size={24} />
            <span class="text-xs">{language.character}</span>
        </button>
        <button class="mobile-footer-item flex-1 min-w-0 max-w-20 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$MobileGUIStack === 2} aria-current={$MobileGUIStack === 2 ? 'page' : undefined} onclick={() => {
            MobileGUIStack.set(2)
        }}>
            <SettingsIcon size={24} />
            <span class="text-xs">{language.settings}</span>
        </button>
    </div>

{/if}

{#if $selectedCharID !== -1 && $MobileSideBar === 2}
    <div class="mobile-footer-nav w-full gap-1 px-2 py-2 text-lg border-t border-t-darkborderc bg-darkbg flex items-center justify-center text-textcolor2 truncate">
        <button class="mobile-footer-item flex-1 min-w-0 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$CharConfigSubMenu === 0} aria-current={$CharConfigSubMenu === 0 ? 'page' : undefined} onclick={() => {
            CharConfigSubMenu.set(0)
        }}>
            <UserIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.basicInfo}</span>
        </button>
        <button class="mobile-footer-item flex-1 min-w-0 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$CharConfigSubMenu === 1} aria-current={$CharConfigSubMenu === 1 ? 'page' : undefined} onclick={() => {
            CharConfigSubMenu.set(1)
        }}>
            <SmileIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.characterDisplay}</span>
        </button>
        <button class="mobile-footer-item flex-1 min-w-0 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$CharConfigSubMenu === 3} aria-current={$CharConfigSubMenu === 3 ? 'page' : undefined} onclick={() => {
            CharConfigSubMenu.set(3)
        }}>
            <BookIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.loreBook}</span>
        </button>
        <button class="mobile-footer-item flex-1 min-w-0 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$CharConfigSubMenu === 5} aria-current={$CharConfigSubMenu === 5 ? 'page' : undefined} onclick={() => {
            CharConfigSubMenu.set(5)
        }}>
            <Volume2Icon size={24} />
            <span class="text-xs truncate max-w-16">TTS</span>
        </button>
        <button class="mobile-footer-item flex-1 min-w-0 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$CharConfigSubMenu === 4} aria-current={$CharConfigSubMenu === 4 ? 'page' : undefined} onclick={() => {
            CharConfigSubMenu.set(4)
        }}>
            <Braces size={24} />
            <span class="text-xs truncate max-w-16">{language.scripts}</span>
        </button>
        <button class="mobile-footer-item flex-1 min-w-0 justify-center items-center flex-col gap-1" class:mobile-footer-item-active={$CharConfigSubMenu === 2} aria-current={$CharConfigSubMenu === 2 ? 'page' : undefined} onclick={() => {
            CharConfigSubMenu.set(2)
        }}>
            <ActivityIcon size={24} />
            <span class="text-xs truncate max-w-16">{language.advanced}</span>
        </button>
    </div>
{/if}

<style>
    .mobile-footer-nav {
        flex: none;
        min-width: 0;
        padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
        background-color: var(--risu-theme-surface-elevated);
        box-shadow: 0 -1px 0 var(--risu-theme-darkborderc);
    }

    .mobile-footer-item {
        display: flex;
        min-width: 0;
        min-height: 2.75rem;
        padding: 0.25rem;
        border-top: 3px solid transparent;
        border-radius: 0.375rem;
        color: var(--risu-theme-textcolor2);
        line-height: 1;
    }

    .mobile-footer-item span {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .mobile-footer-item:hover {
        background-color: var(--risu-theme-surface-subtle);
        color: var(--risu-theme-textcolor);
    }

    .mobile-footer-item-active {
        border-top-color: var(--risu-theme-focus);
        color: var(--risu-theme-textcolor);
    }

    @media (max-width: 360px) {
        .mobile-footer-item :global(svg) {
            width: 1.125rem;
            height: 1.125rem;
        }

        .mobile-footer-item span {
            font-size: 0.625rem;
        }
    }
</style>