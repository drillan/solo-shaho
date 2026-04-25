import { describe, it, expect } from 'vitest';
import { isKaigoApplicable, calculateAge } from '$lib/payroll/kaigo';

describe('isKaigoApplicable', () => {
	it('returns false when birthDate is null', () => {
		expect(isKaigoApplicable(null, 2025, 6)).toBe(false);
	});

	it('returns false when birthDate is empty string', () => {
		expect(isKaigoApplicable('', 2025, 6)).toBe(false);
	});

	it('40歳誕生月: 月の途中で40歳→当月末日が40歳誕生日前日以降なら該当', () => {
		// 1985-06-15 生まれ → 40歳誕生日 = 2025-06-15、前日 = 2025-06-14
		// 2025-06 月末 = 2025-06-30 ≥ 2025-06-14 → 該当
		expect(isKaigoApplicable('1985-06-15', 2025, 6)).toBe(true);
	});

	it('40歳誕生月の前月: 該当しない', () => {
		expect(isKaigoApplicable('1985-06-15', 2025, 5)).toBe(false);
	});

	it('40歳誕生日が月初(1日)生まれ: 前月から該当', () => {
		// 1985-06-01 生まれ → 40歳誕生日 = 2025-06-01、前日 = 2025-05-31
		// 2025-05-31 ≥ 2025-05-31 → 該当
		expect(isKaigoApplicable('1985-06-01', 2025, 5)).toBe(true);
		expect(isKaigoApplicable('1985-06-01', 2025, 4)).toBe(false);
	});

	it('65歳誕生月: 月初の前日と同月末の関係で当月末が前日未満なら該当継続、以上なら非該当', () => {
		// 1960-06-15 生まれ → 65歳誕生日 = 2025-06-15、前日 = 2025-06-14
		// 2025-06 月末 = 2025-06-30 ≥ 2025-06-14 → 非該当(=Excel: < ではないので false)
		expect(isKaigoApplicable('1960-06-15', 2025, 6)).toBe(false);
		// 前月 2025-05: 月末 2025-05-31 < 2025-06-14 → 該当
		expect(isKaigoApplicable('1960-06-15', 2025, 5)).toBe(true);
	});

	it('閏年生まれ(2/29)の処理: JS Date が自動正規化する', () => {
		// 1984-02-29 生まれ → 40歳誕生日 = 2024-02-29(2024 も閏年)、前日 = 2024-02-28
		// 2024-02 月末 = 2024-02-29 ≥ 2024-02-28 → 該当
		expect(isKaigoApplicable('1984-02-29', 2024, 2)).toBe(true);
	});
});

describe('calculateAge', () => {
	it('returns 40 when the month-end equals the 40th birthday (1985-06-30 / 2025-06)', () => {
		expect(calculateAge('1985-06-30', 2025, 6)).toBe(40);
	});

	it('returns 39 for the month before the 40th birthday', () => {
		expect(calculateAge('1985-06-15', 2025, 5)).toBe(39);
	});

	it('returns 40 for the 40th birthday month (mid-month birthday)', () => {
		expect(calculateAge('1985-06-15', 2025, 6)).toBe(40);
	});
});
