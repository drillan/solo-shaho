import { describe, it, expect } from 'vitest';
import { splitHalfEmployee, splitHalfEmployer, fullDownToYen } from '$lib/payroll/round';

describe('splitHalfEmployee (50銭以下切捨て・50銭超切上げ)', () => {
	it('M=10093.6 (totalSen=1009360) → 5047 (案件: 1円ズレ問題のキー数値)', () => {
		expect(splitHalfEmployee(1009360)).toBe(5047);
	});

	it('M=10094.4 (sen=40 < 50) → 5047', () => {
		expect(splitHalfEmployee(1009440)).toBe(5047);
	});

	it('M=10095.0 (sen=50, 切捨て) → 5047', () => {
		expect(splitHalfEmployee(1009500)).toBe(5047);
	});

	it('M=10095.2 (sen=60 > 50) → 5048', () => {
		expect(splitHalfEmployee(1009520)).toBe(5048);
	});

	it('整数銭・偶数 M=16104 → 8052', () => {
		expect(splitHalfEmployee(1610400)).toBe(8052);
	});

	it('odd totalSen 境界: 10101 → 51 (Excel と一致)', () => {
		// M = 101.01, M/2 = 50.505, MOD(M,2)=1.01>1 → 51
		expect(splitHalfEmployee(10101)).toBe(51);
	});

	it('odd totalSen 境界: 10093 → 50', () => {
		// M = 100.93, M/2 = 50.465, MOD(M,2)=0.93≤1 → 50
		expect(splitHalfEmployee(10093)).toBe(50);
	});
});

describe('splitHalfEmployer (残額方式)', () => {
	it('M=10093.6 で社員 5047 → 事業主 5046 (合計 = ROUNDDOWN(M))', () => {
		expect(splitHalfEmployer(1009360, 5047)).toBe(5046);
		expect(5047 + 5046).toBe(10093);
	});

	it('M=16104 で社員 8052 → 事業主 8052', () => {
		expect(splitHalfEmployer(1610400, 8052)).toBe(8052);
	});
});

describe('fullDownToYen (ROUNDDOWN)', () => {
	it('M=316.8 → 316 (拠出金の例)', () => {
		expect(fullDownToYen(31680)).toBe(316);
	});

	it('M=316.0 → 316', () => {
		expect(fullDownToYen(31600)).toBe(316);
	});

	it('M=316.99 → 316', () => {
		expect(fullDownToYen(31699)).toBe(316);
	});
});
