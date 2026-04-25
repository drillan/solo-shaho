import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { validateAppState, createDefaultAppState, type AppState } from '$lib/payroll/types';
import { reportPersistenceError } from './persistence';

export const STORAGE_KEY = 'solo-shaho-state' as const;
const DEBOUNCE_MS = 300;

export class StorageCorruptError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'StorageCorruptError';
	}
}

export function createAppStateStore(): Writable<AppState> {
	const initial = loadFromStorage();
	const store = writable<AppState>(initial);
	let timer: ReturnType<typeof setTimeout> | null = null;
	store.subscribe((state) => {
		if (timer !== null) clearTimeout(timer);
		timer = setTimeout(() => {
			try {
				// Storage.prototype.setItem 経由で呼ぶことで、テストで Storage.prototype.setItem を
				// 差し替えた際にも確実にエラーパスを通せるようにする(happy-dom の Proxy bind 対策)。
				Storage.prototype.setItem.call(localStorage, STORAGE_KEY, JSON.stringify(state));
			} catch (e) {
				// QuotaExceededError, SecurityError 等を専用 store に push して
				// UI レイヤがバナー表示等で必ずユーザーに伝える(silent data loss を防ぐ)
				reportPersistenceError(e instanceof Error ? e : new Error(String(e)));
			} finally {
				timer = null;
			}
		}, DEBOUNCE_MS);
	});
	return store;
}

function loadFromStorage(): AppState {
	const raw = localStorage.getItem(STORAGE_KEY);
	if (raw === null) return createDefaultAppState();
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		throw new StorageCorruptError(`Failed to parse localStorage: ${(e as Error).message}`);
	}
	// CSV インポートと同じ validateAppState を使い、入口の検証強度を統一する
	return validateAppState(parsed);
}

let _store: Writable<AppState> | null = null;

/** ブラウザでのみ初期化されるシングルトンの AppState ストア。 */
export function getAppStateStore(): Writable<AppState> {
	if (!browser) return writable(createDefaultAppState());
	if (_store === null) _store = createAppStateStore();
	return _store;
}
