const { Packr } = require('msgpackr/index-no-eval');

function makeCard(id, name) {
    return {
        chaId: id, name, type: 'character', image: '', desc: 'Fixture-only private description',
        firstMessage: 'Fixture card greeting', alternateGreetings: ['Fixture alternate greeting'],
        chats: [
            { id: `${id}-main`, name: 'Main story', note: '', localLore: [], fmIndex: -1, message: [
                { role: 'user', data: 'Fixture user message', chatId: `${id}-user`, time: 1 },
                { role: 'char', data: 'Fixture legacy reply', time: 2 },
                { role: 'user', data: 'Fixture question', chatId: `${id}-question`, time: 3 },
                { role: 'char', data: 'Fixture regular reply', chatId: `${id}-reply`, time: 4 },
            ] },
            { id: `${id}-other`, name: 'Other story', note: '', localLore: [], fmIndex: -1, message: [] },
        ],
        chatPage: 0, notes: '', exampleMessage: '', creatorNotes: '', replaceGlobalNote: '',
        additionalText: '', personality: '', postHistoryInstructions: '', triggerscript: [],
        chatFolders: [], firstMsgIndex: -1, viewScreen: 'none', ccAssets: [], additionalAssets: [],
        extensions: {}, bias: [], characterVersion: '', creator: '', customscript: [],
        emotionImages: [], globalLore: [], scenario: '', systemPrompt: '', tags: [], utilityBot: false,
        ttsMode: 'none',
    };
}

function makeDatabase() {
    return {
        didFirstSetup: true, coldstorage: false, language: 'en', username: 'Fixture player', userIcon: '',
        personas: [{ id: 'fixture-player', name: 'Fixture player', icon: '', personaPrompt: '' }],
        characters: [makeCard('fixture-jun', 'Fixture Jun'), makeCard('fixture-nell', 'Fixture Nell')],
        aiModel: 'gpt-4o', openAIKey: 'fixture-only-not-a-real-key', maxContext: 8000,
        maxResponse: 320, useStreaming: false, sendWithEnter: true, swipe: false,
        useChatCopy: true, enableBookmark: true, askRemoval: true, instantRemove: false,
        translator: '', showMenuChatList: true, worldWorkspace: { defaultHome: 'world' },
        socialFeed: {
            version: 1, enabled: true, publicWorld: 'A fictional fixture world.',
            cast: [{ characterId: 'fixture-jun', name: 'Fixture Jun', publicProfile: 'A fictional neighbour.' }],
            posts: [], draft: '', maxContext: 8000, maxResponse: 320,
        },
    };
}

function encodeDatabase(db) {
    const header = Buffer.from([0, 82, 73, 83, 85, 83, 65, 86, 69, 0, 7]);
    return Buffer.concat([header, new Packr({ useRecords: false }).encode(db)]);
}

module.exports = { makeDatabase, encodeDatabase };
