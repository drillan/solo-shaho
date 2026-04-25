import { describe, it, expect } from 'vitest';
import ratesData from '$lib/data/rates.json';
import type { RateEntry } from '$lib/payroll/types';

describe('rates.json', () => {
	it('has schemaVersion 1', () => {
		expect(ratesData.schemaVersion).toBe(1);
	});

	it('has 17 entries in chronological order', () => {
		expect(ratesData.history).toHaveLength(17);
		const dates = ratesData.history.map((e) => e.effectiveFrom);
		const sorted = [...dates].sort();
		expect(dates).toEqual(sorted);
	});

	it('all rates are non-negative integers', () => {
		for (const e of ratesData.history as RateEntry[]) {
			for (const k of ['kenpoBase', 'kaigo', 'kosei', 'kosodate', 'shien'] as const) {
				expect(Number.isInteger(e[k])).toBe(true);
				expect(e[k]).toBeGreaterThanOrEqual(0);
			}
		}
	});
});
