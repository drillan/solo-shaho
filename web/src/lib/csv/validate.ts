import { validateAppState, CURRENT_SCHEMA_VERSION, type AppState } from '$lib/payroll/types';
import type { ParsedCsv } from './parse';

export class ImportError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImportError';
	}
}

/**
 * CSV パース結果を中間オブジェクトに変換した上で、
 * payroll/types.ts の `validateAppState` で構造検証を行う。
 * これにより loadFromStorage と validateAndConvert で検証ロジックを共有できる。
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
	const profileRow = profileSec.rows[0];

	const remSec = parsed.sections.remuneration_history;
	if (!remSec || remSec.rows.length === 0) {
		throw new ImportError('Missing or empty [remuneration_history]');
	}

	// 中間オブジェクト構築 — 数値・日付・キーの構造検証は validateAppState に委譲
	const intermediate: unknown = {
		schemaVersion: CURRENT_SCHEMA_VERSION,
		profile: {
			name: profileRow.name ?? '',
			birthDate: profileRow.birthDate === '' ? null : (profileRow.birthDate ?? null)
		},
		remunerationHistory: remSec.rows.map((r) => ({
			effectiveFrom: r.effectiveFrom ?? '',
			stdRemuneration: r.stdRemuneration === '' ? -1 : Number(r.stdRemuneration),
			grossSalary: r.grossSalary === '' ? -1 : Number(r.grossSalary),
			note: r.note ?? ''
		})),
		monthlyNotes: Object.fromEntries(
			(parsed.sections.monthly_notes?.rows ?? []).map((r) => {
				const note: { notifiedAmount?: number; memo?: string } = {};
				if (r.notifiedAmount !== undefined && r.notifiedAmount !== '') {
					note.notifiedAmount = Number(r.notifiedAmount);
				}
				if (r.memo !== undefined && r.memo !== '') note.memo = r.memo;
				return [r.month ?? '', note];
			})
		)
	};

	try {
		return validateAppState(intermediate);
	} catch (e) {
		// AppStateValidationError を ImportError に統一して、UI で同じハンドリングが可能に
		const msg = (e as Error).message;
		// effectiveFrom / birthDate の `invalid` メッセージは「不正な日付フォーマット」として再表現する
		const annotated = /effectiveFrom invalid|birthDate must be null or YYYY-MM-DD/.test(msg)
			? `${msg} (invalid date format)`
			: msg;
		throw new ImportError(`CSV validation failed: ${annotated}`);
	}
}
