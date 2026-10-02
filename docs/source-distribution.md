# Source distribution and retained notices

This preparation covers publication of the Elsewhere repository's source code. It does not publish a hosted service, compiled web application, installer, container image, updater artifact, tag or GitHub release. The supported private local Node path is documented in [the Node guide](../server/node/readme.md#run-locally).

## Modification notice and attribution

[NOTICE](../NOTICE) records the fork's modifications and a relevant date, preserves attribution to RisuAI, Kwaroran and the original contributors, and identifies the reviewed code baseline. Keep that notice visible from the root README. Preserve the existing copyright, license, permission and no-warranty notices when redistributing sources; do not replace upstream copyright with a fork-only attribution.

The root [LICENSE](../LICENSE) contains GPL version 3, with `Copyright (C) 2024 Kwaroran`. Sections 4 and 5 describe distribution of original and modified sources, including retained notices, a dated modification notice and the license terms for covered work. This documentation records those requirements and the delivery choices; it is not a legal certification.

The generic application examples at the end of GPL and AGPL include an "or any later version" phrase. That example is not itself a program-specific grant. This preparation does not infer a `GPL-3.0-or-later` or `AGPL-3.0-or-later` grant or replace existing notices with a new SPDX declaration.

## Rpack choice and provenance

Preserve all of these files:

- [rpack LICENSE](../src/ts/rpack/LICENSE), which states the conditional MIT/AGPL-3.0 choice.
- [rpack LICENSE_AGPL](../src/ts/rpack/LICENSE_AGPL), the AGPL version 3 text.
- [rpack LICENSE_MIT](../src/ts/rpack/LICENSE_MIT), including `Copyright (c) 2026 Kwaroran` and its permission notice.
- [rpack README](../src/ts/rpack/README), which states that the JavaScript rewrite of the original Rust implementation has the original author's permission.
- [rpack_js.js](../src/ts/rpack/rpack_js.js) and its [512-byte mapping table](../src/ts/rpack/rpack_map.bin).

The MIT option is expressly limited to use within Risuai. The text assigns AGPL-3.0 to other applications or embedding Risuai in another application, and does not explicitly address a renamed fork. For this source distribution, Elsewhere treats rpack under AGPLv3 and does not rely on an inferred MIT exception. This records a conservative distribution choice rather than a claim that the ambiguity has been resolved by the original author.

GPLv3 section 13 and AGPLv3 section 13 expressly permit their covered works to be linked or combined. The respective licenses continue to govern their covered parts; the AGPL network-interaction requirements apply to the combination. Do not change every project file's license to AGPL or state that GPLv3 and AGPLv3 are incompatible.

Other third-party licenses retain their own scope. In particular, keep the tokenizer notices at [public/token/claude/LICENSE](../public/token/claude/LICENSE) and [public/token/trin/LICENSE](../public/token/trin/LICENSE). This record does not certify every dependency or asset's licensing.

## Interactive notices in modified sources

GPL and AGPL section 5(d) are also part of the conditions for conveying modified source versions. Assess appropriate legal notices in interactive interfaces during this source preparation, rather than deferring that assessment solely to future hosting. The section expressly includes an exception for interfaces in the original Program that do not display Appropriate Legal Notices; determine and record its applicability against the inherited interface before source promotion. Preserve any required existing notices.

A private setup notice or service contract dialog is not automatically an appropriate copyright/license notice. A source inspection compared the inherited `origin/main` baseline `25001174e0452e3b9d16aee459ce9d2444c197d7` with the current code baseline `15e9311bc6167df3a8485c99fe73537c286e7386`. Searches across Svelte interfaces and language files found a GPL3 attribution comment in `AlertComp.svelte`, which is not displayed, and an AGPL warning for an external WebUI in `OtherBotSettings.svelte`, which is not this application's license notice. The inspected support page, welcome screen, main menu and application shell did not contain an explicit copyright/no-warranty/redistribution/license-view notice satisfying all four elements of the section 0 definition. The service-configuration screen instead discusses service terms and privacy.

