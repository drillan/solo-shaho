import type { MonthResult, YearSummary } from './types';

/**
 * 月次計算結果を暦年で集計する。MonthResult が year/month を内包しているため
 * 並列配列パターンや TaggedMonth ラッパーは不要。
 */
export function aggregateByCalendarYear(months: readonly MonthResult[]): YearSummary[] {
	const byYear = new Map<number, YearSummary>();
	for (const r of months) {
		let s = byYear.get(r.year);
		if (!s) {
			s = {
				year: r.year,
				monthCount: 0,
				employeeDeductionTotal: 0,
				employerBurdenTotal: 0,
				payableTotal: 0
			};
			byYear.set(r.year, s);
		}
		s.monthCount += 1;
		s.employeeDeductionTotal += r.employeeDeductionTotal;
		s.employerBurdenTotal += r.employerBurdenTotal;
		s.payableTotal += r.payableTotal;
	}
	return [...byYear.values()].sort((a, b) => a.year - b.year);
}
