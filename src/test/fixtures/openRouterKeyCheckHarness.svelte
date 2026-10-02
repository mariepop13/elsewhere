<script lang="ts">
    import OpenRouterKeyCheck from '../../lib/Setting/OpenRouterKeyCheck.svelte'
    let apiKey = $state('fixture-key')
    let providerContext = $state('openrouter/main')
</script>
<OpenRouterKeyCheck {apiKey} {providerContext} />
<button onclick={() => apiKey = 'fixture-other'}>Change key</button>
<button onclick={() => apiKey = ''}>Clear key</button>
<button onclick={() => providerContext = 'openrouter/aux'}>Change provider</button>
