# Desktop data migration to Elsewhere

Elsewhere has its own desktop application identifier, `io.github.mariepop13.elsewhere`. It installs and stores application data separately from RisuAI (`co.aiclient.risu`). Installing Elsewhere does not automatically read, move, or delete RisuAI data.

To bring local data across deliberately:

1. In the existing RisuAI desktop app, open **Settings → Account & Files** and choose **Save Backup Locally**. Use the full local backup so that available character assets are included. Keep the original backup in a safe location.
2. Install and start Elsewhere. In **Settings → Account & Files**, choose **Load Backup Locally** and select the backup file. This replaces Elsewhere's current local data, so do it before adding new content there.
3. Verify that chats, characters, and assets are present. Keep the original app and backup until you have checked them.

The backup can contain chat history, provider API keys, and other private settings. Store and share it accordingly. An existing RisuAI account or cloud backup is not an Elsewhere account; separate account and backup services are tracked in [issue #15](https://github.com/mariepop13/elsewhere/issues/15).

Older backups made while signed in on the RisuAI website may contain `encryption.risudat`. Importing one currently requests a decryption key from RisuAI's service. The ordinary backup made by the RisuAI desktop app does not use that website encryption path. Fully independent handling of legacy account backups is tracked in [issue #14](https://github.com/mariepop13/elsewhere/issues/14) and [issue #15](https://github.com/mariepop13/elsewhere/issues/15).

Elsewhere checks only the [Elsewhere releases](https://github.com/mariepop13/elsewhere/releases) for signed desktop updates. The updater will have no update to install until a published release includes `latest.json` and signed artifacts.
