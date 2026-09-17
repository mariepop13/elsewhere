# Neon Relay application-wide visual system

## Context and decision requested

The existing `cyberpunk-onboarding-proposal.html` explicitly limited Neon Relay to `WelcomeRisu.svelte`. The new request extends that direction across the application. This plan interprets **everywhere** as the end-user production interface: onboarding, desktop chat, sidebar, settings, shared buttons/inputs, dialogs and alerts, and the mobile shell. It excludes plugin-defined UI, third-party/editor surfaces, `Playground/`, and `LiteUI/`, which have independent presentation contracts.

**Theme decision (approval required):** preserve the existing theme selector and custom color editor. Add Neon Relay as the fork's default visual system for fresh/no-scheme users and make all new structural accents responsive to the active theme tokens where contrast requires it. Do not silently overwrite a saved custom or alternate colour scheme. This gives the product a coherent default without invalidating user customisation.

## Design direction

**Audience and job:** people building long-lived AI conversations; the interface should feel like a calm creative console, with a clear information hierarchy during extended reading and configuration.

### Token palette

| Token | Value | Role |
| --- | --- | --- |
| Signal night | `#0A0B1D` | primary canvas |
| Deep relay | `#11142F` | elevated surfaces |
| Voltage violet | `#6D5DFB` | primary actions and selection |
| Relay cyan | `#28D7C5` | focus, active rail, live presence |
| Afterglow pink | `#F45B9A` | rare ambient accent only |
| Ice text | `#F5F7FF` | primary reading text |

Keep the existing UI typeface; reserve the system monospace stack for terse status labels or wordmarks, never for paragraphs. Use translucent layered panels, a cyan functional rail for selection/focus, and violet for primary action. Ambient glows/grids belong only to broad backgrounds and must not compete with conversation text. All motion remains interaction-led and respects `prefers-reduced-motion`.

### Layout treatment

```text
Desktop:  [ navigation rail ] [ reading/workspace ]
Mobile:   [ compact signal header ]
          [ single reading/workspace column ]
Overlays: [ dim backdrop ] [ elevated relay panel ]
```

The chat remains content-first: message legibility, controls, and user-created backgrounds retain priority. The update does not introduce a decorative grid behind active conversation text.

## Invariants and non-goals

- Preserve all navigation, chat processing, storage, provider configuration, translations, accessibility settings, custom CSS, and user-selected theme behavior.
- Preserve the existing Svelte component APIs; this is a visual-only update.
- Retain visible keyboard focus, semantic controls, disabled states, and contrast-safe text on both dark and light/custom themes.
- Do not add a dependency, change persisted schema, or change the visual contract of plugin-defined components.
- Do not restyle `Playground/` or `LiteUI/` in this delivery.

## Implementation plan

1. **Establish a theme-safe Neon Relay foundation**
   - Update `src/ts/gui/colorscheme.ts` and `src/styles.css` to expose the Neon Relay default/preset and semantic CSS variables for canvas, elevated panel, subtle panel, action, focus, and ambient accents.
   - Map Tailwind theme aliases to semantic variables so shared components never need fixed gray/zinc/blue/pink utility colours for ordinary UI states.
   - Define global focus, selection, form-control, scrollbar, reduced-motion, and overlay treatments. Use `color-mix()` only where it has a token fallback or browser support is already established by the project.
   - Keep alternate/custom schemes functional: semantic structural values derive from their existing theme variables rather than resetting a user's saved colors.

2. **Restyle reusable controls and overlays before page-specific surfaces**
   - Update `src/lib/UI/GUI/Button.svelte`, the input/select/textarea/segmented-control components in `src/lib/UI/GUI/`, `src/lib/UI/BaseRoundedButton.svelte`, popup infrastructure, and `src/lib/Others/AlertComp.svelte` to consume the semantic tokens.
   - Replace hard-coded neutral/blue/zinc states in these shared production primitives with theme-aware classes/variables. Standardize hover, selected, disabled, destructive, and `:focus-visible` behavior.
   - This establishes the visual contract inherited by settings and most modal/popup flows without duplicating component-local styling.

3. **Apply the system to the desktop conversation workspace**
   - Update the desktop navigation and character-selection shell (`src/lib/SideBars/Sidebar.svelte` and its directly owned visual children), `src/lib/ChatScreens/ChatScreen.svelte`, `DefaultChatScreen.svelte`, `Chat.svelte`, and chat-adjacent lists/popups.
   - Add the restrained console structure: layered nav surface, clear active character/chat rail, elevated composer/action region, and readable message controls. Preserve all chat modes, user custom backgrounds, character display modes, and streaming behavior.
   - Convert remaining hard-coded generic gray/blue neutral UI states in these paths to the semantic system; leave user message/character content styling alone.

