# Native Elsewords integration in Elsewhere

Inspection and proposed implementation plan, 2026-10-02. No implementation is authorized by this document. Repository artifacts use English; the user-facing handoff is in French.

## Verified state

- Host: `bella-felix`. Main repositories: `/home/marie/code/elsewhere` and `/home/marie/code/elsewords`.
- Live `git ls-remote origin` confirms Elsewhere `develop` = `15ff45f6ab70f929459ea9010fe01e7c635ae48a`, `main` = `90bc7ca77219a31ffde739c2ec2e7d4051e0658c`; Elsewords `develop` = `c634135d9852855c4977e6184c1d2e2cea1fbdbe`.
- Elsewhere main checkout remains on `develop` at `7632682a`, behind 18 commits, with an existing untracked `.pnpm-store/`. Inspection of current integration source uses `git show/grep origin/develop`, not the stale checkout.
- Elsewords main checkout is clean on `develop`, including the squash merge of PR 22. The translation-review worktree remains at `381d75a`, with an existing untracked `plans/translation-review.md`. The merged source is authoritative for reuse.
- Token-limit worktree: `/home/marie/code/elsewhere.worktrees/feature-model-token-limits`, clean at `3326321f`.
- Social worktree: `/home/marie/Documents/Codex/2026-09-30/task-3/social-feed`, clean at `e39c0f5a`.
- Neither active worktree was modified. No branch, build, dependency installation, provider startup, paid call, commit, push, PR, deletion or archive occurred.

## Instructions and isolation

Read `/home/marie/.codex/AGENTS.md`, Elsewhere `AGENTS.md` and the `coding-agents/codex/skills` versions of `git-create-branch`, `git-conventions`, `plan-lifecycle`, `quality-gate`. Elsewords has no repository AGENTS file; neither repository has `.agents/skills`. No separate planning skill was found in the Codex fallback catalog beyond plan-lifecycle and the continuation-plan section of git-create-branch.

Use a future `feature/native-elsewords` branch from freshly fetched `origin/develop`, after plan approval. Prefer a native Codex task with a managed worktree. If unavailable, git-create-branch explicitly requires approval for manual fallback before creating it. The proposed manual path is `/home/marie/code/elsewhere.worktrees/feature-native-elsewords`, subject to registry/path/branch availability checks. Never nest a worktree inside the repository. Create its continuation plan only after verifying isolation and branch. This inspection report is a workspace deliverable, not a repository continuation plan.

## Actual compatibility boundary

Elsewords explicitly targets Elsewhere Plugin API v3. The global API name is still `Risuai`. It is not proof that every plugin workflow is incompatible with RisuAI.

The cached upstream/main source at `f9728b14` (2026-09-29) exposes `runLLMModel`, but has neither the fork's `createCharacterFromCard` nor `generateImage` method in `v3.svelte.ts`. This matches the plugin's documented Elsewhere-only boundary. Upstream's current remote and actual runtime installation were not checked, so this is source evidence for the cached version, not a universal runtime diagnosis.

- Translation and generation/completion text use `runLLMModel({ messages, mode: 'model', allowPlugins: false })`, already sharing Elsewhere model configuration and credentials.
- New-character creation uses the fork-specific `createCharacterFromCard` and is hidden when that method is unavailable; downloads remain available.
- Portrait generation uses the fork-specific `generateImage` and gives actionable errors when unavailable.
- Existing-character loading/saving, group member selection, image reads, plugin local storage, menu entries and sandbox file handling also depend on host APIs. No real upstream flow was launched in this inspection.
- JSON/PNG parsing, protected-token validation, batching, output editing and completion merging are host-independent modules and can be reused without the plugin runtime.

Native integration is a product consolidation decision supported by this boundary. It does not require first repairing upstream plugin compatibility.

## Approved scope: full current-plugin parity

Marie clarified that all Elsewords functions and settings must be retained. Functional parity is settled, not an open V1 reduction decision. The implementation may be delivered in ordered steps, but no current-plugin function may be omitted from the completed native feature without an explicit later decision. Reusing a native setting means preserving its effective choice, not replacing it with a superficially similar setting.

The parity baseline is merged Elsewords `develop` at `c634135d`, including its entire template, core, adapter and documented behavior. Earlier TAVO-era experimental controls are historical evidence, not silently assumed to be current functionality.

### Function-by-function native map

