<script lang="ts">
    import { language } from 'src/lang'
    import type { TokenCapabilities } from 'src/ts/model/tokenCapabilities'

    let { cap, sharedCap }: { cap: TokenCapabilities; sharedCap?: TokenCapabilities } = $props()
    const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
    function display(value?: number) { return value === undefined ? language.tokenLimitsUnknown : compact.format(value) }
    function exact(value?: number) { return value === undefined ? language.tokenLimitsUnknown : value.toLocaleString('en-US') + ' ' + language.tokenBudgetUnits }
    function identity(value: TokenCapabilities) {
        // Observation timestamps and object property ordering do not change model limits.
        return JSON.stringify([value.requestedId, value.resolvedId, value.context, value.output,
            value.contextKind, value.source, value.routeCoverage, value.routeMinimum?.context,
            value.routeMinimum?.output, value.topProvider?.context, value.topProvider?.output])
    }
    let duplicate = $derived(!!sharedCap && identity(cap) === identity(sharedCap))
</script>

<div class="mb-3 text-xs text-textcolor">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
        <span title={exact(cap.context)}>
            <span aria-hidden="true">{language.tokenLimitsContextShort} {display(cap.context)}</span>
            <span class="sr-only">{language.tokenLimitsContextShort} {exact(cap.context)}</span>
            {#if cap.contextKind === 'input'}<span> ({language.tokenLimitsInputOnly})</span>{/if}
        </span>
        <span title={exact(cap.output)}>
            <span aria-hidden="true">{language.tokenLimitsOutputShort} {display(cap.output)}</span>
            <span class="sr-only">{language.tokenLimitsOutputShort} {exact(cap.output)}</span>
        </span>
        {#if sharedCap}
            {#if duplicate}
                <span class="text-textcolor2">{language.tokenLimitsSharedSame}</span>
            {:else}
                <span class="text-textcolor2 break-all">{language.tokenLimitsShared}: {sharedCap.requestedId} · {language.tokenLimitsOutputShort} <span title={exact(sharedCap.output)}>{exact(sharedCap.output)}</span></span>
            {/if}
        {/if}
    </div>
    <details class="mt-1">
        <summary class="w-fit cursor-pointer rounded text-textcolor2 underline decoration-textcolor/30 underline-offset-2 focus-visible:outline-2 focus-visible:outline-textcolor">{language.tokenLimitsDetails}</summary>
        <div class="mt-2 space-y-1 break-words text-textcolor2">
            <p class="break-all">{language.tokenLimitsAdvertised}: {cap.requestedId}.</p>
            <p>{language.tokenLimitsContextShort}: {exact(cap.context)}{cap.contextKind === 'input' ? ` (${language.tokenLimitsInputOnly})` : ''}. {language.tokenLimitsOutputShort}: {exact(cap.output)}.</p>
            {#if sharedCap && !duplicate}
                <p class="break-all">{language.tokenLimitsShared}: {sharedCap.requestedId}. {language.tokenLimitsContextShort}: {exact(sharedCap.context)}{sharedCap.contextKind === 'input' ? ` (${language.tokenLimitsInputOnly})` : ''}. {language.tokenLimitsOutputShort}: {exact(sharedCap.output)}.</p>
                {#if sharedCap.source && sharedCap.source !== cap.source}
                    <p><a href={sharedCap.source} target="_blank" rel="noreferrer" class="underline">{language.tokenLimitsSharedSource}</a>{#if sharedCap.observedAt} · <time datetime={sharedCap.observedAt}>{sharedCap.observedAt}</time>{/if}</p>
                {/if}
            {/if}
            {#if sharedCap?.observedAt && sharedCap.source === cap.source && sharedCap.observedAt !== cap.observedAt}<p>{language.tokenLimitsSharedObserved}: <time datetime={sharedCap.observedAt}>{sharedCap.observedAt}</time></p>{/if}
            <p>{language.tokenLimitsSharedReasoning}</p>
            <p>{language.tokenLimitsEstimate}</p>
            {#if cap.routeCoverage === 'catalog' || cap.routeMinimum || sharedCap?.routeCoverage === 'catalog' || sharedCap?.routeMinimum}<p>{language.tokenLimitsRouting}</p>{/if}
            {#if cap.source}<p><a href={cap.source} target="_blank" rel="noreferrer" class="underline">{language.tokenLimitsSource}</a>{#if cap.observedAt} · <time datetime={cap.observedAt}>{cap.observedAt}</time>{/if}</p>{/if}
        </div>
    </details>
</div>
