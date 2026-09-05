<script lang="ts">
	import { getContext, onDestroy } from 'svelte';
	import { toast } from 'svelte-sonner';

	import Modal from '$lib/components/common/Modal.svelte';
	import XMark from '$lib/components/icons/XMark.svelte';
	import {
		downloadGoogleDriveFile,
		getGoogleDriveStatus,
		GoogleDriveIntegrationError,
		searchGoogleDriveFiles,
		type GoogleDriveFile,
		type GoogleDriveStatus
	} from '$lib/apis/integrations/google-drive';

	const i18n = getContext('i18n');

	export let show = false;
	export let maxSelections = 1;
	export let maxSizeBytes: number | null = null;
	export let onFiles: (files: File[]) => Promise<void>;

	let status: GoogleDriveStatus | null = null;
	let query = '';
	let results: GoogleDriveFile[] = [];
	let nextPageToken: string | null = null;
	let selected: Record<string, GoogleDriveFile> = {};
	let transfers: Record<string, { state: string; progress: number; error?: string }> = {};
	let loading = false;
	let opened = false;
	let searchTimer: ReturnType<typeof setTimeout> | null = null;
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let searchGeneration = 0;

	const token = () => localStorage.token ?? '';
	const selectedCount = () => Object.keys(selected).length;
	const fitsAttachmentSize = (file: GoogleDriveFile) =>
		file.selectable && (maxSizeBytes === null || file.size === null || file.size <= maxSizeBytes);
	const canSelect = (file: GoogleDriveFile) =>
		fitsAttachmentSize(file) && (Boolean(selected[file.id]) || selectedCount() < maxSelections);

	const loadStatus = async () => {
		try {
			status = await getGoogleDriveStatus(token());
			if (status.connected && results.length === 0) await search(true);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : String(error));
		}
	};

	const search = async (reset: boolean) => {
		if (!status?.connected) return;
		const generation = reset ? ++searchGeneration : searchGeneration;
		loading = true;
		try {
			const response = await searchGoogleDriveFiles(
				token(),
				query,
				reset ? null : nextPageToken,
				25
			);
			if (generation !== searchGeneration) return;
			results = reset ? response.files : [...results, ...response.files];
			nextPageToken = response.next_page_token ?? null;
		} catch (error) {
			if (error instanceof GoogleDriveIntegrationError && error.code === 'reauth_required') {
				status = {
					connected: false,
					connection_state: 'reauthorization_required',
					authorization_url: error.authorizationUrl
				};
			}
			toast.error(error instanceof Error ? error.message : String(error));
		} finally {
			loading = false;
		}
	};

	const queueSearch = () => {
		if (searchTimer) clearTimeout(searchTimer);
		searchTimer = setTimeout(() => search(true), 300);
	};

	const connect = () => {
		if (!status?.authorization_url) return;
		window.open(status.authorization_url, 'google-drive-oauth', 'popup,width=520,height=720');
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = setInterval(async () => {
			const updated = await getGoogleDriveStatus(token()).catch(() => null);
			if (updated?.connected) {
				status = updated;
				if (pollTimer) clearInterval(pollTimer);
				pollTimer = null;
				await search(true);
			}
		}, 1200);
	};

	const toggle = (file: GoogleDriveFile) => {
		if (!canSelect(file)) return;
		if (selected[file.id]) {
			const { [file.id]: _, ...rest } = selected;
			selected = rest;
		} else if (selectedCount() < maxSelections) {
			selected = { ...selected, [file.id]: file };
		}
	};

	const attach = async () => {
		const queue = Object.values(selected);
		if (queue.length === 0) return;
		let cursor = 0;
		const completed: File[] = [];
		const successfulIds = new Set<string>();
		const worker = async () => {
			while (cursor < queue.length) {
				const file = queue[cursor++];
				transfers = { ...transfers, [file.id]: { state: 'downloading', progress: 0 } };
				try {
					const downloaded = await downloadGoogleDriveFile(token(), file, (progress) => {
						transfers = {
							...transfers,
							[file.id]: { state: 'downloading', progress }
						};
					});
					completed.push(downloaded);
					successfulIds.add(file.id);
					transfers = { ...transfers, [file.id]: { state: 'complete', progress: 100 } };
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					transfers = {
						...transfers,
						[file.id]: { state: 'error', progress: 0, error: message }
					};
					if (error instanceof GoogleDriveIntegrationError && error.code === 'reauth_required') {
						status = {
							connected: false,
							connection_state: 'reauthorization_required',
							authorization_url: error.authorizationUrl
						};
					}
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(2, queue.length) }, () => worker()));
		if (completed.length > 0) await onFiles(completed);
		selected = Object.fromEntries(
			Object.entries(selected).filter(([id]) => !successfulIds.has(id))
		);
		if (selectedCount() === 0) show = false;
	};

	$: if (show && !opened) {
		opened = true;
		query = '';
		results = [];
		selected = {};
		transfers = {};
		loadStatus();
	} else if (!show) {
		opened = false;
	}

	onDestroy(() => {
		if (searchTimer) clearTimeout(searchTimer);
		if (pollTimer) clearInterval(pollTimer);
	});
