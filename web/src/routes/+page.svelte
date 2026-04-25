<script lang="ts">
	import { getAppStateStore } from '$lib/stores/appState';
	import { isKaigoApplicable } from '$lib/payroll/kaigo';

	const store = getAppStateStore();

	function todayDateString(): string {
		const d = new Date();
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		return `${y}-${m}-01`;
	}

	function addRemunerationRow() {
		// 新規行のデフォルト effectiveFrom は当月1日。空文字を入れて
		// 文字列辞書順比較で常時マッチしてしまう silent な ゼロフォールバックを防ぐ。
		store.update((s) => ({
			...s,
			remunerationHistory: [
				...s.remunerationHistory,
				{
					effectiveFrom: todayDateString(),
					stdRemuneration: 0,
					grossSalary: 0,
					note: ''
				}
			]
		}));
	}

	function removeRemunerationRow(idx: number) {
		store.update((s) => ({
			...s,
			remunerationHistory: s.remunerationHistory.filter((_, i) => i !== idx)
		}));
	}

	const today = new Date();
	const currentY = today.getFullYear();
	const currentM = today.getMonth() + 1;
	let kaigoNow = $derived(isKaigoApplicable($store.profile.birthDate, currentY, currentM));

	// 履歴に空 effectiveFrom が含まれている場合、計算結果は信頼できない。
	// バリデーションメッセージで明示する(silent failure 防止)。
	let emptyEffectiveCount = $derived(
		$store.remunerationHistory.filter((r) => r.effectiveFrom === '').length
	);
</script>

<h2 class="text-2xl font-bold">設定</h2>

<section class="mt-6">
	<h3 class="text-lg font-semibold">プロフィール</h3>
	<div class="mt-3 grid max-w-xl grid-cols-2 gap-3">
		<label class="block">
			<span class="text-sm text-gray-600">氏名(任意)</span>
			<input
				class="mt-1 w-full rounded border px-2 py-1"
				type="text"
				bind:value={$store.profile.name}
			/>
		</label>
		<label class="block">
			<span class="text-sm text-gray-600">生年月日(必須・介護判定用)</span>
			<input
				class="mt-1 w-full rounded border px-2 py-1"
				type="date"
				bind:value={$store.profile.birthDate}
			/>
		</label>
	</div>
	<p class="mt-2 text-sm text-gray-600">
		現在 介護該当: <strong>{kaigoNow ? '✅' : '❌'}</strong>
	</p>
</section>

{#if emptyEffectiveCount > 0}
	<p class="mt-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
		報酬改定履歴に「適用開始日」が未入力の行が {emptyEffectiveCount}
		件あります。月次・履歴タブの計算は信頼できません。
	</p>
{/if}

<section class="mt-8">
	<div class="flex items-center justify-between">
		<h3 class="text-lg font-semibold">報酬改定履歴</h3>
		<button
			type="button"
			class="rounded border px-3 py-1 text-sm hover:bg-gray-100"
			onclick={addRemunerationRow}>+ 行を追加</button
		>
	</div>
	<table class="mt-3 w-full text-sm">
		<thead class="bg-gray-100 text-gray-600">
			<tr>
				<th class="px-2 py-1 text-left">適用開始日</th>
				<th class="px-2 py-1 text-right">標準報酬月額</th>
				<th class="px-2 py-1 text-right">給与額面</th>
				<th class="px-2 py-1 text-left">備考</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each $store.remunerationHistory as r, idx (idx)}
				<tr class="border-b" class:font-bold={idx === $store.remunerationHistory.length - 1}>
					<td class="px-2 py-1"
						><input
							type="date"
							bind:value={r.effectiveFrom}
							class="rounded border px-1 py-0.5"
						/></td
					>
					<td class="px-2 py-1 text-right"
						><input
							type="number"
							min="0"
							bind:value={r.stdRemuneration}
							class="w-32 rounded border px-1 py-0.5 text-right"
						/></td
					>
					<td class="px-2 py-1 text-right"
						><input
							type="number"
							min="0"
							bind:value={r.grossSalary}
							class="w-32 rounded border px-1 py-0.5 text-right"
						/></td
					>
					<td class="px-2 py-1"
						><input type="text" bind:value={r.note} class="w-full rounded border px-1 py-0.5" /></td
					>
					<td class="px-2 py-1"
						><button
							type="button"
							class="text-red-600 hover:underline"
							onclick={() => removeRemunerationRow(idx)}>削除</button
						></td
					>
				</tr>
			{/each}
			{#if $store.remunerationHistory.length === 0}
				<tr
					><td colspan="5" class="px-2 py-3 text-center text-gray-500"
						>「+ 行を追加」で履歴を登録してください</td
					></tr
				>
			{/if}
		</tbody>
	</table>
</section>
