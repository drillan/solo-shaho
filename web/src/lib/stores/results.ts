import { derived, type Readable, type Writable } from 'svelte/store';
import type { AppState, MonthResult, RateEntry } from '$lib/payroll/types';
import { calculateRange } from '$lib/payroll/calculate';
import ratesData from '$lib/data/rates.json';

const RATE_HISTORY = ratesData.history as RateEntry[];

export function createResultsStore(
	appState: Writable<AppState>,
	range: { start: string; end: string }
): Readable<MonthResult[]> {
	return derived(appState, ($s) => {
		if ($s.remunerationHistory.length === 0) return [];
		return calculateRange(range.start, range.end, {
			birthDate: $s.profile.birthDate,
			remunerationHistory: $s.remunerationHistory,
			rateHistory: RATE_HISTORY
		});
	});
}
