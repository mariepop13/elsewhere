# Elsewhere Node server

The Node server serves the built application and forwards provider requests from an authenticated browser on the same origin. It supports remote self-hosting and local/LAN providers. The experimental [Hono server](../hono/README.md) is a separate implementation; these routing guarantees apply to `server/node/server.cjs`.

## Run locally

Use the Node and pnpm versions declared in the root `package.json`:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm runserver
```

Open `http://localhost:6001`. Set a server password and sign in using the existing Node authentication flow. `PORT` changes the listening port. The existing certificates under `server/node/ssl/certificate` enable HTTPS; use HTTPS for a remote/LAN browser and protect the server password and save directory. A trusted reverse proxy can be configured with the existing `TRUST_PROXY` environment variable.

The legal configuration and first-run requirements remain tracked separately in [issue #22](https://github.com/mariepop13/elsewhere/issues/22).

## Provider routing policy

- Tauri uses its native HTTP plugin directly for ordinary and streaming HTTP requests. Browser-direct settings and userscripts do not override that route.
- Node uses its authenticated same-origin `/proxy2` route for ordinary and streaming HTTP requests, including local/LAN providers. Provider credentials remain inside the encoded provider headers, separate from the Node authentication header. Requests that previously used browser fetch, such as Google service-account OAuth, Horde, Stability multipart images, token counting, TTS, and provider metadata, share this policy on Node and Tauri.
- Legacy Ooba WebSocket streaming on Node uses `/proxy-websocket`. Authentication is sent in the first frame, never in the socket URL or to the provider. Closing or aborting the browser socket disconnects the provider. Tauri retains its existing direct WebView WebSocket connection for this legacy protocol to preserve LAN compatibility. This is an explicit exception to the native HTTP policy: the project declares no native WebSocket transport. Use an OpenAI-compatible HTTP endpoint for native Tauri streaming.
- A failed route never retries directly in the browser or through a RisuAI hub. Missing `/proxy2`, connection failures, proxy authentication errors, and timeouts produce an actionable error. Provider HTTP status codes and bodies are preserved.
- Node accepts configured HTTP(S) provider destinations, including private networks and Docker DNS names, after authentication. This is an intentional LAN capability, not a public anonymous proxy. Do not give an untrusted person access to the server's provider proxy.
- Provider requests cannot target `sv.risuai.xyz` or `nightly.sv.risuai.xyz`. The old `/hub-proxy/proxy`, `/hub-proxy/proxy2`, and `/hub-proxy/proxy-stream-jobs` paths are disabled. The hub constant and unrelated legacy services are not replaced by an Elsewhere public proxy.

## Credentials, redirects, and streams

Provider URLs must use HTTP(S), or WS(S) for legacy sockets, and must not contain embedded username/password credentials. Authorization, `x-api-key`, `apikey`, `xi-api-key`, and other provider headers are preserved. Node authentication, cookies, hop-by-hop headers, and proxy control headers are filtered out before forwarding. Provider cookies and redirect headers are not installed on the application origin.

Node follows at most five same-origin HTTP redirects. Cross-origin redirects are blocked before sending the request body or credentials to the next destination. Configure the final provider URL explicitly when a provider redirects across origins. Native Tauri HTTP requests and Node legacy provider sockets do not follow redirects automatically. The retained Tauri/WebView legacy socket behavior has not been validated on a desktop runtime.

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
