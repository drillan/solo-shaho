import { findApplicableEntry } from './lookup';
import type { RateEntry } from './types';

export function findApplicableRate(yearMonth: string, history: readonly RateEntry[]): RateEntry {
	return findApplicableEntry(yearMonth, history, '料率');
}
