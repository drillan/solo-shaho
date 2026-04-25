import { describe, it, expect } from 'vitest';
import { serializeAppState } from '$lib/csv/serialize';
import { parseCsv } from '$lib/csv/parse';
import { validateAndConvert } from '$lib/csv/validate';
import type { AppState } from '$lib/payroll/types';

const original: AppState = {
	schemaVersion: 1,
	profile: { name: '山田太郎', birthDate: '1985-06-15' },
	remunerationHistory: [
		{ effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' }
	],
	monthlyNotes: {
		'2024-05': { notifiedAmount: 25202, memo: '通常月' },
		'2026-04': { notifiedAmount: 25088, memo: '=cmd|/c calc' },
		'2026-05': { notifiedAmount: 25290, memo: '改行を\n含む\nメモ' }
	}
};

describe('CSV roundtrip', () => {
	it('serialize → parse → validate restores AppState (with newlines, formula injection)', () => {
		const csv = serializeAppState(original, { exportedAt: '2026-04-25T14:30:00+09:00' });
		const restored = validateAndConvert(parseCsv(csv));
		expect(restored.profile).toEqual(original.profile);
		expect(restored.remunerationHistory).toEqual(original.remunerationHistory);
		// Formula Injection 文字列もそのまま復元される(エスケープが対称)
		expect(restored.monthlyNotes['2026-04'].memo).toBe('=cmd|/c calc');
		expect(restored.monthlyNotes['2024-05'].memo).toBe('通常月');
		// クォート内改行(RFC 4180 multiline)も保持される
		expect(restored.monthlyNotes['2026-05'].memo).toBe('改行を\n含む\nメモ');
	});

	it('Formula Injection 文字列がエクスポート CSV では先頭シングルクォート付き', () => {
		const csv = serializeAppState(original, { exportedAt: 'x' });
		expect(csv).toContain(`"'=cmd|/c calc"`);
	});
});
