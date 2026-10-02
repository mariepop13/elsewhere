# Optional social feed, first usable slice

Worktree: `/home/marie/Documents/Codex/2026-09-30/task-3/social-feed`.
Branch: `feature/social-feed`, initially based on clean `develop` at `7632682a`, synchronized by fast-forward first to `8a023262`, then to `origin/develop` at `15e9311` on 2026-10-01.

## Scope and decisions

- Opt-in fictional feed inside the existing app, with persisted user posts, likes and explicitly requested character reactions/comments.
- A first-slice limit of four existing character cards (not a permanent product limit) in a selectable cast. Reuse their stable IDs, names and images. Users write each public profile explicitly; card descriptions, chats, persona prompts, lore and memory are never copied into public generation.
- Reuse persona display names and images for post attribution. Snapshots preserve authors if cards/personas are renamed or removed.
- Public world and public profiles are inspectable and editable. No background generation, automatic retries, reputation, events, followers or progression.
- Atomic reaction batches, one response per actor per post. Cancellation, navigation and state replacement discard late results. Errors preserve posts and allow explicit retry.
- Persist in the existing database root, so normal autosave and full backups include the feed. Disabling preserves data.
- Reuse audited nonstreaming transports (OpenAI compatible, Anthropic, Gemini) with isolated public context. Other formats show an unsupported-model explanation.
- Character IDs and public interaction history form the basis for later relationships. No relation scoring in this slice.

## Verification

Local fixtures only. Focused tests cover privacy projections, validation, duplicate prevention, concurrent clicks, cancellation, navigation/state replacement, deletion and atomic errors. Run `pnpm check`, `pnpm test`, `pnpm build`, and `git diff --check` serially. Use a separate preview port; coordinate before interacting with the shared browser. No commit, push, issue, PR or deployment authorized.

## Validation evidence

- Type check: `node_modules/.bin/svelte-check --tsconfig ./tsconfig.json`, 0 errors and 0 warnings.
- Full test suite: `node_modules/.bin/vitest run --maxWorkers=1`, 32 files passed, 302 tests passed, 3 pre-existing skipped.
- Final affected tests after disabling OpenRouter fallback: `node_modules/.bin/vitest run src/ts/social src/ts/process/request/openAI/requests.social.test.ts --maxWorkers=1`, 23 passed.
- Build: `node_modules/.bin/vite build --sourcemap`, final build passed in 53.57 seconds. Existing CSS optimizer, externalized Node built-in, chunk-size and dynamic-import warnings remain.
- Formatting: existing local Prettier used on new TypeScript files; `git diff --check` clean. No Svelte Prettier plugin is installed; component formatting follows existing conventions.
- Browser: isolated Chromium profile, production UI via Vite, 18 scenarios passed. Seven requests intercepted locally, no paid provider calls. Private sentinel values absent from actual outbound payloads despite private globals, system replacement, prediction, schema and card/chat/persona fixture data. No JavaScript runtime errors. Unrelated HTTPS startup lookups deliberately blocked.
- UI scenarios: opt-in, casting/public profiles, posting without requests, generation, likes, cancellation, explicit error/retry, pause/re-enable, navigation, navigation during generation, actual mobile navigation, autosave/reload, 390px and 320px without overflow, deletion confirmation, older-backup replacement while mounted.
- Fresh independent read-only reviewer: no actionable findings after fixes.

Evidence directory: `/home/marie/Documents/Codex/2026-09-30/task-3/social-evidence` contains replay script, browser log, desktop/mobile PNGs and automated logs. Prepared Library upload was unavailable in the hosted helper; the direct host upload succeeded after parent coordination. Desktop: `libfile_39b32c521c7881918b80d840b682f15a` (`file_00000000878c81f58940d869e391e450`). Mobile reactions: `libfile_b89aaeef8ca48191af9dd5c90817d1e7` (`file_00000000cec881f5b61e9defd807e41f`).

## Boundaries and handoff

Native Tauri packaging, real-provider output quality/billing, non-audited transport formats and image asset deletion are not covered by these fixture tests. Existing database autosave was verified through an actual browser reload. Four actors is an MVP limit. Relationships beyond identity/history, reputation, events and followers/aura/progression are future work.

No commit, push, merge, PR, issue or deployment performed. `develop` and the routing worktree were not modified. Shared dependencies were read-only; their metadata/binaries and source lockfile retained earlier timestamps and source checkout remains clean. Package scripts were executed via their existing binaries because pnpm attempted automatic dependency verification; no dependency install or lockfile change occurred.

Retain this plan and the usage guide for review and handoff. Delivery status: Complete for the authorized fixture-validated web slice. Native and real-provider boundaries remain as stated above.


## Approved feed UX pass

- Keep the same optional state and generation semantics. Center the feed on existing card/persona portraits, compact reaction chips and short comment rows.
- Collapse **My universe** by default. Keep casting and public-profile/world editing there. Move privacy/cost/pause information into help.
- Show a compact **What’s new?** composer, expanding on activation. Closing or Escape preserves the draft and returns focus. Help supports Escape and returns focus to its native summary.
- Use theme surfaces and neutral low-opacity separators; no new assets or copied branding. Images use the existing character-image helper and its visibility setting, with initials for missing/broken assets.
- UX type check: 0 errors, 0 warnings. Full suite: 302 passed, 3 pre-existing skipped, 32 files passed. Fresh reviewer found two Escape gaps; both fixed and targeted rereview has no remaining finding.
- Browser fixture uses a fresh isolated profile and blocks service workers because Vite does not serve the production image worker routes. Existing PNGs are persisted with saveAsset; portrait rendering is checked before capture and after reload on mobile. No changes to shared browser or ports 6610/6602/4460/4461.

## Develop synchronization after PR 29

Parent reported merge commit `8a02326217a7c474fb9c57451d1ea664041d3a3a`. This worktree remains on its authorized clean base `7632682a`; the merge object is not present locally. Read-only comparison with the available PR snapshot `441ca4ec` found overlapping transport files `request.ts`, `google.ts`, and `openAI/requests.ts`. The changes appear logically compatible, with adjacent Google schema code requiring careful resolution. The new routing `globalApi.svelte.ts` must be revalidated with social isolation and cancellation. No dirty-worktree merge/rebase was attempted. Synchronize and rerun validation before publication.


