import { describe, it, expect } from 'vitest';
import { serializeAppState } from '$lib/csv/serialize';
import type { AppState } from '$lib/payroll/types';

const sample: AppState = {
	schemaVersion: 1,
	profile: { name: '山田太郎', birthDate: '1985-06-15' },
	remunerationHistory: [
		{ effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' }
	],
	monthlyNotes: {
		'2024-05': { notifiedAmount: 25202 },
		'2026-04': { notifiedAmount: 25088, memo: '健保改定後初月' }
	}
};

describe('serializeAppState', () => {
	const csv = serializeAppState(sample, { exportedAt: '2026-04-25T14:30:00+09:00' });

	it('starts with BOM (UTF-8 BOM EF BB BF)', () => {
		expect(csv.charCodeAt(0)).toBe(0xfeff);
	});

	it('includes header comment with version and exportedAt', () => {
		expect(csv).toContain('# solo-shaho');
		expect(csv).toContain('# schemaVersion=1');
		expect(csv).toContain('exportedAt=2026-04-25T14:30:00+09:00');
	});

	it('contains [profile] section', () => {
		expect(csv).toMatch(/\[profile\]\nname,birthDate\n山田太郎,1985-06-15/);
	});

	it('contains [remuneration_history] section', () => {
		expect(csv).toContain('[remuneration_history]');
		expect(csv).toContain('2024-04-01,88000,83000,定時決定');
	});

	it('contains [monthly_notes] section sorted by month', () => {
		expect(csv).toContain('[monthly_notes]');
		const lines = csv.split('\n');
		const idx2024 = lines.findIndex((l) => l.startsWith('2024-05'));
		const idx2026 = lines.findIndex((l) => l.startsWith('2026-04'));
		expect(idx2024).toBeLessThan(idx2026);
	});

	it('escapes Formula Injection in memo field', () => {
		const dangerous: AppState = {
			...sample,
			monthlyNotes: { '2024-05': { memo: '=cmd|/c calc' } }
		};
		const out = serializeAppState(dangerous, { exportedAt: 'x' });
		expect(out).toContain(`"'=cmd|/c calc"`);
	});
});
