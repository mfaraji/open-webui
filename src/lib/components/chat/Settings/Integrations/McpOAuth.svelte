<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';
	import {
		getMcpOAuthLinkStatus,
		removeMcpOAuthLink,
		startMcpOAuthLink
	} from '$lib/apis/integrations/mcp-oauth';
	const i18n = getContext<Writable<i18nType>>('i18n');

	let linked: boolean | null = null;
	let busy = false;

	const refresh = async () => {
		linked = (await getMcpOAuthLinkStatus(localStorage.token)).linked;
	};

	const connect = async () => {
		busy = true;
		const popup = window.open('', '_blank');
		if (popup) popup.opener = null;
		try {
			const { url } = await startMcpOAuthLink(localStorage.token);
			if (popup) {
				popup.location.href = url;
			} else {
				window.location.assign(url);
			}
		} catch (error) {
			popup?.close();
			toast.error(
				error instanceof Error ? error.message : $i18n.t('Could not start account linking.')
			);
		} finally {
			busy = false;
		}
	};

	const disconnect = async () => {
		if (!confirm($i18n.t('Disconnect this OAuth login from your Open WebUI account?'))) return;
		busy = true;
		try {
			await removeMcpOAuthLink(localStorage.token);
			await refresh();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : $i18n.t('Could not remove account link.')
			);
		} finally {
			busy = false;
		}
	};

	onMount(() => {
		refresh().catch((error) =>
			toast.error(error instanceof Error ? error.message : $i18n.t('Could not load account link.'))
		);
	});
</script>

<div class="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
	<div class="text-xs font-medium text-gray-900 dark:text-white">
		{linked === null
			? $i18n.t('Checking account link…')
			: linked
				? $i18n.t('OAuth login linked')
				: $i18n.t('OAuth login not linked')}
	</div>
	<p class="mt-1 text-[0.6875rem] text-gray-500">
		{$i18n.t(
			'Link your existing account once to use its Google, Apex, and Telegram tools from ChatGPT or a CLI.'
		)}
	</p>
	<div class="mt-3 flex flex-wrap gap-2">
		{#if linked}
			<button
				type="button"
				disabled={busy}
				class="text-xs text-red-600 hover:underline dark:text-red-400"
				on:click={disconnect}>{$i18n.t('Unlink OAuth login')}</button
			>
		{:else}
			<button
				type="button"
				disabled={busy}
				class="rounded-lg bg-black px-3 py-2 text-xs text-white disabled:opacity-40 dark:bg-white dark:text-black"
				on:click={connect}>{$i18n.t('Link OAuth login')}</button
			>
		{/if}
		<button
			type="button"
			disabled={busy}
			class="text-xs text-gray-600 underline dark:text-gray-400"
			on:click={() =>
				refresh().catch((error) =>
					toast.error(error instanceof Error ? error.message : $i18n.t('Refresh failed.'))
				)}>{$i18n.t('Refresh status')}</button
		>
	</div>
</div>
