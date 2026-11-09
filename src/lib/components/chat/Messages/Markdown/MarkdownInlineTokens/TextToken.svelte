<script lang="ts">
	import { settings } from '$lib/stores';
	import { isolationSegments } from '$lib/utils/bidi';

	export let token;
	export let done = true;

	$: raw = token?.raw ?? '';
</script>

<!-- Technical values (URLs, IDs, filenames, pairs) are isolated so Persian punctuation and
	order around them stay stable. The rendered text itself is unchanged. -->
{#if done || !($settings?.chatFadeStreamingText ?? true)}
	{#each isolationSegments(raw) as segment}{#if segment.technical}<bdi
				dir="ltr"
				data-technical-value>{segment.text}</bdi
			>{:else}{segment.text}{/if}{/each}
{:else}
	{#each raw.split(' ') as text}
		<span class="fade-in-token">
			{#each isolationSegments(text) as segment}{#if segment.technical}<bdi
						dir="ltr"
						data-technical-value>{segment.text}</bdi
					>{:else}{segment.text}{/if}{/each}{' '}
		</span>
	{/each}
{/if}
