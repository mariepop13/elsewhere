<script lang="ts">
    import { downloadRisuHub, getRisuHub, hubAdditionalHTML, type hubType } from "src/ts/characterCards";
    import { ArrowLeft, ArrowRight, MenuIcon, SearchIcon, XIcon } from "@lucide/svelte";
    import { alertInput } from "src/ts/alert";
    import { language } from "src/lang";
    import RisuHubIcon from "./RealmHubIcon.svelte";
    import { RealmInitialOpenChar } from "src/ts/stores.svelte";
    import RealmPopUp from "./RealmPopUp.svelte";

    let openedData: hubType | null = $state(null);
    let charas: hubType[] = $state([]);
    let page = $state(0);
    let sort = $state('recommended');
    let search = $state('');
    let menuOpen = $state(false);
    let nsfw = $state(false);

    async function getHub() {
        charas = await getRisuHub({ search, page, nsfw, sort });
    }

    function changeSort(type: string) {
        if (sort === type) {
            sort = 'recommended';
        } else {
            sort = type;
        }
        page = 0;
        return getHub();
    }

    getHub();

    $effect(() => {
        if ($RealmInitialOpenChar) {
            openedData = $RealmInitialOpenChar;
            $RealmInitialOpenChar = null;
        }
    });
</script>

