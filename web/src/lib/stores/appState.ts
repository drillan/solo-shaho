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

/**
 * AppState ストアを生成する。
 * storage は依存注入で受け取り、テスト時はモックを差し替えられる。
 * happy-dom 等の環境では Storage.prototype を差し替えても bound proxy
 * が直接実装を呼び出してしまうため、Storage.prototype 経由ではなく
 * 注入された storage オブジェクトのメソッドを直接呼ぶ。
 */
export function createAppStateStore(
	storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): Writable<AppState> {
	const initial = loadFromStorage(storage);
	const store = writable<AppState>(initial);
	let timer: ReturnType<typeof setTimeout> | null = null;
	store.subscribe((state) => {
		// clearTimeout は null/undefined を安全に受け付ける(HTML 仕様)
		clearTimeout(timer ?? undefined);
		timer = setTimeout(() => {
			try {
				storage.setItem(STORAGE_KEY, JSON.stringify(state));
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

function loadFromStorage(storage: Pick<Storage, 'getItem' | 'setItem'>): AppState {
	const raw = storage.getItem(STORAGE_KEY);
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