| Current function | Native destination/reuse | Parity requirement |
| --- | --- | --- |
| Chat-menu and settings entry, fullscreen open/close | Chat menu + native settings entry + shared Svelte workspace | Both existing entry points remain; one session, focus restoration, no plugin installation requirement |
| Translate / Generate tabs, keyboard navigation | Native workspace tabs | Preserve tab drafts and form values, desktop/mobile behavior, busy state |
| Load open character in either tab | Native character adapter / DBState | Explicit staging; Generate switches to completion; no chat/persona staging |
| Group-member chooser | Native group/character identity service | Same chooser and membership/identity recheck before save |
| JSON/PNG card import | Native file picker + card core | Bare, CCv2, CCv3, SillyTavern wrappers; PNG tEXt chara; unknown metadata retained; no DB write at import |
| Translation with supported-field extraction | Native card core + prompt service + shared request pipeline | Preserve names option, prose allowlist, lorebook and extension text; retain protected tokens/formatting |
| Sequential batch translation and progress | Session/model service | All batches complete before publishing output; no partially translated card on failure |
| Fresh character generation | Native generation service | CCv3-compatible output, required meaningful prose, brief language, no invented source comparison |
| Complete/rewrite loaded/imported character | Native generation + completion merger | Explicit instructions; original comparison; wrapper/metadata retention and lorebook identity checks |
| Response recovery | Native parser + model service | One visible bounded recovery per invalid batch/generation; reasoning-only diagnostics; previous valid output retained on failure |
| Output editors | Native review component | Name, supported prose, greetings, lorebook names/content, extension prompts and existing empty fields; variable multiplicity preserved |
| Original comparison | Native review component | Original stays read-only; two columns desktop, stacked mobile; fresh generation output-only |
| Update preview / Cancel edits | Whole-draft validator and session | No model call; atomic validated preview; pending/invalid edits block all output actions; cancel restores last validated output |
| Summary and View full card JSON | Native review summary + disclosure | Both use the same validated output; full JSON remains a read-only inspection view, not a separate unsynchronized editor |
| Save existing character / Cancel / Yes | Native confirmation + conflict-aware application | Apply entire reviewed output only after confirmation; preserve unrelated host metadata/chat; no per-field accept/reject |
| Replace current profile image checkbox | Native save confirmation | Defaults unchecked; only shown when a generated result has selected artwork, matching current semantics |
| Save as new / Cancel / Yes | Native confirmation + prepareCharacterFromCard/common creation helpers | Existing character untouched; validated card; applicable source/selected portrait included; serialize creation and preserve host safety checks |
| Download result JSON or PNG | Native download adapter + card core | Preserve current format/portrait-driven output choice, reviewed edits, card wrapper, naming and PNG imagery |
| Download PNG with loaded portrait | Native image read/conversion + download | Explicit separate action; readable portrait required; do not mutate current character |
| Select/remove portrait; portrait preview | Native file/image adapter + session | PNG/JPEG/WebP input, PNG conversion, size limits, explicit removal, failed requests keep previous artwork |
| Select/remove reference; use current portrait; reference preview | Native file/image adapter + session | Reference separate from output portrait; sent only when Generate portrait is invoked |
| Generate portrait | Existing OpenRouter image service/settings + native consent | Same selected model/key/options; separate prompt; reference capability checks, per-call confirmation and actionable errors |
| Status/error and bounded debug disclosure | Native status/debug component | Visible progress and actionable failures; bounded in-session response inspection (8000 characters per entry); no persistent response logging |
| Close/reopen/reset and late-result invalidation | Native session lifecycle | Clear cards, drafts, images, prompts/debug; restore saved translation preferences; stale responses cannot restore closed content |
| Settings persistence | Dedicated device-local native preferences service | Eight stored form values retained; no migration of nonexistent persisted drafts or keys |

### Setting-by-setting native map

