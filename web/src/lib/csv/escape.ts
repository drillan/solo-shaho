/**
 * 「0 個以上の `'` の後に Formula prefix(`=`, `+`, `-`, `@`, TAB, CR)」というパターン。
 * このパターンに合致するセル値は escape 時に必ず先頭にもう 1 個 `'` を付加する。
 */
const ESCAPE_PATTERN = /^'*[=+\-@\t\r]/;

/**
 * 「1 個以上の `'` の後に Formula prefix」というパターン。
 * このパターンに合致するセル値は unescape 時に先頭から 1 個 `'` を剥がす。
 *
 * escape 側が「0 個以上 `'` + Formula」に 1 個追加する → 必ず「1 個以上 `'` + Formula」になる。
 * unescape 側はその「1 個以上 `'` + Formula」から 1 個剥がす → 元の「0 個以上 `'` + Formula」に戻る。
 * 集合関係 (escape 覆域 = unescape 定義域) の対称性により、任意の apostrophe 個数で全単射が成立する。
 */
const UNESCAPE_PATTERN = /^'+[=+\-@\t\r]/;

/**
 * CSV セル値をエクスポート用にエスケープする。
 * 1) Formula Injection 対策: 「0 個以上 `'` + Formula prefix」で始まる値の先頭に `'` を 1 個付加。
 *    Excel/LibreOffice で開いたとき式として実行されないようリテラル化される。
 * 2) RFC 4180: 値が , " 改行 を含むか、Formula 対策で `'` を付与した場合、ダブルクォートで囲み
 *    内部の `"` を `""` にする。
 */
export function escapeCell(value: string): string {
	let v = value;
	let needsQuote = false;
	if (ESCAPE_PATTERN.test(v)) {
		v = `'${v}`;
		needsQuote = true;
	}
	if (/[,"\n\r]/.test(v)) needsQuote = true;
	if (!needsQuote) return v;
	return `"${v.replace(/"/g, '""')}"`;
}

/**
 * パース済みのセル値から「Formula エスケープのために追加された `'` 1 個」を剥がす。
 * 「1 個以上 `'` + Formula prefix」のパターンに対してのみ動作する(任意のリテラル `'foo` 等は
 * そのまま保持される)。
 */
export function unescapeCell(value: string): string {
	if (UNESCAPE_PATTERN.test(value)) {
		return value.slice(1);
	}
	return value;
}
