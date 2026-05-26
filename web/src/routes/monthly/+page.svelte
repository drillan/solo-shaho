<script lang="ts">
	import { getAppStateStore } from '$lib/stores/appState';
	import { formatYen, formatRatePercent } from '$lib/format/numbers';
	import { findApplicableRate } from '$lib/payroll/rates';
	import { findApplicableRemuneration } from '$lib/payroll/remuneration';
	import { calculateMonth } from '$lib/payroll/calculate';
	import { validateRateHistory } from '$lib/payroll/types';
	import ratesData from '$lib/data/rates.json';

	const store = getAppStateStore();
	const rateHistory = validateRateHistory(ratesData.history);

	const today = new Date();
	let selectedYear = $state(today.getFullYear());
	let selectedMonth = $state(today.getMonth() + 1);

	function shift(delta: number) {
		let y = selectedYear;
		let m = selectedMonth + delta;
		if (m < 1) {
			m = 12;
			y -= 1;
		}
		if (m > 12) {
			m = 1;
			y += 1;
		}
		selectedYear = y;
		selectedMonth = m;
	}

	let ym = $derived(`${selectedYear}-${String(selectedMonth).padStart(2, '0')}`);
	let hasRemuneration = $derived($store.remunerationHistory.length > 0);
	let result = $derived.by(() => {
		if (!hasRemuneration) return null;
		try {
			const rates = findApplicableRate(ym, rateHistory);
			const rem = findApplicableRemuneration(ym, $store.remunerationHistory);
			return {
				rates,
				rem,
				result: calculateMonth({
					year: selectedYear,
					month: selectedMonth,
					stdRemuneration: rem.stdRemuneration,
					grossSalary: rem.grossSalary,
					birthDate: $store.profile.birthDate,
					rates
				})
			};
		} catch (e) {
			return { error: (e as Error).message };
		}
	});

	let note = $derived($store.monthlyNotes[ym] ?? {});
	let noteError = $state<string | null>(null);

	function saveMemo(value: string) {
		noteError = null;
		store.update((s) => ({
			...s,
			monthlyNotes: {
				...s.monthlyNotes,
				[ym]: { ...(s.monthlyNotes[ym] ?? {}), memo: value }
			}
		}));
	}

	/**
	 * 通知額入力ハンドラ。
	 * - 空文字 → notifiedAmount プロパティを削除(未入力に戻す)。Number('') === 0 として
	 *   silent に保存する fallback を排除する。
	 * - 非負整数文字列 → number に変換して保存。
	 * - それ以外(NaN、負数、小数等) → noteError に格納してユーザーへ表示し、ストアは更新しない。
	 */
	function saveNotifiedAmount(raw: string) {
		store.update((s) => {
			const next = { ...(s.monthlyNotes[ym] ?? {}) };
			if (raw === '') {
				delete next.notifiedAmount;
				noteError = null;
				return { ...s, monthlyNotes: { ...s.monthlyNotes, [ym]: next } };
			}
			if (!/^\d+$/.test(raw)) {
				noteError = `通知額は 0 以上の整数で入力してください(入力: ${raw})`;
				return s;
			}
			next.notifiedAmount = Number(raw);
			noteError = null;
			return { ...s, monthlyNotes: { ...s.monthlyNotes, [ym]: next } };
		});
	}
</script>

<h2 class="text-2xl font-bold">月次計算</h2>

<div class="mt-4 flex items-center gap-2">
	<button class="rounded border px-2 py-1 text-sm" onclick={() => shift(-1)}>← 前月</button>
	<input
		type="number"
		min="2016"
		max="2100"
		bind:value={selectedYear}
		class="w-20 rounded border px-2 py-1"
	/>
	<span>年</span>
	<input
		type="number"
		min="1"
		max="12"
		bind:value={selectedMonth}
		class="w-16 rounded border px-2 py-1"
	/>
	<span>月</span>
	<button class="rounded border px-2 py-1 text-sm" onclick={() => shift(1)}>次月 →</button>
</div>

