<script lang="ts">
    import { Send } from "@lucide/svelte";
    import { changeLanguage, language } from "src/lang";
    import { setPreset } from "src/ts/storage/database.svelte";
    import { DBState } from 'src/ts/stores.svelte';
    import Chat from "../ChatScreens/Chat.svelte";
    import { prebuiltPresets } from "src/ts/process/templates/templates";
    import { updateTextThemeAndCSS } from "src/ts/gui/colorscheme";
    import { alertError } from "src/ts/alert";
    import Airisu from '../../etc/Airisu.webp'

    const airisuStyle = `background: url("${Airisu}");background-size: cover;`
    let step = $state(0)
    let provider = $state('')
    let input = $state('')
    let chatLang = $state(0)
    let chatMemorySelection = $state(0)

    {
        const browserLang = navigator.language
        const browserLangShort = browserLang.split('-')[0]
        const usableLangs = ['de', 'en', 'ko', 'cn', 'vi', 'zh-Hant']
        if(usableLangs.includes(browserLangShort)){
            changeLanguage(browserLangShort)
            DBState.db.language = browserLangShort
            step = 1
        }
    }
    let start = $state(false)

    function send(){
        switch(step){
            case 1:{
                if(input.length > 0){
                    DBState.db.username = input
                    step = 2
                    input = ''
                }
                break
            }
            case 2:{
                if(['openai','openrouter','horde','later'].includes(input.toLocaleLowerCase())){
                    provider = input.toLocaleLowerCase()
                    step = 3
                    input = ''
                }
                break
            }
            case 4:{
                if(input.length === 0){
                    break
                }
                if(!input.startsWith('sk-')){
                    alertError('Invalid API key')
                    break
                }
                if(provider === 'openai'){
                    DBState.db.openAIKey = input
                }
                if(provider === 'openrouter'){
                    DBState.db.openrouterKey = input
                }
                if(provider === 'claude'){
                    DBState.db.claudeAPIKey = input
                }
                step = 5
                input = ''
                break
            }
        }
    }

    $effect.pre(() => {
        if(step === 10){
            setTimeout(() => {
                DBState.db = setPreset(DBState.db, prebuiltPresets.OAI2)
                DBState.db.textTheme = 'highcontrast'
                updateTextThemeAndCSS()

                switch(chatMemorySelection){
                    case 0:{
                        DBState.db.maxContext = 16000
                        DBState.db.maxResponse = 1000
                        break
                    }
                    case 1:{
                        DBState.db.maxContext = 8000
                        DBState.db.maxResponse = 500
                        break
                    }
                    case 2:{
                        DBState.db.maxContext = 12000
                        DBState.db.maxResponse = 800
                        break
                    }
                    case 3:{
                        DBState.db.maxContext = 100000
                        DBState.db.maxResponse = 1000
                        break
                    }
                }

                if(provider === 'claude'){
                    DBState.db.aiModel = 'claude-sonnet-4-6'
                    DBState.db.subModel = 'claude-sonnet-4-6'
                }

                if(provider === 'openai'){
                    DBState.db.aiModel = 'gpt4o-chatgpt'
                    DBState.db.subModel = 'gpt4o-chatgpt'
                }

                if(provider === 'openrouter'){
                    DBState.db.aiModel = 'openrouter'
                    DBState.db.subModel = 'openrouter'
                    DBState.db.openrouterRequestModel = 'risu/free'
                }
                if(provider === 'horde'){
                    DBState.db.aiModel = 'horde:::auto'
                    DBState.db.subModel = 'horde:::auto'
                }
                if(chatLang !== 0){
                    switch(DBState.db.language){
                        case 'de':{
                            DBState.db.translator = 'de'
                            break
                        }
                        case 'en':{
                            DBState.db.translator = 'en'
                            break
                        }
                        case 'ko':{
                            DBState.db.translator = 'ko'
                            break
                        }
                        case 'cn':{
                            DBState.db.translator = 'zh'
                            break
                        }
                        case 'vi':{
                            DBState.db.translator = 'vi'
                            break
                        }
                        case 'zh-Hant':{
                            DBState.db.translator = 'zh-TW'
                            break
                        }
                    }
                }
                if(chatLang === 1){
                    DBState.db.autoTranslate = true
                    DBState.db.translatorType = 'google'
                    DBState.db.useAutoTranslateInput = true
                }

                DBState.db.didFirstSetup = true
            }, 1000);

            DBState.db.claudeCachingExperimental = true
        }

    });
</script>