UX browser result: 23 scenarios passed, seven locally intercepted requests, no JavaScript errors or private sentinel in actual payloads. Portrait images were visually inspected on desktop and mobile, including after autosave/reload. See `social-evidence/browser-ux-result.json` and replay `browser-ux.cjs`; the mixed diagnostic log retains preceding failed Vite/service-worker attempts.

Updated Library captures: desktop `libfile_9152f3904e94819198d18f0c18d8aa56` (`file_00000000e70c81f5974083c5672b2e99`); mobile reactions `libfile_c25a2a62f84c8191a0ba6859da4e66d5` (`file_00000000100481f5a83ed56f1738b161`). Both direct uploads confirmed succeeded and file identity xattrs were applied locally. Earlier captures remain as historical evidence.

Final UX build: `node_modules/.bin/vite build --sourcemap` passed in 2m 11s (exit 0), with existing CSS optimizer, externalized Node built-in, chunk-size/dynamic-import warnings and plugin-timing notices. Types 0/0, full suite 302 passed/3 skipped, diff whitespace check clean. Preview server stopped and port 6620 released. Final image-helper review: no finding.


## Authorized synchronization, 2026-10-01

The previously reported PR29 synchronization follow-up is resolved. `origin/develop` was fetched and verified at `8a02326217a7c474fb9c57451d1ea664041d3a3a`, containing only PR29 since the original base. PR30 is not part of this integration; its pending CI/approval is independent.

Safety and method:
- Snapshot all 20 modified/untracked files, their SHA-256 hashes, tracked base versions and binary diff in `../social-sync-backup`, and verify each copy.
- Precompute a three-version combination of tracked files. Overlap only in `request.ts`, `google.ts`, and `openAI/requests.ts`; no textual conflicts.
- Temporarily restore only the snapshotted tracked files to the old base, fast-forward the feature branch, then reapply the verified candidate files. Untracked files remain in place and retain their hashes. No stash, reset, rebase, branch switch, new local commit or history rewrite.
- Preserve Google OAuth providerFetch/abort and removed logs together with schema/publicOnly isolation; preserve OpenAI pipe promise handling/log cleanup; preserve dispatcher routing additions and public-only formatter/transport guards.

Compatibility context:
- Upstream backlog/roadmap: no changes. Dependencies, app entry points and social storage contract: unchanged.
- Adopt the merged authenticated Node routing and redacted logging via existing globalFetch/fetchNative callsites, rather than duplicating routing in the social adapter. Existing abort/interceptor signatures remain compatible.
- Ooba/Ollama/Horde changes are inherited but those formats remain outside the audited social format allowlist. No new social provider support is implied.
- No ownership conflict or blocked product decision found. Other worktrees and local develop are untouched.

Add three transport regression cases in `globalApi.svelte.test.ts`: isolated public calls skip private interceptors through Node/Tauri, outbound content remains the public body, diagnostics omit it and fake credentials, and Node cancellation interrupts a pending JSON body without a fallback request.

Synchronization validation:
- Focused social/routing tests: 5 files, 46 passed.
- Full suite: 34 files, 327 passed and 3 pre-existing skipped.
- Node provider proxy/fixture integrations: 23 passed using temporary localhost ports and fake credentials. Sandbox cannot bind sockets; the same command passed outside the sandbox.
- Fresh independent read-only integration review: no actionable finding.
- No commit, push, social PR or merge into develop is authorized or performed.


Final synchronized type check: 0 errors, 0 warnings. Browser acceptance on the synchronized branch: 26 scenarios passed, seven locally intercepted provider requests, no private sentinel in actual outbound payloads and no JavaScript errors. Added acceptance covers Escape from persona selector/Publish plus draft persistence across navigation and actual autosave/reload. Desktop and mobile screenshots are in `../social-sync-evidence`; mobile portraits and layout were visually inspected. The isolated Vite fixture disables service workers to exercise persistent local image storage without the production worker routes. Preview stopped and port 6620 released.

Evidence: `../social-sync-evidence/{check.log,focused-tests.log,tests.log,node-tests.log,browser-result.json,browser-sync.cjs,social-sync-desktop.png,social-sync-mobile-reactions.png}`. The user-facing launch command and acceptance steps remain in `docs/social-feed.md`. Tests use fictional cards/personas, fake provider credentials and local fixtures only. Live paid providers, native Tauri packaging and PR30 CI are outside this validation.

Source checkout still points to `7632682a`; no source files there were changed by this task. An untracked `.pnpm-store/` was observed in the shared source checkout during final inspection and left untouched. Only the social branch advances to the fetched develop commit.

Final synchronized build: `node_modules/.bin/vite build --sourcemap` passed (exit 0) in 42.13 seconds. Existing CSS optimizer, browser externalization, chunk-size/dynamic-import and plugin timing warnings remain. `git diff --check` is clean. Changed-file secret-pattern scan found only the existing Google PEM delimiter parser string, not a key or API token. Delivery status: Complete for the authorized synchronization and fixture-validated web slice. Native/real-provider boundaries remain as stated above.


## Pixel preview preparation, PR30 base

Authorization covers synchronization with merged PR30, revalidation, a temporary tailnet-only HTTPS preview on port 8443 and removal after Marie finishes testing. No publication, permanent deployment, paid calls or deletion of existing browser-origin data is authorized.

Read-only remote verification confirms `origin/develop` at `15e9311bc6167df3a8485c99fe73537c286e7386`. Snapshot 21 modified/untracked files and tracked base/candidate versions in `../social-pixel-backup`; SHA-256 verification succeeds. Only App.svelte and lang/en.ts overlap PR30, with a clean textual combination preserving the social entry and first-run/auth flows. Fast-forward and reapplication complete without new commits. Independent integration review finds no defect. No backlog/roadmap or dependency declaration changes.

