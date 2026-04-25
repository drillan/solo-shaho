const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * CSV セル値をエクスポート用にエスケープする。
 * 1) Formula Injection 対策: 先頭が = + - @ TAB CR の場合、先頭にシングルクォートを付与
 * 2) RFC 4180: 値が , " 改行 を含むか、Formula 対策で `'` を付与した場合、ダブルクォートで囲み内部の `"` を `""` にする
 */
export function escapeCell(value: string): string {
	let v = value;
	let needsQuote = false;
	if (FORMULA_PREFIX.test(v)) {
		v = `'${v}`;
		needsQuote = true;
	}
	if (/[,"\n\r]/.test(v)) needsQuote = true;
	if (!needsQuote) return v;
	return `"${v.replace(/"/g, '""')}"`;
}

/**
 * パース済みのセル値からシングルクォート(Formula Injection エスケープ)を剥がす。
 * 値が `'` で始まり、かつそれが Formula prefix のエスケープと判別できる場合のみ剥がす。
 */
export function unescapeCell(value: string): string {
	if (value.length >= 2 && value.startsWith("'") && FORMULA_PREFIX.test(value.slice(1))) {
		return value.slice(1);
	}
	return value;
}
