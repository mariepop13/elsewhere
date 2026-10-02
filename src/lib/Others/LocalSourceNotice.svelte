<script lang="ts">
    import Button from '../UI/GUI/Button.svelte'
    import SoftwareLicenses from '../Setting/Pages/SoftwareLicenses.svelte'
    let { oncontinue, preview = false }: { oncontinue: () => void; preview?: boolean } = $props()
</script>

<div
    class="local-source-notice bg-bgcolor text-textcolor"
>
    <section
        class="local-source-card border border-borderc rounded-lg space-y-4"
        aria-labelledby="local-source-title"
    >
        <h1 id="local-source-title" class="text-2xl font-semibold">
            {preview ? 'Elsewhere: temporary private preview' : 'Elsewhere: private local source build'}
        </h1>
        <p>
            {#if preview}This temporary preview is available only at the authorized private Tailnet address. It will be removed after the test. Use fictional data for this first session.{:else}You are running the source application on this computer. Elsewhere does not provide a hosted service or an account for this setup.{/if}
        </p>
        <p>
            With the Node server, chats, settings, assets, and provider keys are
            saved in the server's save directory. The browser also keeps local
            settings and its server sign-in. Protect both locations and use a
            separate browser profile for testing.
        </p>
        <p>
            You can finish setup without a provider key. If you later enable an
            AI provider, translation, speech, model downloads, plugins, or
            another integration, it may contact external services and send data
            according to your configuration.
        </p>
        <p>
            This notice describes the local setup. Continuing does not accept
            Sionyw or any other third-party contract, and does not certify a
            public deployment's legal configuration. Review the relevant
            service's terms before using it.
        </p>
        <p class="text-textcolor2">
            {#if preview}Previous browser data at this address is preserved. You can configure your own provider in Settings → Chat Bot and request real reactions. Its usual charges apply. Social reactions send only your public world, public profiles, posts and comments to the provider you choose.{:else}For this first run, use a loopback Node server. Public or shared hosting needs its own service configuration and review. See the repository's Node server guide.{/if}
        </p>
        <SoftwareLicenses />
        <Button onclick={oncontinue}>Continue with local setup</Button>
    </section>
</div>

<style>
    .local-source-notice {
        width: 100%;
        height: 100%;
        max-height: 100dvh;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        box-sizing: border-box;
        padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
    }
    .local-source-card {
        width: 100%;
        max-width: 42rem;
        margin-inline: auto;
        padding: clamp(1rem, 3vw, 1.5rem);
        overflow-wrap: anywhere;
    }
</style>
