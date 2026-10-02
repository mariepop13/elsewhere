# Neon Relay structural redesign

## Why this supersedes the visual pass

The current work introduces Neon Relay tokens and colours across the existing interface. That is necessary foundation work, but it does not meet the clarified request: the application needs a **new design**, not just a new colour scheme. This plan keeps that foundation and changes the layout, hierarchy, density, and interaction presentation of the production UI without changing chat, storage, provider, or settings logic.

## Art direction

Elsewhere is a personal conversation console, not a generic settings-heavy admin app. The new design uses one memorable structural device: a **relay spine** — a narrow cyan active edge that connects navigation, the current conversation, and action surfaces. Violet is reserved for commits/actions; pink remains ambient only. Surfaces are offset, not uniformly carded: the chat stays open and readable while tools form deliberately layered decks.

```
Desktop
┌ signal rail ┐┌ context deck ┐┌──────────────── reading stage ───────────────┐
│ icons/status││ character/   ││ compact conversation header                   │
│ quick action││ chat index   ││ messages: wide, calm reading column           │
│             ││              ││ composer dock with explicit send action        │
└─────────────┘└──────────────┘└─────────────────────────────────────────────┘

Settings
┌ index deck ┐┌────────────────── focused settings workspace ──────────────┐
│ wordmark   ││ section title + contextual introduction                    │
│ categories ││ grouped setting rows, not a field wall                      │
└────────────┘└─────────────────────────────────────────────────────────────┘
```

## Invariants

- Preserve every interaction, store, translated label, provider workflow, custom background, theme selector, and persisted value.
- Keep content and chat messages user-owned; do not restyle their semantic markdown as decorative UI.
- Retain keyboard access, visible focus, reduced-motion support, touch usability, and light/custom theme compatibility.
- No dependencies, routes, persistence migrations, or component public API changes.

## Structural implementation

1. **Desktop shell and chat stage**
   - Recompose `src/lib/SideBars/Sidebar.svelte` and its visual children into a narrow fixed signal rail plus a distinct context deck. Make selection structural with the relay spine rather than a background-colour swap.
   - Recompose `src/lib/ChatScreens/ChatScreen.svelte`, `DefaultChatScreen.svelte`, `Chat.svelte`, and `ChatBody.svelte`: establish a compact conversation context bar, a readable bounded message stage, clear author/control hierarchy, and a docked composer/action plane. Use spacing, boundaries, and alignment instead of adding decorative cards around every message.
   - Preserve Waifu, WaifuMobile, custom background, streaming, partial-edit, and character modes.

2. **Settings workspace**
   - Recompose `src/lib/Setting/Settings.svelte`, `SettingRenderer.svelte`, and setting wrappers into a navigable index deck plus a focused workspace: visible selected section, contextual section header, grouped controls, and consistent action/footer placement.
   - Reduce the impression of a long form by creating meaningful section rhythm in existing wrappers; do not rename or reorder persisted settings.

3. **Mobile composition**
   - Recompose `src/lib/Mobile/MobileHeader.svelte`, `MobileBody.svelte`, `MobileFooter.svelte`, and `MobileCharacters.svelte` for a deliberate mobile navigation hierarchy: persistent context strip, selected-state relay edge, comfortable control spacing, and a single content stage.
   - Verify at a narrow viewport that controls do not clip or require horizontal scroll.

4. **Shared components and overlays**
   - Adjust only the shared primitives necessary to support new shell geometry — panel, button, input, popover and alert composition — in `src/lib/UI/GUI/**`, `BaseRoundedButton.svelte`, `Popup*.svelte`, and `AlertComp.svelte`.
   - Do not turn this into another colour-only sweep. Each shared change must support one of the layouts above.

5. **Integration and visual acceptance**
   - Review each structural diff for logic/API changes and remove incidental colour-only churn that does not serve the redesigned compositions.
   - Run `pnpm check`, `pnpm test`, `pnpm build`, and `git diff --check`.
   - In the actual browser, inspect onboarding, main desktop shell, sidebar selection, a selected chat/composer, settings index/workspace, alert/popup, mobile width, and one light/custom scheme. Capture screenshots for visual review before declaring it ready for commit.

## Delegation

After approval, only disjoint scopes may run in parallel:

| Worker | Exclusive write scope | Evidence |
| --- | --- | --- |
| Desktop design worker (`power`) | `src/lib/SideBars/**`, `src/lib/ChatScreens/**` | `pnpm check`; desktop browser flow |
| Settings design worker (`default`) | `src/lib/Setting/**` | `pnpm check`; settings browser flow |
| Mobile design worker (`default`) | `src/lib/Mobile/**` | `pnpm check`; narrow-browser flow |
| Shared-geometry worker (`default`) | `src/lib/UI/GUI/**`, `src/lib/UI/BaseRoundedButton.svelte`, `src/lib/UI/Popup*.svelte`, `src/lib/Others/AlertComp.svelte` | `pnpm check`; popup/focus flow |

The primary agent owns visual direction, interfaces between these scopes, integration, diff review, browser acceptance, and release readiness.

## Manual acceptance procedure

**Preconditions:** use the local browser profile only; do not enter provider keys or sensitive chat content. Choose a disposable test profile or data set.

1. Complete onboarding with the test name `Verifier`; expected: the setup conversation remains functional and visually reads as a relay console, with a clear action plane and visible keyboard focus.
2. On desktop, open the main shell and select a character/chat. Expected: the signal rail, context deck, and message stage are visibly distinct; active selection uses the relay spine; custom backgrounds stay readable.
3. Focus the composer and message actions with Tab. Expected: every control has a visible focus indicator and the composer/send hierarchy is clear.
4. Open Settings and move through at least two categories. Expected: the index deck identifies the active category and the workspace has a contextual heading and grouped controls.
5. At mobile width, navigate character list, chat, and settings. Expected: one content stage, no clipped controls, no horizontal overflow, and an active relay edge.
6. Switch to a light/custom scheme. Expected: the structural hierarchy persists and text/focus remain visible without forcing dark colours.

## Completion bar

The work is ready for commit/PR only after the browser visual review is approved and all automated checks pass. The prior colour-token pass alone does not satisfy this bar.