| Setting or choice | Existing value/default | Native ownership and value preservation |
| --- | --- | --- |
| `sourceMode` | `auto` or `manual`, default `auto` | Dedicated card-translation preference; migrate exact recognized value, never conflate with chat translator settings |
| `sourceLanguage` | Free text, default empty | Dedicated preference; retain even while automatic mode disables its field |
| `target` | Empty; English/French/Spanish/German/Italian/Portuguese/Japanese/Korean/Chinese (Simplified)/Arabic/Russian/Other | Preserve every preset and current selected string; no replacement by application UI language |
| `customTarget` | Free text, default empty | Preserve independently of target selection, including fallback behavior when target is empty |
| `style` | `natural`, `faithful`, `close`; default `natural` | Dedicated card preference with all three options |
| `instructions` | Translation guidance, default empty | Dedicated local preference; exact stored string survives migration, no new silent trimming/truncation |
| `tone` | Preserve original tone, default `true` | Dedicated boolean; retain `false` correctly rather than defaulting through truthiness |
| `names` | Translate descriptive names, default `true` | Dedicated boolean controlling field extraction; preserve `false` |
| Generation `mode` | `create` / `complete`, default `create` | Session choice; loading source in Generate switches to complete; retain across tabs; reset on close as today |
| Generation `instructions` | Description/rewrite brief | Separate session field from translation guidance; retain across tabs; not historically persisted |
| `imagePrompt` | Separate portrait prompt | Separate session field; never derive from generation brief without an explicit user action; not historically persisted |
| Reference image | Selected/imported/current portrait or none | Session-only explicit choice; removal remains available; never automatically send current portrait |
| Output artwork | Selected/generated portrait or none | Session-only preview/removal; PNG/new-character inclusion and existing-character replacement rules retained |
| Replace portrait | Confirmation checkbox, default unchecked | Confirmation-only choice, never sticky or inferred from artwork availability |
| Edited output / original / full JSON | Draft and validated values | Session-only; exact edits feed all output actions after global validation |
| Output format and filename | Source PNG vs JSON, generated artwork PNG, explicit loaded-portrait PNG; character-derived filename | Preserve each existing path; current plugin has no independent global format-setting dropdown |
| Text model/provider/keys | Elsewhere main-model configuration through `mode: 'model'`; no plugin model/key selector | Reuse exactly the existing configured main model/provider/routing/settings; do not redirect to submodel/translate mode or reset its options |
| Text response/reasoning parameters | Host configuration consumed by request pipeline | Keep shared model parameters and upcoming token validation; no duplicate limits or hidden replacement settings |
| Image model/provider/key | Host `openrouterImageModel`, `openrouterKey` | Reuse unchanged; link to existing native image settings, no copied keys or new image provider |
| Image options | Host `openrouterImageOptions`: aspectRatio, resolution, quality, outputFormat, seed | Preserve all configured values, including seed zero; keep capability validation and current settings controls |
| Prompt templates / retry instructions | Built-in translation/generation/recovery templates, not a user-selectable template setting | Preserve effective prompt behavior and explicit guidance fields; no unrequested removal of language or formatting constraints |

There is no separate text-model selector, negative-image-prompt setting, editable raw-JSON control, chat translation or working glossary in the current plugin. Their absence is not a proposed removal. Any request to recover historical TAVO-only behavior must be mapped explicitly before changing this baseline.

### Migration without loss

Migrate all eight persisted form values as a unit after validating recognizable shape/types. Preserve valid strings verbatim, including inactive/custom choices, and preserve explicit `false`; do not cap/truncate values silently. Unknown enum values or ambiguous generic storage trigger a reviewable migration warning/import choice, retain the legacy object untouched and do not mark migration successful. Existing native preferences are never overwritten without a visible choice. Missing settings use current defaults. A migration marker records completion and supports repeat-safe behavior.

Generation briefs, portrait prompts, references, artwork and review drafts were never persisted by the current plugin. Native tab/session behavior must preserve them during use; cross-restart recovery of these values would be a new persistence/privacy decision, not parity. Host model/image credentials and options already reside in Elsewhere and require no migration; do not copy, replace or inspect actual user secrets. Legacy generic storage may contain another plugin's values, so no unattended guess or destructive cleanup is permitted.

Marie states that her current sessions and characters are tests, with no real sessions/characters to retain at present. This informs disposable acceptance scenarios; it does not authorize deletion, overwriting or bypassing migration/conflict protections. Restoration of drafts after closure can be deferred as an optional extension. The functional plan has been presented; explicit approval for implementation/manual-worktree fallback is still not established.

Retain existing format/capability limits (10 MiB input/image limits, standard PNG chara metadata, no negative image prompt, controlled supported text fields). Expose limitations clearly; no silent feature downgrade under the label of native reuse.

## Workflow inventory and full-parity delivery

Preserve the complete useful card workflow in one native feature, with no new separately maintained plugin artifact:

