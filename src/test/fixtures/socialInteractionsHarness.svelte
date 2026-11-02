<script lang="ts">
    import { createSocialFeed, createSocialPost } from 'src/ts/social/socialFeed'
    import { addSocialComment, toggleSocialRepost, ensureSocialHandles } from 'src/ts/social/socialInteractions'
    const author = { id: 'native-persona', name: 'Mara' }
    const feed = $state(createSocialFeed())
    feed.posts = [createSocialPost(author, 'A public moment')]
    function handles() { ensureSocialHandles(feed, [author, { id: 'second-persona', name: 'Mara' }]) }
</script>
<button onclick={() => addSocialComment(feed.posts[0], author, 'First public comment')}>Comment</button>
<button onclick={() => toggleSocialRepost(feed, feed.posts[0].id, author)}>Repost</button>
<button onclick={handles}>Allocate handles</button>
<output>{JSON.stringify($state.snapshot(feed))}</output>
