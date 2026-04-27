(ns solo-shaho.payroll.lookup-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.lookup :as l]))

(def history
  [{:effective-from "2024-04-01" :v "A"}
   {:effective-from "2025-04-01" :v "B"}
   {:effective-from "2026-04-01" :v "C"}])

(deftest finds-most-recent-applicable
  (is (= "C" (:v (l/find-applicable-entry "2026-04" history "test")))))

(deftest finds-prior-when-target-before-newer
  (is (= "A" (:v (l/find-applicable-entry "2024-12" history "test"))))
  (is (= "B" (:v (l/find-applicable-entry "2025-06" history "test")))))

(deftest exact-effective-from-month-matches
  (testing "effectiveFrom <= targetDate (= ym-01) を満たす"
    (is (= "B" (:v (l/find-applicable-entry "2025-04" history "test"))))))

(deftest throws-when-no-applicable
  (is (thrown-with-msg? js/Error #"No applicable test entry"
        (l/find-applicable-entry "2024-01" history "test"))))

(deftest throws-when-empty-history
  (is (thrown-with-msg? js/Error #"No applicable test entry"
        (l/find-applicable-entry "2026-04" [] "test"))))