1. Open the native Elsewords workspace from the chat menu and native settings navigation; optionally add a contextual action in character configuration if approved.
2. Load the selected character; choose a member when a group is selected. Import JSON or PNG into a staged card without importing it into the character database yet.
3. Translate with automatic/manual source language, target/custom language, natural/faithful/close style, tone/name options and optional instructions.
4. Generate a new CCv3 character from typed instructions, or complete/rewrite an explicitly loaded card. Do not infer instructions from chat or persona.
5. Compare original and editable output side by side on desktop and stacked on mobile. Fresh creation has editable output only. Include greetings, lorebook prose/names and supported extension prompts, including empty supported fields.
6. Validate all edits into a single preview. Pending or invalid edits block every save/create/export. Cancel edits restores the last validated preview. No per-field accept/reject controls and no partial application.
7. Apply the reviewed result to the existing character only after explicit confirmation; alternatively create a new character after separate confirmation. Check source identity and editable-content conflicts before writing, preserve unrelated metadata/chat/settings, and make portrait replacement an explicit option.
8. Export the latest validated preview as JSON or PNG. Preserve imported PNG imagery; support current/selected portraits and readable filenames. Never export the live character in place while pretending it is the staged result.
9. Select PNG/JPEG/WebP portraits, use an explicit reference image or the current portrait, generate with the existing configured OpenRouter image model, preview, and optionally replace the portrait on application.
10. Preserve drafts between tabs, preserve previous results on failed model responses, clear card/result/image/debug content on closing or loading another source. Persist preferences only.

Current-plugin parity does not introduce functions absent from that baseline: chat/history/input translation, a working glossary, batch processing across multiple characters, per-field approvals, new image providers/credentials, expanded card formats or public sharing. No current function is excluded. Repository/plugin retirement remains separately authorized.

## Reuse and target seams

### Domain

Port `elsewhere-plugin/src/card-core.mjs` into a native typed domain module, retaining fixture behavior and immutable staging. Reuse extraction allowlist, protected markers, JSON response recovery parsing, completion identity constraints, whole-draft validation and PNG round trips. Port the character adapter's mapping and conflict checks into a typed native service. Do not execute or embed `elsewords.elsewhere.js` as an iframe inside the application.

Proposed new ownership: `src/ts/elsewords/` for card domain, session, prompts, model requests, application and preferences; `src/lib/Elsewords/` for native Svelte workspace/review/confirmation components. Names are proposals, not files already created.

### UI

Native Svelte 5 components use current theme classes and shared input/button components. Existing seams: `src/lib/ChatScreens/DefaultChatScreen.svelte` chat menu, `src/lib/Setting/Settings.svelte` navigation, `src/App.svelte` modal/conditional surface, `src/ts/stores.svelte.ts` open state. Consider `src/lib/SideBars/CharConfig.svelte` only for the optional contextual entry. Keep one session/preview regardless of entry point; ensure keyboard focus trapping/restoration and mobile scroll behavior.

### Providers

Use `requestChatDataMain` from `src/ts/process/request/request.ts` with explicit card-only messages and current model settings, without calling chat orchestration. V1 defaults to the existing main model, matching the plugin; no new dedicated model mode or token settings. Disable plugin providers, tools, streaming and multi-generation in this structured-output workflow; supply AbortSignal for text requests and invalidate late responses on close/source/model changes. Verify downstream request serialization with fake transports so chat/persona context never enters the request. A future model-slot selector can reference existing configured slots if the user needs it.

Retain at most one parse/completion recovery per request/batch, matching current behavior; make the retry visible and ensure abort closes the retry chain. The current plugin uses sequential batches of 6000 characters, not token-aware sizing. Retain that conservative starting behavior, subject to the shared token-limit validation; do not silently clamp or invent another model-capability system.

Use existing `generateOpenRouterImage` logic and `OpenrouterImageSettings.svelte` configuration (`openrouterKey`, `openrouterImageModel`, `openrouterImageOptions`). Extract/share the service cleanly if needed instead of copying its request implementation. Keep explicit image-generation confirmation and reference disclosure. Current image service has no AbortSignal: never promise cancellation of image costs; adding real image transport cancellation is a separately scoped improvement.

### Cards, files and persistence

