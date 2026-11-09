<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { onMount, getContext } from 'svelte';
	const i18n: any = getContext('i18n');

	import {
		artifactCode,
		chatId,
		config,
		settings,
		showArtifacts,
		artifactContents,
		theme
	} from '$lib/stores';
	import { copyToClipboard, createMessagesList } from '$lib/utils';
	import { injectCsp } from '$lib/utils/csp';
	import { buildMessagePreviewDocument, type PreviewColors } from '$lib/utils/messagePreview';

	import Icon from './FileNav/Icon.svelte';
	import Tooltip from '../common/Tooltip.svelte';
	import SvgPanZoom from '../common/SVGPanZoom.svelte';
	import ArrowLeft from '../icons/ArrowLeft.svelte';

	export let overlay = false;

	let contents: Array<{
		type: string;
		content: string;
		variant?: 'message';
		body?: string;
		direction?: 'rtl' | 'ltr';
	}> = [];
	let selectedContentIdx = 0;

	let copied = false;
	let iframeElement: HTMLIFrameElement;

	// Message previews follow the active app theme. The values are read from the same CSS
	// tokens the app uses, and refreshed whenever the theme class on <html> changes.
	let themeVersion = 0;
	const readPreviewColors = (): PreviewColors => {
		const style = getComputedStyle(document.documentElement);
		const token = (name: string, fallback: string) =>
			style.getPropertyValue(name).trim() || fallback;
		const dark = document.documentElement.classList.contains('dark');
		return {
			background: token('--ashpazi-surface', dark ? '#1c2120' : '#ffffff'),
			text: token('--ashpazi-text', dark ? '#ecefec' : '#202624'),
			muted: token('--ashpazi-muted', dark ? '#a3aca8' : '#5d6662'),
			link: token('--ashpazi-primary', dark ? '#4fb3a5' : '#0f6b60'),
			border: token('--ashpazi-border', dark ? '#343b39' : '#e2ddd3'),
			colorScheme: dark ? 'dark' : 'light'
		};
	};

	const vazirmatnUrl = () =>
		new URL('/assets/fonts/Vazirmatn-Variable.ttf', window.location.href).href;

	// Same sandbox and CSP for every preview; only the document differs for message fragments.
	// `_theme` and `_version` are only passed so Svelte re-runs this when the theme changes.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const previewDocument = (entry: (typeof contents)[number], _theme: unknown, _version: number) =>
		injectCsp(
			entry.variant === 'message'
				? buildMessagePreviewDocument(entry.body ?? entry.content, {
						direction: entry.direction ?? 'ltr',
						colors: readPreviewColors(),
						fontUrl: vazirmatnUrl()
					})
				: entry.content,
			$config?.ui?.iframe_csp ?? ''
		);

	function navigateContent(direction: 'prev' | 'next') {
		selectedContentIdx =
			direction === 'prev'
				? Math.max(selectedContentIdx - 1, 0)
				: Math.min(selectedContentIdx + 1, contents.length - 1);
	}

	const iframeLoadHandler = () => {
		iframeElement.contentWindow.addEventListener(
			'click',
			function (e) {
				const target = e.target.closest('a');
				if (target && target.href) {
					e.preventDefault();
					const url = new URL(target.href, iframeElement.baseURI);
					if (url.origin === window.location.origin) {
						iframeElement.contentWindow.history.pushState(
							null,
							'',
							url.pathname + url.search + url.hash
						);
					} else {
						console.info('External navigation blocked:', url.href);
					}
				}
			},
			true
		);

		// Cancel drag when hovering over iframe
		iframeElement.contentWindow.addEventListener('mouseenter', function (e) {
			e.preventDefault();
			iframeElement.contentWindow.addEventListener('dragstart', (event) => {
				event.preventDefault();
			});
		});
	};

	const showFullScreen = () => {
		if (iframeElement.requestFullscreen) {
			iframeElement.requestFullscreen();
		} else if (iframeElement.webkitRequestFullscreen) {
			iframeElement.webkitRequestFullscreen();
		} else if (iframeElement.msRequestFullscreen) {
			iframeElement.msRequestFullscreen();
		}
	};

	const downloadArtifact = () => {
		const blob = new Blob([contents[selectedContentIdx].content], { type: 'text/html' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `artifact-${$chatId}-${selectedContentIdx}.html`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	onMount(() => {
		const themeObserver = new MutationObserver(() => (themeVersion += 1));
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['class', 'data-theme']
		});

		const unsubscribeArtifactContents = artifactContents.subscribe((value) => {
			const newContents = value ?? [];
			console.log('Artifact contents updated:', newContents);

			if (newContents.length === 0) {
				showArtifacts.set(false);
				selectedContentIdx = 0;
			} else if (newContents.length > contents.length) {
				selectedContentIdx = newContents.length - 1;
			} else if (selectedContentIdx > newContents.length - 1) {
				selectedContentIdx = newContents.length - 1;
			}

			contents = newContents;
		});

		const unsubscribeArtifactCode = artifactCode.subscribe((value) => {
			if (contents && value) {
				const codeIdx = contents.findIndex((content) => content.content.includes(value));
				selectedContentIdx = codeIdx !== -1 ? codeIdx : 0;
			}
		});

		return () => {
			themeObserver.disconnect();
			unsubscribeArtifactCode();
			unsubscribeArtifactContents();
			artifactCode.set(null);
		};
	});
</script>

<div class="w-full h-full relative flex flex-col" id="artifacts-container">
	<div class="w-full min-h-0 flex flex-col flex-1 relative">
		{#if contents.length > 0}
			<div
				class="pointer-events-auto z-20 shrink-0 flex items-center justify-between gap-2 px-2 pb-1.5"
			>
				<div class="flex min-w-0 items-center gap-0.5" dir="ltr">
					<button
						aria-label={$i18n.t('Previous version')}
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors duration-100 hover:text-gray-600 disabled:text-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:disabled:text-gray-700"
						on:click={() => navigateContent('prev')}
						disabled={selectedContentIdx === 0}
						><Icon name="chevron-left" size={11} strokeWidth={1.5} /></button
					>
					<span class="truncate text-xs text-gray-500 dark:text-gray-400">
						{$i18n.t('Version {{selectedVersion}} of {{totalVersions}}', {
							selectedVersion: selectedContentIdx + 1,
							totalVersions: contents.length
						})}
					</span>
					<button
						aria-label={$i18n.t('Next version')}
						class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 transition-colors duration-100 hover:text-gray-600 disabled:text-gray-200 dark:text-gray-500 dark:hover:text-gray-300 dark:disabled:text-gray-700"
						on:click={() => navigateContent('next')}
						disabled={selectedContentIdx === contents.length - 1}
						><Icon name="chevron-right" size={11} strokeWidth={1.5} /></button
					>
				</div>
				<div class="flex shrink-0 items-center gap-0.5">
					<Tooltip content={copied ? $i18n.t('Copied') : $i18n.t('Copy')}>
						<button
							aria-label={copied ? $i18n.t('Copied') : $i18n.t('Copy')}
							class="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors duration-100 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
							on:click={() => {
								copyToClipboard(contents[selectedContentIdx].content);
								copied = true;
								setTimeout(() => {
									copied = false;
								}, 2000);
							}}><Icon name={copied ? 'check' : 'copy'} size={11} strokeWidth={1.4} /></button
						>
					</Tooltip>
					<Tooltip content={$i18n.t('Download')}>
						<button
							aria-label={$i18n.t('Download')}
							class="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors duration-100 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
							on:click={downloadArtifact}
							><Icon name="download" size={11} strokeWidth={1.4} /></button
						>
					</Tooltip>
					{#if contents[selectedContentIdx].type === 'iframe'}
						<Tooltip content={$i18n.t('Open in full screen')}>
							<button
								aria-label={$i18n.t('Open in full screen')}
								class="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors duration-100 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
								on:click={showFullScreen}><Icon name="expand" size={11} strokeWidth={1.4} /></button
							>
						</Tooltip>
					{/if}
				</div>
			</div>
		{/if}

		{#if overlay}
			<div class=" absolute top-0 left-0 right-0 bottom-0 z-10"></div>
		{/if}

		<div class="flex-1 w-full min-h-0 bg-white dark:bg-gray-850">
			<div class=" h-full flex flex-col">
				{#if contents.length > 0}
					<div class="max-w-full w-full h-full">
						{#if contents[selectedContentIdx].type === 'iframe'}
							<iframe
								bind:this={iframeElement}
								title={$i18n.t('Content')}
								srcdoc={previewDocument(contents[selectedContentIdx], $theme, themeVersion)}
								class="w-full border-0 h-full rounded-none"
								sandbox="{($settings?.iframeSandboxAllowScripts ?? true)
									? 'allow-scripts'
									: ''}{($settings?.iframeSandboxAllowDownloads ?? true)
									? ' allow-downloads'
									: ''}{($settings?.iframeSandboxAllowForms ?? true)
									? ' allow-forms'
									: ''}{($settings?.iframeSandboxAllowSameOrigin ?? false)
									? ' allow-same-origin'
									: ''}"
								on:load={iframeLoadHandler}
							></iframe>
						{:else if contents[selectedContentIdx].type === 'svg'}
							<SvgPanZoom
								className=" w-full h-full max-h-full overflow-hidden"
								svg={contents[selectedContentIdx].content}
							/>
						{/if}
					</div>
				{:else}
					<div class="m-auto p-6 text-center font-normal text-xs text-gray-900 dark:text-white">
						{$i18n.t('No HTML, CSS, or JavaScript content found.')}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
