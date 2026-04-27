(ns solo-shaho.payroll.kaigo
  (:require [solo-shaho.payroll.types :as t]))

(defn- end-of-month
  "year, month (1-based) の末日を js/Date で返す。
   js/Date の day=0 は前月に正規化される性質を利用して `new Date(y, m, 0)` で末日を得る。"
  [year month]
  (js/Date. year month 0))

(defn- parse-birth-date [s]
  (when-not (and (string? s) (re-matches t/DATE-RE s))
    (throw (ex-info (str "birthDate must be YYYY-MM-DD, got: " s)
                    {:error/type :invalid-birth-date :value s})))
  (let [[y m d] (->> (.split s "-") (map js/parseInt))]
    [y m d]))

(defn kaigo-applicable?
  "引数 year/month は納付月として解釈する。
   該当判定: 40歳誕生日の前日 ≦ 当月末日 < 65歳誕生日の前日
   birth-date が nil または空文字の場合は false。
   YYYY-MM-DD 形式以外の文字列の場合は ex-info を throw。"
  [birth-date year month]
  (if (or (nil? birth-date) (= birth-date ""))
    false
    (let [eom (end-of-month year month)
          [by bm bd] (parse-birth-date birth-date)
          ;; JS Date は day=0 や day=-1 で前月に正規化されるので bd-1 を渡せる
          b40 (js/Date. (+ by 40) (dec bm) (dec bd))
          b65 (js/Date. (+ by 65) (dec bm) (dec bd))]
      (and (>= (.getTime eom) (.getTime b40))
           (< (.getTime eom) (.getTime b65))))))

(defn calculate-age
  "年齢計算: 当月末日が誕生日より前なら year差 - 1。"
  [birth-date year month]
  (let [eom (end-of-month year month)
        [by bm bd] (parse-birth-date birth-date)
        eom-month (inc (.getMonth eom))
        eom-date (.getDate eom)
        diff (- year by)]
    (if (or (< eom-month bm)
            (and (= eom-month bm) (< eom-date bd)))
      (dec diff)
      diff)))
