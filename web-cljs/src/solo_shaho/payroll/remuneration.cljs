(ns solo-shaho.payroll.remuneration
  (:require [solo-shaho.payroll.lookup :as lookup]))

(defn find-applicable-remuneration
  "year-month に適用される報酬月額エントリを返す。"
  [year-month history]
  (lookup/find-applicable-entry year-month history "報酬"))