Dependency isolation: local node_modules is a real directory with local .vite/.vite-temp caches; package links, .pnpm and .bin still target the shared source installation. Its wrappers changed since the last run. Read-only metadata confirms Vite 8.0.3, Svelte 5.55.1, svelte-check 4.3.5 and Vitest 4.1.2 are readable. Use direct Node package entry points, never pnpm exec/install, and never mutate shared packages or wrappers. Heavy builds must run sequentially with Elsewords.

Read-only preview preflight: ports 48765, 8443 and 6620 are free. Tailscale has only the existing HTTPS443 root proxy to localhost5173; preserve it. No route/process was opened at this stage.

PR30's private-local guard accepts only loopback browser hostnames. The Pixel URL hostname would fall outside it and render Legal before Social. A temporary preview needs an explicit separate mode restricted to the exact HTTPS origin and port8443, using the same App/bootstrap guard and preserving a descriptive local/preview notice; do not use the global legal-configured flag to bypass this gate. The configuration choice is pending a response. Production/private-local behavior must remain unchanged.

Proposed stable preview after validation: freeze the build in a separate preview runtime directory with its own save directory; launch the Node server bound to127.0.0.1 on6620 via a detached child with PID/start-time and ownership record, then add only Tailscale HTTPS8443 proxy to that loopback port. Do not use Funnel or install a persistent service. Keep it running after the Codex turn. Remove only the matching route/process after explicit end-of-test instruction. The8443 browser origin may contain earlier picker data; offer a private browser window and never clear it automatically. Prefer fictional cast and local provider fixtures for the first test.

PR30-base automated validation: direct Node svelte-check passes with0 errors/0 warnings; full Vitest suite36 files,331 passed/3 pre-existing skipped; Node proxy/fixture integrations23 passed. git diff --check clean. Logs in ../social-pixel-evidence. No paid call, heavy build or preview route/process opened. Status: Partial for Pixel preview, pending explicit configuration choice for the exact-origin preview mode, then build/browser acceptance/temporary route setup. Prior social code remains byte-identical to the precomputed integration candidate apart from this delivery record.


## Authorized temporary Pixel preview

The parent explicitly authorized the separate exact-origin preview configuration. `private-preview` requires both configured and runtime origin to equal `https://bella-felix.taila3974e.ts.net:8443`; normal private-local and production guards remain unchanged. App/bootstrap share the guard. A separate descriptive preview notice is required and writes only its acknowledgement, never contractual acceptance. Preview avoids registering the optional image service worker because its initialization stalled the HTTPS browser check; existing workers/caches are not unregistered or deleted. Independent read-only review finds no specific regression; an already-controlled browser tab may require a private window.

Final checks after that correction: svelte-check 0 errors/0 warnings; full Vitest 36 files,333 passed/3 existing skipped; production build passed in38.85s with existing dependency/CSS/chunk warnings; diff whitespace check clean. The local-acceptance command now uses private-local instead of the old legal-configured flag. No real provider calls or billing validation.

Runtime is separate at `../social-preview-runtime`, with frozen dist, own fictional save, local provider fixture on48765 and Node bound to127.0.0.1:6620. Detached process ownership records contain PIDs/start ticks/scripts; replacement of dist preserves these processes, saves and old content-addressed assets. Tailscale serves only HTTPS8443 for this preview. Existing HTTPS443 remains intact and no Funnel is enabled. Keep the runtime alive after this turn; run its ownership-checked cleanup.py only after Marie explicitly finishes. Preserve saved/browser data.

The initial HTTPS build returned200 but the UI check stalled at service-worker initialization. Keep that failed diagnostic separate from final acceptance. A fresh browser check of the corrected frozen build is in progress; do not yet claim Pixel UI acceptance. Fictional setup uses Mara,Jun,Sol and floating gardens. Bikini Bottom/Marie/Bob/Patrick/Carlo are manual guide examples only, never inserted into user data.


Final HTTPS acceptance: PASS. The subsequent diagnostic reached the normal home screen with no JS error; the classic mobile sidebar was collapsed. The replay now opens its existing top-left arrow before Social feed instead of waiting for an invisible navigation button. At390x844: Node authentication, preview notice, no tos4 acceptance, local publication without a request, two local fixture reactions with no private sentinel, like, decoded portraits/no horizontal overflow, and autosave/reload all pass. No JS errors. Visually inspected `../social-preview-evidence/preview-pixel.png`. Two fixture calls confirmed independently at localhost48765. Earlier failed browser logs remain diagnostics, not passing evidence.

Stable runtime ownership was rechecked in a separate command after browser completion: Node PID1141671 and fixture PID1141670 match recorded start ticks/scripts and remain alive. Existing443 route is byte-equivalent to the saved configuration;8443 targets loopback6620; Funnel is disabled. Logs and replay: `../social-preview-evidence/{check-final.log,tests-final.log,build-final.log,browser-preview-navigation.log,browser-preview.cjs,runtime-final.json}`.

Handoff: private tailnet URL `https://bella-felix.taila3974e.ts.net:8443/`, temporary fictitious-demo password `social-demo-8443`. Use a private browser window, continue after the preview notice, open the classic sidebar arrow, then Social feed. This frozen preview uses deterministic fixture responses, not real model quality. Do not clear previous origin data. Manual universe examples may use Bikini Bottom and the user's selected display identity; no personal setup was injected. Cleanup is deferred until explicit end-of-trial authorization. Remove the temporary exact-origin mode after that trial before future PR delivery. No commit/push/PR was performed.

Delivery status: Complete for this authorized web slice, PR30 synchronization and temporary fixture-backed HTTPS preview. Native Tauri packaging, actual Pixel device execution and live provider quality/billing remain unvalidated.


## Android notice and user-configured generation follow-up

Marie reported clipped notice text and requested real generation that she configures and triggers herself. Inspected Library screenshot5656.png after authenticated materialization, preserving its identity. Cause: vertically centered flex content taller than the Android viewport. Replace centering with a top-aligned scroll container constrained by100dvh, safe-area padding and wrapping; keep all disclosures. The preview text now explicitly permits selecting a real provider rather than requiring local fixtures.

