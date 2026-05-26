import { describe, it, expect } from 'vitest';
import { calculateMonth, calculateRange, InvalidYearMonthError } from '$lib/payroll/calculate';
import type { MonthInput, RateEntry, RemunerationEntry } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const rate2026Apr: RateEntry = {
	effectiveFrom: '2026-04-01',
	kenpoBase: 9850,
	kaigo: 1620,
	kosei: 18300,
	kosodate: 360,
	shien: 0,
	note: '2026年4月納付分'
};

const rate2026May: RateEntry = {
	...rate2026Apr,
	effectiveFrom: '2026-05-01',
	shien: 230,
	note: '2026年5月納付分(支援金開始)'
};

describe('calculateMonth — 2026/04 (kaigo applicable, no shien yet)', () => {
	const input: MonthInput = {
		year: 2026,
		month: 4,
		stdRemuneration: 88000,
		grossSalary: 83000,
		birthDate: '1985-06-15',
		rates: rate2026Apr
	};
	const r = calculateMonth(input);

	it('結果に year=2026, month=4 が埋め込まれる', () => {
		expect(r.year).toBe(2026);
		expect(r.month).toBe(4);
	});

	it('age = 40 (April month-end is before the June birthday → year diff − 1)', () => {
		// 1985-06-15 生まれ、2026-04 月末 = 2026-04-30
		// 月日比較で 04-30 < 06-15 のため year 差から 1 引く → 41 - 1 = 40
		expect(r.age).toBe(40);
	});

	it('介護該当 (40歳誕生日 2025-06-15 前日以降、65歳誕生日前日未満)', () => {
		// 40歳誕生日前日 = 2025-06-14、65歳誕生日前日 = 2050-06-14
		// 2026-04-30 ∈ [2025-06-14, 2050-06-14) → 該当
		expect(r.isKaigoApplicable).toBe(true);
	});

	it('appliedKenpoRate = kenpoBase + kaigo (kaigo applicable)', () => {
		expect(r.appliedKenpoRate).toBe(9850 + 1620);
	});

	it('協会けんぽ群(支援金前)は健保のみ・全額 10093', () => {
		// 全額_sen = 88000 * 11470 / 1000 = 1,009,360 → 10093.60 yen → ROUNDDOWN = 10093
		// 支援金 0 のため協会けんぽ群 = 健保単独
		expect(r.kyokaiTotal).toBe(10093);
	});

	it('協会けんぽ社員 = 5047 (11.47% 半額 5046.8 → 50銭超切上げ)、事業主 = 残額 5046', () => {
		expect(r.kyokaiEmployee).toBe(5047);
		expect(r.kyokaiEmployer).toBe(10093 - 5047);
		expect(r.kyokaiEmployee + r.kyokaiEmployer).toBe(r.kyokaiTotal);
	});

	it('koseiTotal = ROUNDDOWN(88000 * 18.30%) = 16104', () => {
		expect(r.koseiTotal).toBe(16104);
	});

	it('koseiEmployee = 8052, employer = 8052', () => {
		expect(r.koseiEmployee).toBe(8052);
		expect(r.koseiEmployer).toBe(8052);
	});

	it('kosodateEmployer = floor(88000 * 0.36% ROUNDDOWN) = 316', () => {
		expect(r.kosodateEmployer).toBe(316);
		expect(r.kosodateTotal).toBe(316);
	});

	it('集計値が一致する (支援金前は納付額 26513)', () => {
		expect(r.employeeDeductionTotal).toBe(r.kyokaiEmployee + r.koseiEmployee);
		expect(r.employerBurdenTotal).toBe(r.kyokaiEmployer + r.koseiEmployer + r.kosodateEmployer);
		expect(r.payableTotal).toBe(r.employeeDeductionTotal + r.employerBurdenTotal);
		expect(r.payableTotal).toBe(26513);
		expect(r.netSalary).toBe(83000 - r.employeeDeductionTotal);
	});
});

describe('calculateMonth — birthDate=null (kaigo は false)', () => {
	it('appliedKenpoRate = kenpoBase only', () => {
		const r = calculateMonth({
			year: 2026,
			month: 4,
			stdRemuneration: 88000,
			grossSalary: 83000,
			birthDate: null,
			rates: rate2026Apr
		});
		expect(r.isKaigoApplicable).toBe(false);
		expect(r.appliedKenpoRate).toBe(9850);
		expect(r.age).toBe(null);
	});
});

