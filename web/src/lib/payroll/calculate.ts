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

	// 協会けんぽ告知(健保+介護+支援金): 納入告知額は「合算してから 1 円未満切捨て」。
	// 健保(例 10093.6)と支援金(例 202.4)の銭端数が告知書内で合算されるため、
	// 種別ごとに切捨ててから足すと 1 円不足する(料額表の脚注ルール)。
	const kyokaiTotalSen = kenpoTotalSen + shienTotalSen;
	const kyokaiTotal = fullDownToYen(kyokaiTotalSen);
	// 社員負担は折半額の欄ごとに 50 銭ルールを適用(健保・支援金それぞれ)した和。
	const kyokaiEmployee = splitHalfEmployee(kenpoTotalSen) + splitHalfEmployee(shienTotalSen);
	// 事業主負担は残額方式(告知額 − 社員負担)。協会けんぽ群の +1 円はここに乗る。
	const kyokaiEmployer = kyokaiTotal - kyokaiEmployee;

	// 年金機構告知(厚年+拠出金): 厚年全額は整数円のため、種別丸めと合算丸めが一致する。
	const koseiTotal = fullDownToYen(koseiTotalSen);
	const koseiEmployee = splitHalfEmployee(koseiTotalSen);
	const koseiEmployer = splitHalfEmployer(koseiTotalSen, koseiEmployee);
	const kosodateTotal = fullDownToYen(kosodateTotalSen);
	const kosodateEmployer = kosodateTotal; // 拠出金は事業主全額(社員負担 0)

	const employeeDeductionTotal = kyokaiEmployee + koseiEmployee;
	const employerBurdenTotal = kyokaiEmployer + koseiEmployer + kosodateEmployer;
	const payableTotal = employeeDeductionTotal + employerBurdenTotal;
	const netSalary = grossSalary - employeeDeductionTotal;

	return {
		year,
		month,
		age,
		isKaigoApplicable: isKaigo,
		appliedKenpoRate,
		kyokaiTotal,
		kyokaiEmployee,
		kyokaiEmployer,
		koseiTotal,
		koseiEmployee,
		koseiEmployer,
		kosodateTotal,
		kosodateEmployer,
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
