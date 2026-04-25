import { unescapeCell } from './escape';

export interface ParsedSection {
	header: string[];
	rows: Record<string, string>[];
}

export interface ParsedCsv {
	headerMeta: {
		schemaVersion: number | null;
		appVersion: string | null;
		exportedAt: string | null;
	};
	sections: Record<string, ParsedSection | undefined>;
}

/**
 * RFC 4180 準拠の CSV パーサ。クォート内の改行をフィールド値として扱うため、
 * 行分割 → 行パーサの 2 段階構成ではなく入力全体を 1 パスで走査する状態機械として実装する。
 */
export function parseCsv(input: string): ParsedCsv {
	const text = input.startsWith('﻿') ? input.slice(1) : input;
	const records = parseRfc4180(text);

	const headerMeta = {
		schemaVersion: null as number | null,
		appVersion: null as string | null,
		exportedAt: null as string | null
	};
	const sections: Record<string, ParsedSection> = {};

	let currentSection: string | null = null;
	let currentHeader: string[] | null = null;

	for (const record of records) {
		// 空行(全フィールドが空文字 1 個)はセクション境界
		if (record.length === 1 && record[0] === '') {
			currentHeader = null;
			continue;
		}
		const first = record[0];
		if (first.startsWith('#')) {
			const fullLine = record.join(',');
			const m = fullLine.match(/schemaVersion=(\d+)/);
			if (m) headerMeta.schemaVersion = Number(m[1]);
			const m2 = fullLine.match(/exportedAt=(\S+)/);
			if (m2) headerMeta.exportedAt = m2[1];
			const m3 = fullLine.match(/^# solo-shaho (\S+)/);
			if (m3) headerMeta.appVersion = m3[1];
			continue;
		}
		if (first.startsWith('[') && first.endsWith(']') && record.length === 1) {
			currentSection = first.slice(1, -1);
			sections[currentSection] = { header: [], rows: [] };
			currentHeader = null;
			continue;
		}
		if (currentSection === null) continue;
		if (currentHeader === null) {
			currentHeader = record;
			sections[currentSection].header = record;
		} else {
			const row: Record<string, string> = {};
			for (let i = 0; i < currentHeader.length; i++) {
				row[currentHeader[i]] = unescapeCell(record[i] ?? '');
			}
			sections[currentSection].rows.push(row);
		}
	}

	return { headerMeta, sections };
}

/**
 * RFC 4180 準拠の CSV を入力全体を 1 パスで走査して records へ分解する。
 * クォート内の改行はフィールド値として保持される。
 */
function parseRfc4180(text: string): string[][] {
	const records: string[][] = [];
	let record: string[] = [];
	let buf = '';
	let inQuote = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuote) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					buf += '"';
					i++;
					continue;
				}
				inQuote = false;
				continue;
			}
			buf += c;
			continue;
		}
		if (c === '"') {
			inQuote = true;
			continue;
		}
		if (c === ',') {
			record.push(buf);
			buf = '';
			continue;
		}
		if (c === '\r') continue; // CRLF の CR は無視
		if (c === '\n') {
			record.push(buf);
			records.push(record);
			record = [];
			buf = '';
			continue;
		}
		buf += c;
	}
	// 末尾改行なしの最終フィールドを取りこぼさない
	if (buf !== '' || record.length > 0) {
		record.push(buf);
		records.push(record);
	}
	return records;
}
