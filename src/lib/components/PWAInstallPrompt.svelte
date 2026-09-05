<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';

	type BeforeInstallPromptEvent = Event & {
		prompt: () => Promise<void>;
		userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
	};

	const DISMISSAL_KEY = 'ashpazi-pwa-install-dismissed-at';
	const DISMISSAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

	let deferredPrompt: BeforeInstallPromptEvent | null = null;
	let show = false;
	let installing = false;

	const isInstalled = () =>
		window.matchMedia('(display-mode: standalone)').matches ||
		(window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
		document.referrer.startsWith('android-app://');

	const wasRecentlyDismissed = () => {
		const dismissedAt = Number(localStorage.getItem(DISMISSAL_KEY));
		return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISSAL_DURATION_MS;
	};

	const dismiss = () => {
		localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
		show = false;
	};

	const install = async () => {
		if (!deferredPrompt || installing) return;

		installing = true;
		try {
			await deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'dismissed') {
				localStorage.setItem(DISMISSAL_KEY, Date.now().toString());
			}
			deferredPrompt = null;
			show = false;
		} catch (error) {
			console.error('Unable to show the app install prompt:', error);
		} finally {
			installing = false;
		}
	};

	onMount(() => {
		const handleBeforeInstallPrompt = (event: Event) => {
			if (!/Android/i.test(navigator.userAgent) || isInstalled()) {
				return;
			}

			event.preventDefault();
			if (wasRecentlyDismissed()) return;

			deferredPrompt = event as BeforeInstallPromptEvent;
			show = true;
		};

		const handleAppInstalled = () => {
			localStorage.removeItem(DISMISSAL_KEY);
			deferredPrompt = null;
			show = false;
		};

		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
		window.addEventListener('appinstalled', handleAppInstalled);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
			window.removeEventListener('appinstalled', handleAppInstalled);
		};
	});
</script>

{#if show}
	<div
		class="pointer-events-none fixed inset-x-0 bottom-0 z-[9998] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5"
		transition:fade={{ duration: 150 }}
	>
		<aside
			class="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 text-gray-900 shadow-2xl dark:border-gray-700 dark:bg-gray-850 dark:text-white"
			role="dialog"
			aria-labelledby="pwa-install-title"
			aria-describedby="pwa-install-description"
			transition:fly={{ y: 24, duration: 220 }}
		>
			<img
				src="/static/web-app-manifest-192x192.png"
				alt=""
				class="size-12 shrink-0 rounded-xl"
			/>

			<div class="min-w-0 flex-1">
				<div id="pwa-install-title" class="text-sm font-semibold">Install Ashpazi AI</div>
				<div id="pwa-install-description" class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
					Add it to your home screen for quick, full-screen access.
				</div>
			</div>

			<button
				type="button"
				class="shrink-0 rounded-xl bg-gray-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
				disabled={installing}
				on:click={install}
			>
				{installing ? 'Opening…' : 'Install'}
			</button>

			<button
				type="button"
				class="-mr-1 shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
				aria-label="Dismiss install prompt"
				on:click={dismiss}
			>
				<svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" class="size-5">
					<path
						d="M4.47 4.47a.75.75 0 0 1 1.06 0L10 8.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L11.06 10l4.47 4.47a.75.75 0 1 1-1.06 1.06L10 11.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L8.94 10 4.47 5.53a.75.75 0 0 1 0-1.06Z"
					/>
				</svg>
			</button>
		</aside>
	</div>
{/if}
