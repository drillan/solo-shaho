(ns solo-shaho.payroll.calculate
  (:require [solo-shaho.payroll.types :as t]
            [solo-shaho.payroll.kaigo :as kaigo]
            [solo-shaho.payroll.round :as round]
            [solo-shaho.payroll.rates :as rates]
            [solo-shaho.payroll.remuneration :as rem]))

(defn- pad2 [n]
  (let [s (str n)]
    (if (= 1 (count s)) (str "0" s) s)))

(defn- raise-ym! [value role]
  (throw (ex-info (str (name role) " must be YYYY-MM, got: " value)
                  {:error/type :invalid-year-month :role role :value value})))

(defn calculate-month
  "1 ヶ月分の社会保険料を計算する純粋関数。
   引数 input.year/month は納付月として解釈する（Excel と同じ）。"
  [{:keys [year month std-remuneration gross-salary birth-date rates]}]
  (let [is-kaigo (kaigo/kaigo-applicable? birth-date year month)
        age (when birth-date (kaigo/calculate-age birth-date year month))
        applied-kenpo-rate (+ (:kenpo-base rates) (if is-kaigo (:kaigo rates) 0))
        ;; 全額（銭単位整数）。std-remuneration が 1000 の倍数なので除算は厳密整数。
        kenpo-total-sen     (quot (* std-remuneration applied-kenpo-rate) 1000)
        kosei-total-sen     (quot (* std-remuneration (:kosei rates))    1000)
        kosodate-total-sen  (quot (* std-remuneration (:kosodate rates)) 1000)
        shien-total-sen     (quot (* std-remuneration (:shien rates))    1000)
        kenpo-total    (round/full-down-to-yen kenpo-total-sen)
        kosei-total    (round/full-down-to-yen kosei-total-sen)
        kosodate-total (round/full-down-to-yen kosodate-total-sen)
        shien-total    (round/full-down-to-yen shien-total-sen)
        kenpo-employee  (round/split-half-employee kenpo-total-sen)
        kosei-employee  (round/split-half-employee kosei-total-sen)
        shien-employee  (round/split-half-employee shien-total-sen)
        kenpo-employer  (round/split-half-employer kenpo-total-sen kenpo-employee)
        kosei-employer  (round/split-half-employer kosei-total-sen kosei-employee)
        kosodate-employer kosodate-total
        shien-employer  (round/split-half-employer shien-total-sen shien-employee)
        employee-deduction-total (+ kenpo-employee kosei-employee shien-employee)
        employer-burden-total    (+ kenpo-employer kosei-employer
                                    kosodate-employer shien-employer)
        payable-total            (+ employee-deduction-total employer-burden-total)
        net-salary               (- gross-salary employee-deduction-total)]
    {:year year
     :month month
     :age age
     :kaigo-applicable? is-kaigo
     :applied-kenpo-rate applied-kenpo-rate
     :kenpo-total kenpo-total
     :kosei-total kosei-total
     :kosodate-total kosodate-total
     :shien-total shien-total
     :kenpo-employee kenpo-employee
     :kosei-employee kosei-employee
     :shien-employee shien-employee
     :kenpo-employer kenpo-employer
     :kosei-employer kosei-employer
     :kosodate-employer kosodate-employer
     :shien-employer shien-employer
     :employee-deduction-total employee-deduction-total
     :employer-burden-total employer-burden-total
     :payable-total payable-total
     :net-salary net-salary}))

(defn- month-range-seq
  "\"YYYY-MM\" を start..end の範囲で lazy seq として返す純粋関数。"
  [start end]
  (let [[sy sm] (->> (.split start "-") (map js/parseInt))
        [ey em] (->> (.split end "-")   (map js/parseInt))]
    (->> (iterate (fn [[y m]]
                    (if (= m 12) [(inc y) 1] [y (inc m)]))
                  [sy sm])
         (take-while (fn [[y m]]
                       (or (< y ey) (and (= y ey) (<= m em)))))
         (map (fn [[y m]] (str y "-" (pad2 m)))))))

(defn calculate-range
  "範囲計算。AppState には依存しない（層分離）。
   start/end は包含。start > end なら空 vector。
   YYYY-MM 形式違反は ex-info で例外送出（silent な空配列返しを防ぐ）。"
  [start end {:keys [birth-date remuneration-history rate-history]}]
  (when-not (re-matches t/MONTH-RE start) (raise-ym! start :start))
  (when-not (re-matches t/MONTH-RE end) (raise-ym! end :end))
  (if (pos? (compare start end))
    []
    (mapv (fn [ym]
            (let [[y-str m-str] (.split ym "-")
                  year (js/parseInt y-str)
                  month (js/parseInt m-str)
                  rate (rates/find-applicable-rate ym rate-history)
                  rem-entry (rem/find-applicable-remuneration ym remuneration-history)]
              (calculate-month {:year year :month month
                                :std-remuneration (:std-remuneration rem-entry)
                                :gross-salary (:gross-salary rem-entry)
                                :birth-date birth-date
                                :rates rate})))
          (month-range-seq start end))))
