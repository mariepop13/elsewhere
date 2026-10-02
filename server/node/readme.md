# Elsewhere Node server

The Node server serves the built application and forwards provider requests from an authenticated browser on the same origin. It supports remote self-hosting and local/LAN providers. The experimental [Hono server](../hono/README.md) is a separate implementation; these routing guarantees apply to `server/node/server.cjs`.

## Run locally

This path is for private use on one computer. It does not publish a website or open a public proxy. Use Node.js 20.19+ or 22.12+ (CI uses Node 24) and the pnpm version declared in the root `package.json`, currently `12.4.2`. Rust and desktop build tools are not required.

### Clone, install, and build

```sh
git clone https://github.com/mariepop13/elsewhere.git
cd elsewhere
```

Use the source revision you intend to run. Before the first source publication on `main`, `develop` is the integration branch containing the latest fixes; check out the desired branch when cloning, for example `git clone --branch develop https://github.com/mariepop13/elsewhere.git`.

If Corepack is already available, `corepack pnpm --version` should report the version pinned in `package.json`. Otherwise install that exact pnpm version using your existing Node/package-manager setup. Do not substitute an arbitrary pnpm version or regenerate the lockfile.

From the checkout root, on a POSIX shell:

```sh
cp .env.example .env
pnpm install --frozen-lockfile
pnpm build
HOST=127.0.0.1 PORT=6001 pnpm runserver
```

On PowerShell, copy with `Copy-Item .env.example .env`, set `$env:HOST = "127.0.0.1"` and `$env:PORT = "6001"`, then run the same pnpm commands. Dependency installation needs network access and may download native ONNX Runtime components; it does not require installing CUDA for this first-run scenario.

`.env.example` selects `VITE_ELSEWHERE_USAGE_MODE=private-local`. This build-time option is active only on `localhost`, `127.0.0.1`, or IPv6 loopback browser origins. Rebuild after changing it. It is separate from the inherited `VITE_RISU_LEGAL_CONFIGURED` flag: do not set that flag just to get past the first screen or present it as legal compliance. A build without the explicit private mode retains the inherited service configuration notice. Private mode does not configure a public/shared hosted service's contracts or privacy policy.

### First browser session

1. Open `http://127.0.0.1:6001` in a separate browser profile for a test run. Keep the same hostname and port on later visits.
2. Set a server password when prompted, then sign in if prompted. This password protects the Node instance, including its provider proxy. It is not a Sionyw/Elsewhere cloud account. The authentication dialog may appear over the setup notice while local data initializes.
3. Read **Elsewhere: private local source build** and choose **Continue with local setup**. This records only a local notice acknowledgement (`elsewhere.localNotice.v1`) in that browser origin, never a Sionyw contract acceptance (`tos4`).
4. Choose a language if needed, enter a display name, and choose **I will setup myself** (defer provider setup). No provider key or paid service is required to reach the application. Provider configuration can be completed later in Settings. Do not send a chat until a provider is configured.
5. Allow automatic saving to finish before reloading or closing the page. Then reload. The local notice stays acknowledged in this browser profile and the setup/data should persist. A different origin or fresh profile requires its own acknowledgement and Node sign-in.

For validation, use only a fake display name, a throwaway password, and fictional data. Stop the process with Ctrl+C when done. To start another isolated test, use another fresh checkout, a fresh browser profile, and a distinct port (for example `HOST=127.0.0.1 PORT=6603 pnpm runserver`). Do not delete or reset an existing installation's data.

### Data and network boundaries

The Node process uses its current working directory: run `pnpm runserver` from the checkout root. It serves `dist/` and creates `save/` there. That directory contains password/authentication material, chats/settings, assets, and configured provider keys. The browser also retains local settings and authentication keys. Protect both, keep backups, and do not commit `.env`, `save/`, or real credentials. The server password does not provide encryption at rest. Deleting the browser profile does not delete the Node save directory.