Rather than relying on an uncertain section 5(d) exception, this preparation adds a visible **Software licenses** item to the application settings, available in desktop/mobile layouts and Lite mode, and displays the same notice on the private local first-run screen. The notice identifies the original copyrights, explains the absence of warranty and the right to copy/modify/redistribute under the applicable terms, and provides native expandable views of the full GPLv3, rpack AGPLv3, original conditional MIT notice and dated modification notice.

The texts are imported directly from the retained source files through Vite's `?raw` mechanism, so reading them does not depend on an external site or new service. The source repository link is explicit user navigation. No acceptance state, service contract or legal-configuration flag is changed. This closes the technical notice gap without claiming that a particular original-interface exception has been legally established.

Before promotion, validate the rendered settings and first-run flows, keyboard operation, mobile/Lite access, offline text availability and exact license-text preservation in the produced bundle. This preparation does not certify every interface or future deployment. The repository link is not a verified exact-version AGPL network source offer; a later remote service still needs the source matching its actual running version.

Resource-limited component acceptance exercised the actual notice, first-screen and settings components with fictional stores and unrelated pages excluded. Desktop/mobile/Lite navigation, keyboard expansion, visible focus, mobile scrolling and exact full license-text reading in offline mode passed. The fixture used a previously tested project stylesheet, not newly generated production styles. The project type check passed with no errors or warnings, and the project test suite passed with one worker (305 passed, 3 skipped across 33 files). The full application build, newly generated production styles and the real Node application flow remain separate validation; these component and project-test results do not establish their success.

## Source availability and build inputs

A source publication must retain the preferred forms for modification and the applicable license notices. The checked-in rpack implementation is JavaScript, not WebAssembly. It uses a checked-in 512-byte encode/decode table; its README describes a rewrite, not a dependency on a compiled copy of the original Rust implementation.

Rpack is imported by module import/export, application preset import/export, and translation preset import/export. It is part of the application bundle, rather than an unrelated library merely stored alongside the app. Vite imports the table via `?url`; the tested web build inlined it in a JavaScript chunk. A sourcemap also referenced the rpack JavaScript source.

Keep the repository's source, `package.json`, `pnpm-lock.yaml`, build configuration and installation/build instructions available together. The GPL/AGPL definition of Corresponding Source includes required source and scripts controlling generation, installation and execution. A minified bundle or sourcemap alone is not the complete source delivery. Dependency installation currently requires network access and may fetch declared ONNX Runtime components; this source path does not promise an offline or fully reproducible binary build.

## Before any later compiled distribution or remote service

These checks are separate from the current source-only preparation:

1. Preserve and deliver the applicable attribution, license, permission and warranty notices with the distributed artifact. The software-license component imports the full root and rpack texts into the application, but the inspected Vite configuration does not copy standalone root or rpack license files into `dist/` automatically. Verify the built text views and any notices required by the other packaged components; do not assume repository files accompany a separate artifact.
2. For a compiled web bundle, installer or container, assess GPL/AGPL section 6 and provide the matching Corresponding Source through a permitted method. Include the relevant build/install/run inputs. Browser-delivered compiled JavaScript is also a distributed copy; deployment is not merely server-internal use.
3. If the modified combined work supports remote network interaction and falls under AGPL section 13, prominently offer all users interacting remotely access to the Corresponding Source of that version at no charge. That source includes the incorporated GPL-covered work. Verify that the offer is visible and reaches the source matching the actual running version; a generic repository link is not sufficient evidence of this match.
4. Recheck the interactive-notice disposition from this source preparation against the actual compiled artifact and any interface changes. Preserve required notices and verify that the provided license/source links work in that artifact.
5. Review the licenses and provenance of packaged dependencies and assets, and any remaining component-specific conditions. Do not infer an additional permission from this record.
6. Review public service, privacy and third-party integration requirements separately. Source licensing does not configure service contracts or establish legal compliance for hosting. Static-web routing and broader external dependencies remain tracked in issues #19, #20 and #22.

No service is deployed and no future binary or service is certified by this source preparation. Any later change to the rpack licensing choice requires a documented basis; this preparation does not request or invent permission from its author.
