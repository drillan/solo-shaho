import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateMonth } from '$lib/payroll/calculate';
import { findApplicableRate } from '$lib/payroll/rates';
import type { RateEntry } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const SNAPSHOT_PATH = resolve(__dirname, 'excel-snapshot.json');
const SKIP = !existsSync(SNAPSHOT_PATH);
const rateHistory = ratesData.history as RateEntry[];

interface SnapshotCase {
	year: number;
	month: number;
	input: { stdRemuneration: number; grossSalary: number; birthDate: string };
	expected: Record<string, number | boolean | null>;
}

describe.skipIf(SKIP)('Excel snapshot regression', () => {
	const data = SKIP
		? { cases: [] as SnapshotCase[] }
		: (JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { cases: SnapshotCase[] });

	for (const c of data.cases) {
		it(`${c.year}/${c.month}`, () => {
			const ym = `${c.year}-${String(c.month).padStart(2, '0')}`;
			const rates = findApplicableRate(ym, rateHistory);
			const got = calculateMonth({
				year: c.year,
				month: c.month,
				stdRemuneration: c.input.stdRemuneration,
				grossSalary: c.input.grossSalary,
				birthDate: c.input.birthDate || null,
				rates
			});
			for (const [k, v] of Object.entries(c.expected)) {
				if (v === null) continue;
				expect((got as unknown as Record<string, unknown>)[k]).toBe(v);
			}
		});
	}
});
