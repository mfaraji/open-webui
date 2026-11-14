<script lang="ts">
	import { getContext, onDestroy, onMount } from 'svelte';
	import {
		findStreamController,
		streamActivity,
		streamControllers,
		STREAM_RECOVER_EVERY_MS,
		STREAM_SLOW_AFTER_MS,
		STREAM_STALLED_AFTER_MS
	} from '$lib/stores/streamActivity';

	const i18n = getContext<typeof import('$lib/i18n').default>('i18n');

	export let messageId: string;
	export let canStop = true;

	// A reply restored from history may have no recorded activity yet; start the clock
	// when it appears on screen rather than at its (possibly old) creation time.
	const mountedAt = Date.now();
	let now = mountedAt;
	let lastRecoverAt = 0;
	let stopping = false;
	let timer: ReturnType<typeof setInterval> | null = null;

	$: lastActivity = Math.max($streamActivity[messageId] ?? 0, mountedAt);
	$: silentMs = Math.max(0, now - lastActivity);
	$: slow = silentMs >= STREAM_SLOW_AFTER_MS;
	$: stalled = silentMs >= STREAM_STALLED_AFTER_MS;

	$: controller = stalled ? findStreamController($streamControllers, messageId) : null;

	$: if (controller && now - lastRecoverAt >= STREAM_RECOVER_EVERY_MS) {
		lastRecoverAt = now;
		// Ask the server whether this reply is still running; finished or lost replies get
		// reloaded or marked failed by the chat instead of spinning forever.
		void Promise.resolve(controller.recover(messageId)).catch(() => {});
	}

	const formatElapsed = (ms: number, locale: string) => {
		const total = Math.floor(ms / 1000);
		const minutes = Math.floor(total / 60);
		const seconds = total % 60;
		const format = (value: number, minimumIntegerDigits: number) => {
			const options = { minimumIntegerDigits, useGrouping: false };
			try {
				return new Intl.NumberFormat(locale, options).format(value);
			} catch {
				return new Intl.NumberFormat(undefined, options).format(value);
			}
		};
		return `${format(minutes, 1)}:${format(seconds, 2)}`;
	};

	const stop = async () => {
		if (stopping) return;
		stopping = true;
		try {
			await controller?.stop(messageId);
		} finally {
			stopping = false;
		}
	};

	onMount(() => {
		timer = setInterval(() => (now = Date.now()), 1000);
	});

	onDestroy(() => {
		if (timer) clearInterval(timer);
	});
</script>

{#if slow}
	<div
		role="status"
		aria-live="polite"
		class="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-gray-400 dark:text-gray-500"
	>
		<span>
			{#if stalled}
				{$i18n.t('Taking longer than usual')}
			{:else}
				{$i18n.t('Still working…')}
			{/if}
			<span dir="ltr" class="tabular-nums">{formatElapsed(silentMs, $i18n.language)}</span>
		</span>
		{#if canStop && controller}
			<button
				type="button"
				class="rounded-full border border-gray-200 px-2 py-0.5 text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-850"
				disabled={stopping}
				on:click|stopPropagation={stop}
			>
				{$i18n.t('Stop')}
			</button>
		{/if}
	</div>
{/if}
