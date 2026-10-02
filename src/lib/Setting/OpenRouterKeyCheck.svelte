<script lang="ts">
    import { CircleCheckIcon, CircleXIcon, TriangleAlertIcon, InfoIcon, LoaderCircleIcon } from '@lucide/svelte'
    import { onDestroy } from 'svelte'
    import { language } from 'src/lang'
    import { fetchNative } from 'src/ts/globalApi.svelte'
    import { isNodeServer, isTauri } from 'src/ts/platform'
    import { createKeyVerification, inspectOpenRouterKey, type KeyVerificationStatus } from 'src/ts/model/openrouterKeyVerification'

    let { apiKey, providerContext }: { apiKey: string; providerContext: string } = $props()
    let status = $state<KeyVerificationStatus>('unverified')
    const supported = isNodeServer || isTauri
    const check = createKeyVerification(
        () => ({ key: apiKey ?? '', context: providerContext }),
        (key, signal) => inspectOpenRouterKey(key, fetchNative, signal),
        (next) => { status = next }
    )
    $effect(() => { apiKey; providerContext; check.invalidate() })
    onDestroy(check.dispose)
    const StatusIcon = $derived(status === 'valid' ? CircleCheckIcon : status === 'refused' ? CircleXIcon : status === 'network' || status === 'unknown' ? TriangleAlertIcon : status === 'checking' ? LoaderCircleIcon : InfoIcon)
    const statusClass = $derived(status === 'valid' ? 'bg-success-100 text-success-900' : status === 'refused' ? 'bg-danger-100 text-danger-900' : status === 'network' || status === 'unknown' ? 'bg-warning-100 text-warning-900' : 'bg-textcolor/5 text-textcolor')
    const descriptions = $derived({
        absent: language.apiKeyCheckAbsent,
        unverified: language.apiKeyCheckUnverified,
        checking: language.apiKeyCheckChecking,
        valid: language.apiKeyCheckValid,
        refused: language.apiKeyCheckRefused,
        network: language.apiKeyCheckNetwork,
        unknown: language.apiKeyCheckUnknown,
    })
</script>

<div class="mt-2 flex flex-col gap-2 text-textcolor">
    <button type="button" class="self-start rounded border border-borderc bg-darkbutton px-3 py-2 focus-visible:outline-2 focus-visible:outline-textcolor disabled:opacity-50"
        disabled={!supported || !apiKey?.trim() || status === 'checking'} onclick={() => check.verify()}>
        {language.apiKeyCheckButton}
    </button>
    <p role="status" aria-live="polite" aria-atomic="true" class="flex w-fit max-w-full items-start gap-2 rounded px-3 py-2 text-sm {statusClass}">
        <StatusIcon size={18} aria-hidden="true" class="mt-0.5 shrink-0" />
        <span>{descriptions[status]}</span>
    </p>
    <p class="text-sm text-textcolor/70">{language.apiKeyCheckScope}</p>
    {#if !supported}<p class="text-sm text-textcolor/70">{language.apiKeyCheckTransport}</p>{/if}
</div>
