(ns solo-shaho.payroll.calculate-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.calculate :as c]))

(def rate-2026-apr
  {:effective-from "2026-04-01"
   :kenpo-base 9850
   :kaigo 1620
   :kosei 18300
   :kosodate 360
   :shien 0
   :note ""})

(def rate-2026-may
  (assoc rate-2026-apr :effective-from "2026-05-01" :shien 230))

(def rate-history
  [(assoc rate-2026-apr :effective-from "2024-04-01")
   rate-2026-apr
   rate-2026-may])

(def remuneration-history
  [{:effective-from "2024-04-01" :std-remuneration 88000 :gross-salary 83000 :note ""}])

(def base-input
  {:year 2026 :month 4
   :std-remuneration 88000 :gross-salary 83000
   :birth-date "1985-06-15"
   :rates rate-2026-apr})

(deftest calculate-month-2026-04-kaigo-applicable
  (let [r (c/calculate-month base-input)]
    (testing "結果に year=2026, month=4 が埋め込まれる"
      (is (= 2026 (:year r)))
      (is (= 4 (:month r))))
    (testing "age = 40 (April month-end before June birthday)"
      (is (= 40 (:age r))))
    (testing "介護該当"
      (is (true? (:kaigo-applicable? r))))
    (testing "appliedKenpoRate = kenpo-base + kaigo"
      (is (= (+ 9850 1620) (:applied-kenpo-rate r))))
    (testing "kenpo-total = ROUNDDOWN(88000 * 11.47%) = 10093"
      (is (= 10093 (:kenpo-total r))))
    (testing "kenpo-employee + kenpo-employer = kenpo-total"
      (is (= (:kenpo-total r) (+ (:kenpo-employee r) (:kenpo-employer r)))))
    (testing "kenpo-employee = 5047"
      (is (= 5047 (:kenpo-employee r)))
      (is (= (- 10093 5047) (:kenpo-employer r))))
    (testing "kosei-total = ROUNDDOWN(88000 * 18.30%) = 16104"
      (is (= 16104 (:kosei-total r))))
    (testing "kosei-employee = kosei-employer = 8052"
      (is (= 8052 (:kosei-employee r)))
      (is (= 8052 (:kosei-employer r))))
    (testing "kosodate-employer = ROUNDDOWN(88000 * 0.36%) = 316"
      (is (= 316 (:kosodate-employer r)))
      (is (= 316 (:kosodate-total r))))
    (testing "shien = 0 (2026/04 月分は支援金開始前)"
      (is (= 0 (:shien-total r)))
      (is (= 0 (:shien-employee r)))
      (is (= 0 (:shien-employer r))))
    (testing "集計値が一致"
      (is (= (:employee-deduction-total r)
             (+ (:kenpo-employee r) (:kosei-employee r) (:shien-employee r))))
      (is (= (:employer-burden-total r)
             (+ (:kenpo-employer r) (:kosei-employer r)
                (:kosodate-employer r) (:shien-employer r))))
      (is (= (:payable-total r)
             (+ (:employee-deduction-total r) (:employer-burden-total r))))
      (is (= (:net-salary r) (- 83000 (:employee-deduction-total r)))))))

(deftest calculate-month-birth-date-nil
  (let [r (c/calculate-month (assoc base-input :birth-date nil))]
    (is (false? (:kaigo-applicable? r)))
    (is (= 9850 (:applied-kenpo-rate r)))
    (is (nil? (:age r)))))

(deftest calculate-month-2026-05-shien-introduced
  (let [r (c/calculate-month (assoc base-input
                                    :year 2026 :month 5
                                    :rates rate-2026-may))]
    (testing "shien-total = ROUNDDOWN(88000 * 0.23%) = 202"
      (is (= 202 (:shien-total r))))
    (testing "shien は労使折半"
      (is (= (:shien-total r) (+ (:shien-employee r) (:shien-employer r)))))))

(deftest calculate-range-3-months
  (let [results (c/calculate-range "2026-03" "2026-05"
                                   {:birth-date "1985-06-15"
                                    :remuneration-history remuneration-history
                                    :rate-history rate-history})]
    (is (= 3 (count results)))
    (is (= 0 (:shien-total (nth results 1))))
    (is (pos? (:shien-total (nth results 2))))))

(deftest calculate-range-start-after-end
  (is (= [] (c/calculate-range "2026-05" "2026-03"
                               {:birth-date "1985-06-15"
                                :remuneration-history remuneration-history
                                :rate-history rate-history}))))

(deftest calculate-range-bad-start-throws
  (is (thrown-with-msg? js/Error #"start must be YYYY-MM"
        (c/calculate-range "2026/03" "2026-05"
                           {:birth-date "1985-06-15"
                            :remuneration-history remuneration-history
                            :rate-history rate-history}))))

(deftest calculate-range-bad-end-throws
  (is (thrown-with-msg? js/Error #"end must be YYYY-MM"
        (c/calculate-range "2026-03" "garbage"
                           {:birth-date "1985-06-15"
                            :remuneration-history remuneration-history
                            :rate-history rate-history}))))
