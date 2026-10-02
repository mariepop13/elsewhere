# Model token limits

Branch: feature/model-token-limits
Worktree: /home/marie/code/elsewhere.worktrees/feature-model-token-limits
Base: origin/develop, 15e9311bc6167df3a8485c99fe73537c286e7386

## Goal and constraints
Resolve context/output capabilities for the selected model across chat, auxiliary requests and translation. Preserve user values on model changes, presets, imports and migrations. Reject invalid budgets before transport, with no silent clamping. Distinguish total context from input-only limits, completion (including reasoning) limits and provider routing metadata. Unknown/custom metadata stays unknown. Do not alter Social or Elsewords, shared dependencies, other checkouts, deployed previews, credentials, or Git delivery state.

## Plan
1. Inventory settings, central request resolution, provider payload overrides and preset normalization.
2. Add a pure detached capability and budget contract, backed by public metadata and documented native model entries.
3. Integrate reactive settings hints/maxima and central plus final payload checks.
4. Add fixtures for known/unknown/alias/routing budgets, preset/import/migration preservation and reasoning constraints.
5. Validate with private dependencies, focused/full tests, pnpm check and serialized build; obtain independent read-only review and UI acceptance.

## Evidence and open decisions
LLMModel has no capacities; OpenRouter discards completion/provider/alias metadata. Social handoff recommends a detached additive API and explicitly unknown route coverage. Translation has a static 2048 maximum. Chat reserves output in total-context accounting but later silently reduces its output budget.

## Implementation and validation outcome
- Completed the shared detached capability contract, public OpenRouter cache/catalogue, reactive context/output/reasoning inputs, primary/auxiliary/translation resolution, and final payload guards including custom parameter overrides and tool continuations.
- Unknown IDs/custom endpoints remain unknown. Native entries are exact IDs with official sources; public OpenRouter aliases and eligible endpoint metadata are resolved without pinning or altering routing.
- Application context reserves output. Input-only provider context is distinct. User values survive model/preset/import/migration changes. Invalid budgets produce actionable errors before HTTP rather than clamps/retries.
- Final automated suite: 36 files, 356 passed, 3 skipped (359 total). Log: /tmp/model-limits-tests-final.log. Type check before visual acceptance: zero errors/warnings, /tmp/model-limits-check-final.log.
- Independent read-only review completed; all concrete findings repaired. Last UI-only delta (absent/null reasoning budget stays disabled) independently reviewed with no blocker.
- Live acceptance used the actual application on a new isolated localhost:5198 profile and direct private Vite launcher. No generation/API key entry. Default unknown Claude/Gemini IDs showed Unknown; changing to documented GPT-5.5 updated capabilities. An output of 200000 remained intact with explicit max128000/context errors. Switching auxiliary to Gemini2.5Flash retained it and additionally showed max65536. User correction to4096 persisted after primary model change/reload.
- Gemini2.5Flash displayed input-only context1048576/output65536. Explicit reasoning activation set dynamic -1 without an error; 30000/30001 stayed intact and produced a range error. Absent budget was initially wrongly checked; corrected without mutating stored values and verified live disabled/error-free.
- Mobile acceptance at390x844 after page reload (responsive mode is initialized on startup): real settings navigation, wrapped hints/fields and reasoning error. Merely resizing an already desktop-initialized page retains desktop mode; mobile test therefore used reload.
- Translation Ax.Model preset resolved auxiliary Gemini capability, retained70000 and displayed output65536 error. Auto translation stayed off; no translation request.
- Live OpenRouter route/offline, custom overrides, preset import/export and provider payload transport were not exercised in browser; mock fixtures cover these paths. Media costs remain an explicitly approximate local estimate.
- Screenshots were inspected through the browser tool during desktop overflow, mobile and translation acceptance. Main test tab closed and viewport reset. Initial failed connection tab is temporary and scheduled for automatic closure at turn end; manual retrieval/close was blocked by browser data-URL policy.
- Initial Vite launch hit EMFILE watchers; polling was enabled only via process environment. Private preview PID1437420 stopped, session exit130. No host/project watcher config was changed.
- Full production build did not complete (log ended Killed; exact cause unconfirmed). It was stopped and is suspended per parent instruction pending CI strategy/publication authorization. Do not claim production build validated.

## Handoff
No commit, push, PR, merge or deployment authorized or performed. Work remains uncommitted on feature/model-token-limits. Dependencies and store are private. Retain this plan. Final UI typecheck log: /tmp/model-limits-check-ui-final.log.
