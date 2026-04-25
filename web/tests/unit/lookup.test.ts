import { describe, it, expect } from 'vitest';
import { findApplicableEntry, EntryNotFoundError } from '$lib/payroll/lookup';

interface Stub {
	effectiveFrom: string;
	value: number;
}

const history: Stub[] = [
	{ effectiveFrom: '2020-04-01', value: 1 },
	{ effectiveFrom: '2022-03-01', value: 2 },
	{ effectiveFrom: '2024-04-01', value: 3 }
];

describe('findApplicableEntry', () => {
	it('returns the latest entry whose effectiveFrom <= target month', () => {
		expect(findApplicableEntry('2025-12', history, 'test').value).toBe(3);
		expect(findApplicableEntry('2024-04', history, 'test').value).toBe(3);
		expect(findApplicableEntry('2023-12', history, 'test').value).toBe(2);
		expect(findApplicableEntry('2022-03', history, 'test').value).toBe(2);
		expect(findApplicableEntry('2020-04', history, 'test').value).toBe(1);
	});

	it('treats yearMonth as the first day of that month', () => {
		// 2024-03 < 2024-04-01, so the 2024-04 entry should NOT match
		expect(findApplicableEntry('2024-03', history, 'test').value).toBe(2);
	});

	it('throws EntryNotFoundError when no entry is applicable', () => {
		expect(() => findApplicableEntry('2019-12', history, 'rate')).toThrow(EntryNotFoundError);
		expect(() => findApplicableEntry('2019-12', history, 'rate')).toThrow(/rate/);
	});

	it('throws on empty history', () => {
		expect(() => findApplicableEntry('2024-01', [], 'rate')).toThrow(EntryNotFoundError);
	});
});
