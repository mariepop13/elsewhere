<script lang="ts">
    import { getCustomBackground, getEmotion } from "../../ts/util";
    
    import { DBState } from 'src/ts/stores.svelte';
    import { CharEmotion, selectedCharID } from "../../ts/stores.svelte";
    import ResizeBox from './ResizeBox.svelte'
    import DefaultChatScreen from "./DefaultChatScreen.svelte";
    import defaultWallpaper from '../../etc/bg.jpg'
    import ChatList from "../Others/ChatList.svelte";
    import TransitionImage from "./TransitionImage.svelte";
    import BackgroundDom from "./BackgroundDom.svelte";
    import SideBarArrow from "../UI/GUI/SideBarArrow.svelte";
    import ModuleChatMenu from "../Setting/Pages/Module/ModuleChatMenu.svelte";
    let openChatList = $state(false)
    let openModuleList = $state(false)

    const wallPaper = `background: url(${defaultWallpaper})`
    const externalStyles = 
            ("background: " + (DBState.db.textScreenColor ? (DBState.db.textScreenColor + '80') : "rgba(0,0,0,0.8)") + ';\n')
        +   (DBState.db.textBorder ? "text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000;" : '')
        +   (DBState.db.textScreenRounded ? "border-radius: 2rem; padding: 1rem;" : '')
        +   (DBState.db.textScreenBorder ? `border: 0.3rem solid ${DBState.db.textScreenBorder};` : '')
    let bgImg= $state('')
    let lastBg = $state('')
    $effect.pre(() => {
        (async () =>{
            if(DBState.db.customBackground !== lastBg){
                lastBg = DBState.db.customBackground
                bgImg = await getCustomBackground(DBState.db.customBackground)
            }
        })()
    });
</script>

{#if DBState.db.theme === 'waifu'}
    <div class="grow h-full flex justify-center relative" style="{bgImg.length < 4 ? wallPaper : bgImg}">
        <SideBarArrow />
        <BackgroundDom />
        {#if $selectedCharID >= 0}
            {#if DBState.db.characters[$selectedCharID].viewScreen !== 'none'}
                <div class="h-full mr-10 flex justify-end halfw" style:width="{42 * (DBState.db.waifuWidth2 / 100)}rem">
                    <TransitionImage classType="waifu" src={getEmotion(DBState.db, $CharEmotion, 'plain')}/>
                </div>
            {/if}
        {/if}
        <div class="h-full w-2xl" style:width="{42 * (DBState.db.waifuWidth / 100)}rem" class:halfwp={$selectedCharID >= 0 && DBState.db.characters[$selectedCharID].viewScreen !== 'none'}>
            <DefaultChatScreen customStyle={`${externalStyles}backdrop-filter: blur(4px);`} bind:openChatList bind:openModuleList/>
        </div>
    </div>
{:else if DBState.db.theme === 'waifuMobile'}
    <div class="grow h-full relative" style={bgImg.length < 4 ? wallPaper : bgImg}>
        <SideBarArrow />
        <BackgroundDom />
        <div class="w-full absolute z-10 bottom-0 left-0"
            class:per33={$selectedCharID >= 0 && DBState.db.characters[$selectedCharID].viewScreen !== 'none'}
            class:h-full={!($selectedCharID >= 0 && DBState.db.characters[$selectedCharID].viewScreen !== 'none')}
        >
            <DefaultChatScreen customStyle={`${externalStyles}backdrop-filter: blur(4px);`} bind:openChatList bind:openModuleList/>
        </div>
        {#if $selectedCharID >= 0}
            {#if DBState.db.characters[$selectedCharID].viewScreen !== 'none'}
                <div class="h-full w-full absolute bottom-0 left-0 max-w-full">
                    <TransitionImage classType="mobile" src={getEmotion(DBState.db, $CharEmotion, 'plain')}/>
                </div>
            {/if}
        {/if}
    </div>
{:else}
    <div class="grow h-full min-w-0 relative justify-center flex">
        <SideBarArrow />
        <BackgroundDom />
        <div style={bgImg} class="conversation-stage h-full w-full flex flex-col" class:max-w-6xl={DBState.db.classicMaxWidth}>
            {#if $selectedCharID >= 0}
                <header class="conversation-header shrink-0">
                    <div class="flex min-w-0 items-center gap-3">
                        <span class="conversation-presence" aria-hidden="true"></span>
                        <div class="min-w-0">
                            <h1 class="truncate">{DBState.db.characters[$selectedCharID]?.name}</h1>
                        </div>
                    </div>
                    <span class="conversation-context truncate">{DBState.db.characters[$selectedCharID]?.chats?.[DBState.db.characters[$selectedCharID]?.chatPage]?.name}</span>
                </header>
            {/if}
            <div class="conversation-reading-stage relative min-h-0 grow">
                {#if $selectedCharID >= 0}
                    {#if DBState.db.characters[$selectedCharID].viewScreen !== 'none' && (DBState.db.characters[$selectedCharID].type === 'group' || (!DBState.db.characters[$selectedCharID].inlayViewScreen))}
                        <ResizeBox />
                    {/if}
                {/if}
                <DefaultChatScreen customStyle={bgImg.length > 2 ? `${externalStyles}`: ''} bind:openChatList bind:openModuleList/>
            </div>
        </div>
    </div>
{/if}
{#if openChatList}
    <ChatList close={() => {openChatList = false}}/>
{:else if openModuleList}
    <ModuleChatMenu close={() => {openModuleList = false}}/>
{/if}

<style>
    .halfw{
        max-width: calc(50% - 5rem);
    }
    .halfwp{
        max-width: calc(50% - 5rem);
    }
    .per33{
        height: 33.333333%;
    }

    .conversation-stage {
        margin-inline: auto;
    }

    .conversation-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        min-height: 4.25rem;
        padding: 0.625rem clamp(1rem, 3vw, 2rem);
        border-bottom: 1px solid var(--risu-theme-darkborderc);
        background: var(--risu-theme-surface-elevated);
    }

    .conversation-presence {
        width: 0.5rem;
        height: 0.5rem;
        flex: none;
        border-radius: 999px;
        background: var(--risu-theme-focus);
        box-shadow: 0 0 0 3px var(--risu-theme-surface-subtle);
    }

    .conversation-context {
        color: var(--risu-theme-textcolor2);
        font-size: 0.8125rem;
    }

    .conversation-header h1 {
        margin: 0;
        color: var(--risu-theme-textcolor);
        font-size: 0.9375rem;
        font-weight: 600;
        line-height: 1.25;
    }

    .conversation-context {
        max-width: 40%;
        text-align: right;
    }

    .conversation-reading-stage {
        min-width: 0;
    }
</style>