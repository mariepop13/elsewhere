# Realm correspondence-desk recomposition

## Goal

Make the existing Realm character-discovery surface visibly read as a correspondence desk rather than the current centered search-plus-identical-card layout. Preserve all data loading, labels, event handlers, modal behavior, and component APIs.

## Design decision

- **Subject and job:** Realm helps someone locate a character to begin or continue a long-lived conversation. Its job is orientation and deliberate browsing, not a dense marketplace.
- **Desk composition:** on desktop, use a narrow context index at the left and a broad browsing stage at the right. The header establishes the current task; search is anchored as a stage tool; results are editorial rows rather than a grid of equal cards.
- **Hierarchy:** use the existing semantic theme tokens only: elevated surfaces for the index/tool bar, action for the search affordance, focus for active filter/location, ambient for no ordinary navigation state.
- **Typography:** retain the existing application typeface. Use size, weight, alignment, and short contextual labels already available in the component; introduce no decorative marketing copy or invented controls.
- **Mobile:** collapse the desktop index into the existing horizontal filter affordance, retain the full-width result list, and keep all controls reachable without horizontal layout breakage.

### Self-critique

The correspondence reference contains a global rail and a separate library, but this scope owns only Realm. Adding fake global navigation would invent controls and misrepresent app navigation. The implementation instead expresses the same rail/context/stage relationship locally: a real filter index (only existing filters) and an editorial discovery stage (only existing result actions). It avoids grids, per-item halos, and a generic card kit.

## Implementation

1. In `src/lib/UI/Realm/RealmMain.svelte`, replace the centered search/filter/result composition with a responsive desk shell:
   - a title/context header using existing `language.recommended` and current result/filter state;
   - an anchored search and menu tool bar retaining the existing query and callbacks;
   - a desktop contextual filter index containing the existing NSFW and sort controls, with clear active state; retain the current compact mobile cycling behavior;
   - a broad stage that renders the same `charas`, pagination, `hubAdditionalHTML`, `RealmPopUp`, and import overlay without data or event changes.
2. In `src/lib/UI/Realm/RealmHubIcon.svelte`, turn each result into an editorial list row with an image/identity column, readable description/tag context, and a restrained metadata/action edge. Retain the existing main click action, nested explanatory icon actions and propagation behavior, image-hide behavior, and responsive full-width usability.
3. Use local CSS/classes in these files for responsive grid-to-stack behavior, visible `:focus-visible` styling, and token-derived overlay/panel treatments. Do not introduce dependencies, state, labels, API calls, or changes outside the two components.

## Delegation

After approval, dispatch one bounded writer task for `src/lib/UI/Realm/RealmHubIcon.svelte` only. The worker owns its full file, preserves the settled props and event behavior, and validates with `pnpm check` plus the component diff. The primary agent retains `RealmMain.svelte`, integration, visual review, and final validation. The files have no write overlap; the parent/component interface is already settled (`onClick`, `chara`).

## Validation

1. Run `pnpm check` and `git diff --check -- src/lib/UI/Realm/RealmMain.svelte src/lib/UI/Realm/RealmHubIcon.svelte`.
2. Inspect the owned diff to confirm `getRisuHub`, `changeSort`, pagination, `RealmPopUp`, `alertInput`, and image/metadata icon behavior are unchanged.
3. Manual acceptance (requires a local app and non-sensitive test data): open Realm at desktop width; search for an existing character name and submit; select Recent, Trending, Downloads, Random, and NSFW; inspect the active filter rail and editorial result rows; open one result and each available metadata icon; open Menu and use **Import Character from URL or ID** with a safe test identifier. At mobile width, repeat search and filter cycling, then verify the rows remain full width and focus is visible when tabbing through the search, filters, result, and menu controls.

## Risks

- The exact Realm entry route is app-state-driven, so browser verification must use the existing UI route rather than an invented URL.
- `hubAdditionalHTML` remains externally supplied and may not follow the new composition; it is intentionally preserved to avoid changing its contract.
