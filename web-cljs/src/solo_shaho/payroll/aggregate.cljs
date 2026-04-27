(ns solo-shaho.payroll.aggregate)

(defn aggregate-by-calendar-year
  "月次計算結果を暦年で集計する。MonthResult が year/month を内包しているため
   並列配列パターンや TaggedMonth ラッパーは不要。
   結果は year 昇順。"
  [months]
  (->> months
       (group-by :year)
       (map (fn [[year ms]]
              {:year year
               :month-count (count ms)
               :employee-deduction-total (reduce + 0 (map :employee-deduction-total ms))
               :employer-burden-total (reduce + 0 (map :employer-burden-total ms))
               :payable-total (reduce + 0 (map :payable-total ms))}))
       (sort-by :year)
       vec))