The social adapter has no fixture override: it reads the current main chat model and normal provider settings. Do not read/change user keys or replace the current preview configuration. Add a visible selected-model name and Model settings action, opening the existing Chat Bot page. In classic mode closing settings returns to the still-open feed. In MobileGUI use existing header/footer settings navigation and return via its Social feed button. Cancel pending reactions before navigation. Add concise Node key-storage/provider public-data disclosure in help, and scroll that popover in small viewports. Document supported formats/custom API replacement and testing a changed model on a new post.

Checks: full suite36 files,334 passed/3 existing skipped, including a provider selection regression case; final types0/0. Corrected HTTPS notice/classic settings replay passes five viewport/font cases (320x460 at16/32px root font,390x600/440 at32px,390x844 at16px), fully reachable title/button and no overflow. Settings opens and returns, no provider request, no key values read or changed, no JS error or contract acceptance. Visually inspected top/bottom screenshots with doubled text.

An initial tool wait for the separate6621 mobile test launch was interrupted after no result. Inspection confirmed no log/process had been started; a subsequent owned launch succeeds. A fresh local browser database (not the preview save) validates MobileGUI settings/footer/return at390px with external requests blocked and0 JS errors. Its owned6621 Node process1164022 was stopped after success. No reserved/shared browser ports were touched. Independent read-only review of both navigation branches finds no defect. Final frozen preview rebuild/update follows, preserving8443 origin,443 route and existing user saves/settings.


Final follow-up build passes in36.74s with existing warnings. Frozen build replacement completes. The first raw HTML byte-hash comparison differs because the inherited Node server injects its platform flag. Comparing the correctly transformed local entrypoint against the HTTPS response now succeeds byte-for-byte. Detached process PID/start/script ownership remains valid;443 is unchanged and Funnel is disabled. Refresh does not touch the save or user provider configuration. Final evidence: `../social-preview-evidence/{browser-mobile-fix.log,browser-mobile-fix.cjs,browser-mobile-nav.log,browser-mobile-nav.cjs,notice-large-text-top.png,notice-large-text-bottom.png,mobile-fix-check.log,mobile-fix-tests.log,mobile-fix-build.log,mobile-fix-runtime-final.json}`. Complete for the authorized correction/user-configuration flow; real provider quality/cost and another physical Pixel test are for Marie to run herself. No paid agent call, key extraction, commit or push.


## Real OpenRouter failure, safe diagnostics follow-up

Marie reports failure on the public chocolate post using an OpenRouter model described as GLM flash. Exact slug and response status are not supplied. Do not guess the variant, read/extract keys, send another paid request, change provider configuration, or rewrite real publications. The existing screenshot's generic error alone cannot establish root cause.

Bounded server-log inspection outputs only allowlisted error-code counts (180 lines maximum), no raw content/headers: Node contains the previously observed forwarded-header limiter diagnostics and unknown client public-key entries; no retained HTTP/provider reply identifies this attempt. Source inspection and mocks confirm aiModel=openrouter routes to its official chat-completions endpoint, ignores the old reverse-proxy fixture URL, and uses openrouterRequestModel and its own provider credential field. Node routing takes precedence over leftover usePlainFetch. None of those findings proves the actual request succeeded.

Proven application defect: every failure was collapsed into one UI message. Add safe optional publicDiagnostic metadata for public-only OpenAI chat-completions, classifying request status, truncated finish_reason=length, malformed payloads and unexpected non-text content. Catch processing exceptions with invalid_response metadata rather than raw provider details. Domain parsing/adapter distinguish invalid JSON and empty final text after excluding reasoning. UI uses only trusted local messages/validated status200..599, displays the actual configured OpenRouter slug and provides the existing redacted request-log dialog in help. Raw provider messages, payloads and keys remain excluded. No retry, output-schema, model, reasoning or token-budget change. Display the unchanged320-token cap in help via the same constant as the request.

