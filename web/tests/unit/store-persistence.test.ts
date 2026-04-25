import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { createAppStateStore, STORAGE_KEY } from '$lib/stores/appState';
import { persistenceErrorStore, clearPersistenceError } from '$lib/stores/persistence';
import { AppStateValidationError } from '$lib/payroll/types';

describe('createAppStateStore', () => {
	beforeEach(() => {
		localStorage.clear();
		clearPersistenceError();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('returns default state when localStorage is empty', () => {
		const store = createAppStateStore();
		expect(get(store).profile.name).toBe('');
	});

	it('persists changes to localStorage after debounce', () => {
		const store = createAppStateStore();
		store.update((s) => ({ ...s, profile: { ...s.profile, name: '山田' } }));
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
		vi.advanceTimersByTime(400);
		const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		expect(stored.profile.name).toBe('山田');
	});

	it('loads existing state from localStorage on init', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				schemaVersion: 1,
				profile: { name: '佐藤', birthDate: '1985-06-15' },
				remunerationHistory: [],
				monthlyNotes: {}
			})
		);
		const store = createAppStateStore();
		expect(get(store).profile.name).toBe('佐藤');
	});

	it('throws StorageCorruptError on invalid JSON', () => {
		localStorage.setItem(STORAGE_KEY, 'not-json');
		expect(() => createAppStateStore()).toThrow(/parse/);
	});

	it('throws AppStateValidationError on schemaVersion mismatch', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ schemaVersion: 999, profile: {}, remunerationHistory: [], monthlyNotes: {} })
		);
		expect(() => createAppStateStore()).toThrow(AppStateValidationError);
	});

	it('throws AppStateValidationError on structural corruption (e.g., remunerationHistory not array)', () => {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({
				schemaVersion: 1,
				profile: { name: '', birthDate: null },
				remunerationHistory: 'not-an-array',
				monthlyNotes: {}
			})
		);
		expect(() => createAppStateStore()).toThrow(AppStateValidationError);
	});

	it('reports persistence error to persistenceErrorStore on setItem failure', () => {
		const setItemSpy = vi.fn(() => {
			throw new DOMException('Quota exceeded', 'QuotaExceededError');
		});
		const mockStorage: Pick<Storage, 'getItem' | 'setItem'> = {
			getItem: () => null,
			setItem: setItemSpy
		};
		const store = createAppStateStore(mockStorage);
		store.update((s) => ({ ...s, profile: { ...s.profile, name: 'X' } }));
		vi.advanceTimersByTime(400);
		const err = get(persistenceErrorStore);
		expect(err).not.toBeNull();
		expect(err?.message).toMatch(/Quota/);
	});

	it('debounce coalesces multiple rapid updates into a single setItem', () => {
		const setItemSpy = vi.fn();
		const getItemSpy = vi.fn(() => null);
		const mockStorage: Pick<Storage, 'getItem' | 'setItem'> = {
			getItem: getItemSpy,
			setItem: setItemSpy
		};
		const store = createAppStateStore(mockStorage);
		// initial subscribe フラッシュ分を消費
		vi.advanceTimersByTime(400);
		setItemSpy.mockClear();

		store.update((s) => ({ ...s, profile: { ...s.profile, name: 'a' } }));
		store.update((s) => ({ ...s, profile: { ...s.profile, name: 'b' } }));
		store.update((s) => ({ ...s, profile: { ...s.profile, name: 'c' } }));
		expect(setItemSpy).not.toHaveBeenCalled();
		vi.advanceTimersByTime(400);
		expect(setItemSpy).toHaveBeenCalledTimes(1);
	});
});
