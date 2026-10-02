# Elsewhere desktop releases

The first planned desktop version is `1.0.0`, with Git tag `v1.0.0`. `package.json`, `version.json`, `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, and `appVer` in `src/ts/storage/database.svelte.ts` must agree before a tag is created.

## Terminal-only Linux validation

The frontend checks do not need Rust or a graphical session:

```sh
pnpm check
pnpm test
pnpm build
```

A native Linux build needs Rust, Cargo, and the [Tauri Linux prerequisites](https://v2.tauri.app/start/prerequisites/). On Ubuntu 24.04, install these packages and [Rust through rustup](https://rust-lang.org/tools/install/):

```sh
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
cargo --version
TAURI_SIGNING_PRIVATE_KEY="$HOME/.local/share/elsewhere/updater.key" TAURI_SIGNING_PRIVATE_KEY_PASSWORD='' pnpm tauri build --bundles deb --ci
```

The build creates a Linux installer without opening a window. Run `pnpm tauri dev` only from a graphical session. On a headless host, test the produced installer on a desktop machine before publishing; successful compilation alone does not verify installation or use.

## Before creating a tag

1. Finish the upstream-service, proxy, and legal work tracked in [#14](https://github.com/mariepop13/elsewhere/issues/14), [#19](https://github.com/mariepop13/elsewhere/issues/19), and [#22](https://github.com/mariepop13/elsewhere/issues/22), or explicitly decide the supported distribution scope.
2. Run the project checks and verify the desktop installer on each intended platform. A web build does not validate native packaging or installation.
3. Preserve a secure backup of Elsewhere's Tauri updater private key outside the build machine. The `TAURI_PRIVATE_KEY` repository Actions secret contains a copy for CI, but GitHub does not allow retrieving the stored secret value later. Do not commit or share the private key.
4. Confirm the release workflow uses the public key in `src-tauri/tauri.conf.json` and only the Elsewhere release endpoint.

## Publish

1. After the tested release commit is on the intended release branch, create and push the matching `v<version>` tag to the Elsewhere fork.
2. The `publish` workflow builds installers and updater artifacts for macOS, Linux, and Windows and creates a draft GitHub release. Check its jobs, assets, `latest.json`, and notes.
3. Publish the reviewed draft release. The desktop updater reads `https://github.com/mariepop13/elsewhere/releases/latest/download/latest.json` and verifies artifacts with Elsewhere's public key.

The Docker image workflow is manual so a desktop tag does not automatically publish the web server image. Run it only when the web distribution and upstream-service separation are ready. `docker-compose.yml` refers to the fork-owned `ghcr.io/mariepop13/elsewhere:latest` image.
