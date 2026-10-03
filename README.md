# Elsewhere

[![Svelte](https://img.shields.io/badge/svelte-5-red?logo=svelte)](https://svelte.dev/) [![Typescript](https://img.shields.io/badge/typescript-5.9-blue?logo=typescript)](https://www.typescriptlang.org/) [![Tauri](https://img.shields.io/badge/tauri-2.5-%2324C8D8?logo=tauri)](https://tauri.app/) [![Vite](https://img.shields.io/badge/vite-8-%23646CFF?logo=vite)](https://vite.dev/) [![Tailwind CSS](https://img.shields.io/badge/tailwindcss-4-%2306B6D4?logo=tailwindcss)](https://tailwindcss.com/)

Elsewhere is a cross-platform AI chat application forked from [RisuAI](https://github.com/kwaroran/RisuAI). The original RisuAI project and its contributors retain credit for their work.

**Modification notice (2026-10-02):** Elsewhere modifies RisuAI's interface, integrations and local setup. See [NOTICE](NOTICE) for dated attribution and [source distribution requirements](docs/source-distribution.md) for retained GPLv3 notices and the conservative AGPLv3 choice for rpack. No MIT exception for this fork is assumed.

# Upstream screenshots

These screenshots show the RisuAI interface before Elsewhere's visual changes.

|         Screenshot 1         |         Screenshot 2         |
| :--------------------------: | :--------------------------: |
| ![Screenshot 1][screenshot1] | ![Screenshot 2][screenshot2] |
| ![Screenshot 3][screenshot3] | ![Screenshot 4][screenshot4] |

[screenshot1]: https://github.com/kwaroran/Risuai/assets/116663078/cccb9b33-5dbd-47d7-9c85-61464790aafe
[screenshot2]: https://github.com/kwaroran/Risuai/assets/116663078/30d29f85-1380-4c73-9b82-1a40f2c5d2ea
[screenshot3]: https://github.com/kwaroran/Risuai/assets/116663078/faad0de5-56f3-4176-b38e-61c2d3a8698e
[screenshot4]: https://github.com/kwaroran/Risuai/assets/116663078/ef946882-2311-43e7-81e7-5ca2d484fa90

## Features

- **Multiple API Supports**: Supports OpenAI, Claude, Gemini, DeepInfra, Ooba, OpenRouter... and More!
- **Emotion Images**: Display the image of the current character, according to his/her expressions!
- **Group Chats**: Multiple characters in one chat.
- **Native Elsewords**: Translate, generate and complete character cards with original comparison, editable output, confirmed application, portraits and JSON/PNG exports. See the [native workflow](docs/elsewords-native.md).
- **Plugins**: Add your features and providers, and simply share.
- **Regex Script**: Modify model's output by regex, to make a custom GUI and others
- **Powerful Translators**: Automatically translate the input/output, so you can roleplay without knowing model's language.
- **Lorebook**: Also known as world infos or memory book, which can make character memorize more. 
- **Themes**: Choose it from 3 themes, Classic, WaifuLike, WaifuCut.
- **Powerful Prompting**: Change the prompting order easily, Impersonate inside prompts, Use conditions, variables... and more!
- **Customizable, Friendly UI**: Great Accessibility and mobile friendly
- **TTS**: Use TTS to make the output text into voice.
- **Additional Assets**: Embed your images, audios and videos to bot, and make it display at chat or background!
- **Long-term Memory**: Advanced memory systems including HypaMemoryV2/V3 memory compression, SupaMemory for context management to maintain long-term conversation context.
- And More!

For documentation inherited from RisuAI, see the [upstream wiki](https://github.com/kwaroran/RisuAI/wiki). Some upstream-hosted features are still being separated from this fork.

## Project

- [Elsewhere repository](https://github.com/mariepop13/elsewhere)
- [Upstream RisuAI repository](https://github.com/kwaroran/RisuAI)

## Run from source (private local use)

This first delivery is source code only. Start with the supported [Node first-run guide](server/node/readme.md#run-locally): clone the repository, install the declared pnpm version, use the frozen lockfile, build, and run an authenticated loopback Node server. No desktop installer, container image, hosted Elsewhere service, or public Elsewhere proxy is provided by this delivery.

Node.js 20.19+ or 22.12+ is required. CI uses Node 24. The exact pnpm version is pinned in `package.json` (`12.4.2`). Rust is not needed for the Node path.

The private local mode shows a setup notice separate from third-party contract acceptance. It does not certify legal configuration for a hosted service. See the guide for data locations, a first run without provider keys, and remaining external dependencies.

- [Desktop data migration](docs/desktop-migration.md)
- [Maintainer release checklist](docs/releasing.md) (separate from this source-only delivery)

### Vite and Docker development

For frontend development, copy `.env.example` to `.env`, install with `pnpm install --frozen-lockfile`, then run `pnpm dev --host 127.0.0.1`. Alternatively, run `docker compose -f docker-compose.dev.yml up` and open `http://localhost:5173` after creating `.env`.

Vite development is not the Node self-hosted runtime: it has no Node password, Node save directory, or authenticated `/proxy2` routing guarantees. Its inherited `/hub-proxy` and `/nightly-hub-proxy` development routes still target upstream hubs. Static web routing and further external service separation remain open work ([#19](https://github.com/mariepop13/elsewhere/issues/19), [#20](https://github.com/mariepop13/elsewhere/issues/20)). Use Node for the supported first run. `RISU_DEV_ALLOWED_HOSTS` configures allowed Vite hostnames; Docker's development port remains bound to localhost. Private local mode is available only on loopback browser origins.
