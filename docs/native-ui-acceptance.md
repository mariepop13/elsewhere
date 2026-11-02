# Native UI acceptance before deployment

Run type checks, unit tests and the production build first. Then run the native UI gate against that exact built artifact. Do not deploy on a failed gate, a different source tree, missing evidence or an interrupted cleanup.

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright \
QA_BROWSER_EXECUTABLE=/absolute/path/to/chromium \
node scripts/qa/nativeUiGate.cjs \
  --dist /absolute/path/to/build-private \
  --manifest /absolute/path/to/build-manifest.json \
  --tree EXPECTED_SOURCE_TREE \
  --report /absolute/path/to/acceptance-report
```

The manifest must contain `candidate_tree`, `build_preview_origin` and `built_files` entries with `path` and `sha256`. Every compiled file is checked before launching. Harness changes have their own provenance and must not be described as part of an already frozen production tree.

The runner requires Node.js, the project's declared dependencies, an available Playwright installation and Chromium. HTTPS fixtures also require an existing OpenSSL executable. No installation or credentials are performed by the runner. Use an idle loopback port matching the build's configured preview origin. A busy port fails; the gate never stops another listener. Do not use ports reserved by another validation task.

All cards, messages, provider responses and saved files are disposable fixtures. The owned browser resolves the preview hostname to the owned loopback fixture listener. External requests are denied and fixture responses constrain connections and workers to that origin. The real application bundle, native UI, storage encoding and StreamSaver download path are exercised. Production data, provider keys and the user's browser are not used.

Acceptance covers greeting action restrictions and alternate replies; regular and legacy message actions; deletion confirmation/cancellation; branching; native editor closure after character deletion; actual JSON and PNG downloads and native reimport; navigation/reload persistence; and mobile overflow. Any JavaScript error, unexpected request, wrong observable outcome or cleanup error fails. `result.json` is written after independent cleanup of the owned browser, listener and ephemeral certificate. Downloaded cards and screenshots contain fixture content only.

This gate does not establish physical-device, Tauri save-dialog or real-provider compatibility. Do not infer exhaustive feature coverage from a passing result. Keep failed attempts and report any remaining acceptance gaps. CI integration and deployment authorization remain separate tasks.
