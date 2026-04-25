<script lang="ts">
	import { getAppStateStore } from '$lib/stores/appState';
	import { formatYen } from '$lib/format/numbers';
	import { calculateRange } from '$lib/payroll/calculate';
	import { aggregateByCalendarYear } from '$lib/payroll/aggregate';
	import { findApplicableRemuneration } from '$lib/payroll/remuneration';
	import { validateRateHistory, type MonthResult, type YearSummary } from '$lib/payroll/types';
	import ratesData from '$lib/data/rates.json';

	const store = getAppStateStore();
	const rateHistory = validateRateHistory(ratesData.history);

	type Row =
		| { kind: 'month'; result: MonthResult; std: number }
		| { kind: 'year'; summary: YearSummary };

	// ユーザー指定の表示範囲を、報酬改定履歴に基づく適用可能範囲にクランプする。
	// 履歴より古い月を含めた瞬間に EntryNotFoundError が出るのを防ぎつつ、
	// フォールバックでゼロ値を捏造することもしない(「クランプして表示しない」を選択)。
	function effectiveStartYM(
		userStart: string,
		history: readonly { effectiveFrom: string }[]
	): string | null {
		if (history.length === 0) return null;
		const oldest = [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
		const oldestYM = oldest.effectiveFrom.slice(0, 7);
		return userStart < oldestYM ? oldestYM : userStart;
	}

	let userStartYM = $state('2024-04');
	let endYM = $state(`${new Date().getFullYear() + 1}-12`);

	let hasRem = $derived($store.remunerationHistory.length > 0);
	let clampedStart = $derived(effectiveStartYM(userStartYM, $store.remunerationHistory));
	let months = $derived(
		hasRem && clampedStart !== null
			? calculateRange(clampedStart, endYM, {
					birthDate: $store.profile.birthDate,
					remunerationHistory: $store.remunerationHistory,
					rateHistory
				})
			: []
	);
	let yearSummaries = $derived(aggregateByCalendarYear(months));
	let rows = $derived.by(() => {
		const out: Row[] = [];
		let curYear: number | null = null;
		for (const r of months) {
			if (curYear !== null && curYear !== r.year) {
				const sum = yearSummaries.find((s) => s.year === curYear);
				if (sum) out.push({ kind: 'year', summary: sum });
			}
			// findApplicableRemuneration の throw は現時点で発生しない契約
			// (clampedStart で履歴範囲外を排除済み)。万一 throw した場合は
			// 上位の reactive ブロックでそのまま伝播させる(ユーザーに表示する)。
			const std = findApplicableRemuneration(
				`${r.year}-${String(r.month).padStart(2, '0')}`,
				$store.remunerationHistory
			).stdRemuneration;
			out.push({ kind: 'month', result: r, std });
			curYear = r.year;
		}
		if (curYear !== null) {
			const sum = yearSummaries.find((s) => s.year === curYear);
			if (sum) out.push({ kind: 'year', summary: sum });
		}
		return out;
	});

	// 表示範囲のクランプをユーザーに開示する(silent failure 防止)
	let rangeClamped = $derived(clampedStart !== null && clampedStart !== userStartYM);
</script>

<h2 class="text-2xl font-bold">履歴</h2>

<div class="mt-4 flex items-center gap-3 text-sm">
	<label
		>開始: <input type="month" bind:value={userStartYM} class="rounded border px-2 py-1" /></label
	>
	<label>終了: <input type="month" bind:value={endYM} class="rounded border px-2 py-1" /></label>
</div>

{#if rangeClamped}
	<p class="mt-2 rounded bg-yellow-50 p-2 text-sm text-yellow-800">
		指定の開始月 {userStartYM} は報酬改定履歴の最古エントリより古いため、{clampedStart}
		から表示しています。
	</p>
{/if}

{#if !hasRem}
	<p class="mt-6 rounded bg-yellow-50 p-3 text-sm">設定タブで報酬改定履歴を登録してください。</p>
{:else}
	<div class="mt-6 overflow-x-auto">
		<table class="w-full min-w-max text-sm">
			<thead class="bg-gray-100">
				<tr>
					<th class="px-2 py-1 text-right">年/月</th>
					<th class="px-2 py-1 text-right">標報</th>
					<th class="px-2 py-1 text-right">介護</th>
					<th class="px-2 py-1 text-right">社員天引き</th>
					<th class="px-2 py-1 text-right">事業主負担</th>
					<th class="px-2 py-1 text-right">納付額</th>
					<th class="px-2 py-1 text-right">差引支給</th>
					<th class="px-2 py-1 text-right">通知額</th>
					<th class="px-2 py-1 text-right">差分</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row, i (i)}
					{#if row.kind === 'month'}
						{@const monthKey = `${row.result.year}-${String(row.result.month).padStart(2, '0')}`}
						{@const notified = $store.monthlyNotes[monthKey]?.notifiedAmount}
						<tr class="border-b">
							<td class="px-2 py-1 text-right">{row.result.year}/{row.result.month}</td>
							<td class="px-2 py-1 text-right">{formatYen(row.std)}</td>
							<td class="px-2 py-1 text-right">{row.result.isKaigoApplicable ? '✅' : '─'}</td>
							<td class="px-2 py-1 text-right">{formatYen(row.result.employeeDeductionTotal)}</td>
							<td class="px-2 py-1 text-right">{formatYen(row.result.employerBurdenTotal)}</td>
							<td class="px-2 py-1 text-right">{formatYen(row.result.payableTotal)}</td>
							<td class="px-2 py-1 text-right">{formatYen(row.result.netSalary)}</td>
							<td class="px-2 py-1 text-right">
								{#if notified !== undefined}
									{formatYen(notified)}
								{:else}─{/if}
							</td>
							<td class="px-2 py-1 text-right">
								{#if notified !== undefined}
									{formatYen(row.result.payableTotal - notified)}
								{:else}─{/if}
							</td>
						</tr>
					{:else}
						<tr class="border-y-2 border-gray-400 bg-gray-50 font-semibold">
							<td colspan="3" class="px-2 py-1 text-right"
								>{row.summary.year}年 集計({row.summary.monthCount}月分)</td
							>
							<td class="px-2 py-1 text-right">{formatYen(row.summary.employeeDeductionTotal)}</td>
							<td class="px-2 py-1 text-right">{formatYen(row.summary.employerBurdenTotal)}</td>
							<td class="px-2 py-1 text-right">{formatYen(row.summary.payableTotal)}</td>
							<td colspan="3"></td>
						</tr>
					{/if}
				{/each}
			</tbody>
		</table>
	</div>
{/if}
