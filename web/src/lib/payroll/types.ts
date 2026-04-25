// web/src/lib/payroll/types.ts

export const CURRENT_SCHEMA_VERSION = 1 as const;

/** 料率履歴の 1 エントリ。すべて 1/100,000 単位の整数。 */
export interface RateEntry {
	effectiveFrom: string; // "YYYY-MM-DD"
	kenpoBase: number; // 例: 9850 = 9.85% (kenpoBase 2026)
	kaigo: number; // 例: 1620 = 1.62%
	kosei: number; // 例: 18300 = 18.30% / 17828 = 17.828% (歴史的)
	kosodate: number; // 例: 360 = 0.36%
	shien: number; // 例: 230 = 0.23% (2026/05 から)
	note: string;
}

/** 報酬改定履歴の 1 エントリ。note は必須(空文字許容)。 */
export interface RemunerationEntry {
	effectiveFrom: string;
	stdRemuneration: number;
	grossSalary: number;
	note: string;
}

/** calculateMonth への入力。 */
export interface MonthInput {
	year: number;
	month: number;
	stdRemuneration: number;
	grossSalary: number;
	birthDate: string | null;
	rates: RateEntry;
}

/** calculateMonth の戻り値。year/month を内包し、並列配列パターンを排除する。 */
export interface MonthResult {
	year: number;
	month: number;
	age: number | null;
	isKaigoApplicable: boolean;
	/** 適用済み健保料率(1/100,000 単位整数) = kenpoBase + (isKaigoApplicable ? kaigo : 0) */
	appliedKenpoRate: number;
	kenpoTotal: number;
	koseiTotal: number;
	kosodateTotal: number;
	shienTotal: number;
	kenpoEmployee: number;
	koseiEmployee: number;
	shienEmployee: number;
	kenpoEmployer: number;
	koseiEmployer: number;
	kosodateEmployer: number;
	shienEmployer: number;
	employeeDeductionTotal: number;
	employerBurdenTotal: number;
	payableTotal: number;
	netSalary: number;
}

export interface YearSummary {
	year: number;
	monthCount: number;
	employeeDeductionTotal: number;
	employerBurdenTotal: number;
	payableTotal: number;
}

/** 月次メモ。月情報は AppState.monthlyNotes の Record キーで一意に表現する。 */
export interface MonthlyNote {
	notifiedAmount?: number;
	memo?: string;
}

export interface AppState {
	schemaVersion: typeof CURRENT_SCHEMA_VERSION;
	profile: {
		name: string;
		birthDate: string | null;
	};
	remunerationHistory: RemunerationEntry[];
	monthlyNotes: Record<string, MonthlyNote>;
}

export function createDefaultAppState(): AppState {
	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		profile: { name: '', birthDate: null },
		remunerationHistory: [],
		monthlyNotes: {}
	};
}

export class AppStateValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'AppStateValidationError';
	}
}

/** YYYY-MM-DD 形式の厳密な日付正規表現。kaigo.ts や csv/validate.ts でも再利用する。 */
export const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** YYYY-MM 形式の厳密な月正規表現。calculate.ts や csv/validate.ts でも再利用する。 */
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * unknown を AppState として厳密に検証する。
 * すべての永続化・インポート経路の入口で利用する想定
 * (stores/appState.ts の loadFromStorage、csv/validate.ts の validateAndConvert)。
 * 不正値はすべて AppStateValidationError として throw(フォールバック禁止)。
 */
export function validateAppState(input: unknown): AppState {
	if (typeof input !== 'object' || input === null) {
		throw new AppStateValidationError('AppState must be an object');
	}
	const o = input as Record<string, unknown>;

	if (o.schemaVersion !== CURRENT_SCHEMA_VERSION) {
		throw new AppStateValidationError(
			`Unsupported schemaVersion: ${String(o.schemaVersion)} (expected ${CURRENT_SCHEMA_VERSION})`
		);
	}

	if (typeof o.profile !== 'object' || o.profile === null) {
		throw new AppStateValidationError('profile must be an object');
	}
	const p = o.profile as Record<string, unknown>;
	if (typeof p.name !== 'string') {
		throw new AppStateValidationError('profile.name must be a string');
	}
	// birthDate は null または YYYY-MM-DD のみ許容。空文字 '' は null に正規化して
	// 下流分岐(kaigo.ts 等)で 3 値ロジックを書かなくて済むようにする。
	let birthDate: string | null;
	if (p.birthDate === null || p.birthDate === '') {
		birthDate = null;
	} else if (typeof p.birthDate === 'string' && DATE_RE.test(p.birthDate)) {
		birthDate = p.birthDate;
	} else {
		throw new AppStateValidationError('profile.birthDate must be null or YYYY-MM-DD');
	}

	if (!Array.isArray(o.remunerationHistory)) {
		throw new AppStateValidationError('remunerationHistory must be an array');
	}
	const remunerationHistory = o.remunerationHistory.map((e, i) => validateRemunerationEntry(e, i));

	if (
		typeof o.monthlyNotes !== 'object' ||
		o.monthlyNotes === null ||
		Array.isArray(o.monthlyNotes)
	) {
		throw new AppStateValidationError('monthlyNotes must be an object');
	}
	const monthlyNotes: Record<string, MonthlyNote> = {};
	for (const [key, value] of Object.entries(o.monthlyNotes as Record<string, unknown>)) {
		if (!MONTH_RE.test(key)) {
			throw new AppStateValidationError(`Invalid monthlyNotes key: ${key}`);
		}
		monthlyNotes[key] = validateMonthlyNote(value, key);
	}

	return {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		profile: { name: p.name, birthDate },
		remunerationHistory,
		monthlyNotes
	};
}

