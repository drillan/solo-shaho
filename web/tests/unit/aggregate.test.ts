import { describe, it, expect } from 'vitest';
import { aggregateByCalendarYear } from '$lib/payroll/aggregate';
import { calculateRange } from '$lib/payroll/calculate';
import type { MonthResult, RateEntry, RemunerationEntry } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const rateHistory = ratesData.history as RateEntry[];
const remunerationHistory: RemunerationEntry[] = [
	{ effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '' }
];

function makeStub(year: number, month: number, ed: number, eb: number, total: number): MonthResult {
	return {
		year,
		month,
		age: null,
		isKaigoApplicable: false,
		appliedKenpoRate: 0,
		kyokaiTotal: 0,
		kyokaiEmployee: 0,
		kyokaiEmployer: 0,
		koseiTotal: 0,
		koseiEmployee: 0,
		koseiEmployer: 0,
		kosodateTotal: 0,
		kosodateEmployer: 0,
		employeeDeductionTotal: ed,
		employerBurdenTotal: eb,
		payableTotal: total,
		netSalary: 0
	};
}

describe('aggregateByCalendarYear', () => {
	it('returns one summary per calendar year present in the input', () => {
		const results = calculateRange('2024-12', '2025-02', {
			birthDate: '1985-06-15',
			remunerationHistory,
			rateHistory
		});
		// results は MonthResult[] で year/month を内包しているため、そのまま渡せる
		const summaries = aggregateByCalendarYear(results);
		expect(summaries).toHaveLength(2);
		expect(summaries[0].year).toBe(2024);
		expect(summaries[0].monthCount).toBe(1);
		expect(summaries[1].year).toBe(2025);
		expect(summaries[1].monthCount).toBe(2);
	});

	it('合計値が正しい', () => {
		const summaries = aggregateByCalendarYear([
			makeStub(2024, 5, 100, 200, 300),
			makeStub(2024, 6, 110, 210, 320)
		]);
		expect(summaries).toHaveLength(1);
		expect(summaries[0].employeeDeductionTotal).toBe(210);
		expect(summaries[0].employerBurdenTotal).toBe(410);
		expect(summaries[0].payableTotal).toBe(620);
	});

	it('空配列なら空配列を返す', () => {
		expect(aggregateByCalendarYear([])).toEqual([]);
	});
});
