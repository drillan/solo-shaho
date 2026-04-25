import { describe, it, expect } from 'vitest';
import { escapeCell, unescapeCell } from '$lib/csv/escape';

describe('escapeCell — Formula Injection 対策', () => {
	it('= で始まる値は先頭にシングルクォートを付ける', () => {
		expect(escapeCell('=cmd|/c calc')).toBe(`"'=cmd|/c calc"`);
	});

	it('+ - @ TAB CR で始まる値も同様にエスケープ', () => {
		expect(escapeCell('+1234')).toBe(`"'+1234"`);
		expect(escapeCell('-1234')).toBe(`"'-1234"`);
		expect(escapeCell('@hostname')).toBe(`"'@hostname"`);
		expect(escapeCell('\tcmd')).toBe(`"'\tcmd"`);
		expect(escapeCell('\rcmd')).toBe(`"'\rcmd"`);
	});

	it('通常の値はそのまま(クォートも不要)', () => {
		expect(escapeCell('山田太郎')).toBe('山田太郎');
		expect(escapeCell('123')).toBe('123');
	});

	it('カンマを含む値は RFC 4180 でクォート', () => {
		expect(escapeCell('a,b')).toBe(`"a,b"`);
	});

	it('ダブルクォートを含む値はエスケープ', () => {
		expect(escapeCell('a"b')).toBe(`"a""b"`);
	});

	it('改行を含む値はクォート', () => {
		expect(escapeCell('a\nb')).toBe(`"a\nb"`);
	});

	it('空文字はそのまま', () => {
		expect(escapeCell('')).toBe('');
	});

	it('escapes a literal value starting with apostrophe + formula prefix', () => {
		// 元データ "'=foo" は、エスケープ後にダブルクォートで囲み、内部は ''=foo に
		expect(escapeCell("'=foo")).toBe(`"''=foo"`);
	});

	it('round-trips a literal value starting with apostrophe + formula prefix', () => {
		const original = "'=foo";
		const escaped = escapeCell(original);
		// パーサ後の中間値は ''=foo になる(クォートが剥がされる想定)
		// ここでは escapeCell + unescapeCell の往復を直接検証する
		// 簡略化のため、エスケープ済みの中身を取り出して unescape に渡す
		const innerEscaped = escaped.slice(1, -1).replace(/""/g, '"');
		expect(unescapeCell(innerEscaped)).toBe(original);
	});
});

describe('unescapeCell — シングルクォート剥がし', () => {
	it('escape→unescape ラウンドトリップで元の値に戻る(Formula Injection 文字列)', () => {
		const _original = '=cmd|/c calc';
		// escapeCell の結果から quote を取り除き、unescapeCell に渡すケースをシミュレート
		// パーサが先に `"`の処理をしてシングルクォートを剥がす責務をここに持たせる
		expect(unescapeCell(`'=cmd|/c calc`)).toBe('=cmd|/c calc');
		void _original;
	});

	it('シングルクォートで始まらない値はそのまま', () => {
		expect(unescapeCell('山田')).toBe('山田');
	});

	it('does NOT strip leading apostrophe when next char is not a formula prefix', () => {
		expect(unescapeCell("'foo")).toBe("'foo");
	});
});

/**
 * Bijection の網羅検証。
 * escape は CSV クォート ("...") を含めて出力するので、roundTrip は
 * 「クォート除去 + RFC 4180 のダブルクォート復元」をシミュレートしてから unescape する。
 */
function roundTrip(original: string): string {
	const escaped = escapeCell(original);
	const inner =
		escaped.startsWith('"') && escaped.endsWith('"')
			? escaped.slice(1, -1).replace(/""/g, '"')
			: escaped;
	return unescapeCell(inner);
}

describe('escape ⇄ unescape bijection (任意個数の apostrophe + formula prefix)', () => {
	const formulaChars = ['=', '+', '-', '@', '\t', '\r'] as const;
	for (const apos of [0, 1, 2, 3, 4]) {
		for (const c of formulaChars) {
			const input = "'".repeat(apos) + c + 'foo';
			const label = JSON.stringify(input);
			it(`${label} を完全復元する`, () => {
				expect(roundTrip(input)).toBe(input);
			});
		}
	}

	it('apostrophe のみで formula が無い値は加工されない', () => {
		expect(roundTrip("'")).toBe("'");
		expect(roundTrip("''")).toBe("''");
		expect(roundTrip("'''foo")).toBe("'''foo");
	});

	it('formula のみ・apostrophe のみのエッジケースも復元', () => {
		expect(roundTrip('=')).toBe('=');
		expect(roundTrip('')).toBe('');
	});
});
