(ns solo-shaho.payroll.aggregate-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.aggregate :as a]))

(defn- mk-result [year month emp-ded emp-bur pay]
  {:year year :month month
   :employee-deduction-total emp-ded
   :employer-burden-total emp-bur
   :payable-total pay})

(deftest aggregate-empty
  (is (= [] (a/aggregate-by-calendar-year []))))

(deftest aggregate-single-year
  (let [results [(mk-result 2025 11 100 200 300)
                 (mk-result 2025 12 100 200 300)
                 (mk-result 2026 1 50 100 150)]
        summaries (a/aggregate-by-calendar-year results)]
    (is (= 2 (count summaries)))
    (let [[y2025 y2026] summaries]
      (is (= 2025 (:year y2025)))
      (is (= 2 (:month-count y2025)))
      (is (= 200 (:employee-deduction-total y2025)))
      (is (= 400 (:employer-burden-total y2025)))
      (is (= 600 (:payable-total y2025)))
      (is (= 2026 (:year y2026)))
      (is (= 1 (:month-count y2026)))
      (is (= 150 (:payable-total y2026))))))

(deftest aggregate-sorted-by-year
  (let [results [(mk-result 2026 1 0 0 0)
                 (mk-result 2024 1 0 0 0)
                 (mk-result 2025 1 0 0 0)]
        summaries (a/aggregate-by-calendar-year results)]
    (is (= [2024 2025 2026] (mapv :year summaries)))))
