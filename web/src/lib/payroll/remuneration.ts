import { findApplicableEntry } from './lookup';
import type { RemunerationEntry } from './types';

export function findApplicableRemuneration(
	yearMonth: string,
	history: readonly RemunerationEntry[]
): RemunerationEntry {
	return findApplicableEntry(yearMonth, history, '報酬');
}
