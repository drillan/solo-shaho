import { describe, it, expect } from 'vitest';
import { findApplicableRate } from '$lib/payroll/rates';
import { EntryNotFoundError } from '$lib/payroll/lookup';
import type { RateEntry } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const history = ratesData.history as RateEntry[];

describe('findApplicableRate', () => {
	it('returns the 2026-04 entry for 2026-04', () => {
		const r = findApplicableRate('2026-04', history);
		expect(r.kenpoBase).toBe(9850);
		expect(r.shien).toBe(0);
	});

	it('returns the 2026-05 entry for 2026-05 (shien onset)', () => {
		const r = findApplicableRate('2026-05', history);
		expect(r.shien).toBe(230);
	});

	it('throws with "料率" in the error context for too-old months', () => {
		expect(() => findApplicableRate('2015-12', history)).toThrow(EntryNotFoundError);
		expect(() => findApplicableRate('2015-12', history)).toThrow(/料率/);
	});
});
