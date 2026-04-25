import { describe, it, expect } from 'vitest';
import { parseCsv, type ParsedCsv } from '$lib/csv/parse';

// eslint-disable-next-line no-irregular-whitespace
const SAMPLE = `﻿# solo-shaho v0 export 2026-04-25T14:30:00+09:00
# schemaVersion=1

[profile]
name,birthDate
山田太郎,1985-06-15

[remuneration_history]
effectiveFrom,stdRemuneration,grossSalary,note
2024-04-01,88000,83000,定時決定

[monthly_notes]
month,notifiedAmount,memo
2024-05,25202,
2026-04,25088,健保改定後初月
`;

describe('parseCsv', () => {
	const parsed: ParsedCsv = parseCsv(SAMPLE);

	it('strips BOM', () => {
		// 内部表現でセクションが取れていれば BOM は処理されている
		expect(parsed.sections.profile).toBeDefined();
	});

	it('parses [profile] section as single row', () => {
		expect(parsed.sections.profile?.rows).toHaveLength(1);
		expect(parsed.sections.profile?.rows[0]).toEqual({
			name: '山田太郎',
			birthDate: '1985-06-15'
		});
	});

	it('parses [remuneration_history] section', () => {
		expect(parsed.sections.remuneration_history?.rows).toHaveLength(1);
		expect(parsed.sections.remuneration_history?.rows[0].effectiveFrom).toBe('2024-04-01');
		expect(parsed.sections.remuneration_history?.rows[0].stdRemuneration).toBe('88000');
	});

	it('parses [monthly_notes] section', () => {
		expect(parsed.sections.monthly_notes?.rows).toHaveLength(2);
		expect(parsed.sections.monthly_notes?.rows[1].memo).toBe('健保改定後初月');
	});

	it('captures schemaVersion from header comments', () => {
		expect(parsed.headerMeta.schemaVersion).toBe(1);
	});

	it('handles quoted values with commas', () => {
		const csv = `[remuneration_history]
effectiveFrom,stdRemuneration,grossSalary,note
2024-04-01,88000,83000,"特別事情, 産育休"
`;
		const p = parseCsv(csv);
		expect(p.sections.remuneration_history?.rows[0].note).toBe('特別事情, 産育休');
	});

	it('handles quoted values containing newlines (RFC 4180 multiline)', () => {
		const csv = `[monthly_notes]
month,notifiedAmount,memo
2024-05,25202,"line1\nline2\nline3"
`;
		const p = parseCsv(csv);
		expect(p.sections.monthly_notes?.rows[0].memo).toBe('line1\nline2\nline3');
	});

	it('unescapes Formula Injection escape', () => {
		const csv = `[monthly_notes]
month,notifiedAmount,memo
2024-05,25202,"'=cmd"
`;
		const p = parseCsv(csv);
		expect(p.sections.monthly_notes?.rows[0].memo).toBe('=cmd');
	});

	it('captures appVersion from header comment', () => {
		// SAMPLE constant already contains "# solo-shaho v0 export ..."
		expect(parsed.headerMeta.appVersion).toBe('v0');
	});

	it('handles CRLF line endings (Excel-exported CSV)', () => {
		const crlf = SAMPLE.replace(/\n/g, '\r\n');
		const p = parseCsv(crlf);
		expect(p.sections.profile?.rows[0].name).toBe('山田太郎');
	});
});
