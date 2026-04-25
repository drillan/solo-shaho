const yenFmt = new Intl.NumberFormat('ja-JP');

export function formatYen(n: number): string {
	return yenFmt.format(n);
}

/** 1/100,000 単位の整数を "X.XX%" にする。 */
export function formatRatePercent(rateX100k: number, fractionDigits = 2): string {
	return (rateX100k / 1000).toFixed(fractionDigits) + '%';
}