function validateRemunerationEntry(input: unknown, index: number): RemunerationEntry {
	if (typeof input !== 'object' || input === null) {
		throw new AppStateValidationError(`remunerationHistory[${index}] must be an object`);
	}
	const e = input as Record<string, unknown>;
	if (typeof e.effectiveFrom !== 'string' || !DATE_RE.test(e.effectiveFrom)) {
		throw new AppStateValidationError(
			`remunerationHistory[${index}].effectiveFrom invalid: ${String(e.effectiveFrom)}`
		);
	}
	if (!isNonNegativeInt(e.stdRemuneration)) {
		throw new AppStateValidationError(
			`remunerationHistory[${index}].stdRemuneration must be non-negative integer`
		);
	}
	if (e.stdRemuneration % 1000 !== 0) {
		throw new AppStateValidationError(
			`remunerationHistory[${index}].stdRemuneration must be a multiple of 1000 (健保等級表の制約)`
		);
	}
	if (!isNonNegativeInt(e.grossSalary)) {
		throw new AppStateValidationError(
			`remunerationHistory[${index}].grossSalary must be non-negative integer`
		);
	}
	if (typeof e.note !== 'string') {
		throw new AppStateValidationError(`remunerationHistory[${index}].note must be a string`);
	}
	return {
		effectiveFrom: e.effectiveFrom,
		stdRemuneration: e.stdRemuneration,
		grossSalary: e.grossSalary,
		note: e.note
	};
}

function validateMonthlyNote(input: unknown, key: string): MonthlyNote {
	if (typeof input !== 'object' || input === null) {
		throw new AppStateValidationError(`monthlyNotes[${key}] must be an object`);
	}
	const n = input as Record<string, unknown>;
	const out: MonthlyNote = {};
	if (n.notifiedAmount !== undefined) {
		if (!isNonNegativeInt(n.notifiedAmount)) {
			throw new AppStateValidationError(
				`monthlyNotes[${key}].notifiedAmount must be non-negative integer`
			);
		}
		out.notifiedAmount = n.notifiedAmount;
	}
	if (n.memo !== undefined) {
		if (typeof n.memo !== 'string') {
			throw new AppStateValidationError(`monthlyNotes[${key}].memo must be a string`);
		}
		out.memo = n.memo;
	}
	return out;
}

function isNonNegativeInt(v: unknown): v is number {
	return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * unknown を RateEntry[] として厳密に検証する。
 * rates.json をモジュール初期化時に検証するための入口関数(`as RateEntry[]` キャスト排除)。
 * 不正値はすべて AppStateValidationError として throw(フォールバック禁止)。
 */
export function validateRateHistory(input: unknown): RateEntry[] {
	if (!Array.isArray(input)) {
		throw new AppStateValidationError('rateHistory must be an array');
	}
	return input.map((e, i) => validateRateEntry(e, i));
}

function validateRateEntry(input: unknown, index: number): RateEntry {
	if (typeof input !== 'object' || input === null) {
		throw new AppStateValidationError(`rateHistory[${index}] must be an object`);
	}
	const e = input as Record<string, unknown>;
	if (typeof e.effectiveFrom !== 'string' || !DATE_RE.test(e.effectiveFrom)) {
		throw new AppStateValidationError(
			`rateHistory[${index}].effectiveFrom invalid: ${String(e.effectiveFrom)}`
		);
	}
	for (const k of ['kenpoBase', 'kaigo', 'kosei', 'kosodate', 'shien'] as const) {
		if (!isNonNegativeInt(e[k])) {
			throw new AppStateValidationError(
				`rateHistory[${index}].${k} must be non-negative integer, got: ${String(e[k])}`
			);
		}
	}
	if (typeof e.note !== 'string') {
		throw new AppStateValidationError(`rateHistory[${index}].note must be a string`);
	}
	return {
		effectiveFrom: e.effectiveFrom,
		kenpoBase: e.kenpoBase as number,
		kaigo: e.kaigo as number,
		kosei: e.kosei as number,
		kosodate: e.kosodate as number,
		shien: e.shien as number,
		note: e.note
	};
}
