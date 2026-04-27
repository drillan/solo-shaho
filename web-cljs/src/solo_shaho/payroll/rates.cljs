(ns solo-shaho.payroll.rates
  (:require [solo-shaho.payroll.lookup :as lookup]))

(defn find-applicable-rate
  "year-month に適用される料率エントリを返す。"
  [year-month history]
  (lookup/find-applicable-entry year-month history "料率"))
