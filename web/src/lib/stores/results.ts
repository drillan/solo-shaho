import { derived, type Readable, type Writable } from 'svelte/store';
import {
	validateRateHistory,
	type AppState,
	type MonthResult,
	type RateEntry
} from '$lib/payroll/types';
import { calculateRange } from '$lib/payroll/calculate';
import ratesData from '$lib/data/rates.json';

const RATE_HISTORY: RateEntry[] = validateRateHistory(ratesData.history);

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
