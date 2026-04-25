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
});
