<script lang="ts">
    let {
        value = $bindable(), minimum = 1, maximum, label, disabled = false,
        unknownText, invalidText, tokensText, fixedText, disabledText,
    }: {
        value: number; minimum?: number; maximum?: number; label: string;
        disabled?: boolean; unknownText: string; invalidText: string; tokensText: string;
        fixedText: string; disabledText: string;
    } = $props();
    const id = $props.id();
    let knownMaximum = $derived(maximum !== undefined && Number.isSafeInteger(maximum));
    let knownRange = $derived(knownMaximum && maximum! > minimum);
    let inRange = $derived(Number.isSafeInteger(value) && value >= minimum && value <= maximum!);
    let invalid = $derived(!Number.isSafeInteger(value) || value < minimum || (knownMaximum && value > maximum!));
    let sliderDisabled = $derived(disabled || !inRange);
</script>

<div class="w-full mb-3">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
        <span class="text-textcolor tabular-nums" aria-live="polite">{disabled ? disabledText : `${value ?? 'Unset'} ${tokensText}`}</span>
        <input
            id={id + '-number'} type="number" step="1" min={minimum} max={maximum}
            aria-label={label} aria-describedby={id + '-help'}
            aria-invalid={!disabled && invalid}
            class="w-36 max-w-full rounded-md border border-darkborderc bg-darkbg px-3 py-2 text-textcolor focus-visible:outline-2 focus-visible:outline-textcolor disabled:opacity-60"
            {disabled} bind:value
        />
    </div>
    {#if knownRange}
        <input
            type="range" min={minimum} max={maximum} step="1"
            value={inRange ? value : minimum} disabled={sliderDisabled}
            aria-label={label + ' slider'} aria-describedby={id + '-help'}
            class="w-full h-10 cursor-pointer accent-textcolor focus-visible:outline-2 focus-visible:outline-textcolor disabled:opacity-40 disabled:cursor-not-allowed"
            oninput={(event) => { value = event.currentTarget.valueAsNumber; }}
        />
        <div class="flex justify-between text-xs text-textcolor2 tabular-nums" aria-hidden="true">
            <span>{minimum}</span><span>{maximum}</span>
        </div>
    {/if}
    <p id={id + '-help'} class="text-xs text-textcolor2 mt-1">
        {#if !knownMaximum}{unknownText}{:else if !disabled && invalid}{invalidText}{:else if !disabled && maximum === minimum}{fixedText}{/if}
    </p>
</div>