{#if !hasRemuneration}
	<p class="mt-6 rounded bg-yellow-50 p-3 text-sm">
		設定タブで報酬改定履歴を 1 行以上登録してください。
	</p>
{:else if result && 'error' in result}
	<p class="mt-6 rounded bg-red-50 p-3 text-sm text-red-700">エラー: {result.error}</p>
{:else if result}
	<section class="mt-6 grid max-w-3xl grid-cols-2 gap-6">
		<div>
			<h3 class="font-semibold">入力</h3>
			<dl class="mt-2 grid grid-cols-2 gap-1 text-sm">
				<dt class="text-gray-600">標準報酬月額</dt>
				<dd class="text-right">{formatYen(result.rem.stdRemuneration)}</dd>
				<dt class="text-gray-600">給与額面</dt>
				<dd class="text-right">{formatYen(result.rem.grossSalary)}</dd>
				<dt class="text-gray-600">介護該当</dt>
				<dd>{result.result.isKaigoApplicable ? '✅' : '❌'}</dd>
				<dt class="text-gray-600">健保適用料率</dt>
				<dd>{formatRatePercent(result.result.appliedKenpoRate)}</dd>
				<dt class="text-gray-600">厚年料率</dt>
				<dd>{formatRatePercent(result.rates.kosei)}</dd>
				<dt class="text-gray-600">拠出金率</dt>
				<dd>{formatRatePercent(result.rates.kosodate, 3)}</dd>
				<dt class="text-gray-600">支援金率</dt>
				<dd>{formatRatePercent(result.rates.shien, 3)}</dd>
			</dl>
		</div>
		<div>
			<h3 class="font-semibold">計算結果</h3>
			<table class="mt-2 w-full text-sm">
				<thead class="text-gray-600">
					<tr
						><th class="text-left">項目</th><th class="text-right">全額</th><th class="text-right"
							>社員</th
						><th class="text-right">事業主</th></tr
					>
				</thead>
				<tbody>
					<tr
						><td>協会けんぽ<span class="text-xs text-gray-500">(健保+介護+支援金)</span></td><td
							class="text-right">{formatYen(result.result.kyokaiTotal)}</td
						><td class="text-right">{formatYen(result.result.kyokaiEmployee)}</td><td
							class="text-right">{formatYen(result.result.kyokaiEmployer)}</td
						></tr
					>
					<tr
						><td>厚年</td><td class="text-right">{formatYen(result.result.koseiTotal)}</td><td
							class="text-right">{formatYen(result.result.koseiEmployee)}</td
						><td class="text-right">{formatYen(result.result.koseiEmployer)}</td></tr
					>
					<tr
						><td>拠出金</td><td class="text-right">{formatYen(result.result.kosodateTotal)}</td><td
							class="text-right">─</td
						><td class="text-right">{formatYen(result.result.kosodateEmployer)}</td></tr
					>
					<tr class="border-t font-semibold"
						><td>合計</td><td></td><td class="text-right"
							>{formatYen(result.result.employeeDeductionTotal)}</td
						><td class="text-right">{formatYen(result.result.employerBurdenTotal)}</td></tr
					>
					<tr class="font-bold"
						><td>納付額</td><td colspan="3" class="text-right"
							>{formatYen(result.result.payableTotal)}</td
						></tr
					>
					<tr
						><td>差引支給額</td><td colspan="3" class="text-right"
							>{formatYen(result.result.netSalary)}</td
						></tr
					>
				</tbody>
			</table>
		</div>
	</section>

	<section class="mt-6 max-w-3xl">
		<h3 class="font-semibold">通知額(任意・検算用)</h3>
		<div class="mt-2 flex items-center gap-3 text-sm">
			<label>
				通知額: <input
					type="number"
					min="0"
					value={note.notifiedAmount ?? ''}
					step="1"
					onchange={(e) => saveNotifiedAmount((e.target as HTMLInputElement).value)}
					class="w-32 rounded border px-2 py-0.5 text-right"
				/>
			</label>
			{#if note.notifiedAmount !== undefined}
				<span>差分: {formatYen(result.result.payableTotal - note.notifiedAmount)}</span>
			{/if}
		</div>
		{#if noteError !== null}
			<p class="mt-2 rounded bg-red-50 p-2 text-sm text-red-700">{noteError}</p>
		{/if}
		<label class="mt-3 block text-sm">
			メモ
			<!--
				bind:value は派生 store のオブジェクトを直接 mutate してしまい、
				blur まで store.update が走らずに silent data loss になるため使わない。
				代わりに value + oninput の controlled component で 1 文字ごとに永続化する。
			-->
			<textarea
				value={note.memo ?? ''}
				oninput={(e) => saveMemo((e.target as HTMLTextAreaElement).value)}
				rows="2"
				class="mt-1 w-full rounded border px-2 py-1"
			></textarea>
		</label>
	</section>
{/if}