<div class="w-full h-full flex justify-center welcome-bg neon-onboarding text-textcolor relative">
    <div class="w-2xl onboarding-rail overflow-x-hidden max-w-full min-h-full h-full flex flex-col overflow-y-hidden" class:justify-center={!start}>
        {#if !start}
            <div class="w-full welcome-wordmark justify-center flex mt-8 logo-animation" onanimationend={() => {
                start = true
            }}>
                <span class="welcome-brand" aria-hidden="true">ELSE<span>//</span>WHERE</span>
                <img src="/logo_typo_trans.png" alt="logo" class="w-full max-w-(--breakpoint-sm) mb-0">
            </div>
        {:else}
            <div class="relative w-full onboarding-panel flex-col grow mt-5 max-w-full p-5 overflow-x-hidden flex chat-animation overflow-y-auto">
                <span class="onboarding-brand" aria-hidden="true">ELSE<span>//</span>WHERE</span>
                {#if step === 0}
                    <h2 class="language-heading">Choose your language</h2>
                    <div class="language-options flex flex-col items-start">
                        <button class="language-option" onclick={() => {
                            changeLanguage('de')
                            DBState.db.language='de'
                            step = 1
                        }}>• Deutsch</button>
                        <button class="language-option" onclick={() => {
                            changeLanguage('en')
                            DBState.db.language='en'
                            step = 1
                        }}>• English</button>
                        <button class="language-option" onclick={() => {
                            changeLanguage('ko')
                            DBState.db.language='ko'
                            step = 1
                        }}>• 한국어</button>
                        <button class="language-option" onclick={() => {
                            changeLanguage('cn')
                            DBState.db.language='cn'
                            step = 1
                        }}>• 中文</button>
                        <button class="language-option" onclick={() => {
                            changeLanguage('zh-Hant')
                            DBState.db.language='zh-Hant'
                            step = 1
                        }}>• 中文(繁體)</button>
                        <button class="language-option" onclick={() => {
                            changeLanguage('vi')
                            DBState.db.language='vi'
                            step = 1
                        }}>• Tiếng Việt</button>
                    </div>

                {:else}
                    <Chat name="Airisu" img={airisuStyle} message={language.setup.welcome} isLastMemory={false} />
                    {#if step >= 2}
                        <Chat name={DBState.db.username} message={DBState.db.username} isLastMemory={false} />
                        <Chat name="Airisu" img={airisuStyle} message={language.setup.setupLaterMessage.replace('{username}', DBState.db.username)} isLastMemory={false} />
                    {/if}
                    {#if step === 2}
                        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                            <button class="onboarding-option p-6 flex flex-col sm:col-span-2" onclick={() => {
                                step = 3
                            }}>
                                <h1 class="text-2xl font-bold text-start">{language.setup.setupMessageOption1}</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.setupMessageOption1Desc}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                provider = 'later'
                                step = 10
                            }}>
                                <h1 class="text-md font-bold text-start">{language.setup.setupMessageOption2}</h1>
                            </button>
                        </div>
                    {/if}
                    {#if step >= 3}
                        <Chat name={DBState.db.username} message={language.setup.setupMessageOption1} isLastMemory={false} />
                        <Chat name="Airisu" img={airisuStyle} message={language.setup.welcome2.replace('{username}', DBState.db.username)} isLastMemory={false} />
                    {/if}
                    {#if step === 3}
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                provider = 'claude'
                                step = 4
                            }}>
                                <h1 class="text-2xl font-bold text-start">Claude <span class="onboarding-recommendation">{language.recommended}</span></h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.claudeDesc}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                provider = 'openai'
                                step = 4
                            }}>
                                <h1 class="text-2xl font-bold text-start">OpenAI</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.openAIDesc}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                provider = 'horde'
                                step = 10
                            }}>
                                <h1 class="text-2xl font-bold text-start">Horde</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.hordeProvider}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                provider = 'openrouter'
                                step = 4
                            }}>
                                <h1 class="text-2xl font-bold text-start">OpenRouter</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.openRouterProvider}</span>
                            </button>
                        </div>
                    {/if}
                    {#if step >= 4}
                        <Chat name={DBState.db.username} message={provider} isLastMemory={false} />
                        {#if provider === 'openai'}
                            <Chat name="Airisu" img={airisuStyle} message={language.setup.setupOpenAI} isLastMemory={false} />
                        {/if}
                        {#if provider === 'openrouter'}
                            <Chat name="Airisu" img={airisuStyle} message={language.setup.setupOpenRouter} isLastMemory={false} />
                        {/if}
                        {#if provider === 'claude'}
                            {#each language.setup.setupClaudeSteps as step, i}
                                <Chat name="Airisu" img={airisuStyle} message={
                                `![alt text](/welcome/claude/ant_${i}.webp)\n\n${i === 0 ? 'https://console.anthropic.com/login?returnTo=%2F%3F\n\n' : ''}` + step
                            } isLastMemory={false} />
                                
                            {/each}
                        {/if}
                    {/if}
                    {#if step >= 5}
                        <Chat name={DBState.db.username} message="<HIDDEN>" isLastMemory={false} />
                        <Chat name="Airisu" img={airisuStyle} message={language.setup.chooseChatType} isLastMemory={false} />
                    {/if}
                    {#if step === 5}
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                chatLang = 0
                                step = 6
                            }}>
                                <h1 class="text-2xl font-bold text-start">{language.setup.chooseChatTypeOption1}</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.chooseChatTypeOption1Desc}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                chatLang = 1
                                step = 6
                            }}>
                                <h1 class="text-2xl font-bold text-start">{language.setup.chooseChatTypeOption2}</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.chooseChatTypeOption2Desc}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                chatLang = 2
                                step = 6
                            }}>
                                <h1 class="text-2xl font-bold text-start">{language.setup.chooseChatTypeOption3}</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.chooseChatTypeOption3Desc}</span>
                            </button>
                        </div>
                    {/if}
                    {#if step >= 6}
                        <Chat name={DBState.db.username} message={
                            language.setup[`chooseChatTypeOption${chatLang+1}`]
                        } isLastMemory={false} />
                        <Chat name="Airisu" img={airisuStyle} message={language.setup.chooseCheapOrMemory} isLastMemory={false} />
                    {/if}
                    {#if step === 6}
                        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                chatMemorySelection = 2
                                step = 10
                            }}>
                                <h1 class="text-2xl font-bold text-start">{language.setup.chooseCheapOrMemoryOption3} <span class="onboarding-recommendation">{language.recommended}</span></h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.chooseCheapOrMemoryOption3Desc}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                chatMemorySelection = 0
                                step = 10
                            }}>
                                <h1 class="text-2xl font-bold text-start">{language.setup.chooseCheapOrMemoryOption1}</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.chooseCheapOrMemoryOption1Desc}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                chatMemorySelection = 1
                                step = 10
                            }}>
                                <h1 class="text-2xl font-bold text-start">{language.setup.chooseCheapOrMemoryOption2}</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.chooseCheapOrMemoryOption2Desc}</span>
                            </button>
                            <button class="onboarding-option p-6 flex flex-col" onclick={() => {
                                chatMemorySelection = 3
                                step = 10
                            }}>
                                <h1 class="text-2xl font-bold text-start">{language.setup.chooseCheapOrMemoryOption4}</h1>
                                <span class="mt-2 text-textcolor2 text-start">{language.setup.chooseCheapOrMemoryOption4Desc}</span>
                            </button>
                        </div>
                    {/if}
                    {#if step === 10}
                        <Chat name="Airisu" img={airisuStyle} message={language.setup.allDone} isLastMemory={false} />
                    {/if}
                    <div class="onboarding-input flex items-stretch mb-2 w-full mt-auto">
                        <textarea class="onboarding-textarea peer outline-hidden p-2 min-w-0 border-0 bg-transparent rounded-l-md input-text text-xl grow ml-4 resize-none overflow-y-hidden overflow-x-hidden max-w-full"
                            bind:value={input}
                            onkeydown={(e) => {
                                if(e.key.toLocaleLowerCase() === "enter" && (!e.shiftKey) && !e.isComposing){
                                    e.preventDefault()
                                    send()
                                }
                            }}
                            style:height={'44px'}
                        ></textarea>
                        <button
                            onclick={send}
                            class="onboarding-send flex justify-center rounded-r-md items-center p-2 transition-colors"
                        >
                            <Send />
                        </button>
                    </div>
                {/if}
            </div>
        {/if}

    </div>
</div>
<style>
    .welcome-bg {
        background:
            radial-gradient(circle at 82% 14%, rgb(244 91 154 / 0.17), transparent 25%),
            radial-gradient(circle at 12% 86%, rgb(40 215 197 / 0.12), transparent 28%),
            linear-gradient(150deg, #11142f 0%, #0a0b1d 68%);
        background-size: cover;
        isolation: isolate;
        position: relative;
    }

    .welcome-bg::after {
        background:
            repeating-linear-gradient(90deg, transparent 0 42px, rgb(109 93 251 / 0.16) 43px 44px),
            repeating-linear-gradient(0deg, transparent 0 28px, rgb(109 93 251 / 0.16) 29px 30px);
        bottom: -31%;
        content: '';
        height: 54%;
        left: -10%;
        pointer-events: none;
        position: absolute;
        right: -10%;
        transform: perspective(340px) rotateX(63deg);
        transform-origin: bottom;
        z-index: -1;
    }

    .onboarding-rail {
        padding: 1.5rem 1rem 0;
    }

    .welcome-wordmark {
        align-items: center;
        flex-direction: column;
        gap: 0.5rem;
        position: relative;
    }

    .welcome-brand {
        color: #f5f7ff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.16em;
        text-shadow: 0 0 22px rgb(109 93 251 / 0.8);
    }

    .welcome-brand span {
        color: #28d7c5;
    }

    .welcome-wordmark img {
        filter: drop-shadow(0 0 22px rgb(109 93 251 / 0.42));
        max-width: 14rem;
    }

    .onboarding-panel {
        background: color-mix(in srgb, var(--risu-theme-darkbg) 74%, #0a0b1d);
        border: 1px solid rgb(109 93 251 / 0.55);
        border-left: 4px solid #28d7c5;
        border-radius: 1rem 1rem 0 0;
        box-shadow: 0 0 0 1px rgb(40 215 197 / 0.1), 0 20px 48px rgb(0 0 0 / 0.35);
    }

    .onboarding-brand {
        color: #f5f7ff;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.14em;
        margin-bottom: 1rem;
    }

    .onboarding-brand span {
        color: #28d7c5;
    }

    .language-heading {
        color: var(--risu-theme-textcolor);
        font-size: clamp(1.5rem, 4vw, 2rem);
        letter-spacing: -0.03em;
        margin: 0 0 1rem;
    }

    .language-options {
        gap: 0.35rem;
    }

    .language-option {
        border-radius: 0.5rem;
        color: var(--risu-theme-textcolor);
        padding: 0.45rem 0.65rem;
        text-align: left;
        transition: background-color 160ms ease, color 160ms ease, transform 160ms ease;
    }

    .language-option:hover {
        background: rgb(40 215 197 / 0.12);
        color: #f5f7ff;
        transform: translateX(0.2rem);
    }

    .onboarding-option {
        background: rgb(17 19 43 / 0.82);
        border: 1px solid rgb(117 119 190 / 0.52);
        border-left: 4px solid #6d5dfb;
        border-radius: 0.75rem;
        box-shadow: inset 0 1px 0 rgb(245 247 255 / 0.05);
        transition: background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
    }

    .onboarding-option:hover {
        background: rgb(29 31 66 / 0.92);
        border-color: #28d7c5;
        box-shadow: 0 0 0 1px rgb(40 215 197 / 0.22), 0 12px 30px rgb(0 0 0 / 0.2);
    }

    .onboarding-option:focus-visible,
    .language-option:focus-visible {
        outline: 3px solid #f5f7ff;
        outline-offset: 3px;
    }

    .onboarding-option h1 {
        color: var(--risu-theme-textcolor);
    }

    .onboarding-recommendation {
        background: #6d5dfb;
        border: 1px solid #b9b0ff;
        border-radius: 0.125rem;
        color: #f5f7ff;
        display: inline-block;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.68rem;
        letter-spacing: 0.04em;
        padding: 0.125rem 0.25rem;
    }

    .onboarding-option > span {
        color: color-mix(in srgb, var(--risu-theme-textcolor2) 70%, #d6d8f5);
    }

    .onboarding-input {
        background: rgb(10 11 29 / 0.76);
        border: 1px solid rgb(117 119 190 / 0.52);
        border-radius: 0.625rem;
        box-shadow: 0 8px 24px rgb(0 0 0 / 0.16);
    }

    .onboarding-input:focus-within {
        border-color: #28d7c5;
        box-shadow: 0 0 0 1px rgb(40 215 197 / 0.24), 0 8px 24px rgb(0 0 0 / 0.16);
    }

    .onboarding-textarea {
        color: var(--risu-theme-textcolor);
    }

    .onboarding-send {
        background: #6d5dfb;
        color: #f5f7ff;
        min-width: 3rem;
    }

    .onboarding-send:hover {
        background: #28d7c5;
        color: #0a0b1d;
    }

    .logo-animation {
        animation: logo-animation 3s ease-in-out;
        opacity: 0;
    }

    @keyframes logo-animation {
        from { opacity: 0; }
        80% { opacity: 1; }
        to { opacity: 0; }
    }

    .chat-animation {
        animation: chat-animation 3s ease-in-out;
    }

    @keyframes chat-animation {
        from { top: 100vh; }
        to { top: 0; }
    }

    @media (max-width: 640px) {
        .onboarding-rail {
            padding: 1rem 0.5rem 0;
        }

        .onboarding-panel {
            border-radius: 0.75rem 0.75rem 0 0;
            padding: 1rem;
        }

        .welcome-wordmark img {
            max-width: 11rem;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .logo-animation,
        .chat-animation {
            animation-duration: 1ms;
        }

        .language-option,
        .onboarding-option {
            transition: none;
        }

        .language-option:hover {
            transform: none;
        }
    }
</style>
