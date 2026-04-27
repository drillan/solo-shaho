(ns solo-shaho.payroll.round)

(defn full-down-to-yen
  "Excel ROUNDDOWN(M, 0) 相当: 円未満を切捨て。
   入力は銭単位整数、出力は円整数。"
  [total-sen]
  (quot total-sen 100))

(defn split-half-employee
  "銭単位整数 total-sen を社員負担（円・整数）に分割する。
   Excel の `=INT(M/2)+IF(MOD(M,2)>1,1,0)` を bit-perfect 再現。

   アルゴリズム:
     half-yen-floored = floor(total-sen / 200)
     remainder        = total-sen mod 200      ;; 0..199 (sen)
     return remainder > 100 ? half-yen-floored + 1 : half-yen-floored

   remainder > 100 ⇔ MOD(M,2) > 1（yen with sen 端数 > 1.00 yen）。
   半額が奇数銭になるケースでも 0.5 銭の精度を失わない。"
  [total-sen]
  (let [half-yen-floored (quot total-sen 200)
        remainder (mod total-sen 200)]
    (if (> remainder 100)
      (inc half-yen-floored)
      half-yen-floored)))

(defn split-half-employer
  "残額方式: ROUNDDOWN(全額) - 社員負担。"
  [total-sen employee]
  (- (full-down-to-yen total-sen) employee))
