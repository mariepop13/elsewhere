# Align the product with the approved correspondence visual

## Source of truth

The approved visual reference is [`elsewhere-correspondence-design-proposal.html`](./elsewhere-correspondence-design-proposal.html), including the user’s annotations:

1. Use **ELSE//WHERE** in the rendered visual identity where the mockup presents it; application/package identifiers and persisted data stay unchanged.
2. Reproduce the narrow vertical signal rail shown by `◎`, `⌕`, `≡`, and `⚙` using the application’s real accessible controls and existing navigation actions.
3. Reproduce the **Conversations / Recently active** context library using real characters and chats, never placeholder Airisu/Notes/Archive data.

The current branch contains a token pass and several interpretation-led compositions. They are not acceptance evidence. This work aligns the actual production shell to the approved reference’s layout and hierarchy rather than continuing colour-only changes or a separate RisuRealm concept.

## Invariants

- Do not change providers, storage, character/chat ordering semantics, translations, API/component public props, custom backgrounds, or theme-selection persistence.
- Preserve the existing accessible functional controls behind the reference glyphs: home/character access, search/menu, and settings remain their current actions with visible names/tooltips/ARIA labels.
- Use real character and chat data. An empty library must state the real empty condition and offer an existing action; it must not fabricate conversations.
- Preserve desktop narrow/overlay behavior and the mobile shell’s separate navigation model.
- Do not rename the Risuai package, stores, paths, or persisted branding identifiers. This is visual copy only.

## Implementation

1. **Make the desktop shell structurally match the mockup**
   - In `src/lib/SideBars/Sidebar.svelte`, implement the reference geometry: a 58px signal rail and a 194px context deck at normal desktop density. Respect the existing user-controlled expanded-sidebar path rather than silently deleting it.
   - Replace the generic welcome treatment with the ELSE//WHERE visual wordmark. Recompose the context deck around an actual `Conversations` / `Recently active` library using `charImages`, existing avatar assets, and existing character selection behavior.
   - In `src/lib/SideBars/SideChatList.svelte`, make the selected character’s real `chara.chats` list visually read as the active thread library, retaining `changeChatTo()` and current ordering/drag behavior.

2. **Make the chat stage match the mockup**
   - In `src/lib/ChatScreens/ChatScreen.svelte` and `DefaultChatScreen.svelte`, align the compact character/chat header, bounded message reading column, and composer dock to the reference. The header is context, not a new navigation system.
   - Preserve `Chats`, `Chat`, `AssetInput`, streaming, waifu modes, overlay menus, existing message styles, fixed composer logic, and custom backgrounds. Do not insert mock conversation content.

3. **Align settings and mobile to the same system**
   - In `src/lib/Setting/Settings.svelte`, make the existing `SettingsMenuIndex` navigation visibly correspond to the reference’s index deck/workspace pair, including ELSE//WHERE visual identity only where the mockup shows it.
   - In `src/lib/Mobile/MobileHeader.svelte`, `MobileBody.svelte`, `MobileFooter.svelte`, and `MobileCharacters.svelte`, make the active context, selected edge, and single-stage layout express the same hierarchy without copying the desktop two-column library onto small screens.

4. **Integrate and remove drift**
   - Primary owner reviews current uncommitted visual changes. Remove or adapt only changes that conflict with the approved reference; do not delete user-owned work.
   - Verify the desktop default state, an existing selected character with real chat threads, settings, and mobile against the reference side-by-side. No claim of visual alignment without screenshots of both desktop chat and settings.

## Delegation

The dedicated Orca worktree and feature branch already exist:

- Worktree: `/home/marie/orca/workspaces/elsewhere/feature-neon-relay-application`
- Branch: `feature/neon-relay-application`

After approval, dispatch these settled, disjoint workspace-write contracts through **Pi Model Manager**. No task may modify stores, APIs, dependencies, Git state, or a path owned by another worker.

| Worker profile | Objective | Writable scope | Excluded scope | Verification |
| --- | --- | --- | --- | --- |
| `power` | Match real rail, context deck, and thread library to the desktop reference | `src/lib/SideBars/Sidebar.svelte`, `src/lib/SideBars/SideChatList.svelte` | chat screens, settings, mobile, stores | `pnpm check`; selected-character screenshot shows 58px rail, 194px library and active real thread |
| `power` | Match the real conversation stage and composer to the reference | `src/lib/ChatScreens/ChatScreen.svelte`, `src/lib/ChatScreens/DefaultChatScreen.svelte` | sidebar, settings, mobile, message logic children | `pnpm check`; selected-character screenshot shows header, reading column and composer dock |
| `default` | Match index/workspace settings and narrow mobile hierarchy to the reference | `src/lib/Setting/Settings.svelte`, `src/lib/Mobile/MobileHeader.svelte`, `src/lib/Mobile/MobileBody.svelte`, `src/lib/Mobile/MobileFooter.svelte`, `src/lib/Mobile/MobileCharacters.svelte` | sidebar/chat screen/setting children/stores | `pnpm check`; settings desktop and narrow-mobile screenshot show active context and no horizontal overflow |

**Primary owner:** `src/App.svelte`, `src/styles.css`, `src/ts/gui/colorscheme.ts`, `src/lib/UI/Realm/**`, shared primitives, integration, conflict resolution, visual review, final validation, and any removal of prior drift. These are coupled surfaces and remain local. Existing inactive terminals may be used only after the Plannotator approval; writers must return a concise evidence-first delivery report.

## Acceptance procedure

**Preconditions:** run `VITE_RISU_LEGAL_CONFIGURED=TRUE pnpm exec vite --host 0.0.0.0 --port 5175` in this worktree. Use existing non-sensitive local data; do not send a provider request, add keys, or edit character content.

1. At desktop width, open the unselected default view. Expected: a narrow signal rail, an ELSE//WHERE context deck, and the application stage occupy distinct columns; the context deck is not an oversized empty welcome panel.
2. Select an existing character, then switch one existing chat thread in its library. Expected: real names/chats appear under Conversations / Recently active; the selected thread has the cyan relay edge; switching still uses existing chat behavior.
3. Inspect the selected character’s stage. Expected: compact context header, bounded readable messages, and a persistent composer dock; no mock messages or new chat state appears.
4. Open Settings and switch two existing categories. Expected: ELSE//WHERE visual identity, index deck, selected cyan edge, and a focused workspace are all visible; settings values do not change.
5. At narrow width, open characters, a selected conversation, and Settings. Expected: one stage, no horizontal overflow/clipped controls, and an active context indicator.
6. Switch to one existing light/custom scheme and tab through a rail item, thread, input, and primary action. Expected: structural hierarchy persists, and focus/contrast remain visible.

## Completion bar

Run `pnpm check`, `pnpm test`, `pnpm build`, and `git diff --check` after integration. Capture desktop-chat and settings screenshots from the local browser, compare them to the approved reference, and report any remaining mismatch as partial—not as complete. Do not commit or create a PR.
