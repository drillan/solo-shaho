(ns solo-shaho.excel-snapshot-test
  (:require [cljs.test :refer-macros [deftest is testing async]]
            [solo-shaho.payroll.types :as t]
            [solo-shaho.payroll.calculate :as c]
            [solo-shaho.payroll.rates :as r]
            ["fs" :as fs]
            ["path" :as path]))

;; node-test の `out/test.js` から見てプロジェクトルートは 2 階層上。
(def fixture-path
  (path/resolve js/__dirname ".." ".." "web" "tests" "fixtures" "excel-snapshot.json"))

(def rates-json-path
  (path/resolve js/__dirname ".." ".." "web" "src" "lib" "data" "rates.json"))

(def fixture-exists?
  (try (fs/accessSync fixture-path) true (catch :default _ false)))

(defn- load-rate-history []
  (-> (fs/readFileSync rates-json-path "utf8")
      js/JSON.parse
      (js->clj :keywordize-keys true)
      t/kebabify-keys
      :history
      t/validate-rate-history))

(defn- load-fixture-cases []
  (-> (fs/readFileSync fixture-path "utf8")
      js/JSON.parse
      (js->clj :keywordize-keys true)
      :cases))

;; TS の camelCase → CLJS の kebab-case 変換表
(def expected-key->result-key
  {:kenpoTotal :kenpo-total
   :koseiTotal :kosei-total
   :kosodateTotal :kosodate-total
   :shienTotal :shien-total
   :kenpoEmployee :kenpo-employee
   :koseiEmployee :kosei-employee
   :shienEmployee :shien-employee
   :kenpoEmployer :kenpo-employer
   :koseiEmployer :kosei-employer
   :kosodateEmployer :kosodate-employer
   :shienEmployer :shien-employer
   :employeeDeductionTotal :employee-deduction-total
   :employerBurdenTotal :employer-burden-total
   :payableTotal :payable-total
   :netSalary :net-salary
   :appliedKenpoRate :applied-kenpo-rate
   :age :age
   :isKaigoApplicable :kaigo-applicable?
   :year :year
   :month :month})

(defn- pad2 [n]
  (let [s (str n)]
    (if (= 1 (count s)) (str "0" s) s)))

(when fixture-exists?
  (deftest excel-snapshot-bit-perfect
    (let [rate-history (load-rate-history)
          cases (load-fixture-cases)]
      (testing (str (count cases) " cases must match Excel exactly")
        (doseq [{:keys [year month input expected]} cases]
          (let [ym (str year "-" (pad2 month))
                rates (r/find-applicable-rate ym rate-history)
                got (c/calculate-month
                      {:year year :month month
                       :std-remuneration (:stdRemuneration input)
                       :gross-salary (:grossSalary input)
                       :birth-date (let [b (:birthDate input)]
                                     (if (or (nil? b) (= b "")) nil b))
                       :rates rates})]
            (doseq [[exp-key exp-val] expected]
              (let [result-key (expected-key->result-key exp-key)
                    actual (get got result-key)]
                (is (= exp-val actual)
                    (str year "/" month " " (name exp-key)
                         " expected=" exp-val " actual=" actual))))))))))

(when-not fixture-exists?
  (deftest excel-snapshot-fixture-missing-warning
    (testing (str "Fixture not found at " fixture-path
                  " — run web/tests/fixtures/extract_from_excel.py to generate it")
      ;; 存在しない場合はテストをスキップ扱いにする（fail させない）
      (is true))))
