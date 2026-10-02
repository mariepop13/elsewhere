# Correspondence desk implementation plan

## Approved visual direction

The approved visual proposal is [`elsewhere-correspondence-design-proposal.html`](./elsewhere-correspondence-design-proposal.html): Elsewhere becomes a private correspondence desk for long character-led AI conversations. It is not a neon dashboard. The current conversation is the reading/writing stage; a narrow signal rail supports global movement; a character library provides context; violet means commitment, cyan locates the active thread/focus, and pink is rare ambience.

## Boundaries that must remain stable

- No persistence, model/provider, route, store, or request changes.
- Keep `Sidebar` (`openGrid`, `hidden`), `DefaultChatScreen` (`openChatList`, `openModuleList`, `customStyle`), `SideChatList` (`chara`), and Settings callbacks stable.
- Preserve `settingsOpen`, `MobileGUI`, `MobileGUIStack`, `MobileSideBar`, and `SettingsMenuIndex` behavior.
- Keep waifu/waifu-mobile variants, existing custom chat backgrounds, streaming/chat controls, all translated text, themes, focus, reduced motion, and touch use working.

## Execution

1. **Integrate the shell — primary owner**
   - Review `src/App.svelte` runtime desktop/mobile branch points; make only integration changes necessary to preserve the visual hierarchy when `DynamicGUI` changes.
   - Review `src/styles.css` and `src/ts/gui/colorscheme.ts`; retain the already-applied Neon Relay tokens, but remove any broad decorative effect that conflicts with the correspondence-desk design.

2. **Create the desktop navigation desk — sidebar worker**
   - In `src/lib/SideBars/Sidebar.svelte`, distinguish the global signal rail from the conversation/context deck using current markup and controls, rather than introducing new navigation state.
   - Active navigation and active conversation get the cyan relay edge. Inactive items are quiet. Keep drag/drop, settings, quick settings, character configuration, and desktop narrow-mode behavior intact.

3. **Create the reading and writing stage — chat worker**
   - In `src/lib/ChatScreens/ChatScreen.svelte` and `DefaultChatScreen.svelte`, establish the calm conversation header, bounded reading column, message hierarchy, and persistent composer dock shown in the mockup.
   - Use `Chats`, `Chat`, and `AssetInput` unchanged; styling/layout only. Keep waifu branches and existing overlay menus unchanged.

4. **Create a settings workspace — settings worker**
   - In `src/lib/Setting/Settings.svelte`, give the existing settings index and current page a clear desk/workspace composition: persistent active location, contextual page heading, and meaningful section rhythm.
   - Do not rename page labels, alter the menu-index mapping, or modify child setting components unless a small wrapper-level class is strictly needed.

5. **Create the mobile correspondence surface — mobile worker**
   - In `src/lib/Mobile/MobileHeader.svelte`, `MobileBody.svelte`, `MobileFooter.svelte`, and `MobileCharacters.svelte`, establish a single compact mobile stage with persistent context, thumb-reachable actions, and active relay edge.
   - Do not take ownership of `ChatScreen.svelte` or `Settings.svelte`; mobile must consume their stable interfaces and avoid horizontal overflow.

6. **Review and validate — primary owner**
   - Resolve visual seams at desktop/mobile breakpoints without crossing worker ownership except through focused integration fixes.
   - Run `pnpm check`, `pnpm test`, `pnpm build`, and `git diff --check`.
   - Browser-verify onboarding, desktop conversation, sidebar selection, settings navigation, popup/alert, narrow viewport, and light/custom schemes. Check browser console/network for runtime errors.

## Delegation

| Worker profile | Exclusive write scope | Validation evidence |
| --- | --- | --- |
| `power` | `src/lib/SideBars/Sidebar.svelte` | `pnpm check`; desktop selection / drag-drop smoke test |
| `power` | `src/lib/ChatScreens/ChatScreen.svelte`, `src/lib/ChatScreens/DefaultChatScreen.svelte` | `pnpm check`; desktop chat/composer smoke test |
| `default` | `src/lib/Setting/Settings.svelte` | `pnpm check`; settings navigation smoke test |
| `default` | `src/lib/Mobile/MobileHeader.svelte`, `src/lib/Mobile/MobileBody.svelte`, `src/lib/Mobile/MobileFooter.svelte`, `src/lib/Mobile/MobileCharacters.svelte` | `pnpm check`; narrow viewport smoke test |

The primary agent exclusively owns `src/App.svelte`, `src/styles.css`, `src/ts/gui/colorscheme.ts`, shared primitives, conflict resolution, integration, the final diff review, and final validation. The design interfaces are settled by the approved visual proposal. Each worker has an exact isolated scope; no worker may change stores, APIs, dependencies, or Git state.

## Manual acceptance

1. Onboard as `Verifier`; the welcome flow completes and remains readable/focusable.
2. Open a desktop conversation; the signal rail, character library and chat stage are visibly distinct, with readable custom backgrounds.
3. Select a conversation and tab through its controls; cyan marks location/focus, focus rings remain visible, and the compose/send action is unambiguous.
4. Open at least two Settings sections; active section is evident and the content reads as a focused workspace rather than a field wall.
5. At a narrow viewport, visit characters, chat, and settings; no horizontal overflow, clipped actions, or lost context.
6. Switch to light and custom schemes; structural hierarchy, contrast, and focus remain visible.

## Completion bar

Do not commit or create a PR. Report readiness only after all checks pass and the browser review above is complete.
