<script lang="ts">
    import { BookIcon, ImageIcon, SmileIcon } from "@lucide/svelte";
    import { alertNormal } from "src/ts/alert";
    import { hubURL, type hubType } from "src/ts/characterCards";
    import { DBState } from "src/ts/stores.svelte";
    import { parseMultilangString } from "src/ts/util";

    interface Props {
        onClick?: () => void;
        chara: hubType;
    }

    let { onClick = () => {}, chara }: Props = $props();
</script>

<button class="realm-entry" onclick={onClick}>
    {#if DBState.db.hideAllImages}
        <div class="realm-entry-image realm-entry-image-empty" aria-hidden="true">?</div>
    {:else}
        <img class="realm-entry-image" alt={chara.name} src={`${hubURL}/resource/${chara.img}`}>
    {/if}
    <div class="realm-entry-body">
        <span class="realm-entry-name">{chara.name}</span>
        <span class="realm-entry-description">{parseMultilangString(chara.desc)[DBState.db.language] ?? parseMultilangString(chara.desc).en ?? parseMultilangString(chara.desc).xx}</span>
        <div class="realm-entry-footer">
            <div class="realm-entry-tags">
                {#each chara.tags as tag, i}
                    {#if i < 3}
                        <span>{tag}</span>
                    {:else if i === 3}
                        <span>…</span>
                    {/if}
                {/each}
            </div>
            <div class="realm-entry-assets">
                {#if chara.hasEmotion}
                    <span role="button" tabindex="0" aria-label="Emotion images" onclick={(e) => {
                        e.stopPropagation();
                        alertNormal('This character includes emotion images');
                    }} onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            alertNormal('This character includes emotion images');
                        }
                    }}><SmileIcon size={16} /></span>
                {/if}
                {#if chara.hasAsset}
                    <span role="button" tabindex="0" aria-label="Additional assets" onclick={(e) => {
                        e.stopPropagation();
                        alertNormal('This character includes additional assets');
                    }} onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            alertNormal('This character includes additional assets');
                        }
                    }}><ImageIcon size={16} /></span>
                {/if}
                {#if chara.hasLore}
                    <span role="button" tabindex="0" aria-label="Lorebook" onclick={(e) => {
                        e.stopPropagation();
                        alertNormal('This character includes lorebook');
                    }} onkeydown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            alertNormal('This character includes lorebook');
                        }
                    }}><BookIcon size={16} /></span>
                {/if}
            </div>
        </div>
    </div>
</button>

<style>
    .realm-entry {
        display: grid;
        grid-template-columns: 5.25rem minmax(0, 1fr);
        gap: 1rem;
        width: 100%;
        min-height: 8.5rem;
        padding: 0.875rem;
        border: 1px solid transparent;
        border-left: 3px solid var(--risu-theme-darkborderc);
        border-radius: 0.75rem;
        background: color-mix(in srgb, var(--risu-theme-surface-elevated) 78%, transparent);
        color: var(--risu-theme-textcolor);
        text-align: left;
    }

    .realm-entry:hover {
        border-color: var(--risu-theme-darkborderc);
        border-left-color: var(--risu-theme-focus);
        background: var(--risu-theme-surface-elevated);
    }

    .realm-entry:focus-visible { outline: 2px solid var(--risu-theme-focus); outline-offset: 2px; }

    .realm-entry-image {
        width: 5.25rem;
        height: 6.75rem;
        border-radius: 0.4rem;
        object-fit: cover;
        object-position: top;
        background: var(--risu-theme-surface-subtle);
    }

    .realm-entry-image-empty {
        display: grid;
        place-items: center;
        color: var(--risu-theme-textcolor2);
        font-size: 1.75rem;
    }

    .realm-entry-body { display: flex; min-width: 0; flex-direction: column; }
    .realm-entry-name { overflow: hidden; font-size: 1rem; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .realm-entry-description { display: -webkit-box; overflow: hidden; margin-top: 0.3rem; color: var(--risu-theme-textcolor2); font-size: 0.78rem; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
    .realm-entry-footer { display: flex; align-items: end; justify-content: space-between; gap: 0.5rem; margin-top: auto; padding-top: 0.75rem; }
    .realm-entry-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; min-width: 0; }
    .realm-entry-tags span { overflow: hidden; max-width: 7rem; color: var(--risu-theme-focus); font-size: 0.7rem; text-overflow: ellipsis; white-space: nowrap; }
    .realm-entry-assets { display: flex; gap: 0.15rem; color: var(--risu-theme-textcolor2); }
    .realm-entry-assets [role="button"] { display: grid; width: 1.75rem; height: 1.75rem; place-items: center; border-radius: 0.3rem; }
    .realm-entry-assets [role="button"]:hover { color: var(--risu-theme-focus); background: var(--risu-theme-surface-subtle); }

    @media (max-width: 380px) {
        .realm-entry { grid-template-columns: 4.25rem minmax(0, 1fr); gap: 0.75rem; }
        .realm-entry-image { width: 4.25rem; height: 5.5rem; }
    }
</style>
