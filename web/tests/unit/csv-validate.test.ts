import { describe, it, expect } from 'vitest';
import { validateAndConvert, ImportError } from '$lib/csv/validate';
import { parseCsv } from '$lib/csv/parse';

const VALID = `# schemaVersion=1

[profile]
name,birthDate
山田,1985-06-15

[remuneration_history]
effectiveFrom,stdRemuneration,grossSalary,note
2024-04-01,88000,83000,定時決定

[monthly_notes]
month,notifiedAmount,memo
2024-05,25202,メモ
`;

describe('validateAndConvert', () => {
	it('converts a valid parsed CSV into AppState', () => {
		const result = validateAndConvert(parseCsv(VALID));
		expect(result.profile.name).toBe('山田');
		expect(result.profile.birthDate).toBe('1985-06-15');
		expect(result.remunerationHistory).toHaveLength(1);
		expect(result.remunerationHistory[0].stdRemuneration).toBe(88000);
		expect(result.monthlyNotes['2024-05'].notifiedAmount).toBe(25202);
	});

	it('throws when schemaVersion is missing', () => {
		const csv = VALID.replace('# schemaVersion=1', '');
		expect(() => validateAndConvert(parseCsv(csv))).toThrow(ImportError);
	});

	it('throws when schemaVersion mismatches', () => {
		const csv = VALID.replace('schemaVersion=1', 'schemaVersion=2');
		expect(() => validateAndConvert(parseCsv(csv))).toThrow(/schemaVersion/);
	});

	it('throws when [profile] section is missing', () => {
		const csv = VALID.replace(/\[profile\][\s\S]*?\n\n/, '');
		expect(() => validateAndConvert(parseCsv(csv))).toThrow(/profile/);
	});

	it('throws when remuneration_history is empty', () => {
		const csv = VALID.replace(/2024-04-01,88000,83000,定時決定\n/, '');
		expect(() => validateAndConvert(parseCsv(csv))).toThrow(/remuneration/);
	});

	it('throws on invalid date format', () => {
		const csv = VALID.replace('2024-04-01', '2024/04/01');
		expect(() => validateAndConvert(parseCsv(csv))).toThrow(/YYYY-MM-DD/);
	});

	it('throws on invalid month key in monthly_notes', () => {
		const csv = VALID.replace('2024-05', 'invalid');
		expect(() => validateAndConvert(parseCsv(csv))).toThrow(/month/);
	});

	it('throws on negative numeric value', () => {
		const csv = VALID.replace('88000', '-1');
		expect(() => validateAndConvert(parseCsv(csv))).toThrow(/non-negative/);
	});
});
