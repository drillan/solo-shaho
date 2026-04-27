(ns solo-shaho.payroll.rates-test
  (:require [cljs.test :refer-macros [deftest is]]
            [solo-shaho.payroll.rates :as r]))

(def rate-history
  [{:effective-from "2025-04-01" :kenpo-base 9910 :kaigo 1590 :kosei 18300 :kosodate 360 :shien 0 :note ""}
   {:effective-from "2026-04-01" :kenpo-base 9850 :kaigo 1620 :kosei 18300 :kosodate 360 :shien 0 :note ""}
   {:effective-from "2026-05-01" :kenpo-base 9850 :kaigo 1620 :kosei 18300 :kosodate 360 :shien 230 :note ""}])

(deftest applies-most-recent
  (is (= 230 (:shien (r/find-applicable-rate "2026-06" rate-history)))))

(deftest applies-rate-before-shien-introduction
  (is (= 0 (:shien (r/find-applicable-rate "2026-04" rate-history)))))

(deftest throws-when-before-history
  (is (thrown-with-msg? js/Error #"No applicable 料率"
        (r/find-applicable-rate "2024-01" rate-history))))
