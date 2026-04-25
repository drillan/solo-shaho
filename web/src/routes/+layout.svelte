<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { getAppStateStore } from '$lib/stores/appState';
	import { createDefaultAppState } from '$lib/payroll/types';
	import { persistenceErrorStore, clearPersistenceError } from '$lib/stores/persistence';
	import { serializeAppState } from '$lib/csv/serialize';
	import { parseCsv } from '$lib/csv/parse';
	import { validateAndConvert } from '$lib/csv/validate';

	let { children } = $props();

	const tabs = [
		{ href: '/', label: '設定' },
		{ href: '/monthly', label: '月次' },
		{ href: '/history', label: '履歴' }
	] as const;

	const store = getAppStateStore();
	let menuOpen = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let importMessage = $state('');

	function exportCsv() {
		const csv = serializeAppState($store, { exportedAt: new Date().toISOString() });
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `solo-shaho-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
		menuOpen = false;
	}

	async function importCsv() {
		// onchange が発火した時点で fileInput は必ずマウント済みである。
		// undefined を握りつぶして silent failure にしないよう、明示的に検査する。
		if (fileInput === undefined) {
			throw new Error('fileInput element is not mounted');
		}
		const input = fileInput;
		const file = input.files?.[0];
		if (!file) return;

		// ファイル読込・パース・バリデーションの 3 段階すべてでエラーをユーザーに伝える
		let text: string;
		try {
			text = await file.text();
		} catch (e) {
			importMessage = `ファイル読み取り失敗: ${(e as Error).message}`;
			input.value = '';
			menuOpen = false;
			return;
		}

		let next;
		try {
			next = validateAndConvert(parseCsv(text));
		} catch (e) {
			importMessage = `CSV パース/バリデーション失敗: ${(e as Error).message}`;
			input.value = '';
			menuOpen = false;
			return;
		}

		if (!confirm('既存データを上書きします。本当に取り込みますか?')) {
			input.value = '';
			menuOpen = false;
			return;
		}
		store.set(next);
		importMessage = '取り込み成功';
		input.value = '';
		menuOpen = false;
	}

	function clearAll() {
		if (!confirm('すべてのデータを削除します。事前に CSV エクスポートしましたか?')) return;
		store.set(createDefaultAppState());
		menuOpen = false;
	}

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
			<div class="relative ml-auto">
				<button class="rounded border px-3 py-1 text-sm" onclick={() => (menuOpen = !menuOpen)}
					>⚙ I/O</button
				>
				{#if menuOpen}
					<div class="absolute right-0 top-full z-10 mt-1 w-48 rounded border bg-white p-1 shadow">
						<button
							class="block w-full rounded px-3 py-1 text-left text-sm hover:bg-gray-100"
							onclick={exportCsv}>CSV エクスポート</button
						>
						<label class="block w-full rounded px-3 py-1 text-left text-sm hover:bg-gray-100">
							CSV インポート
							<input
								bind:this={fileInput}
								type="file"
								accept=".csv,text/csv"
								class="hidden"
								onchange={importCsv}
							/>
						</label>
						<button
							class="block w-full rounded px-3 py-1 text-left text-sm text-red-600 hover:bg-red-50"
							onclick={clearAll}>全データクリア</button
						>
					</div>
				{/if}
			</div>
		</nav>
	</header>
	<main class="container mx-auto px-4 py-6">
		{#if $persistenceErrorStore !== null}
			<div class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
				<strong>データの保存に失敗しました</strong>: {$persistenceErrorStore.message}<br />
				ストレージ容量超過などの可能性があります。CSV エクスポートでバックアップを取り、ブラウザの保存データを整理してください。
				<button class="ml-2 underline" onclick={clearPersistenceError}>閉じる</button>
			</div>
		{/if}
		{#if importMessage !== ''}
			<p class="mb-4 rounded bg-blue-50 p-2 text-sm">{importMessage}</p>
		{/if}
		{@render children?.()}
	</main>
</div>
