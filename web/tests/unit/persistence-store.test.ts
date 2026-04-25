import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
	persistenceErrorStore,
	reportPersistenceError,
	clearPersistenceError
} from '$lib/stores/persistence';

describe('persistenceErrorStore', () => {
	beforeEach(() => clearPersistenceError());

	it('initial value is null', () => {
		expect(get(persistenceErrorStore)).toBeNull();
	});

	it('reportPersistenceError sets the latest error', () => {
		reportPersistenceError(new Error('quota'));
		expect(get(persistenceErrorStore)?.message).toBe('quota');
	});

	it('clearPersistenceError resets to null', () => {
		reportPersistenceError(new Error('x'));
		clearPersistenceError();
		expect(get(persistenceErrorStore)).toBeNull();
	});
});
