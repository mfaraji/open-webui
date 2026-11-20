<script lang="ts">
	import { onMount, getContext } from 'svelte';
	import { goto } from '$app/navigation';

	import { WEBUI_NAME, config, mobile, showSettings, showSidebar, user } from '$lib/stores';
	import { page } from '$app/stores';
	import Tooltip from '$lib/components/common/Tooltip.svelte';

	import Sidebar from '$lib/components/icons/Sidebar.svelte';

	const i18n = getContext('i18n');

	let loaded = false;
	let query = '';

	type NavItem = { label: string; href?: string; tab?: string; gated?: boolean };

	// Every admin destination, grouped. `href` items are routes; `tab` items open the
	// admin settings modal on that tab (ids match SettingsModal's `admin:<tab>`).
	let groups: { title: string; items: NavItem[] }[];
	$: groups = [
		{
			title: $i18n.t('People'),
			items: [
				{ label: $i18n.t('Users'), href: '/admin' },
				{ label: $i18n.t('Groups'), href: '/admin/users/groups' },
				{ label: $i18n.t('Authentication'), tab: 'authentication' }
			]
		},
		{
			title: $i18n.t('AI'),
			items: [
				{ label: $i18n.t('Models'), tab: 'models' },
				{ label: $i18n.t('Subagents'), tab: 'subagents' },
				{ label: $i18n.t('Connections'), tab: 'connections' },
				{ label: $i18n.t('Pipelines'), tab: 'pipelines' },
				...($config?.features?.enable_functions
					? [{ label: $i18n.t('Functions'), href: '/admin/functions' }]
					: [])
			]
		},
		{
			title: $i18n.t('Evaluate'),
			items: [
				{ label: $i18n.t('Leaderboard'), href: '/admin/evaluations/leaderboard' },
				{ label: $i18n.t('Feedback'), href: '/admin/evaluations/feedback' },
				{ label: $i18n.t('Arena models'), tab: 'evaluations' },
				...(($config?.features?.enable_admin_analytics ?? true)
					? [{ label: $i18n.t('Analytics'), tab: 'analytics' }]
					: [])
			]
		},
		{
			title: $i18n.t('Capabilities'),
			items: [
				{ label: $i18n.t('Documents'), tab: 'documents' },
				{ label: $i18n.t('Web Search'), tab: 'web' },
				{ label: $i18n.t('Code Execution'), tab: 'code-execution' },
				{ label: $i18n.t('Audio'), tab: 'audio' },
				{ label: $i18n.t('Images'), tab: 'images' },
				{ label: $i18n.t('Integrations'), tab: 'integrations' },
				...($config?.features?.enable_apps ? [{ label: $i18n.t('Apps'), tab: 'apps' }] : [])
			]
		},
		{
			title: $i18n.t('System'),
			items: [
				{ label: $i18n.t('General'), tab: 'general' },
				{ label: $i18n.t('Interface'), tab: 'interface' },
				{ label: $i18n.t('Database'), tab: 'db' }
			]
		}
	];

	$: visibleGroups = groups
		.map((g) => ({
			...g,
			items: g.items.filter((i) => i.label.toLowerCase().includes(query.trim().toLowerCase()))
		}))
		.filter((g) => g.items.length > 0);

	const isActive = (item: NavItem, path: string) =>
		item.href
			? item.href === '/admin'
				? path === '/admin' || path === '/admin/users' || path === '/admin/users/overview'
				: path.startsWith(item.href)
			: false;

	onMount(async () => {
		if ($user?.role !== 'admin') {
			await goto('/', { replaceState: true });
		} else if (
			!$config?.features?.enable_functions &&
			$page.url.pathname.includes('/admin/functions')
		) {
			await goto('/admin', { replaceState: true });
		}
		loaded = true;
	});
</script>

<svelte:head>
	<!-- LICENSE covers this Open WebUI browser-title identifier.
	Do not alter, remove, obscure, or replace it except as LICENSE permits:
	https://docs.openwebui.com/license. -->
	<title>
		{$i18n.t('Admin Panel')} / {$WEBUI_NAME}
	</title>
</svelte:head>

{#if loaded}
	<div
		class=" flex flex-col h-screen max-h-[100dvh] flex-1 min-w-0 transition-width duration-200 ease-in-out {$showSidebar
			? 'md:max-w-[calc(100%-var(--sidebar-width))]'
			: 'md:max-w-[calc(100%-42px)]'}  w-full max-w-full"
	>
		<nav class="pb-1 px-1.5 pt-1.5 md:px-2.5 md:pt-2 drag-region select-none">
			<div class=" flex items-center gap-0.5 md:gap-1">
				{#if $mobile}
					<div class="{$showSidebar ? 'md:hidden' : ''} self-center flex flex-none items-center">
						<Tooltip
							content={$showSidebar ? $i18n.t('Close Sidebar') : $i18n.t('Open Sidebar')}
							interactive={true}
						>
							<button
								id="sidebar-toggle-button"
								class=" cursor-pointer flex rounded-lg hover:bg-gray-100 dark:hover:bg-gray-850 transition cursor-"
								aria-label={$showSidebar ? $i18n.t('Close Sidebar') : $i18n.t('Open Sidebar')}
								on:click={() => {
									showSidebar.set(!$showSidebar);
								}}
							>
								<div class=" self-center p-1.5">
									<Sidebar className="size-4" />
								</div>
							</button>
						</Tooltip>
					</div>
				{/if}

			</div>
		</nav>

		<div class="flex flex-1 min-h-0 flex-col md:flex-row">
			<aside
				class="md:w-56 shrink-0 px-2 md:px-3 pb-2 md:overflow-y-auto md:border-r border-gray-100 dark:border-gray-850"
				aria-label={$i18n.t('Admin sections')}
			>
				<input
					type="search"
					bind:value={query}
					class="w-full mb-2 px-3 py-2 text-sm rounded-xl bg-gray-50 dark:bg-gray-900 outline-hidden"
					placeholder={$i18n.t('Jump to…')}
					aria-label={$i18n.t('Search admin')}
				/>
				<nav class="flex md:flex-col gap-3 overflow-x-auto md:overflow-visible scrollbar-none">
					{#each visibleGroups as group}
						<div class="flex md:flex-col gap-0.5 min-w-fit">
							<div
								class="hidden md:block px-2 pt-1 pb-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500"
							>
								{group.title}
							</div>
							{#each group.items as item}
								{#if item.href}
									<a
										href={item.href}
										draggable="false"
										aria-current={isActive(item, $page.url.pathname) ? 'page' : undefined}
										class="min-w-fit px-2 py-1.5 rounded-lg text-sm transition select-none {isActive(
											item,
											$page.url.pathname
										)
											? 'bg-gray-100 dark:bg-gray-850 font-medium'
											: 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900'}"
										>{item.label}</a
									>
								{:else}
									<button
										type="button"
										class="min-w-fit text-left px-2 py-1.5 rounded-lg text-sm transition select-none text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-900"
										on:click={() => showSettings.set(`admin:${item.tab}`)}>{item.label}</button
									>
								{/if}
							{/each}
						</div>
					{/each}
				</nav>
			</aside>
			<div class="pb-1 flex-1 min-w-0 max-h-full overflow-y-auto overflow-x-hidden">
				<slot />
			</div>
		</div>
	</div>
{/if}
