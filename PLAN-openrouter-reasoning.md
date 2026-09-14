# OpenRouter reasoning controls

## Goal

Add first-class controls for OpenRouter reasoning/thinking on the selected model: enable or disable it where the model permits, select a supported reasoning effort, and set a reasoning-token budget when the selected model supports one. The request must use OpenRouter's unified `reasoning` object rather than provider-specific request fields.

## Evidence and constraints

- The current OpenRouter request branch builds routing/provider options in `src/ts/process/request/openAI/requests.ts`, but sends no `reasoning` request object.
- The current model picker reads `GET https://openrouter.ai/api/v1/models` in `src/ts/model/openrouter.ts`, but discards the response's per-model `reasoning` capability metadata.
- The generic `openrouter` model entry cannot describe the capabilities of every OpenRouter model, so the UI must be driven by the selected model's API metadata rather than static `LLMModel` parameters.
- Official documentation: [Reasoning Tokens](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens) documents `reasoning.enabled`, `reasoning.effort`, `reasoning.max_tokens`, mandatory-reasoning models, and the `/models` capability fields (`supported_efforts`, `default_effort`, `default_enabled`, `supports_max_tokens`, `mandatory`).
- The reasoning trace is already displayed for `message.reasoning`, `reasoning_content`, and streamed `delta.reasoning` / `reasoning_content`; this change does not expand conversation-history preservation of `reasoning_details`.

## Workspace and branch

This repository’s canonical `origin` is `https://github.com/mariepop13/elsewhere.git`, which is not a main-only exception. The selected workflow is therefore **GitFlow**. This is the target-worktree plan and is the required implementation approval gate.

- [x] Create the dedicated Orca worktree from `develop`. It is located at `/home/marie/orca/workspaces/elsewhere/feature-openrouter-reasoning-controls`.
- [x] Verify and correct the branch to the expected GitFlow name: `feature/openrouter-reasoning-controls`; the worktree was clean before this plan was copied.
- [x] Copy this plan from the parent workspace without moving or changing its unrelated untracked files (`PLAN-gitflow-rulesets.md` and `cyberpunk-onboarding-proposal.html`).
- [x] Obtain a task-specific Plannotator approval of this copied plan in the target worktree before any implementation edit or worker dispatch (approved via Plannotator).

## Steps

- [x] **Model metadata — `src/ts/model/openrouter.ts`**
   - Add narrow TypeScript types for OpenRouter's optional `reasoning` metadata and supported effort values.
   - Parse and retain that metadata from `GET /api/v1/models` in `OpenRouterModelInfo`, with runtime guards for optional/malformed API values.
   - Keep the existing model-grid contract unchanged; metadata is consumed only by the OpenRouter settings surface.

- [x] **Persisted configuration — `src/ts/storage/database.svelte.ts`**
   - Add an OpenRouter-specific reasoning configuration to `Database` and `botPreset`, defaulted/migrated without affecting existing users or presets.
   - Include it in preset save and restore paths. Use an unset configuration to preserve OpenRouter/model defaults until the user explicitly changes a control.
   - Store only user intent (on/off plus optional effort or token budget), never a server-derived capability snapshot.

- [x] **Capability-aware settings UI — `src/lib/Setting/Pages/`**
   - Add a focused OpenRouter reasoning settings component, rendered by `OpenrouterSettings.svelte` after loading the selected model's metadata.
   - Hide all reasoning controls for models whose API metadata omits `reasoning` (including dynamic `openrouter/auto` and `openrouter/free`).
   - For eligible models, present:
     - an enable/disable control unless `mandatory` is true;
     - only the effort levels reported in `supported_efforts` (falling back to OpenRouter's documented gateway values only when the API explicitly reports `null`);
     - a token-budget control only when `supports_max_tokens` is true.
   - Seed unconfigured controls from `default_enabled` / `default_effort` without writing defaults just by opening Settings. If reasoning is mandatory, omit the disable option and allow effort/budget configuration.
   - Use existing translated labels where available and add localized strings for new labels in every supported locale as required by the project’s language type contract.

- [x] **Request serialization — `src/ts/process/request/openAI/requests.ts`**
   - In the existing `aiModel === 'openrouter'` branch, serialize the persisted intent as OpenRouter's `reasoning` object.
   - Disabled reasoning is expressed as `reasoning: { effort: 'none' }`; do not emit a disabling request for mandatory models because the UI cannot persist that state.
   - Enabled/default reasoning sends `enabled: true` when that is the only selected configuration, or the selected `effort` and/or positive `max_tokens`. Do not send empty or invalid fields.
   - Preserve existing routing, provider selection, prompting, tool use, streaming, and response-reasoning display behavior.

- [x] **Tests — `src/ts/process/request/openAI/requests.openrouter.test.ts` (new, focused)**
   - Mock the OpenRouter HTTP path and verify outgoing JSON for disabled, enabled-with-effort, and enabled-with-budget configurations.
   - Verify no `reasoning` field is emitted for a legacy/unconfigured preset and that unrelated OpenRouter routing fields are retained.

## Verification

- [x] Run the focused Vitest file for request serialization.
- [x] Run `pnpm check`.
- [x] Run the relevant formatter/lint command if available from `package.json` (none is defined).
- [ ] Browser/manual acceptance procedure (requires an OpenRouter API key; do not paste it into source, logs, screenshots, or a shared environment):
   - Select **OpenRouter** as the provider and choose a model whose Models API metadata advertises reasoning (for example, a current reasoning-capable model shown by the picker).
   - Open **OpenRouter Settings**. Confirm the displayed enable/disable control, available effort values, and token-budget control match that model’s advertised capability; models without metadata show no reasoning controls.
   - Enable reasoning, choose an effort, send a short prompt, and confirm the model response appears normally with returned thoughts when the provider exposes them.
   - Disable reasoning on a non-mandatory model, send the same prompt, and confirm the request succeeds without a displayed reasoning trace when the provider honors the setting.
   - Switch to `openrouter/auto` or `openrouter/free`, confirm controls are hidden, then switch back and confirm the saved explicit settings remain available.
   - Save/switch presets and confirm the configured controls restore with the preset.

## Non-goals

- No support for OpenRouter `reasoning.mode`, `reasoning.context`, per-message effort updates, `exclude`, or `reasoning_details` replay in this change.
- No guessing model capabilities from model names or static provider lists.
- No changes to non-OpenRouter providers.

## Delegation

After the feature worktree is created and the copied plan has a task-specific Plannotator approval **inside that worktree**, delegate the isolated request-serialization test file only:

- **Target/model:** Pi native subagent in the `feature/openrouter-reasoning-controls` worktree through the `cheap` model-manager profile; use the lowest-cost implementation-capable worker available.
- **Approval record:** `PLAN-openrouter-reasoning.md` copied into that worktree and approved there; dispatch only after verifying the feature branch name above.
- **Exclusive ownership:** create/edit only `src/ts/process/request/openAI/requests.openrouter.test.ts`.
- **Settled interface:** tests assert the `openrouterReasoning` persisted configuration and `reasoning` JSON contract specified above; production API/types/storage/UI remain owned by the primary agent.
- **Evidence required:** focused Vitest command and concise summary of assertions; the primary agent reviews the patch before integration.

The primary agent retains architecture, persistence migration, UI, request implementation, integration, code review, and final validation.
