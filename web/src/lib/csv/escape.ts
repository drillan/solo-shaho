const FORMULA_PREFIX = /^[=+\-@\t\r]/;
const ESCAPED_LIKE = /^'[=+\-@\t\r]/;

/**
 * CSV セル値をエクスポート用にエスケープする。
 * 1) Formula Injection 対策: 先頭が = + - @ TAB CR の場合、先頭にシングルクォートを付与
 * 2) 元データが「' + Formula prefix」で始まる場合、unescape で Formula エスケープと
 *    誤認されるのを防ぐため、もう 1 つ ' を追加する(全単射性の保証)
 * 3) RFC 4180: 値が , " 改行 を含むか、Formula 対策で `'` を付与した場合、ダブルクォートで囲み内部の `"` を `""` にする
 */
export function escapeCell(value: string): string {
	let v = value;
	let needsQuote = false;
	if (FORMULA_PREFIX.test(v)) {
		v = `'${v}`;
		needsQuote = true;
	} else if (ESCAPED_LIKE.test(v)) {
		v = `'${v}`;
		needsQuote = true;
	}
	if (/[,"\n\r]/.test(v)) needsQuote = true;
	if (!needsQuote) return v;
	return `"${v.replace(/"/g, '""')}"`;
}

/**
 * パース済みのセル値からシングルクォート(Formula Injection エスケープ)を剥がす。
 * - `'` + Formula prefix(=+-@TAB CR) で始まる場合: 先頭 ' を剥がす(Formula エスケープの除去)
 * - `''` + Formula prefix で始まる場合: 先頭 ' を剥がす(escapeCell が「' + Formula prefix」を
 *   Formula エスケープと誤認させないために追加した ' を剥がす)
 */
export function unescapeCell(value: string): string {
	if (value.length >= 2 && value.startsWith("'")) {
		const rest = value.slice(1);
		if (FORMULA_PREFIX.test(rest) || ESCAPED_LIKE.test(rest)) {
			return rest;
		}
	}
	return value;
}
