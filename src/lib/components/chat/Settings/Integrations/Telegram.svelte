<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';

	import Spinner from '$lib/components/common/Spinner.svelte';
	import {
		addTelegramDestination,
		connectTelegram,
		disconnectTelegram,
		getTelegramStatus,
		removeTelegramDestination,
		verifyTelegramDestination,
		type TelegramStatus
	} from '$lib/apis/integrations/telegram';

	const i18n = getContext<Writable<i18nType>>('i18n');

	let status: TelegramStatus | null = null;
	let botToken = '';
	let alias = '';
	let target = '';
	let busy = false;

	const refresh = async () => {
		status = await getTelegramStatus(localStorage.token);
	};

	const connect = async () => {
		if (!botToken.trim()) return;
		busy = true;
		try {
			await connectTelegram(localStorage.token, botToken.trim());
			botToken = '';
			await refresh();
			toast.success($i18n.t('Telegram bot connected'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : $i18n.t('Failed to connect Telegram'));
		} finally {
			busy = false;
		}
	};

	const addDestination = async () => {
		if (!alias.trim() || !target.trim()) return;
		busy = true;
		try {
			await addTelegramDestination(localStorage.token, alias.trim(), target.trim());
			alias = '';
			target = '';
			await refresh();
			toast.success($i18n.t('Telegram channel verified'));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : $i18n.t('Failed to verify channel'));
		} finally {
			busy = false;
		}
	};

	onMount(() => {
		refresh().catch((error) =>
			toast.error(error instanceof Error ? error.message : $i18n.t('Failed to load Telegram'))
		);
	});
</script>

{#if status === null}
	<div class="flex justify-center py-4"><Spinner className="size-5" /></div>
{:else}
	<div class="flex flex-col gap-3">
		<div class="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
			<div class="flex items-start justify-between gap-3">
				<div>
					<div class="text-xs font-medium text-gray-900 dark:text-white">
						{status.connected
							? `@${status.bot?.username ?? status.bot?.display_name ?? 'Telegram bot'}`
							: $i18n.t('No Telegram bot connected')}
					</div>
					<div class="mt-0.5 text-[0.6875rem] text-gray-500">
						{$i18n.t('The bot token is encrypted and is never shared with the model.')}
					</div>
				</div>
				{#if status.connected}
					<button
						type="button"
						class="text-xs text-red-600 hover:underline dark:text-red-400"
						on:click={async () => {
							if (!confirm($i18n.t('Disconnect this Telegram bot and remove its channels?')))
								return;
							busy = true;
							try {
								await disconnectTelegram(localStorage.token);
								await refresh();
							} finally {
								busy = false;
							}
						}}>{$i18n.t('Disconnect')}</button
					>
				{/if}
			</div>

			<div class="mt-3 flex gap-2">
				<input
					type="password"
					autocomplete="off"
					bind:value={botToken}
					placeholder={$i18n.t('BotFather token')}
					class="min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs outline-none focus:border-gray-400 dark:border-gray-700"
				/>
				<button
					type="button"
					disabled={busy || !botToken.trim()}
					class="rounded-lg bg-black px-3 py-2 text-xs text-white disabled:opacity-40 dark:bg-white dark:text-black"
					on:click={connect}>{$i18n.t(status.connected ? 'Replace bot' : 'Connect')}</button
				>
			</div>
		</div>

		{#if status.connected}
			<div class="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
				<div class="text-xs font-medium text-gray-900 dark:text-white">
					{$i18n.t('Verified channels')}
				</div>
				<div class="mt-2 flex flex-col gap-2">
					{#each status.destinations as destination}
						<div
							class="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-2 dark:bg-gray-900"
						>
							<div class="min-w-0">
								<div class="truncate text-xs">
									{destination.title} · <code>{destination.alias}</code>
								</div>
								<div
									class="text-[0.6875rem] {destination.enabled
										? 'text-green-600'
										: 'text-amber-600'}"
								>
									{$i18n.t(destination.enabled ? 'Verified' : 'Reverification required')}
								</div>
							</div>
							<div class="flex gap-2 text-[0.6875rem]">
								{#if !destination.enabled}
									<button
										type="button"
										class="hover:underline"
										on:click={async () => {
											await verifyTelegramDestination(localStorage.token, destination.alias);
											await refresh();
										}}>{$i18n.t('Verify')}</button
									>
								{/if}
								<button
									type="button"
									class="text-red-600 hover:underline"
									on:click={async () => {
										await removeTelegramDestination(localStorage.token, destination.alias);
										await refresh();
									}}>{$i18n.t('Remove')}</button
								>
							</div>
						</div>
					{/each}
				</div>

				<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
					<input
						bind:value={alias}
						placeholder={$i18n.t('Alias, e.g. announcements')}
						class="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs outline-none dark:border-gray-700"
					/>
					<input
						bind:value={target}
						placeholder={$i18n.t('@channel or numeric channel ID')}
						class="rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs outline-none dark:border-gray-700"
					/>
					<button
						type="button"
						disabled={busy || !alias.trim() || !target.trim()}
						class="rounded-lg border border-gray-200 px-3 py-2 text-xs disabled:opacity-40 dark:border-gray-700"
						on:click={addDestination}>{$i18n.t('Verify and add')}</button
					>
				</div>
				<div class="mt-2 text-[0.6875rem] text-gray-500">
					{$i18n.t(
						'Add the bot as a channel administrator with permission to post before verifying.'
					)}
				</div>
			</div>
		{/if}
	</div>
{/if}
