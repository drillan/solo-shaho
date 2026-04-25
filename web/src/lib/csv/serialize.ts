import type { AppState } from '$lib/payroll/types';
import { escapeCell } from './escape';

const BOM = '﻿';

export interface SerializeOptions {
	exportedAt: string;
	appVersion?: string;
}

export function serializeAppState(state: AppState, opts: SerializeOptions): string {
	const lines: string[] = [];
	lines.push(`# solo-shaho ${opts.appVersion ?? 'v0'} export ${opts.exportedAt}`);
	lines.push(`# schemaVersion=${state.schemaVersion} exportedAt=${opts.exportedAt}`);
	lines.push('');

	// [profile]
	lines.push('[profile]');
	lines.push('name,birthDate');
	lines.push([escapeCell(state.profile.name), escapeCell(state.profile.birthDate ?? '')].join(','));
	lines.push('');

	// [remuneration_history]
	lines.push('[remuneration_history]');
	lines.push('effectiveFrom,stdRemuneration,grossSalary,note');
	for (const e of state.remunerationHistory) {
		lines.push(
			[
				escapeCell(e.effectiveFrom),
				String(e.stdRemuneration),
				String(e.grossSalary),
				escapeCell(e.note ?? '')
			].join(',')
		);
	}
	lines.push('');

	// [monthly_notes] (sort by month key)
	lines.push('[monthly_notes]');
	lines.push('month,notifiedAmount,memo');
	const sortedMonths = Object.keys(state.monthlyNotes).sort();
	for (const m of sortedMonths) {
		const n = state.monthlyNotes[m];
		lines.push(
			[
				m,
				n.notifiedAmount === undefined ? '' : String(n.notifiedAmount),
				escapeCell(n.memo ?? '')
			].join(',')
		);
	}

	return BOM + lines.join('\n') + '\n';
}