Reuse `prepareCharacterFromCard` from `src/ts/characterCards.ts` for creation, preserving low-level-access checks, then commit through DBState/order services only after native confirmation. Separate domain import preparation from plugin-specific permission wording. Existing creation serialization and interrupted-confirmation safety in `src/ts/plugins/apiV3/characterCreation.ts` should remain available to plugins; extract common helpers rather than duplicating business behavior or removing that API.

Use native `selectSingleFile`, `downloadFile`, image read/save and platform adapters. Preserve the 10 MiB limits and PNG validation. Keep arbitrary imported-card wrappers/unknown fields in staged-card export. `exportCharacterCard` operates on native character shape and temporarily mutates its image field; do not pass a live character to it for staged-output exports. Native card conversion cannot be assumed to preserve every unknown imported field.

Preferences should have a versioned dedicated native namespace. Recommendation: keep them device-local to match current plugin behavior, rather than silently making them syncable DB content. Character changes use normal database persistence and backups. No draft, card text, portrait prompt, model response or debug payload should be written into persistent preferences/logs.

## Settings migration and coexistence

The plugin stores only `state.form`: sourceMode/sourceLanguage/target/customTarget/style/instructions/tone/names. It has no separate API keys and no persisted card drafts. Elsewhere's `SafeLocalPluginStorage` uses LocalForage database/store `plugin`/`plugin`, prefix `safe_plugin_`; Elsewords writes key `settings`, producing `safe_plugin_settings`. The implementation shown does not namespace that key by plugin identity.

Offer one-time, user-confirmed import of recognized preferences, validating types/enums without silently truncating valid stored values, with a migration marker in the new namespace. Do not blindly trust a generic shared settings object; do not overwrite existing native preferences, delete legacy storage, access private runtime data during implementation or promise cross-device transfer. Keep instructions local because they may contain private content. Migration absence/failure must not prevent using default native settings; retain the legacy data and explain any unimported value.

The installed old plugin can still register duplicate chat/settings entries. Recommend a visible instruction to disable it when enabling native Elsewords; leave plugin code/storage and the entire source repository intact. No automatic uninstall, suppression of unrelated plugins or archive without later permission. Native release thereafter owns bug fixes and tests in Elsewhere; no new mirrored plugin releases.

## Licenses and provenance

Elsewhere `LICENSE` contains GPLv3; `NOTICE` preserves upstream authors and documents the rpack AGPLv3 treatment. Keep those notices and Software licenses access intact. Elsewords has no tracked LICENSE/NOTICE and no license file found in the source tree. The entire current branch history lists Marie-Sarah Beaugrand and mariepop13 as authors; the three current implementation sources have that same authorship. Current package.json declares no third-party dependencies; the build only concatenates local core/adapter/template sources. Current source/docs/plan searches found no third-party attribution, copied-from notice or external code license. Core PNG/CRC32 helpers are inline implementations using browser primitives, with no embedded attribution notice.

History records the original TAVO plugin creation in `a77ffa6`, followed by the self-contained RisuAI port in `ad2d280`, then the Elsewhere-only port. Earlier TAVO packaging used its MCP workflow, which is evidence of packaging context, not by itself evidence that the current runtime bundles TAVO code. The current artifact calls host APIs but contains only local sources. These findings support Marie's belief that no third-party code was added; they do not certify the provenance of every algorithm or establish rights solely from Git author fields. No external originality comparison or exhaustive legal audit was performed.

Before transplanting code into the now-published source repository, confirm Marie's rights to the imported code and its intended compatible distribution terms; inspect copied-source/dependency provenance and retain required attribution. Do not invent a license or silently relicense the Elsewords repository. This is an unresolved release/provenance decision, not a claim that GPL/AGPL alone forbids the integration.

## Coordination

- Token limits (`3326321f`) change request.ts, provider serializers, tokenizer, model capability services and settings/language files. Consume their shared validation after integration; do not modify their worktree or copy capability logic. Coordinate text limits/reasoning failures and batched input budgeting.
- Social (`e39c0f5a`) changes App.svelte, stores.svelte.ts, database.svelte.ts, en.ts, navigation and request/provider files. Its `socialProvider.ts` supplies publicOnly, tools=[], noMultiGen and cancellation; publicOnly is a social-specific contract, not automatically the right flag for private character-card work. Confirm an explicit card-only request contract without changing social semantics.
- Main source release is already published. Base the feature on develop, keep it outside the frozen release candidate, and schedule a separate reviewed integration. Shared-file coordination is required even if most new modules are independent.

## Ordered implementation after approval

