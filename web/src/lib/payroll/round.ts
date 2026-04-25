/**
 * 銭単位の整数 totalSen を社員負担(円・整数)に分割する。
 * Excel の `=INT(M/2)+IF(MOD(M,2)>1,1,0)` を bit-perfect 再現。
 *
 * アルゴリズム:
 *   half_yen_floored = floor(totalSen / 200)        // = INT(M/2) in yen
 *   remainder        = totalSen % 200               // 0..199 (sen)
 *   return remainder > 100 ? half_yen_floored + 1 : half_yen_floored
 *
 * remainder > 100 ⇔ MOD(M, 2) > 1(yen with sen 端数 > 1.00 yen)。
 * これにより 50 銭超切上げ・50 銭以下切捨ての境界判定が、
 * 半額が奇数銭になるケースでも 0.5 銭の精度を失わない。
 */
export function splitHalfEmployee(totalSen: number): number {
	const halfYenFloored = Math.floor(totalSen / 200);
	const remainder = totalSen % 200;
	return remainder > 100 ? halfYenFloored + 1 : halfYenFloored;
}

/** 残額方式: ROUNDDOWN(全額) - 社員負担。 */
export function splitHalfEmployer(totalSen: number, employee: number): number {
	return fullDownToYen(totalSen) - employee;
}

/** Excel ROUNDDOWN(M, 0) 相当: 円未満を切捨て。 */
export function fullDownToYen(totalSen: number): number {
	return Math.floor(totalSen / 100);
}
