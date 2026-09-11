<script lang="ts">
	/** A compact, accessible action button for the local SVG icon collection. */
	export let size: 'sm' | 'md' | 'lg' = 'md';
	export let tone: 'default' | 'primary' | 'danger' = 'default';
	export let label: string;
	export let pressed: boolean | undefined = undefined;
	export let disabled = false;
	export let tooltip = true;
	export let className = '';

	$: sizeClass = {
		sm: 'size-7 [&_svg]:size-4',
		md: 'size-8 [&_svg]:size-5',
		lg: 'size-10 [&_svg]:size-6'
	}[size];

	$: toneClass = {
		default:
			'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
		primary:
			'bg-[--color-primary] text-white hover:bg-[--color-primary-hover] focus-visible:ring-[--color-focus]',
		danger:
			'text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40'
	}[tone];
</script>

<button
	type="button"
	class={`ashpazi-icon-button inline-flex shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--color-focus] disabled:pointer-events-none disabled:opacity-50 ${sizeClass} ${toneClass} ${className}`}
	aria-label={label}
	aria-pressed={pressed}
	title={tooltip ? label : undefined}
	{disabled}
	on:click
>
	<slot />
</button>
