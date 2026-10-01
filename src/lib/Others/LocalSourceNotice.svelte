<script lang="ts">
    import Button from '../UI/GUI/Button.svelte'
    let { oncontinue }: { oncontinue: () => void } = $props()
</script>

<div
    class="w-full h-full overflow-y-auto bg-bgcolor text-textcolor flex justify-center items-center p-6"
>
    <section
        class="max-w-2xl border border-borderc rounded-lg p-6 space-y-4"
        aria-labelledby="local-source-title"
    >
        <h1 id="local-source-title" class="text-2xl font-semibold">
            Elsewhere: private local source build
        </h1>
        <p>
            You are running the source application on this computer. Elsewhere
            does not provide a hosted service or an account for this setup.
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
            For this first run, use a loopback Node server. Public or shared
            hosting needs its own service configuration and review. See the
            repository's Node server guide.
        </p>
        <Button onclick={oncontinue}>Continue with local setup</Button>
    </section>
</div>
