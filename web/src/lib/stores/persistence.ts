import { writable, type Readable } from 'svelte/store';

const _errorStore = writable<Error | null>(null);

export const persistenceErrorStore: Readable<Error | null> = {
	subscribe: _errorStore.subscribe
};

export function reportPersistenceError(e: Error): void {
	_errorStore.set(e);
}

export function clearPersistenceError(): void {
	_errorStore.set(null);
}
