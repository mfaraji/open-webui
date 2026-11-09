<script lang="ts">
	import { getContext } from 'svelte';
	import type { Writable } from 'svelte/store';
	import type { i18n as i18nType } from 'i18next';

	import { changeLanguage } from '$lib/i18n';

	const i18n = getContext<Writable<i18nType>>('i18n');

	/** `menu` fits a dropdown row; `default` is the standalone control. */
	export let variant: 'default' | 'menu' = 'default';
	export let onChange: (locale: string) => void = () => {};

	// Autonyms: each language names itself, so they are never translated.
	const options = [
		{ code: 'fa-IR', base: 'fa', label: 'فارسی' },
		{ code: 'en-US', base: 'en', label: 'English' }
	];

	$: active = ($i18n.language ?? '').toLowerCase().split('-')[0];

	const select = async (code: string) => {
		await changeLanguage(code);
		onChange(code);
	};
</script>

<div
	role="group"
	aria-label={$i18n.t('Language')}
	class="inline-flex items-center gap-0.5 rounded-full border border-gray-100 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-850 {variant ===
	'menu'
		? 'w-full'
		: ''}"
>
	{#each options as option (option.code)}
		<button
			type="button"
			lang={option.base}
			dir={option.base === 'fa' ? 'rtl' : 'ltr'}
			aria-pressed={active === option.base}
			class="min-h-8 rounded-full px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-focus,currentColor)] {variant ===
			'menu'
				? 'flex-1'
				: ''} {active === option.base
				? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-50'
				: 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'}"
			on:click={() => select(option.code)}
		>
			{option.label}
		</button>
	{/each}
</div>