4. **Apply the system to settings and mobile shells**
   - Update `src/lib/Setting/Settings.svelte` and shared setting wrappers, then apply the same navigation/selection and control states to `src/lib/Mobile/MobileHeader.svelte`, `MobileBody.svelte`, and `MobileFooter.svelte`.
   - Ensure desktop settings and mobile navigation communicate selection consistently, with responsive single-column layouts and no loss of readable contrast.
   - Keep individual provider-specific setting pages visually inherited through shared wrappers unless an audit identifies a hard-coded control that breaks the contract.

5. **Integrate, audit, and verify the real surface**
   - Inspect all touched diffs for logic/persistence changes, unthemed hard-coded generic controls, keyboard focus regressions, and visual conflicts with custom backgrounds/custom CSS.
   - Run `pnpm check`, `pnpm test`, and `pnpm build` after integrating. Resolve styling/type failures before browser verification.
   - Run the Vite app and use the real browser surface to verify onboarding; normal desktop chat with/without a character; sidebar selection; settings navigation and controls; an alert/modal; and the mobile responsive layout. Exercise both the Neon Relay/default and an existing light/custom scheme.

## Delegation

A dedicated Orca-managed feature worktree is required before implementation; this repository is currently on the shared `develop` worktree and must not be edited for this delivery. Copy this approved plan into the target worktree, confirm its feature branch, and obtain approval there before dispatching writers.

After the target-worktree approval, dispatch only these independent, disjoint writer scopes:

| Task | Target / worker | Exclusive write scope | Verification evidence |
| --- | --- | --- | --- |
| Semantic tokens and Neon Relay preset | Pi Model Manager / `default` | `src/styles.css`, `src/ts/gui/colorscheme.ts` | `pnpm check`; inspect token mapping and existing custom-preset path |
| Shared controls and overlays | Pi Model Manager / `default` | `src/lib/UI/GUI/**`, `src/lib/UI/BaseRoundedButton.svelte`, `src/lib/UI/Popup*.svelte`, `src/lib/Others/AlertComp.svelte` | `pnpm check`; inspect focus, disabled and destructive states |
| Desktop navigation/workspace | Pi Model Manager / `power` | `src/lib/SideBars/**`, `src/lib/ChatScreens/**`, excluding paths in the previous row | `pnpm check`; browser desktop chat/sidebar flow |
| Settings and mobile shell | Pi Model Manager / `default` | `src/lib/Setting/**`, `src/lib/Mobile/**` | `pnpm check`; browser settings and narrow viewport flow |

The primary agent owns requirements, semantic-token interfaces, integration, conflict resolution, code review, and final browser validation. Each worker must stop and report if a shared primitive needs a change outside its ownership; it must not modify source outside its exclusive scope.

## Manual acceptance procedure

**Preconditions:** run the local app with non-sensitive local data. Use a disposable provider configuration if setup requires credentials; do not place API keys in screenshots or reports. Have at least one character/chat available for the desktop-chat checks.

1. Open the app without a saved alternate scheme, or select the Neon Relay/default scheme in **Settings → Display**. Expected: onboarding and the application shell use the dark navy canvas, violet primary actions, cyan functional focus/selection rail, and readable ice text.
2. Complete or revisit onboarding through language, provider, chat-type, memory, and name/input steps. Expected: each option has visible hover and keyboard focus; the selected/primary control is clearly distinct; the layout remains usable at a narrow viewport; no onboarding action changes behavior.
3. Open a normal desktop chat, select characters/chats in the sidebar, send no real provider request, and focus the composer and its controls with the keyboard. Expected: active navigation is visible, text remains the visual priority, controls have a visible focus state, and custom chat backgrounds/character display modes are not obscured by decorative effects.
4. Open **Settings**, navigate multiple categories, alter no persisted configuration, and open one representative popup or alert. Expected: navigation selection, controls, overlays, cancel/destructive states, and disabled controls are legible and visually consistent.
5. At a mobile-width viewport, navigate from the mobile header to chat, menu, and settings. Expected: one-column layout, usable touch targets, and no clipped header/control text.
6. Switch to an existing light preset and a custom scheme if available, then repeat a focused button/input/settings navigation check. Expected: semantic styling follows the selected theme without low-contrast text, invisible focus, or forced Neon Relay palette overrides.
7. Enable OS/browser reduced motion and reopen onboarding plus a modal. Expected: no non-essential animation obscures the flow; open/close states remain perceptible.

## Risks

- The repository contains many component-local hard-coded colors, including specialized modals. The phased shared-control approach covers common paths but a post-integration audit is required to avoid claiming all plugin/development surfaces are restyled.
- Theme users can set arbitrary custom colours; contrast cannot be guaranteed for deliberately low-contrast custom inputs. The implementation must preserve current behavior and avoid making it worse.
- Browser real-surface verification requires a local app that can reach the chosen screen without exposing credentials.
