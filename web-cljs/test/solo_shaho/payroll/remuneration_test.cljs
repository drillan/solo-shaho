(ns solo-shaho.payroll.remuneration-test
  (:require [cljs.test :refer-macros [deftest is]]
            [solo-shaho.payroll.remuneration :as r]))

(def history
  [{:effective-from "2024-04-01" :std-remuneration 88000 :gross-salary 83000 :note ""}
   {:effective-from "2025-09-01" :std-remuneration 98000 :gross-salary 93000 :note ""}])

(deftest applies-prior-entry
  (is (= 88000 (:std-remuneration (r/find-applicable-remuneration "2025-08" history)))))

(deftest applies-newer-entry
  (is (= 98000 (:std-remuneration (r/find-applicable-remuneration "2025-09" history)))))

(deftest throws-when-before-history
  (is (thrown-with-msg? js/Error #"No applicable 報酬"
        (r/find-applicable-remuneration "2024-03" history))))
