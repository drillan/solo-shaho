import { describe, it, expect } from 'vitest';
import { findApplicableRemuneration } from '$lib/payroll/remuneration';
import type { RemunerationEntry } from '$lib/payroll/types';

const history: RemunerationEntry[] = [
	{ effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' },
	{ effectiveFrom: '2025-09-01', stdRemuneration: 98000, grossSalary: 92000, note: '随時改定' }
];

describe('findApplicableRemuneration', () => {
	it('returns the 2024-04 entry for 2025-08', () => {
		const r = findApplicableRemuneration('2025-08', history);
		expect(r.stdRemuneration).toBe(88000);
	});

	it('returns the 2025-09 entry for 2025-09', () => {
		const r = findApplicableRemuneration('2025-09', history);
		expect(r.stdRemuneration).toBe(98000);
	});

	it('throws with "報酬" in the error context for too-old months', () => {
		expect(() => findApplicableRemuneration('2024-03', history)).toThrow(/報酬/);
	});
});
