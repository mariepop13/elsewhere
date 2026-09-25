<script lang="ts">
    import { language } from 'src/lang'
    import OtherBotSettings from './OtherBotSettings.svelte'
</script>

<h2 class="mb-2 mt-2 text-2xl font-bold">{language.imageGeneration}</h2>
<section class="mt-4 rounded-md border border-darkborderc bg-darkbg p-4">
    <h3 class="mb-3 text-xl font-semibold text-textcolor">{language.imageGeneration} {language.provider}</h3>
    <OtherBotSettings imageOnly />
</section>
