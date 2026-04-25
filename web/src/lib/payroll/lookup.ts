export class EntryNotFoundError extends Error {
	constructor(context: string, yearMonth: string) {
		super(`No applicable ${context} entry found for ${yearMonth}`);
		this.name = 'EntryNotFoundError';
	}
}

/**
 * effectiveFrom <= yearMonth-01 を満たす最新エントリを返す。
 * 該当なしは EntryNotFoundError を throw(フォールバック禁止)。
 */
export function findApplicableEntry<T extends { effectiveFrom: string }>(
	yearMonth: string,
	history: readonly T[],
	errorContext: string
): T {
	const targetDate = `${yearMonth}-01`;
	let best: T | null = null;
	for (const entry of history) {
		if (entry.effectiveFrom <= targetDate) {
			if (best === null || entry.effectiveFrom > best.effectiveFrom) {
				best = entry;
			}
		}
	}
	if (best === null) {
		throw new EntryNotFoundError(errorContext, yearMonth);
	}
	return best;
}
