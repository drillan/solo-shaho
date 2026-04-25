import { describe, it, expect } from 'vitest';
import { calculateMonth, calculateRange } from '$lib/payroll/calculate';
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

	it('kenpoTotal = floor(88000 * 11470 / 1000 / 100) = 10093 (after ROUNDDOWN)', () => {
		// ※ kenpoTotal は MonthResult では「全額(整数円・ROUNDDOWN 後)」として保持
		// 全額_sen = 88000 * 11470 / 1000 = 1,009,360 → 10093.60 yen → ROUNDDOWN = 10093
		expect(r.kenpoTotal).toBe(10093);
	});

	it('kenpoEmployee + kenpoEmployer = kenpoTotal (1円ズレ問題が起きない)', () => {
		expect(r.kenpoEmployee + r.kenpoEmployer).toBe(r.kenpoTotal);
	});

	it('kenpoEmployee = 5047 (kaigo 込み 11.47% の半額・50銭超切上げ)', () => {
		// 全額 = 88000 × 11.47% = 10093.6, 半額 = 5046.8, 60銭は50銭超 → 切上げ → 5047
		expect(r.kenpoEmployee).toBe(5047);
		expect(r.kenpoEmployer).toBe(10093 - 5047);
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

	it('shien = 0 (2026/04 月分は支援金開始前)', () => {
		expect(r.shienTotal).toBe(0);
		expect(r.shienEmployee).toBe(0);
		expect(r.shienEmployer).toBe(0);
	});

	it('集計値が一致する', () => {
		expect(r.employeeDeductionTotal).toBe(r.kenpoEmployee + r.koseiEmployee + r.shienEmployee);
		expect(r.employerBurdenTotal).toBe(
			r.kenpoEmployer + r.koseiEmployer + r.kosodateEmployer + r.shienEmployer
		);
		expect(r.payableTotal).toBe(r.employeeDeductionTotal + r.employerBurdenTotal);
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

describe('calculateMonth — 2026/05 (支援金開始, kaigo 該当)', () => {
	it('shien は労使折半', () => {
		const r = calculateMonth({
			year: 2026,
			month: 5,
			stdRemuneration: 88000,
			grossSalary: 83000,
			birthDate: '1985-06-15',
			rates: rate2026May
		});
		// shienTotal = ROUNDDOWN(88000 * 0.23%) = ROUNDDOWN(202.4) = 202
		expect(r.shienTotal).toBe(202);
		expect(r.shienEmployee + r.shienEmployer).toBe(r.shienTotal);
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

	it('2026-04 行は shien=0、2026-05 行は shien>0', () => {
		const results = calculateRange('2026-03', '2026-05', {
			birthDate: '1985-06-15',
			remunerationHistory,
			rateHistory: allRates
		});
		expect(results[1].shienTotal).toBe(0); // 2026-04
		expect(results[2].shienTotal).toBeGreaterThan(0); // 2026-05
	});

	it('start > end のとき空配列', () => {
		const results = calculateRange('2026-05', '2026-03', {
			birthDate: '1985-06-15',
			remunerationHistory,
			rateHistory: allRates
		});
		expect(results).toEqual([]);
	});
});
