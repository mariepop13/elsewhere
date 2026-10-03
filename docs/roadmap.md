# Elsewhere distribution roadmap

## First publication: source code only

Promote the reviewed source candidate from the integration branch to `main` through a draft release pull request in `mariepop13/elsewhere`. This phase supplies source for private local use through the documented Node runtime. It does not publish a tag, installer, container image, hosted website, updater artifact or public proxy. Social features and model token-limit work are not prerequisites for this source candidate and are excluded from its frozen baseline.

The supported flow is clone, pinned dependency installation with the frozen lockfile, build, authenticated loopback Node startup, private local setup, and persisted data. Vite development and static-web hosting have different routing and storage boundaries. See [the Node guide](../server/node/readme.md#run-locally).

### Attribution and license boundary

Preserve upstream attribution, original copyrights and license texts. [NOTICE](../NOTICE) records the dated modifications. Treat rpack under AGPLv3 for this source distribution without inferring that its conditional MIT permission extends to Elsewhere. GPLv3 continues to govern its covered parts; this choice does not relicense every component as AGPL. Keep the application notices accessible through Software licenses and the private first-run screen. See [source distribution requirements](source-distribution.md).

### Promotion checks

- Confirm the exact candidate and target belong to the fork, retain all source and applicable notices, and resolve integration conflicts without losing either branch's intended content.
- Verify type checks, project tests and production build on the reviewed candidate. Record the exact PR head and CI results.
- Retain the distinction between isolated component acceptance and actual application acceptance. Verify the production Node first-run and settings flow, generated styles, complete bundled license texts, keyboard access, mobile/Lite navigation and persistence before treating those paths as fully validated.
- Preserve user data, secrets and session plans outside publication. No real paid provider is required for the first run.
- A draft PR and passing CI do not authorize its merge, a tag, artifact publication or deployment. Those operations require separate authorization.

## Native character workshop

Elsewords becomes a native Elsewhere character workshop with full parity with the merged plugin, rather than a separately maintained product. The chat-menu and Settings entry points share translation, new-character generation, completion, portrait handling and import/export. Original and editable output are reviewed together; one globally validated result is used for confirmed application, creation and downloads, without per-field keep/reject decisions.

Reuse Elsewhere model settings, credentials and authoritative model limits. Supply only user-written instructions and explicitly staged card data, excluding implicit chat/persona context. Retain the eight translation preferences through optional reviewed import; keep the old plugin storage and repository until separately authorized retirement. Drafts and response diagnostics remain session-only.

Promotion requires exact-head automated validation and real application acceptance of comparison/editing, confirmation/conflicts, cancellation, migration, file adapters and mobile/keyboard flows. Format support follows the native guide; exhaustive CCv3 round-trip fidelity, every provider and every platform are not certified by the initial integration. See [Native Elsewords](elsewords-native.md).

## Later distribution scopes

Desktop packaging and updater publication use the separate [desktop release checklist](releasing.md). No public release version is assigned by this source-only phase.

Before distributing compiled web bundles, installers or containers, provide the required notices and matching Corresponding Source through an applicable method, and validate the actual artifact. Before running a remote service subject to AGPL section 13, provide a prominent source offer matching the running version. Source licensing does not configure service terms or privacy policies.

Static-web route policy remains [#19](https://github.com/mariepop13/elsewhere/issues/19); broader external dependencies remain [#20](https://github.com/mariepop13/elsewhere/issues/20); public service/legal configuration remains [#22](https://github.com/mariepop13/elsewhere/issues/22). This source-only phase does not close those issues or certify every dependency or deployment.