1. Use the settled full-parity scope and mapping above; resolve only remaining UX/persistence/provenance details below, then refresh origin/develop and verify isolation using git-create-branch. Record actual branch/worktree and continuation plan.
2. Add typed card/review domain and port meaningful synthetic regression fixtures. Establish source/staged/draft/validated-output session boundaries.
3. Add model service against the shared request pipeline, fake transport contract tests, sequential batching, bounded recovery and text cancellation. Integrate token-limit changes once their contract is settled.
4. Add native load/group/import and confirmed application/create/export services with conflict detection, preservation and image validation. Extract shared host helpers where appropriate.
5. Build the full Svelte vertical slice: both tabs, mobile comparison/edit/preview, confirmation and native navigation. Keep the same validated object for all outcomes.
6. Connect existing portrait service/settings and native file adapters. Add controlled legacy-preferences import and old-plugin coexistence guidance.
7. Perform focused offline tests and browser acceptance with synthetic characters/canned responses; run full typecheck/tests/build in the authorized cloud environment. Document scope/provenance, then seek separately required commit/push/PR authorization.

## Validation plan

Observed in this inspection: Node synthetic fixture, character adapter, template contract and editable-review suites all pass on merged Elsewords develop. Commands: `node tests/validate-fixtures.mjs`, `node tests/elsewhere-character-adapter.mjs`, `node tests/plugin-template.mjs`, `node tests/translation-review.mjs` from `elsewhere-plugin`. No build or browser/provider flow was run. Past Android acceptance is documented in `docs/translation-review.md`; it is user-reported evidence for the plugin, not proof of native UI acceptance.

Implementation tests must cover immutable sources, all supported wrappers/nested/empty fields, protected-variable multiplicity, bad/ambiguous responses and bounded retry, stale requests, close/reset, group identity, concurrent character edits/deletion, metadata/chat retention, portrait opt-in, interrupted confirmations, creation ordering, JSON/PNG export/re-import, migration absence/malformed values/idempotence and no secret/context leakage. Native preference tests must use disposable storage.

Focused checks: project Vitest paths for the new modules; `git diff --check`; formatter verification. Cloud gates: `pnpm check`, `pnpm test`, `pnpm build`, matching current PR CI. No dependency installation or expensive local check is authorized here.

Future visual acceptance launch: `pnpm dev --host 127.0.0.1` from the isolated Elsewhere worktree, using a disposable profile and a fake transport, with no configured real provider. Exercise both native entry points, group load, file import, translation, completion and fresh generation; compare/edit every output type; verify no write before global confirmation, pending/invalid export blocking, cancel/retry/close, corrected JSON/PNG re-import, portrait replacement opt-in, mobile/keyboard/theme behavior and reload persistence. Execute actual host file picker/download and Android checks; synthetic UI alone cannot certify platform adapters. Do not claim paid provider behavior was tested.

## Decisions for the user

Full current-plugin parity, including all settings, is already confirmed. Do not ask the user to choose a reduced V1 again. The two current entry points and Elsewords name remain the baseline; an extra character-context shortcut is optional new scope.

Remaining details: legacy generic-storage ambiguity needs a reviewable import policy; cross-restart persistence of previously transient prompts/drafts would need explicit new scope; license/provenance terms for copied sources must be recorded before publication. No concrete third-party dependency/attribution conflict was found, so do not turn Marie's belief into a false certification or invent a proven blocker. Confirm distribution authorization/terms proportionally to the inspected evidence.

The user's settings/parity answer does not clearly authorize a manual Git worktree fallback. No worktree is created; obtain that separate authorization if native isolation is unavailable. Implementation remains pending review of this concrete plan.

No code implementation has started. The plan is reviewable now. Manual worktree fallback, commits, pushes, PRs and repository/plugin retirement remain separately gated when applicable.

## Implementation authorization

Marie explicitly authorizes manual sibling worktree creation and implementation of full parity. Actual branch: feature/elsewords-native. Worktree: /home/marie/code/elsewhere.worktrees/feature-elsewords-native. Base: origin/develop at 15ff45f6, refreshed 2026-10-02. No commit/push/PR authorization.

## Current implementation milestone

