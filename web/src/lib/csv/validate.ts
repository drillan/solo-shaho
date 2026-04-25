import {
	validateAppState,
	CURRENT_SCHEMA_VERSION,
	DATE_RE,
	MONTH_RE,
	type AppState,
	type MonthlyNote
} from '$lib/payroll/types';
import type { ParsedCsv } from './parse';

export class ImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImportError';
	}
}

const REQUIRED_HEADERS = {
	profile: ['name', 'birthDate'],
	remuneration_history: ['effectiveFrom', 'stdRemuneration', 'grossSalary', 'note'],
	monthly_notes: ['month', 'notifiedAmount', 'memo']
} as const;

/**
 * CSV パース結果を AppState に変換する。
 * - CSV 文脈固有のエラー(欠損列、空欄必須項目、ヘッダー不一致)は ImportError として直接 throw
 * - 構造的検証(型整合・正規表現マッチ)は validateAppState に委譲
 *
 * フォールバック禁止: 空欄を sentinel 値に変換してチェックを偽装する設計は使わない。
 */
export function validateAndConvert(parsed: ParsedCsv): AppState {
	if (parsed.headerMeta.schemaVersion === null) {
		throw new ImportError('Missing schemaVersion in header');
	}
	if (parsed.headerMeta.schemaVersion !== CURRENT_SCHEMA_VERSION) {
		throw new ImportError(
			`Unsupported schemaVersion: ${parsed.headerMeta.schemaVersion} (expected ${CURRENT_SCHEMA_VERSION})`
		);
	}

	const profileSec = parsed.sections.profile;
	if (!profileSec || profileSec.rows.length === 0) {
		throw new ImportError('Missing [profile] section');
	}
	requireHeaders('profile', profileSec.header);
	const profileRow = profileSec.rows[0];

	const remSec = parsed.sections.remuneration_history;
	if (!remSec || remSec.rows.length === 0) {
		throw new ImportError('Missing or empty [remuneration_history]');
	}
	requireHeaders('remuneration_history', remSec.header);

	const notesSec = parsed.sections.monthly_notes;
	if (notesSec) {
		requireHeaders('monthly_notes', notesSec.header);
	}

	// プロフィール: birthDate は CSV では空文字で null を表現する
	const birthDate = profileRow.birthDate === '' ? null : profileRow.birthDate;
	if (birthDate !== null && !DATE_RE.test(birthDate)) {
		throw new ImportError(`profile.birthDate must be null or YYYY-MM-DD, got: ${birthDate}`);
	}

	// 報酬改定履歴: 空欄は ImportError として直接拒否する(sentinel を介在させない)
	const remunerationHistory = remSec.rows.map((r, i) => {
		const ctx = `remuneration_history[${i}]`;
		if (r.effectiveFrom === '') throw new ImportError(`${ctx}.effectiveFrom is required`);
		if (!DATE_RE.test(r.effectiveFrom)) {
			throw new ImportError(`${ctx}.effectiveFrom must be YYYY-MM-DD, got: ${r.effectiveFrom}`);
		}
		if (r.stdRemuneration === '') {
			throw new ImportError(`${ctx}.stdRemuneration is required`);
		}
		if (!/^\d+$/.test(r.stdRemuneration)) {
			throw new ImportError(
				`${ctx}.stdRemuneration must be a non-negative integer, got: ${r.stdRemuneration}`
			);
		}
		if (r.grossSalary === '') {
			throw new ImportError(`${ctx}.grossSalary is required`);
		}
		if (!/^\d+$/.test(r.grossSalary)) {
			throw new ImportError(
				`${ctx}.grossSalary must be a non-negative integer, got: ${r.grossSalary}`
			);
		}
		return {
			effectiveFrom: r.effectiveFrom,
			stdRemuneration: Number(r.stdRemuneration),
			grossSalary: Number(r.grossSalary),
			note: r.note
		};
	});

	// 月次メモ: month キーの形式を CSV 文脈で先に検証する
	const monthlyNotes: Record<string, MonthlyNote> = {};
	for (const [i, r] of (notesSec?.rows ?? []).entries()) {
		const ctx = `monthly_notes[${i}]`;
		if (r.month === '') throw new ImportError(`${ctx}.month is required`);
		if (!MONTH_RE.test(r.month)) {
			throw new ImportError(`${ctx}.month must be YYYY-MM, got: ${r.month}`);
		}
		const note: MonthlyNote = {};
		if (r.notifiedAmount !== '') {
			if (!/^\d+$/.test(r.notifiedAmount)) {
				throw new ImportError(
					`${ctx}.notifiedAmount must be a non-negative integer, got: ${r.notifiedAmount}`
				);
			}
			note.notifiedAmount = Number(r.notifiedAmount);
		}
		if (r.memo !== '') note.memo = r.memo;
		monthlyNotes[r.month] = note;
	}

	const intermediate = {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		profile: { name: profileRow.name, birthDate },
		remunerationHistory,
		monthlyNotes
	};

	try {
		return validateAppState(intermediate);
	} catch (e) {
		// validateAppState は構造的不整合のみを担当する想定だが、
		// 万一メッセージが UI に流れた場合の文脈を保持する
		throw new ImportError(`CSV validation failed: ${(e as Error).message}`);
	}
}

function requireHeaders(section: keyof typeof REQUIRED_HEADERS, actualHeader: string[]): void {
	const required = REQUIRED_HEADERS[section];
	const missing = required.filter((h) => !actualHeader.includes(h));
	if (missing.length > 0) {
		throw new ImportError(`[${section}] missing required column(s): ${missing.join(', ')}`);
	}
}