Hypothesis only: OpenRouter documents that max_tokens includes reasoning on most providers and can finish with length/empty content when consumed by reasoning (https://openrouter.ai/docs/api_reference/parameters#max-tokens). Our320 cap could cause this for a reasoning-capable GLM variant, but neither the variant nor the actual finish reason is known. Do not present this as established cause or silently increase cost/disable user reasoning. Asked for existing Response Success and request URL without refreshing/retrying or sending headers/keys. Those browser-memory logs may be lost if the user already reloaded.

Validation: full suite36 files,349 passed/3 existing skipped; final types0/0; build35.07s passes with existing warnings. Independent review detects no remaining diagnostic leak/regression. Source-browser acceptance on a separate fictional save: four manually initiated intercepted OpenRouter-shaped calls (request402, invalid JSON, length, reasoning-only empty text), no real provider call, preserved post/zero saved responses, safe UI diagnostics, accessible expurgated logs and0 JS errors. Test server6621 PID1200677 is verified/stopped, no shared/reserved ports affected.

Evidence in `../social-preview-evidence/{browser-social-errors.cjs,browser-social-errors.log,social-error-tests.log,social-error-check.log,social-error-build.log,social-error-runtime-final.json}`. Serve the frozen diagnostic build on the existing8443 origin without touching the save, provider settings or user tab. Keep443 and detached runtime alive. No commit/push. Status: Partial for the real generation failure, Complete for the proven error-reporting defect and fixture validation. Blocking evidence: actual successful/failed request status and selected model slug; live generation quality is unvalidated.


## GLM Flash Latest identification and proposed output budget (not implemented)

Marie supplies the exact UI label Z.ai / GLM Flash Latest. Public unauthenticated OpenRouter Models API resolves its catalog identity to `~z-ai/glm-flash-latest`. At observation it aliases `z-ai/glm-5.3-flash`; the alias is intentionally movable, not a pinned version. Metadata declares reasoning mandatory/default enabled, efforts max/high/low, default max. Source: https://openrouter.ai/api/v1/models and https://openrouter.ai/~z-ai/glm-flash-latest . Minimal public facts and timestamp are in ../social-preview-evidence/glm-flash-catalog-facts.json. No account, key, saved user database or paid endpoint was accessed.

Local mapping is verified by code: getOpenRouterModels preserves model.id, splits provider/display label, toModelGridItem preserves that id, and BotSettings binds the selected id to openrouterRequestModel. The OpenRouter transport forwards that request-model field. This establishes the catalog identifier behind this UI label, not the exact persisted current database value or the historical alias target of the failed attempt.

Code imposes320 max output tokens per social actor irrespective of the main chat's output limit. Official docs state most providers count reasoning and final text against max_tokens and may return length/empty content if thinking consumes the cap: https://openrouter.ai/docs/guides/best-practices/reasoning-tokens#reasoning-tokens-and-max_tokens . Therefore320 can prevent a final answer for reasoning models. Mandatory/default-max metadata strengthens that compatibility concern, but no actual status/finish_reason proves it caused this failure. Neither disable reasoning nor substitute a model.

Concrete proposal, awaiting implementation authorization:
- Add optional `socialFeed.outputTokenLimit`, with backward-compatible effective default320. Opening/reloading an old save must not silently increase its budget or alter provider settings.
- Offer explicit per-character presets320,1024,2048,4096,8192 in generation settings, labeling that thinking and visible answer share the limit.8192 is an application ceiling, not a model recommendation or guarantee. Unknown/malformed/out-of-range stored values revert to320 rather than becoming unlimited or unexpectedly larger.
- Immediately before Ask cast to react, display effective per-character budget, number of eligible actors and worst-case output budget for the batch (limit×eligible count, max4). Note input tokens/provider pricing also affect charges; tokens are not a guaranteed money cap. Preserve posting/likes as local operations.
- Increasing the budget requires a deliberate user selection and explicit generation click. No automatic escalation, retries, fallback, reasoning changes or copying the larger main-chat limit. Keep current model/provider/key settings unchanged. For a mandatory reasoning model, explain that disabled/none is not a reliable escape. Existing Model settings remains the user-controlled place for supported reasoning effort.
- Snapshot the chosen output budget for the entire batch; pass it as a validated adapter option rather than the global constant. Changing the feed budget cancels/invalidate pending generation, just like changing public profiles/navigation. Save only complete atomic responses.
- Retain existing public-context allowlist,600-character comment validation, formatter/transport isolation and privacy controls. Raising token budget does not expose private chats/memory nor allow tools.
- Meaningful fixture checks: old-save default unchanged; boundary/malformed budget values; exact outbound max_tokens; max four calls/no hidden retry; changed budget during delayed response cancels late output; error/truncation keeps post and empty batch; explicit larger-budget fixture succeeds; UI cost ceiling and320/390px accessibility; save/reload persists only user-selected value. No paid provider validation.

Required real-attempt evidence remains request success/status, finish_reason/empty-vs-valid final response and actual alias model resolved at the time (e.g. existing OpenRouter activity without a new generation). Do not infer an authentication failure or assert the320 cap as the confirmed root cause. This phase modifies only this plan and public evidence, not code, saved data, active preview, or user settings.


## Thinking audit (read-only application scope)

Targeted source inspection and local mocked assertions establish an unresolved HIGH response-boundary issue: structured reasoning is concatenated before regex cleanup, and known thought markers in decoded JSON comments can survive to persistence. Do not claim thinking-safe delivery. Report and proposed strict structured exclusion/marker rejection: ../social-preview-evidence/thinking-audit.md.37 fixture assertions pass as evidence of current behavior, not safety acceptance; temporary test source removed. No application, output budget, reasoning setting, model, user save or running preview changed.320 remains a compatibility concern rather than the proven real-attempt cause. See report for source references, provider routing limits, and regression requirements.


## Authorized thinking correction, unchanged output budget

Marie authorizes the response-boundary correction and asks where320 originated. `src/ts/social/socialProvider.ts:7` defines SOCIAL_MAX_OUTPUT_TOKENS=320; :47 forwards it per explicit actor request, at most four actors (1,280 requested output tokens). This is the first-slice application choice, not a documented/validated GLM requirement.600 characters is independent comment validation, not a reasoning allowance or guarantee of final-answer capacity. No model/provider/reasoning/budget setting changes are authorized in this correction.

Correction: shared tested final-text selectors bypass private-chat thinking formatting for public-only OpenAI-compatible, Anthropic and Google responses. OpenAI retains only validated content/legacy text and ignores reasoning/reasoning_content/reasoning_details; Anthropic excludes thinking/redacted blocks; Google excludes thought=true parts. Existing private-chat formatting remains intact. Adapter no longer repairs Thoughts blocks. It rejects known ambiguous thinking markers case-insensitively; domain checks both raw content and decoded JSON comment (including escaped Unicode markers). Entire final JSON must validate; no JSON mining from thought text. Returned tools remain rejected; errors/length/empty final text preserve atomic response semantics with no application retry. Unmarked reasoning supplied as final content cannot be reliably detected automatically.

Validation: targeted57 passed; full37 files,367 passed/3 existing skipped; svelte-check0 errors/0 warnings; sequential production/private-preview build34.90s (existing warnings). Independent read-only reviewer identifies no remaining response-boundary finding; original P1 is corrected. Browser390x844 uses a fresh fictional save, blocks external requests and intercepts six OpenRouter-shaped replies: request failure, malformed JSON, length, empty reasoning-only final, thinking-marked JSON comment, then valid final content with adversarial structured reasoning. Five errors retain the post/zero responses, final response persists only final text, no sentinel or JS error, unchanged320 outbound cap. Inspected thinking-fix-mobile.png. Owned6621 test server1216476 stopped after script/cwd verification. No shared browser/ports disturbed.

Evidence: ../social-preview-evidence/{thinking-fix-targeted.log,thinking-fix-tests.log,thinking-fix-check.log,thinking-fix-build.log,browser-thinking-fix.cjs,browser-thinking-fix.log,thinking-fix-mobile.png,thinking-fix-runtime-final.json}. Original thinking-audit.md is historical pre-fix evidence; this section supersedes its unresolved status. Preview frozen build replacement is verified separately in runtime-final evidence; original Node/fixture process ownership and routes443/8443 preserved, saved data/keys never read or overwritten. No commit/push or paid call.

Future proposal remains explicit user-selected outputTokenLimit320/1024/2048/4096/8192, validated default320 on old/malformed saves, per-actor and eligible-cast batch budget displayed before generation, inputs/pricing/provider routing additionally affect charges. No automatic budget escalation, retries, reasoning disablement or model change. A larger limit is not a guaranteed successful response or monetary cap; implementation still awaits authorization.


## Common casting parameters: existing-field inspection, proposal only

Marie requests general settings shared by all social actors, similar to the existing Max Context Size / Max Response Size controls. Screenshot8000/1200 is an example, not authorization to impose these values. No code/runtime/save or provider request changed in this phase.

Existing UI definitions: `src/ts/setting/botSettingsParamsData.ts:16` binds Max Context Size to root Database.maxContext; :24 binds Max Response Size to root Database.maxResponse. They render in `src/lib/Setting/Pages/BotSettings.svelte:488`, Chat Bot Parameters, via SettingRenderer/SettingNumber/NumberInput. Context input has min0, response input min0/max2048 HTML attributes; these are not authoritative model caps or full validation. Root DB fields are `database.svelte.ts:860-861`, general rather than character/cast fields. Their botPreset counterparts (:1643-1644) are saved (:2107-2108) and applied (:2220-2221), so switching presets changes them globally.

Main chat uses maxContext for total context management (`process/index.svelte.ts:345`), token accounting starts with maxResponse reservation (:613) and includes templates/private history/memory. At :1514-1516 it reduces output allowance if input+output exceeds context. `request/request.ts:464` defaults maxTokens to db.maxResponse only when caller omits it; direct requestChatDataMain does not apply the main-chat context pruning pipeline. Social currently explicitly supplies320 and never enforces db.maxContext on its public DTO. Therefore merely removing320 would address output inheritance, not context enforcement.

Minimal recommended integration if the user wants shared CHAT AND SOCIAL parameters: read existing validated db.maxResponse and db.maxContext, display them in social generation help/settings as common to the entire casting and shared with Chat Bot Parameters; link to those existing controls. No new duplicate values, individual actor configuration or default overwrite. Snapshot both values once at explicit generation, use the same response allowance for each eligible actor, show responseLimit × eligible actor count (max4), cancel/discard if values change during the batch. Switching a model preset also affects social; make that scope visible. Unknown/zero/nonfinite/incompatible limits should stop before requests with an actionable message, not silently increase/clamp an existing value or fall back to320.

If the user wants common SOCIAL ONLY parameters instead: reuse NumberInput/UI labels in one generation-settings section, store `socialFeed.maxContext`/`socialFeed.maxResponse` once for the whole feed. Do not write root db.maxContext/maxResponse or duplicate settings on actors. Initialize/pick values only through deliberate user action, preserve old save behavior until selection. This is a distinct product scope decision; "general for all characters" alone does not prove that modifying social should modify private-chat settings.

Public context must remain strictly the social system instruction + public actor/world/post/comments. Enforce an estimated local token count including both messages/role overhead plus the FULL selected response reservation against maxContext before any batch request. Do not invoke the normal chat pipeline or bring its templates/private chats/memory/tools into the feed. Refuse oversized required public context (or explicitly trim only expendable public comments with disclosure in a later feature); never silently reduce the shared response budget differently for different actors. Preflight all eligible actors before sending the first request so a deterministic context error does not spend a partial batch. The response allowance includes reasoning+final on relevant providers, separate from600-character comment validation.

Do not blindly use the existing encode/ChatTokenizer path: `tokenizer.ts:187` may call Google countTokens and :134-166 may invoke a plugin tokenizer. A public-only preflight needs explicit local-only tokenization of the already allowlisted DTO, with no provider/key/plugin request. `encodeWithTokenizer(text,'tik')` (:48) uses the bundled local Tiktoken implementation; cl100k-based counts are an estimate for GLM/OpenRouter, not guaranteed actual provider counts. A bounded safe local model-specific mapping is possible later without reaching private context. If count/model window is unknown, label estimates rather than claiming hard billing/model acceptance guarantees.

Next implementation regression checks: unchanged user fields on opening/reload; one shared snapshot across four fixture actors; exact outbound max_tokens/max_completion_tokens; context boundary/all-actor preflight0 requests on rejection; settings/preset mutation cancels late results; public-only content and local tokenizer no external request; malformed limit validation; shared/global scope text and visible batch output ceiling; persistence remains existing DB/preset mechanism. Live preview remains the previously verified thinking-fix build on8443, with443 and saves untouched.


## Authorized independent common social limits

Marie confirms social-only parameters shared by the casting, independent of private-chat limits. Implement optional persisted socialFeed.maxContext/maxResponse, visible in one Generation settings panel and its closed summary. Missing-field migration explicitly initializes4,000 context/320 response; existing numeric choices/invalid values are never overwritten, no screenshot value8000/1200 is imposed. Input ranges: context512–131072; response64–8192, whole numbers, response<context. Out-of-range/blank/malformed values block requests; no silent clamp, limit increase, reasoning disablement, model change or retry. Chat fields/presets remain unchanged.

SocialLimits is the single validation/default boundary. SocialPrompt projects public DTO fields at transport and counting boundaries. SocialTokenBudget explicitly calls bundled local encodeWithTokenizer(text,'tik'), never generic encode(), provider countTokens, plugin tokenizer or remote tokenizer loader. Count the same system+public messages, with local role/framing allowance3+8permessage and full response reserve. Labels explicitly call this a local estimate and state provider counts can differ; limits are application boundaries, not guaranteed provider/model limits or money caps. Context includes the public instruction/world/profile/post/comments only. Entire eligible casting is preflighted before the first generation; any oversized context stops the whole batch without calls/publication, never silently shrinking one actor's output.

Generation snapshots shared limits plus detached public DTOs including author/comments. The same DTOs serve counting and generation. Independent review found a P2 where comments/author could change during asynchronous preflight; corrected snapshot/comparison/DTO reuse and added author/comment mutation regressions. Changes to limits/public context/navigation discard late results atomically. One response ceiling is forwarded to every request; casting maximum shown in settings and actual eligible count×ceiling beside each post, at most4 actors, excluding already completed actors. Provider thinking/final separation and strict JSON/marker rejection remain intact.

Validation: targeted60 tests passed before final2 snapshot regressions; complete final suite38 files,396 passed/3 existing skipped. Types0 errors/0 warnings; production build passed after final core changes. Subsequent browser a11y locator exposed overly long implicit labels; replace with distinct aria-labelledby/aria-describedby spans, independently reviewed with no finding. Browser-final on fictional independent save passes defaults/migration320+4000, invalid/blank values preserved+blocked, oversized public context0 calls, shared explicit1200 response for2actors/2400 batch display, chat16000/777 unchanged,5safe error fixtures then2valid final reactions without thought sentinel, save/reload persistence and no horizontal overflow at320/390,0JSerrors. Seven intercepted fixture calls,0real-provider calls. Viewed social-limits-mobile-320.png. Initial failed browser label log is diagnostic history, not acceptance. Owned6621 test server1258453 stopped via exact script/cwd verification. Preview8443 retains its own save/provider config and is refreshed only after final UI types/build pass.

Evidence in ../social-preview-evidence/{social-limits-targeted.log,social-limits-final-tests.log,social-limits-final-check.log,social-limits-final-build.log,social-limits-ui-final-check.log,social-limits-ui-final-build.log,browser-social-limits.cjs,browser-social-limits.log,browser-social-limits-final.log,social-limits-mobile-320.png,social-limits-mobile-390.png,social-limits-runtime-final.json}. Final runtime verification separately confirms transformed frozen HTML, unchanged443/8443 routes and owned process identities. No saved user values/keys/posts were read or rewritten by agent; no paid call, dependency/system install, commit/push/merge. Native Tauri and real-provider count/quality/cost behavior remain unvalidated; local estimates and provider-side failover limits remain explicit.


## Real GLM invalid-final follow-up, no budget escalation

Parent reports earlier length200 followed by invalid social reaction at explicitly selected8000context/4000response,2actors/8000batch. Actual final response/finish reason unavailable; do not conclude another budget shortage. Confirmed coarse-diagnostic defect and ambiguous pipe-enum example corrected with valid example/separate enum and seven allowlisted final-validation reasons, preserving thinking guards/600-character cap/atomic saves/private schema exclusion/no retries. No provider schema, model, reasoning or user-limit changes. Detailed source diagnosis, safe existing-log instructions and limitations: ../social-preview-evidence/social-json-diagnosis.md.

Full411pass/3skip39files, types0/0, build40.38s, independent review no finding. Mobile320/390 fiction-only fixtures9intercepted calls0realcalls distinguish categories, preserve explicit8000/4000+batch8000 through reload and unchanged chat settings. Controlled6621server1276115 stopped. Updated frozen8443build preserves443/processes/save/keys/posts; proof in ../social-preview-evidence/social-json-runtime-final.json. No commit/push. Real-attempt diagnosis remains Partial until safe final-shape/enum/comment-length/finish-reason observations arrive; no actual reasoning or keys requested/read.


## Correction: request journal retains metadata only

Source reinspection of globalApi.svelte.ts:645-654 confirms request/response bodies are deliberately omitted, not merely credential-redacted. Previous safe-final-observation guidance was incorrect; docs and diagnosis now corrected. Same Android/Windows UI path: SAMEdevice/tab Social feed → top-right? (About the feed) → Request diagnostics → Show Request Logs → relevant OpenRouter chat/completions row. Only time/status/redacted URL available; no old JSON/finish_reason/new validation reason can be recovered. RAM logs are device/tab-local and lost on refresh; Node save does not retain the response. Previous asyncquestion seeking content is obsolete. No new call authorized/launched, no code/build/preview/userdata change. Minimal optional observation: existing row time/status, which will not establish JSON root cause.


## Per-character common limits confirmed, no pool/division

Marie clarifies each character must get the same FULL limit. Verified code: SocialGeneration sends {...limits} unchanged for every actor; preflight loops each context separately using input+maxResponse<=maxContext, no summed context/division; adapter passes limits.maxResponse to maxTokens; OAI writes max_tokens/max_completion_tokens unchanged. Multiplication is UI cost-only combined output, never request budgeting. Regression now asserts four actors all receive8000context/4000response and16000total; added separate-context counter case where individual6019 fits8000 while combined24076 exceeds8000, still accepted; transport assertions use4000for both token parameter variants. Documentation explicitly distinguishes same per-request setting from pooled budget and provides clearer wording. No application behavior, user values, live preview443/8443, provider calls or build changed.


## Character publications and selective reactions (authorized continuation)

- Continue feature/social-feed without commit or publication. Preserve the tested runtime and its user data until validation completes.
- Manual single-character publication: explicit actor selector and generation button, one provider request, up to eight recent public posts as context. No automatic reaction chain; reactions remain a separate explicit action capped at four actors.
- Add optional author.characterId for generated attribution and optional post.consideredActorIds to persist a no-reaction decision. Existing posts/responses stay valid without migration or rewriting. A generated author is excluded from reacting to their own post.
- Reaction none with an empty comment means decline; none with text remains a comment. Declines produce no public response and are not automatically retried. Persist decisions atomically with responses.
- Strict generated publication JSON {text:string}, maximum 2000 characters, final-only privacy checks, exact normalized duplicate rejection, public allowlist projection, full common per-request budgets and cancellation.
- UI shows manual action and maximum output, current model and progress/cancel. Errors preserve existing posts and never retry automatically. Dynamic-model capability work remains independently owned; retain SocialLimits integration contract.
- Verification: local fixture domain/transport tests, old-save compatibility, cancellation/repeated clicks/navigation/model selection, full tests, type check, serial private-preview build, independent review and isolated mobile browser contexts. No real provider or shared browser activity.


### Continuation validation

- Final full suite: 40 files, 431 tests passed, 3 existing skipped. Targeted social: 97 passed before accessible-label-only correction.
- Final type check after explicit publication author accessible label: zero errors and zero warnings.
- Independent reviewer: final verdict no remaining findings. Model cancellation identity covers NanoGPT/custom selections and routing without projecting keys.
- Isolated real UI fixture flow: six intercepted requests, zero real provider calls, publications/attribution, no automatic reactions, self-exclusion, declines/reload, duplicate/invalid/thinking rejection, cancellation/navigation/draft preservation, widths320/390 without overflow or JavaScript errors.
- Serial private-preview build with NODE_OPTIONS max-old-space-size1536: passed in36.14s. Existing browser externalization/CSS/plugin timing warnings remain.
- Owned fixture server and headless browser stopped before build; no shared ports/browser used. Earlier interruption root cause remains undetermined; test launcher now explicitly sets private-local and uses local polling without changing system limits.
- Evidence: task-3/social-preview-evidence/social-publications-{acceptance.md,final-tests.log,final-check.log,final-build.log,mobile-320.png,mobile-390.png}; browser-social-publications.cjs/log. Frozen preview refresh and served HTML proof in social-publications-runtime-final.json. User save/config/keys never read or overwritten.
- No commit/push/PR/deployment outside the authorized temporary private preview. Dynamic model-capability integration and release remain separately owned. Native desktop/provider quality/exact billing not validated.


## Automatic social language (authorized continuation)

- Same branch, no new saved settings or destructive migration. No relations feature or extra model call.
- Structured language cues in the existing public prompt: target-post language first for reactions, recent user-authored posts in this feed next, public world/profiles next, actual supported interface language last. Publications have no target post.
- Use the model's interpretation with explicit ambiguity/mixed/short-text rules, not a fragile local language detector or separate classification request. No promise of perfect language detection/provider compliance.
- Bound cues to five recent user posts (400 characters each) and four public profiles (400 each). Full existing public context and these cues remain counted together in the existing preflight and full common output reserve. No chat/private memory/lore/card descriptions or persona prompts.
- Snapshot cues/interface language with each batch; changes to the relevant public signals or interface language invalidate stale results. Character-authored posts cannot become user-language cues. The app currently has one persisted social world/feed, not separate universe containers.
- First prepare code, regressions and read-only review. Heavy types/tests/browser/build are paused until parent authorizes the resource slot. Preview remains the validated character-publication version until validation and communicated refresh.


## Public relationships, first usable slice (authorized after language increment)

- Minimal relationship means public familiarity, not affection/romance or reputation. Show first contact (one distinct public thread), getting acquainted (two/three), familiar faces (four+), with the actual evidence visible. Personality and dialogue still determine warmth/disagreement.
- Derive relationships from saved public character responses and the publication's explicit author identity. Support character/persona and character/character pairs. Existing anonymous user-like toggles have no saved author, so do not invent relationship events from them. Declines are not public interactions and imply no hostility.
- Use existing posts/responses as the event source, not a second writable score ledger. Deduplicate actual response IDs and count distinct post IDs; reloading/repeating requests cannot double-apply a score. Atomic failures/cancellations have no saved events and thus no relation change. Deleting public evidence removes its contribution, explained in the UI. No fabricated past/hidden memory or migration.
- Expandable relationships panel: names, familiarity, distinct-thread count, and chronological public reaction/comment history with bounded pages and explicit Show more. No model call to inspect history.
- Generation includes at most three relevant contacts and two recent interactions each (bounded text excerpts), reprojected public DTOs and instructions not to infer trust/hostility/romance from counts/emoji. Existing tokenizer budgets include these facts. No analysis/model calls added.
- Relevant relationship-context changes invalidate stale generation through existing public-context snapshots. Preserve old saves, declines, character attribution and interface/model cancellation guards.
- Tests to cover pair identity across personas/characters, deletion, duplicate response IDs/reload, stages based on distinct threads, no skip/failed/cancelled effects, strict public DTO projection/bounds and model prompt/preflight consistency. Heavy validation remains queued for parent's exclusive resource signal.


### Language and relationships, validation and handoff

- Previous delayed write completed; socialRelations.ts exists and is fully integrated with UI/prompt snapshots.
- Final focused113tests/7files; final full447pass/3existing skipped/42files; types0errors0warnings; diffcheck passed. Independent final review no remaining findings.
- Stable current/explicit persona author IDs fixed for new posts; old snapshots not rewritten or name-merged. Reaction context prioritizes the target author's relationship within3contacts.
- UI fixture8intercepted calls/0real calls: Englishprofile/Frenchdiscussion cues, prior public relations, progression distinctthreads, decline without hostility/publicevent, sourcehistory, cancellation, navigation/autosave/reload,320/390px without overflow/JSerrors.
- No fullbuild per parent resource/CI direction. No preview refresh: frozen runtimeindex13bf439ddeb91ffc0600315c39325c3fabd10a651de09c69c63f41171418184e unchanged. Production artifact validation and later preview update are the exact remaining gates.
- Owned fixture server1426226 stopped, browser absent; existing5173/6620HTTP200, about3GiB available after cleanup. No source/release/limits worktree edits or shared dependency installation, no commit/push.
- Evidence task-3/social-preview-evidence/social-language-relations-acceptance.md, -focused.log, -check.log, -tests.log, -mobile-320.png/-390.png, -preview-unchanged.json; browser-social-language-relations.cjs/log.


### Authorized measured production-build attempt

- Parent subsequently authorized one measured serial local attempt. Same tested/reviewed source manifest, existing direct Vite CLI, private-preview mode,1536MiB heap, separate candidate `task-3/social-build-language-relations`; no preview/user-data changes.
- Controlled RSS guard stopped the build after46.38seconds:2356844kB observed process-tree RSS,703772kB minimum available memory, exit-15.6866modules transformed; artifact incomplete. No kernel OOM conclusion or blind retry.
- Owned build process/group fully stopped;3029236kB memory available after cleanup. Runtime index hash remains unchanged. Fresh network health calls are sandbox-blocked and cannot determine service health.
- Build/validated preview refresh remain blocked on resource headroom or an approved CI route. Commit/push remain unauthorized. Evidence recorded in social-language-relations acceptance/build measurements and source manifest.
