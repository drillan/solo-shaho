(ns solo-shaho.payroll.lookup)

(defn find-applicable-entry
  "effective-from <= year-month-01 を満たす最新エントリを返す。
   該当なしは ex-info で例外送出（フォールバック禁止）。"
  [year-month history error-context]
  (let [target-date (str year-month "-01")
        applicable (filter #(<= (compare (:effective-from %) target-date) 0) history)]
    (if (empty? applicable)
      (throw (ex-info (str "No applicable " error-context " entry found for " year-month)
                      {:error/type :entry-not-found
                       :context error-context
                       :year-month year-month}))
      (apply max-key :effective-from applicable))))