`HOST=127.0.0.1` explicitly binds the server to loopback; `PORT` changes the port. Without `HOST`, the existing Node default binds all interfaces (IPv6 `::` when available, otherwise IPv4 `0.0.0.0`). The first-run command deliberately uses loopback. Do not expose an uninitialized server or give an untrusted person access to its provider proxy. Existing certificates under `server/node/ssl/certificate` enable HTTPS. Remote/shared hosting, trusted reverse-proxy configuration (`TRUST_PROXY`), and the operator's service/privacy documents require separate setup and are outside this first-run path.

Opening the app without provider configuration is not a guarantee of complete offline operation. These remaining integrations are distinct from the supported Node provider transport:

| Feature                                      | External dependency or boundary                                                                                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-page styles                            | The inherited page requests KaTeX CSS from `cdn.jsdelivr.net` and decorative Google Fonts from `fonts.googleapis.com`. The local setup can proceed with those requests blocked, but math/font styling may differ.                                                         |
| AI generation, embeddings, image generation  | Contacts the configured provider when invoked; requests can contain prompts, chat context, assets, and provider keys. Local/LAN providers are supported through authenticated Node routing.                                                                               |
| Translation                                  | DeepL APIs, Google Translate endpoints, or the configured DeepLX service; translated text leaves the application when enabled.                                                                                                                                            |
| Speech                                       | Depending on configuration, browser speech or ElevenLabs, OpenAI, NovelAI, Hugging Face, Fish Audio, and other configured services.                                                                                                                                       |
| Local model/tokenizer or translation engines | Some engines download models/runtime assets before local inference. Installed source dependencies alone do not make every engine offline.                                                                                                                                 |
| Plugins and MCP                              | User-selected plugins/tools may contact their own services. Inspect them before enabling them. The inherited MCP OAuth helper contains Sionyw endpoints.                                                                                                                  |
| Upstream account/cloud storage               | Legacy Sionyw/account modules remain in the source. Elsewhere's automatic account sync, RisuRealm entry points, and upstream Google Drive backup are disabled; local backup/import is the supported migration path. This is not certification of all legacy integrations. |

