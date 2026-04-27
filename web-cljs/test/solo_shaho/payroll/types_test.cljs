(ns solo-shaho.payroll.types-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.types :as t]))

(def valid-rate-entry
  {:effective-from "2026-04-01"
   :kenpo-base 9850
   :kaigo 1620
   :kosei 18300
   :kosodate 360
   :shien 0
   :note ""})

(def valid-app-state
  {:schema-version 1
   :profile {:name "" :birth-date nil}
   :remuneration-history []
   :monthly-notes {}})

(deftest current-schema-version
  (is (= 1 t/CURRENT-SCHEMA-VERSION)))

(deftest validate-rate-history-pass
  (is (= [valid-rate-entry] (t/validate-rate-history [valid-rate-entry]))))

(deftest kebabify-keys-converts-camelcase
  (testing "JSON 由来の camelCase キーを CLJS 流の kebab-case に変換する"
    (is (= {:effective-from "2026-04-01" :kenpo-base 9850}
           (t/kebabify-keys {:effectiveFrom "2026-04-01" :kenpoBase 9850})))
    (is (= [{:effective-from "x"}] (t/kebabify-keys [{:effectiveFrom "x"}])))
    (is (= "leaf" (t/kebabify-keys "leaf")))
    (is (= 42 (t/kebabify-keys 42)))))

(deftest validate-rate-history-rejects-non-vector
  (is (thrown-with-msg? js/Error #"rateHistory must be" (t/validate-rate-history "x"))))

(deftest validate-rate-history-rejects-bad-effective-from
  (is (thrown-with-msg? js/Error #"effectiveFrom"
        (t/validate-rate-history [(assoc valid-rate-entry :effective-from "2026/04/01")]))))

(deftest validate-rate-history-rejects-negative-kosei
  (is (thrown-with-msg? js/Error #"kosei"
        (t/validate-rate-history [(assoc valid-rate-entry :kosei -1)]))))

(deftest validate-app-state-pass
  (is (= valid-app-state (t/validate-app-state valid-app-state))))

(deftest validate-app-state-rejects-wrong-version
  (is (thrown-with-msg? js/Error #"schemaVersion"
        (t/validate-app-state (assoc valid-app-state :schema-version 2)))))

(deftest validate-app-state-normalizes-empty-birth-date
  (testing "空文字 birth-date は nil に正規化"
    (let [result (t/validate-app-state
                   (assoc-in valid-app-state [:profile :birth-date] ""))]
      (is (nil? (get-in result [:profile :birth-date]))))))

(deftest validate-app-state-rejects-bad-birth-date
  (is (thrown-with-msg? js/Error #"birthDate"
        (t/validate-app-state
          (assoc-in valid-app-state [:profile :birth-date] "garbage")))))

(deftest validate-app-state-rejects-non-multiple-of-1000-std-remuneration
  (is (thrown-with-msg? js/Error #"multiple of 1000"
        (t/validate-app-state
          (assoc valid-app-state :remuneration-history
                 [{:effective-from "2024-04-01"
                   :std-remuneration 88500
                   :gross-salary 83000
                   :note ""}])))))

(deftest validate-app-state-rejects-bad-monthly-notes-key
  (is (thrown-with-msg? js/Error #"monthlyNotes key"
        (t/validate-app-state
          (assoc valid-app-state :monthly-notes {"2026/04" {:memo "x"}})))))