describe('calculateMonth — 2026/05 (支援金開始, kaigo 該当): 告知書単位の合算丸め', () => {
	// 案件: 納付額と通知額の1円ずれ。協会けんぽ告知(健保+介護+支援金)は
	// 「種別ごとに切捨て」ではなく「合算してから1円未満切捨て」(料額表の脚注)。
	// 健保 10093.6 + 支援金 202.4 = 10296.0 → floor 10296 (種別ごとなら 10093+202=10295 で1円不足)。
	const r = calculateMonth({
		year: 2026,
		month: 5,
		stdRemuneration: 88000,
		grossSalary: 83000,
		birthDate: '1985-06-15',
		rates: rate2026May
	});

	it('協会けんぽ群(健保+支援金)は合算後切捨てで全額 10296', () => {
		// floor((1009360 + 20240) / 100) = floor(10296.00) = 10296
		expect(r.kyokaiTotal).toBe(10296);
	});

	it('協会けんぽ社員 = 健保5047 + 支援金101 = 5148 (各 50銭rule 後の和)', () => {
		expect(r.kyokaiEmployee).toBe(5148);
	});

	it('協会けんぽ事業主 = 残額 10296 - 5148 = 5148 (種別ごと 5046+101=5147 より +1)', () => {
		expect(r.kyokaiEmployer).toBe(5148);
		expect(r.kyokaiEmployee + r.kyokaiEmployer).toBe(r.kyokaiTotal);
	});

	it('厚年・拠出金は据え置き(全額 16104 / 316、厚年は端数なしで合算と一致)', () => {
		expect(r.koseiTotal).toBe(16104);
		expect(r.koseiEmployee).toBe(8052);
		expect(r.koseiEmployer).toBe(8052);
		expect(r.kosodateTotal).toBe(316);
		expect(r.kosodateEmployer).toBe(316);
	});

	it('社員天引き合計 13200・差引支給額 69800 は不変', () => {
		expect(r.employeeDeductionTotal).toBe(13200);
		expect(r.netSalary).toBe(83000 - 13200);
	});

	it('事業主負担 13516・納付額 26716 で通知額と一致 (1円ずれ解消)', () => {
		expect(r.employerBurdenTotal).toBe(13516);
		expect(r.payableTotal).toBe(26716);
	});

	it('納付額 = 各告知書の全額の和 = 社員 + 事業主', () => {
		expect(r.payableTotal).toBe(r.kyokaiTotal + r.koseiTotal + r.kosodateTotal);
		expect(r.payableTotal).toBe(r.employeeDeductionTotal + r.employerBurdenTotal);
	});
});

const allRates = ratesData.history as RateEntry[];

describe('calculateRange', () => {
	const remunerationHistory: RemunerationEntry[] = [
		{ effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' }
	];

	it('returns 3 results for "2026-03" .. "2026-05"', () => {
		const results = calculateRange('2026-03', '2026-05', {
			birthDate: '1985-06-15',
			remunerationHistory,
			rateHistory: allRates
		});
		expect(results).toHaveLength(3);
	});

	it('2026-05 で支援金が協会けんぽ告知に加算され納付額が増える', () => {
		const results = calculateRange('2026-03', '2026-05', {
			birthDate: '1985-06-15',
			remunerationHistory,
			rateHistory: allRates
		});
		// results[1]=2026-04(支援金前), results[2]=2026-05(支援金開始)
		expect(results[1].payableTotal).toBe(26513);
		expect(results[2].kyokaiTotal).toBeGreaterThan(results[1].kyokaiTotal); // 10296 > 10093
		expect(results[2].payableTotal).toBe(26716);
	});

	it('start > end のとき空配列', () => {
		const results = calculateRange('2026-05', '2026-03', {
			birthDate: '1985-06-15',
			remunerationHistory,
			rateHistory: allRates
		});
		expect(results).toEqual([]);
	});

	it('throws InvalidYearMonthError when start has wrong format (silent failure 防止)', () => {
		expect(() =>
			calculateRange('2026/03', '2026-05', {
				birthDate: '1985-06-15',
				remunerationHistory: [
					{
						effectiveFrom: '2024-04-01',
						stdRemuneration: 88000,
						grossSalary: 83000,
						note: ''
					}
				],
				rateHistory: allRates
			})
		).toThrow(InvalidYearMonthError);
	});

	it('throws InvalidYearMonthError when end has wrong format', () => {
		expect(() =>
			calculateRange('2026-03', 'garbage', {
				birthDate: '1985-06-15',
				remunerationHistory: [
					{
						effectiveFrom: '2024-04-01',
						stdRemuneration: 88000,
						grossSalary: 83000,
						note: ''
					}
				],
				rateHistory: allRates
			})
		).toThrow(InvalidYearMonthError);
	});
});
