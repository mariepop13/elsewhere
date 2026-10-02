<script lang="ts">
    import { language } from "src/lang";
    import { alertConfirm } from "src/ts/alert";
    import { loadInternalBackup } from "src/ts/globalApi.svelte";
    import { LoadLocalBackup, SaveLocalBackup, SavePartialLocalBackup } from "src/ts/drive/backuplocal";
    import Button from "src/lib/UI/GUI/Button.svelte";
    import { exportAsDataset } from "src/ts/storage/exportAsDataset";
    import { cleanColdStorage } from "src/ts/process/coldstorage.svelte";
</script>


<h2 class="mb-2 text-2xl font-bold mt-2">{language.account} & {language.files}</h2>

<Button
    onclick={async () => {
        if(await alertConfirm(language.backupConfirm)){
            SaveLocalBackup()
        }
    }} className="mt-2">
    {language.saveBackupLocal}
</Button>

<Button
    onclick={async () => {
        if(await alertConfirm(language.backupConfirm)){
            SavePartialLocalBackup()
        }
    }} className="mt-2">
    {language.savePartialLocalBackup}
</Button>

<Button
    onclick={async () => {
        if((await alertConfirm(language.backupLoadConfirm)) && (await alertConfirm(language.backupLoadConfirm2))){
            LoadLocalBackup()
        }
    }} className="mt-2">
    {language.loadBackupLocal}
</Button>

<Button
    onclick={async () => {
        if((await alertConfirm(language.backupLoadConfirm)) && (await alertConfirm(language.backupLoadConfirm2))){
            loadInternalBackup()
        }
    }} className="mt-2">
    {language.loadInternalBackup}
</Button>

<Button
    onclick={async () => {
        if(await alertConfirm(language.cleanColdStorageConfirm)){
            cleanColdStorage()
        }
    }} className="mt-2">
    {language.cleanColdStorage}
</Button>

<p class="mt-2 text-textcolor2">RisuAI Google Drive backup is unavailable in Elsewhere. Use the local backup controls above.</p>


<Button onclick={exportAsDataset} className="mt-2">
    {language.exportAsDataset}
</Button>
<div class="bg-darkbg p-3 rounded-md mb-2 flex flex-col items-start mt-2">
    <div class="w-full">
        <h1 class="text-3xl font-black min-w-0">Bring data from RisuAI</h1>
    </div>
    {#if localStorage.getItem('accountst') === 'able'}
        <p class="text-textcolor2">This installation previously used RisuAI account storage. Elsewhere has not loaded that account data. Keep the original RisuAI web app and account until you have exported and verified a local backup.</p>
    {/if}
    <p class="text-textcolor2">For account data, use the original RisuAI web app to save a local backup. Turn off its Skip Saving Assets on Web Sync setting first. Then use Load Backup Locally above. Check your chats and assets, and keep the original account and backup if anything is missing. Elsewhere does not connect to RisuAI accounts or Google Drive backups.</p>
</div>

<!--

    My song for dear, my old friend.

    Should old aquaintance be forgot,
    and never brought to mind?
    Should old lang syne be forgot,
    and auld lang syne?

    For auld lang syne, my dear,
    for auld lang syne,
    we'll take a cup o' kindness yet,
    for auld lang syne.

-->
