import type { MonthInput, MonthResult } from './types';
import { isKaigoApplicable, calculateAge } from './kaigo';
import { splitHalfEmployee, splitHalfEmployer, fullDownToYen } from './round';

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