<section class="realm-desk">
    <header class="realm-intro">
        <div>
            <h1>RisuRealm</h1>
            <p>{language.character}</p>
        </div>
        <div class="realm-search">
            <input bind:value={search} aria-label={language.search} class="realm-search-input" placeholder={language.search}>
            <button
                class="realm-search-action"
                aria-label={language.search}
                onclick={() => {
                    if (sort === 'random' || sort === 'recommended') {
                        sort = '';
                    }
                    page = 0;
                    getHub();
                }}
            >
                <SearchIcon />
            </button>
            <button class="realm-search-action" aria-label={language.menu} onclick={() => { menuOpen = true; }}>
                <MenuIcon />
            </button>
        </div>
    </header>

    <div class="realm-workspace">
        <nav class="realm-filter-index" aria-label={language.character}>
            <button class:realm-filter-active={sort === 'recommended'} aria-current={sort === 'recommended' ? 'page' : undefined} onclick={() => { changeSort('recommended'); }}>
                {language.recommended}
            </button>
            <button class:realm-filter-active={sort === ''} aria-current={sort === '' ? 'page' : undefined} onclick={() => { changeSort(''); }}>
                {language.recent}
            </button>
            <button class:realm-filter-active={sort === 'trending'} aria-current={sort === 'trending' ? 'page' : undefined} onclick={() => { changeSort('trending'); }}>
                {language.trending}
            </button>
            <button class:realm-filter-active={sort === 'downloads'} aria-current={sort === 'downloads' ? 'page' : undefined} onclick={() => { changeSort('downloads'); }}>
                {language.downloads}
            </button>
            <button class:realm-filter-active={sort === 'random'} aria-current={sort === 'random' ? 'page' : undefined} onclick={() => { changeSort('random'); }}>
                {language.random}
            </button>
            <button class:realm-filter-active={nsfw} aria-pressed={nsfw} onclick={() => {
                nsfw = !nsfw;
                getHub();
            }}>
                {nsfw ? 'NSFW' : 'SFW'}
            </button>
        </nav>

        <div class="realm-results">
            {@html hubAdditionalHTML}
            <div class="realm-results-grid">
                {#key charas}
                    {#each charas as chara}
                        <RisuHubIcon onClick={() => { openedData = chara; }} {chara} />
                    {/each}
                {/key}
            </div>

            {#if sort !== 'random' && sort !== 'recommended'}
                <div class="realm-pagination">
                    <button aria-label="Previous page" onclick={() => {
                        if (page > 0) {
                            page -= 1;
                            getHub();
                        }
                    }}><ArrowLeft /></button>
                    <span>{page + 1}</span>
                    <button aria-label="Next page" onclick={() => {
                        page += 1;
                        getHub();
                    }}><ArrowRight /></button>
                </div>
            {/if}
        </div>
    </div>
</section>

{#if openedData}
    <RealmPopUp bind:openedData={openedData} />
{/if}

{#if menuOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="top-0 left-0 z-50 fixed w-full h-full bg-[var(--risu-theme-overlay)] flex justify-center items-center" role="button" tabindex="0" onclick={() => {
        menuOpen = false;
    }}>
        <div class="max-w-full bg-surface-elevated rounded-md flex flex-col gap-4 overflow-y-auto p-4 border border-darkborderc text-textcolor">
            <h1 class="font-bold text-2xl w-full">
                <span>Menu</span>
                <button class="float-right text-textcolor2 hover:text-focus" aria-label="Close menu" onclick={() => { menuOpen = false; }}>
                    <XIcon />
                </button>
            </h1>
            <div class="mt-2 w-full border-t border-darkborderc"></div>
            <button class="w-full hover:bg-surface-subtle p-4 text-left" onclick={async (e) => {
                e.stopPropagation();
                menuOpen = false;
                const input = await alertInput('Input URL or ID');
                if (input.startsWith('http')) {
                    const url = new URL(input);
                    const id = url.searchParams.get('realm') ?? url.searchParams.get('code') ?? input.split('/').at(-1);
                    if (id) {
                        downloadRisuHub(id);
                        return;
                    }
                }
                const id = input.split('?').at(-1);
                downloadRisuHub(id);
            }}>Import Character from URL or ID</button>
        </div>
    </div>
{/if}

<style>
    .realm-desk {
        width: min(100%, 84rem);
        min-height: 100%;
        margin-inline: auto;
        padding: clamp(1rem, 3vw, 2.5rem);
        color: var(--risu-theme-textcolor);
    }

    .realm-intro {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 2rem;
        padding: 0 0 1.5rem;
        border-bottom: 1px solid var(--risu-theme-darkborderc);
    }

    .realm-intro h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 3.25rem);
        font-weight: 500;
        letter-spacing: -0.045em;
        line-height: 1;
    }

    .realm-intro p {
        margin: 0.5rem 0 0;
        color: var(--risu-theme-textcolor2);
    }

    .realm-search {
        display: grid;
        grid-template-columns: minmax(12rem, 24rem) auto auto;
        overflow: hidden;
        border: 1px solid var(--risu-theme-darkborderc);
        border-radius: 0.75rem;
        background: var(--risu-theme-surface-elevated);
    }

    .realm-search-input {
        min-width: 0;
        padding: 0.75rem 1rem;
        border: 0;
        background: transparent;
        color: var(--risu-theme-textcolor);
    }

    .realm-search-input:focus { outline: 2px solid var(--risu-theme-focus); outline-offset: -2px; }

    .realm-search-action {
        display: grid;
        width: 3rem;
        place-items: center;
        border-left: 1px solid var(--risu-theme-darkborderc);
        color: var(--risu-theme-textcolor2);
    }

    .realm-search-action:hover { background: var(--risu-theme-surface-subtle); color: var(--risu-theme-textcolor); }

    .realm-workspace {
        display: grid;
        grid-template-columns: 11.5rem minmax(0, 1fr);
        gap: clamp(1.5rem, 4vw, 4rem);
        padding-top: 1.5rem;
    }

    .realm-filter-index {
        display: flex;
        align-self: start;
        flex-direction: column;
        gap: 0.25rem;
        padding-right: 1rem;
        border-right: 1px solid var(--risu-theme-darkborderc);
    }

    .realm-filter-index button {
        min-height: 2.75rem;
        padding: 0.625rem 0.75rem;
        border-left: 3px solid transparent;
        border-radius: 0.375rem;
        color: var(--risu-theme-textcolor2);
        text-align: left;
    }

    .realm-filter-index button:hover { background: var(--risu-theme-surface-subtle); color: var(--risu-theme-textcolor); }
    .realm-filter-index .realm-filter-active { border-left-color: var(--risu-theme-focus); background: var(--risu-theme-surface-subtle); color: var(--risu-theme-textcolor); }

    .realm-results { min-width: 0; }

    .realm-results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr));
        gap: 0.75rem;
    }

    .realm-pagination {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 2rem;
    }

    .realm-pagination button,
    .realm-pagination span {
        display: grid;
        width: 2.75rem;
        height: 2.75rem;
        place-items: center;
        border: 1px solid var(--risu-theme-darkborderc);
        border-radius: 0.5rem;
        background: var(--risu-theme-surface-elevated);
    }

    .realm-pagination button:hover { border-color: var(--risu-theme-focus); color: var(--risu-theme-focus); }

    @media (max-width: 700px) {
        .realm-desk { padding: 1rem; }
        .realm-intro { align-items: stretch; flex-direction: column; gap: 1rem; }
        .realm-search { grid-template-columns: minmax(0, 1fr) auto auto; }
        .realm-workspace { grid-template-columns: 1fr; gap: 1.25rem; }
        .realm-filter-index { flex-direction: row; overflow-x: auto; padding: 0 0 0.5rem; border-right: 0; border-bottom: 1px solid var(--risu-theme-darkborderc); }
        .realm-filter-index button { flex: none; white-space: nowrap; }
    }
</style>
