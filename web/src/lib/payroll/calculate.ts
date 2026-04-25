import {
	MONTH_RE,
	type MonthInput,
	type MonthResult,
	type RateEntry,
	type RemunerationEntry
} from './types';
import { isKaigoApplicable, calculateAge } from './kaigo';
import { splitHalfEmployee, splitHalfEmployer, fullDownToYen } from './round';
import { findApplicableRate } from './rates';
import { findApplicableRemuneration } from './remuneration';

export class InvalidYearMonthError extends Error {
	constructor(value: string, role: 'start' | 'end') {
		super(`${role} must be YYYY-MM, got: ${value}`);
		this.name = 'InvalidYearMonthError';
	}
}

/**
 * 1 ヶ月分の社会保険料を計算する。
 * 引数 input.year/month は納付月として解釈する(Excel と同じ)。
 */
export function calculateMonth(input: MonthInput): MonthResult {
	const { year, month, stdRemuneration, grossSalary, birthDate, rates } = input;

	const isKaigo = isKaigoApplicable(birthDate, year, month);
	const age = birthDate ? calculateAge(birthDate, year, month) : null;
	const appliedKenpoRate = rates.kenpoBase + (isKaigo ? rates.kaigo : 0);

	// 全額(銭単位整数)
	const kenpoTotalSen = (stdRemuneration * appliedKenpoRate) / 1000;
	const koseiTotalSen = (stdRemuneration * rates.kosei) / 1000;
	const kosodateTotalSen = (stdRemuneration * rates.kosodate) / 1000;
	const shienTotalSen = (stdRemuneration * rates.shien) / 1000;

	// 全額(整数円・ROUNDDOWN 後)
	const kenpoTotal = fullDownToYen(kenpoTotalSen);
	const koseiTotal = fullDownToYen(koseiTotalSen);
	const kosodateTotal = fullDownToYen(kosodateTotalSen);
	const shienTotal = fullDownToYen(shienTotalSen);

	// 社員負担(50銭以下切捨て・50銭超切上げ)
	const kenpoEmployee = splitHalfEmployee(kenpoTotalSen);
	const koseiEmployee = splitHalfEmployee(koseiTotalSen);
	const shienEmployee = splitHalfEmployee(shienTotalSen);

	// 事業主負担(残額方式 + 拠出金は事業主全額)
	const kenpoEmployer = splitHalfEmployer(kenpoTotalSen, kenpoEmployee);
	const koseiEmployer = splitHalfEmployer(koseiTotalSen, koseiEmployee);
	const kosodateEmployer = kosodateTotal;
	const shienEmployer = splitHalfEmployer(shienTotalSen, shienEmployee);

	const employeeDeductionTotal = kenpoEmployee + koseiEmployee + shienEmployee;
	const employerBurdenTotal = kenpoEmployer + koseiEmployer + kosodateEmployer + shienEmployer;
	const payableTotal = employeeDeductionTotal + employerBurdenTotal;
	const netSalary = grossSalary - employeeDeductionTotal;

	return {
		year,
		month,
		age,
		isKaigoApplicable: isKaigo,
		appliedKenpoRate,
		kenpoTotal,
		koseiTotal,
		kosodateTotal,
		shienTotal,
		kenpoEmployee,
		koseiEmployee,
		shienEmployee,
		kenpoEmployer,
		koseiEmployer,
		kosodateEmployer,
		shienEmployer,
		employeeDeductionTotal,
		employerBurdenTotal,
		payableTotal,
		netSalary
	};
}

/**
 * 範囲計算。AppState には依存しない(層分離)。
 * start/end は包含 ("YYYY-MM")。start > end なら空配列。
 * フォーマット不正なら InvalidYearMonthError を throw(silent な空配列返しを防ぐ)。
 */
export function calculateRange(
	start: string,
	end: string,
	params: {
		birthDate: string | null;
		remunerationHistory: readonly RemunerationEntry[];
		rateHistory: readonly RateEntry[];
	}
): MonthResult[] {
	if (!MONTH_RE.test(start)) throw new InvalidYearMonthError(start, 'start');
	if (!MONTH_RE.test(end)) throw new InvalidYearMonthError(end, 'end');
	if (start > end) return [];
	const results: MonthResult[] = [];
	for (const ym of monthRange(start, end)) {
		const [yStr, mStr] = ym.split('-');
		const year = Number(yStr);
		const month = Number(mStr);
		const rates = findApplicableRate(ym, params.rateHistory);
		const rem = findApplicableRemuneration(ym, params.remunerationHistory);
		results.push(
			calculateMonth({
				year,
				month,
				stdRemuneration: rem.stdRemuneration,
				grossSalary: rem.grossSalary,
				birthDate: params.birthDate,
				rates
			})
		);
	}
	return results;
}

/** "YYYY-MM" を start..end の範囲で yield する純粋関数。 */
function* monthRange(start: string, end: string): Generator<string> {
	let [y, m] = start.split('-').map(Number);
	const [ey, em] = end.split('-').map(Number);
	while (y < ey || (y === ey && m <= em)) {
		yield `${y}-${String(m).padStart(2, '0')}`;
		m++;
		if (m === 13) {
			m = 1;
			y++;
		}
	}
}
