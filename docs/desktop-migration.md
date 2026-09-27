# Desktop data migration to Elsewhere

Elsewhere has its own desktop application identifier, `io.github.mariepop13.elsewhere`. It installs and stores application data separately from RisuAI (`co.aiclient.risu`). Installing Elsewhere does not automatically read, move, or delete RisuAI data.

To bring local data across deliberately:

1. In the existing RisuAI desktop app, open **Settings → Account & Files** and choose **Save Backup Locally**. Use the full local backup so that available character assets are included. Keep the original backup in a safe location.
2. Install and start Elsewhere. In **Settings → Account & Files**, choose **Load Backup Locally** and select the backup file. This replaces Elsewhere's current local data, so do it before adding new content there.
3. Verify that chats, characters, and assets are present. Keep the original app and backup until you have checked them.

The backup can contain chat history, provider API keys, and other private settings. Store and share it accordingly. An existing RisuAI account or cloud backup is not an Elsewhere account; separate account and backup services are tracked in [issue #15](https://github.com/mariepop13/elsewhere/issues/15).

Older backups made while signed in on the RisuAI website may contain `encryption.risudat`. Importing one currently requests a decryption key from RisuAI's service. The ordinary backup made by the RisuAI desktop app does not use that website encryption path. Elsewhere asks before this legacy key lookup, and the RisuAI service must still be reachable for these files. Fork-owned account and backup services are tracked in [issue #15](https://github.com/mariepop13/elsewhere/issues/15).

## Existing RisuAI account data

Elsewhere does not connect to RisuAI accounts or Google Drive backups. If your only copy is in a RisuAI account, open the original **RisuAI web app** while signed in to that account. In its **Advanced Settings**, enable **Show Unrecommended** and turn off **Skip Saving Assets on Web Sync** before choosing **Save Backup Locally**. Import that backup into an empty Elsewhere profile. The original web exporter may still omit non-PNG assets, so compare chats, characters, and every important asset after import. Do not disconnect the original account, remove the original app, or discard the backup while anything is missing.

An installation that previously used RisuAI account storage may still have account settings or credentials saved locally. Elsewhere ignores those settings and does not automatically download the account data. Return to the original RisuAI web app to export it. If you have already created local data in Elsewhere, back up that profile first; loading another backup replaces its database rather than merging the two profiles.

To roll back an unsuccessful import, reopen the original RisuAI application or account and keep its data and the untouched backup file. Restore that backup only into a separate or empty Elsewhere profile. Legacy web backups containing `encryption.risudat` still require a user-confirmed RisuAI key lookup during restore. If that service is unavailable, use an earlier unencrypted desktop backup or recover through the original RisuAI account before trying the import again.

Elsewhere checks only the [Elsewhere releases](https://github.com/mariepop13/elsewhere/releases) for signed desktop updates. The updater will have no update to install until a published release includes `latest.json` and signed artifacts.
