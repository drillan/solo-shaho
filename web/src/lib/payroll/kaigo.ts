/**
 * 引数 year/month は納付月として解釈する(Excel と同じ)。
 * 該当判定: 40歳誕生日の前日 ≦ 当月末日 < 65歳誕生日の前日
 * birthDate が null/empty の場合は false を返す。
 */
export function isKaigoApplicable(birthDate: string | null, year: number, month: number): boolean {
	if (birthDate === null || birthDate === '') return false;
	const eom = endOfMonth(year, month);
	const [by, bm, bd] = parseBirthDate(birthDate);
	// JS Date は day=0 や day=-1 を前月に正規化する
	const b40 = new Date(by + 40, bm - 1, bd - 1);
	const b65 = new Date(by + 65, bm - 1, bd - 1);
	return eom.getTime() >= b40.getTime() && eom.getTime() < b65.getTime();
}

export function calculateAge(birthDate: string, year: number, month: number): number {
	const eom = endOfMonth(year, month);
	const [by, bm, bd] = parseBirthDate(birthDate);
	let age = year - by;
	// 当月末日が誕生日より前なら 1 歳引く
	if (eom.getMonth() + 1 < bm || (eom.getMonth() + 1 === bm && eom.getDate() < bd)) {
		age -= 1;
	}
	return age;
}

function endOfMonth(year: number, month: number): Date {
	// new Date(year, month, 0) = 指定月の末日(month は 1-based をそのまま渡す)
	return new Date(year, month, 0);
}

function parseBirthDate(s: string): [number, number, number] {
	const [y, m, d] = s.split('-').map(Number);
	return [y, m, d];
}
