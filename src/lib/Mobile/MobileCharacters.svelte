<script lang="ts">
    import { type character, type groupChat } from "src/ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import BarIcon from "../SideBars/BarIcon.svelte";
    import { addCharacter, changeChar, getCharImage } from "src/ts/characters";
    import { MobileSearch } from "src/ts/stores.svelte";
    import { MessageSquareIcon, PlusIcon } from "@lucide/svelte";
    import { language } from "src/lang";

    interface Props {
        endGrid?: () => void;
        search?: string;
        hideTrash?: boolean;
    }

    const agoFormatter = new Intl.RelativeTimeFormat(navigator.languages, { style: 'short' });

    let {endGrid = () => {}, search, hideTrash = false}: Props = $props();
    let normalizedSearch = $derived(normalizeSearch(search ?? $MobileSearch));

    function normalizeSearch(value:string){
        return value.replace(/ /g,"").toLocaleLowerCase();
    }

    function makeAgoText(time:number){
        if(time === 0){
            return "Unknown";
        }
        const diff = Date.now() - time;
        if(diff < 3600000){
            const min = Math.floor(diff / 60000);
            return agoFormatter.format(-min, 'minute');
        }
        if(diff < 86400000){
            const hour = Math.floor(diff / 3600000);
            return agoFormatter.format(-hour, 'hour');
        }
        if(diff < 604800000){
            const day = Math.floor(diff / 86400000);
            return agoFormatter.format(-day, 'day');
        }
        if(diff < 2592000000){
            const week = Math.floor(diff / 604800000);
            return agoFormatter.format(-week, 'week');
        }
        if(diff < 31536000000){
            const month = Math.floor(diff / 2592000000);
            return agoFormatter.format(-month, 'month');
        }
        const year = Math.floor(diff / 31536000000);
        return agoFormatter.format(-year, 'year');
    }

    function sortChar(char: (character|groupChat)[]) {
        return char.map((c, i) => ({ c, i })).filter(({ c }) => {
            return !hideTrash || !c.trashTime;
        }).map(({ c, i }) => {
            return {
                name: c.name || "Unnamed",
                image: c.image,
                chats: c.chats.length,
                i: i,
                interaction: c.lastInteraction || 0,
                agoText: makeAgoText(c.lastInteraction || 0),
            }
        }).sort((a, b) => {
            if (a.interaction === b.interaction) {
                return a.name.localeCompare(b.name);
            }
            return b.interaction - a.interaction;
        });
    }
</script>
<div class="mobile-character-list flex flex-col items-center w-full min-w-0 overflow-y-auto h-full">
    {#each sortChar(DBState.db.characters) as char, i}
        {#if normalizeSearch(char.name).includes(normalizedSearch)}
            <button class="mobile-character-card flex p-2 border-t-darkborderc gap-2 w-full" class:border-t={i !== 0} onclick={() => {
                changeChar(char.i)
                endGrid()
            }}>
                <BarIcon additionalStyle={getCharImage(char.image, 'css')}></BarIcon>
                <div class="flex flex-1 w-full flex-col justify-start items-start text-start">
                    <span>{char.name}</span>
                    <div class="text-sm text-textcolor2 flex items-center w-full flex-wrap">
                        <span class="mr-1">{char.chats}</span>
                        <MessageSquareIcon size={14} />
                        <span class="mr-1 ml-1">|</span>
                        <span>{char.agoText}</span>
                    </div>
                </div>
            </button>
        {/if}
    {/each}
</div>

<button class="mobile-add-character p-4 rounded-full absolute bottom-4 right-4 bg-borderc" aria-label={language.addCharacter} onclick={() => {
    addCharacter()
}}>
    <PlusIcon size={24} />
</button>

<style>
    .mobile-character-list {
        padding-bottom: 5rem;
        background-color: var(--risu-theme-canvas);
    }

    .mobile-character-card {
        min-width: 0;
        min-height: 4.5rem;
        border-left: 3px solid transparent;
        color: var(--risu-theme-textcolor);
        text-align: left;
    }

    .mobile-character-card:hover {
        border-left-color: var(--risu-theme-focus);
        background-color: var(--risu-theme-surface-subtle);
    }

    .mobile-add-character {
        min-width: 3.5rem;
        min-height: 3.5rem;
        background-color: var(--risu-theme-action-primary);
        color: var(--risu-theme-textcolor);
        box-shadow: 0 0 1.25rem var(--risu-theme-action-primary);
    }

    .mobile-add-character:hover {
        background-color: var(--risu-theme-focus);
    }
</style>
