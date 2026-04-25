<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';

	let { children } = $props();

	const tabs = [
		{ href: '/', label: '設定' },
		{ href: '/monthly', label: '月次' },
		{ href: '/history', label: '履歴' }
	] as const;

	let current = $derived($page.url.pathname);
</script>

<div class="min-h-screen bg-white text-gray-900">
	<header class="border-b bg-gray-50">
		<nav class="container mx-auto flex items-center gap-4 px-4 py-3">
			<h1 class="text-lg font-bold">solo-shaho</h1>
			<ul class="flex gap-2">
				{#each tabs as t (t.href)}
					<li>
						<a
							href={resolve(t.href)}
							class="rounded px-3 py-1.5 text-sm hover:bg-gray-200"
							class:bg-gray-200={current === t.href}
							class:font-bold={current === t.href}>{t.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
	</header>
	<main class="container mx-auto px-4 py-6">
		{@render children?.()}
	</main>
</div>