</script>

<Modal bind:show size="md">
	<div class="flex max-h-[80vh] flex-col">
		<div class="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
			<div>
				<h1 class="text-sm font-medium">{$i18n.t('Google Drive')}</h1>
				{#if status?.account_email}<p class="text-xs text-gray-500">{status.account_email}</p>{/if}
			</div>
			<button class="rounded-lg p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" on:click={() => (show = false)} aria-label={$i18n.t('Close modal')}><XMark className="size-4" /></button>
		</div>

		{#if !status?.connected}
			<div class="flex flex-col items-center gap-3 px-8 py-12 text-center">
				<p class="text-sm text-gray-600 dark:text-gray-300">{$i18n.t(status?.connection_state === 'reauthorization_required' ? 'Reconnect Google Drive to continue.' : 'Connect Google Drive to search and attach files.')}</p>
				<button class="rounded-full bg-black px-4 py-2 text-sm text-white dark:bg-white dark:text-black" on:click={connect}>{$i18n.t(status?.connection_state === 'reauthorization_required' ? 'Reconnect' : 'Connect')}</button>
			</div>
		{:else}
			<div class="px-5 py-3">
				<input class="w-full rounded-xl border border-gray-200 bg-transparent px-3 py-2 text-sm outline-hidden focus:border-blue-500 dark:border-gray-700" bind:value={query} on:input={queueSearch} placeholder={$i18n.t('Search files by name')} />
				<p class="mt-1 text-xs text-gray-500">{$i18n.t('{{count}} file(s) can be selected.', { count: maxSelections })}</p>
			</div>
			<div class="min-h-48 flex-1 overflow-y-auto px-3 pb-3">
				{#each results as file (file.id)}
					{@const selectable = canSelect(file)}
					{@const transfer = transfers[file.id]}
					<button type="button" class="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectable} aria-pressed={Boolean(selected[file.id])} on:click={() => toggle(file)}>
						<span class="flex size-4 shrink-0 items-center justify-center rounded border border-gray-400 bg-white text-xs text-white dark:border-gray-500 dark:bg-gray-900" class:bg-black={Boolean(selected[file.id])} class:dark:bg-white={Boolean(selected[file.id])} class:dark:text-black={Boolean(selected[file.id])} aria-hidden="true">{selected[file.id] ? '✓' : ''}</span>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm">{file.name}</p>
							<p class="truncate text-xs text-gray-500">{file.source_mime_type}{file.shared ? ` · ${$i18n.t('Shared')}` : ''}{file.size ? ` · ${(file.size / 1024 / 1024).toFixed(1)} MB` : ''}{file.modified_time ? ` · ${new Date(file.modified_time).toLocaleDateString()}` : ''}</p>
							{#if !selectable}<p class="text-xs text-red-500">{$i18n.t(!fitsAttachmentSize(file) ? (file.unselectable_reason === 'too_large' ? 'File is too large.' : 'This file type cannot be attached.') : 'Attachment limit reached.')}</p>{/if}
							{#if transfer}<p class:text-red-500={transfer.state === 'error'} class="text-xs text-gray-500">{transfer.state === 'error' ? transfer.error : `${transfer.progress}%`}</p>{/if}
						</div>
					</button>
				{/each}
				{#if loading}<p class="py-6 text-center text-sm text-gray-500">{$i18n.t('Loading...')}</p>{:else if results.length === 0}<p class="py-6 text-center text-sm text-gray-500">{$i18n.t('No files found.')}</p>{/if}
				{#if nextPageToken && !loading}<button class="mx-auto block rounded-full border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700" on:click={() => search(false)}>{$i18n.t('Load more')}</button>{/if}
			</div>
			<div class="flex items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-gray-800">
				<span class="text-xs text-gray-500">{selectedCount()} / {maxSelections}</span>
				<button class="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-black" disabled={selectedCount() === 0} on:click={attach}>{$i18n.t('Attach')}</button>
			</div>
		{/if}
	</div>
</Modal>