Full native workflow source and eight-value preferences/migration are implemented. Core/adapter/review/session suites and isolated Svelte compilation pass. Independent review identified provider context leakage, model-routing guards, settings-navigation draft loss, generated-placeholder acceptance and desktop overwrite risk; corrections are implemented and awaiting fresh review. Full cloud typecheck/tests/build and actual-app acceptance remain pending. Native source documentation: docs/elsewords-native.md. Next action: finalize focused isolation regressions/review, export a reviewed patch for cloud gates without committing or pushing.

## Reviewed candidate and handoff

2026-10-02: fresh read-only independent review reports no remaining blocking findings after corrections. The original five findings plus NovelList isolated response normalization and missing local/cloud endpoint guards are fixed. No full typecheck/build or actual app/platform acceptance was performed locally. All four lightweight suites and diff whitespace check pass sequentially. Full cloud gates and real-surface acceptance are the next required steps. No commit, push, PR or merge is authorized.

Shared-interface coordination: additive requestDataArgument.isolatedContext suppresses implicit character/persona data in configured serializers while retaining ordinary chat behavior. It is independent of social publicOnly and should survive integration with social/token-limit request.ts changes. No sibling worktree was modified by this task. The token-limit worktree now contains unrelated ongoing changes by its owner; do not reset or copy them.

## Cloud QA correction

Cloud tests passed, but the first full typecheck reported nine errors and zero warnings. Owner corrections use the real readable alertStore from stores.svelte in both consumers, preserve the separate alertConfirm API, and define the eight-field Preferences schema with widened modes/styles and explicit validated/load return types. The session state adopts this schema. A focused TypeScript schema probe and readable-store import regressions now join the passing lightweight suites. Full cloud typecheck/build and real-app acceptance must be rerun on the corrected export; earlier test results do not certify the new candidate. No local heavy build or Git publication.


## Final draft-PR delivery record

This record supersedes earlier pending authorization and QA statements above. Marie authorizes finalization, atomic commits, push to mariepop13/elsewhere and a draft PR from feature/elsewords-native to develop. Merge, deployment, plugin removal and repository retirement remain unauthorized. origin/develop is verified at afe39d63bc0de654b462ef35cba0db5c59b069ce and already included; no additional synchronization merge is needed. Token-limit work is integrated through that base. The social and token-limit sibling worktrees remain untouched.

The final behavior uses literal {{char}} / {{user}} guidance, removes tagged reasoning before parsing/recovery/diagnostics, permits one bounded strict-JSON recovery, and normalizes legacy role sentinels. Translation keeps protected-variable multiplicity; generation/completion and generated review preserve distinct exact macros per staged field at least once, allowing repetition to change. This distinction supersedes blanket multiplicity requirements for generated prose. Editing preserves one globally validated result; large fields have bounded automatic sizing with manual resizing retained. Image reference diagnostics distinguish supported, unsupported and unknown metadata on the actual configured Image API route without expanding the accepted model set or silently selecting another route.

Cloud proof for native code tree deea5dfedc83f7cf5a64e64fb9f771f48a3c129c: 48 suites, 463 source tests passed, 465 preview tests passed, three skipped, zero type errors/warnings and both production builds passed. Additional evidence includes 40 targeted image tests, a 54-case before/after acceptance matrix, four native suites and 26 backup cases. The preview archive SHA-256 is 88bb45e98cff15ec2c1c66f68c4c8c1f25034de0d993a56838708fa877f8128a. Documentation changes after this code proof require final-head CI; the archive is not deployed as part of PR delivery. Marie reports successful actual JSON generation, but that observation does not certify full CCv3 round-trip fidelity, export or every platform.

Independent security/correctness, performance and accessibility review identifies no critical/high defects. Three medium follow-ups remain: inspect image dimensions before full decode to bound memory, bound recursive/field work for very large cards, and provide explicit keyboard focus for scrolling long original text where browsers do not focus scroll containers automatically. Browser-rendered geometry, contrast, complete keyboard flows and host/Android file adapters remain unverified. The previous browser-tool rejection is respected; no alternate browser route is used. No paid provider call or private diagnostic content is required for automated validation.

Delivery remains Partial for real-surface acceptance and eligible for draft review. The single PR retains the coupled native workflow and shared request isolation contract; separate stacked layers would not deliver independently usable outcomes. Commit groups cover editor sizing, generation recovery, image diagnostics and documentation, with exact-path staging. Backup changes, preview/runtime artifacts, private data and unrelated features are excluded. The PR targets develop, names no linked issue and requests eventual Squash and merge. No default-branch issue closure is inferred.
