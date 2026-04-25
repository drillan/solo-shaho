import { describe, it, expect } from 'vitest';
import {
	validateAppState,
	AppStateValidationError,
	createDefaultAppState
} from '$lib/payroll/types';

describe('validateAppState', () => {
	it('accepts createDefaultAppState() output', () => {
		expect(() => validateAppState(createDefaultAppState())).not.toThrow();
	});

	it('throws on non-object input', () => {
		expect(() => validateAppState(null)).toThrow(AppStateValidationError);
		expect(() => validateAppState('x')).toThrow(AppStateValidationError);
	});

	it('throws on schemaVersion mismatch', () => {
		expect(() => validateAppState({ schemaVersion: 2 })).toThrow(/schemaVersion/);
	});

	it('throws when profile.name is not a string', () => {
		expect(() =>
			validateAppState({
				schemaVersion: 1,
				profile: { name: 123, birthDate: null },
				remunerationHistory: [],
				monthlyNotes: {}
			})
		).toThrow(/profile.name/);
	});

	it('throws when profile.birthDate is invalid format', () => {
		expect(() =>
			validateAppState({
				schemaVersion: 1,
				profile: { name: '', birthDate: '1985/06/15' },
				remunerationHistory: [],
				monthlyNotes: {}
			})
		).toThrow(/birthDate/);
	});

	it('throws when remunerationHistory is not an array', () => {
		expect(() =>
			validateAppState({
				schemaVersion: 1,
				profile: { name: '', birthDate: null },
				remunerationHistory: {},
				monthlyNotes: {}
			})
		).toThrow(/remunerationHistory/);
	});

	it('throws when remunerationHistory entry has invalid effectiveFrom', () => {
		expect(() =>
			validateAppState({
				schemaVersion: 1,
				profile: { name: '', birthDate: null },
				remunerationHistory: [
					{ effectiveFrom: '2024/04/01', stdRemuneration: 88000, grossSalary: 83000, note: '' }
				],
				monthlyNotes: {}
			})
		).toThrow(/effectiveFrom/);
	});

	it('throws when monthlyNotes key is invalid', () => {
		expect(() =>
			validateAppState({
				schemaVersion: 1,
				profile: { name: '', birthDate: null },
				remunerationHistory: [],
				monthlyNotes: { invalid: {} }
			})
		).toThrow(/monthlyNotes key/);
	});

	it('throws on negative numeric value', () => {
		expect(() =>
			validateAppState({
				schemaVersion: 1,
				profile: { name: '', birthDate: null },
				remunerationHistory: [
					{ effectiveFrom: '2024-04-01', stdRemuneration: -1, grossSalary: 0, note: '' }
				],
				monthlyNotes: {}
			})
		).toThrow(/non-negative/);
	});

	it('preserves valid input', () => {
		const valid = {
			schemaVersion: 1 as const,
			profile: { name: '山田', birthDate: '1985-06-15' },
			remunerationHistory: [
				{
					effectiveFrom: '2024-04-01',
					stdRemuneration: 88000,
					grossSalary: 83000,
					note: '定時決定'
				}
			],
			monthlyNotes: { '2024-05': { notifiedAmount: 25202 } }
		};
		expect(validateAppState(valid)).toEqual(valid);
	});

	it('throws when stdRemuneration is not a multiple of 1000', () => {
		expect(() =>
			validateAppState({
				schemaVersion: 1,
				profile: { name: '', birthDate: null },
				remunerationHistory: [
					{ effectiveFrom: '2024-04-01', stdRemuneration: 88001, grossSalary: 83000, note: '' }
				],
				monthlyNotes: {}
			})
		).toThrow(/multiple of 1000/);
	});
});
