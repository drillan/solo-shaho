import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateMonth } from '$lib/payroll/calculate';
import { findApplicableRate } from '$lib/payroll/rates';
import { validateRateHistory, type MonthResult } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const SNAPSHOT_PATH = resolve(__dirname, 'excel-snapshot.json');
const SKIP = !existsSync(SNAPSHOT_PATH);
const rateHistory = validateRateHistory(ratesData.history);

/** MonthResult のうち Excel と突合可能な数値・真偽値フィールドのみを許容する。 */
type SnapshotExpectedKey = {
	[K in keyof MonthResult]: MonthResult[K] extends number | boolean ? K : never;
}[keyof MonthResult];

interface SnapshotCase {
	year: number;
	month: number;
	input: { stdRemuneration: number; grossSalary: number; birthDate: string };
	/** キーは MonthResult のフィールド名のみ。値が null のフィールドは fixture 抽出側のミスとして
	 * 扱い、テストは fail する(silent skip しない)。 */
	expected: Partial<Record<SnapshotExpectedKey, number | boolean>>;
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
			for (const k of Object.keys(c.expected) as SnapshotExpectedKey[]) {
				const v = c.expected[k];
				expect(v, `expected[${k}] should not be null in fixture`).toBeDefined();
				expect(got[k]).toBe(v);
			}
		});
	}
});