Third-party contract dialogs remain separate and retain an explicit Accept/Do not Accept choice if invoked by a service flow. Continuing the local notice never writes their acceptance. The first-run test does not use those services or accept their contracts. The remaining external dependency audit is [#20](https://github.com/mariepop13/elsewhere/issues/20).

This source delivery preserves `LICENSE` and upstream credits. The conditional MIT/AGPL licensing question for rpack is a separate maintainer review, not a conclusion of this guide. This path does not build an installer, create a release/tag, or certify the experimental Hono server or static web hosting.

## Provider routing policy

- Tauri uses its native HTTP plugin directly for ordinary and streaming HTTP requests. Browser-direct settings and userscripts do not override that route.
- Node uses its authenticated same-origin `/proxy2` route for ordinary and streaming HTTP requests, including local/LAN providers. Provider credentials remain inside the encoded provider headers, separate from the Node authentication header. Requests that previously used browser fetch, such as Google service-account OAuth, Horde, Stability multipart images, token counting, TTS, and provider metadata, share this policy on Node and Tauri.
- Legacy Ooba WebSocket streaming on Node uses `/proxy-websocket`. Authentication is sent in the first frame, never in the socket URL or to the provider. Closing or aborting the browser socket disconnects the provider. Tauri retains its existing direct WebView WebSocket connection for this legacy protocol to preserve LAN compatibility. This is an explicit exception to the native HTTP policy: the project declares no native WebSocket transport. Use an OpenAI-compatible HTTP endpoint for native Tauri streaming.
- A failed route never retries directly in the browser or through a RisuAI hub. Missing `/proxy2`, connection failures, proxy authentication errors, and timeouts produce an actionable error. Provider HTTP status codes and bodies are preserved.
- Node accepts configured HTTP(S) provider destinations, including private networks and Docker DNS names, after authentication. This is an intentional LAN capability, not a public anonymous proxy. Do not give an untrusted person access to the server's provider proxy.
- Provider requests cannot target `sv.risuai.xyz` or `nightly.sv.risuai.xyz`. The old `/hub-proxy/proxy`, `/hub-proxy/proxy2`, and `/hub-proxy/proxy-stream-jobs` paths are disabled. The hub constant and unrelated legacy services are not replaced by an Elsewhere public proxy.

## Credentials, redirects, and streams

Provider URLs must use HTTP(S), or WS(S) for legacy sockets, and must not contain embedded username/password credentials. Authorization, `x-api-key`, `apikey`, `xi-api-key`, and other provider headers are preserved. Node authentication, cookies, hop-by-hop headers, and proxy control headers are filtered out before forwarding. Provider cookies and redirect headers are not installed on the application origin.

Node follows at most five same-origin HTTP redirects. Cross-origin redirects are blocked before sending the request body or credentials to the next destination. Configure the final provider URL explicitly when a provider redirects across origins. Native Tauri HTTP requests and Node legacy provider sockets do not follow redirects automatically. The retained Tauri/WebView legacy socket was validated on Linux with a loopback simulated provider. This does not certify real providers or other desktop platforms.

Bodies are forwarded byte for byte, including JSON, URL-encoded OAuth forms, multipart images, and binary payloads. SSE is streamed with buffering disabled. Abort signals and client disconnections cancel provider requests. A requested timeout remains active through the entire HTTP response stream; Node accepts timeout values up to one hour. If a timeout or connection failure occurs after streaming has started, the stream fails rather than pretending that a truncated response completed successfully.

Request diagnostics retain the destination without URL query values, safe content-type/accept headers, status, and timing metadata. The diagnostic `success` flag records the initial HTTP status, not successful completion of a streamed generation. They omit request/response content and redact other header values. Provider payloads and raw network exceptions are not written to server logs. Reverse-proxy access logs must also avoid recording request bodies, authorization/control headers, and WebSocket frames. The older LAN stream-job endpoints remain available for compatibility; this application's HTTP streams use `/proxy2` rather than retrying a job through a second route.

## Validate with fake providers

```sh
node --test server/node/providerProxy.integration.cjs
node --test server/node/providerFixture.integration.cjs
pnpm exec vitest run src/ts/globalApi.svelte.test.ts src/ts/network/nodeProxy.test.ts
pnpm check
pnpm test
pnpm build
```

The integration fixture starts the actual Node server in a temporary directory with a fake password and signed browser JWT. Local HTTP/WebSocket providers check authorization, raw bodies, provider errors, streaming, cancellation, timeouts, redirects, blocked hub destinations, and safe logs. Only fake keys and prompts are used.

Start the development-only provider fixture in a second terminal:

```sh
node server/node/providerFixture.cjs
```

It listens only on `127.0.0.1:6602`. Configure the model URL as `http://127.0.0.1:6602/v1/chat/completions`, the key as `fake-provider-key`, and the model ID as `fake-model`. Use `fake-ordinary`, `fake-stream`, `fake-provider-error`, and `fake-slow-stream` as prompts for the ordinary, streaming, provider-error, and cancellation scenarios. `http://127.0.0.1:6602/trace` exposes only this fixture's local test trace; do not use a real key or private conversation. Point the model temporarily to a closed local port to exercise a proxy connection error. Stop only the fixture and server started for this test.

For browser acceptance, configure an OpenAI-compatible model with a local simulated provider URL and a fake key, send a fake prompt with response streaming disabled, enable streaming and send again, then exercise provider/proxy errors and cancellation. Inspect the network panel: provider HTTP requests must leave the browser through the same-origin `/proxy2`; ordinary and streaming payloads must reach only the configured simulated provider on the server. There must be no AI traffic to `sv.risuai.xyz` or `nightly.sv.risuai.xyz`. Verify the Lua help label and its direct upstream documentation destination in the script editor.

## Remaining issue #19 scope

This is the self-hosted Node transport step of [issue #19](https://github.com/mariepop13/elsewhere/issues/19). Static web routing still requires a separate policy, user-facing route configuration/status, and browser acceptance. An optional public Elsewhere proxy is a later decision. Other hosted model/services dependencies belong to [issue #20](https://github.com/mariepop13/elsewhere/issues/20); this transport work does not certify those integrations. Do not close #19 based on Node validation alone.
