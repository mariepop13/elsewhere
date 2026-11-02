<script lang="ts">
    import { splitSocialMentions, type SocialTarget } from 'src/ts/social/socialInteractions'
    let { text, targets, onprofile }: { text: string; targets: SocialTarget[]; onprofile: (target: SocialTarget) => void } = $props()
    let parts = $derived(splitSocialMentions(text, targets))
</script>
{#each parts as part}{#if part.target}<button type="button" class="ew-mention" onclick={() => part.target && onprofile(part.target)}>{part.text}</button>{:else}{part.text}{/if}{/each}
