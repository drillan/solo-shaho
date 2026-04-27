(ns solo-shaho.payroll.types
  (:require [clojure.string :as str]))

(def CURRENT-SCHEMA-VERSION 1)

(def DATE-RE #"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
(def MONTH-RE #"^\d{4}-(0[1-9]|1[0-2])$")

(defn- camel->kebab [s]
  (-> s
      (str/replace #"([a-z0-9])([A-Z])" "$1-$2")
      str/lower-case))

(defn kebabify-keys
  "外部 JSON（TS 互換の camelCase キー）を CLJS 流の kebab-case に変換する。
   Map / sequential を再帰的にたどる。リーフ値は変更しない。"
  [x]
  (cond
    (map? x) (into {} (for [[k v] x]
                        [(keyword (camel->kebab (name k))) (kebabify-keys v)]))
    (sequential? x) (mapv kebabify-keys x)
    :else x))

(defn- non-negative-int? [v]
  (and (number? v) (integer? v) (>= v 0)))

(defn- raise! [msg]
  (throw (ex-info msg {:error/type :validation})))

(defn- validate-rate-entry [e index]
  (when-not (map? e)
    (raise! (str "rateHistory[" index "] must be an object")))
  (let [{:keys [effective-from kenpo-base kaigo kosei kosodate shien note]} e]
    (when-not (and (string? effective-from) (re-matches DATE-RE effective-from))
      (raise! (str "rateHistory[" index "].effectiveFrom invalid: " effective-from)))
    (doseq [[k v] [[:kenpo-base kenpo-base] [:kaigo kaigo] [:kosei kosei]
                   [:kosodate kosodate] [:shien shien]]]
      (when-not (non-negative-int? v)
        (raise! (str "rateHistory[" index "]." (name k)
                     " must be non-negative integer, got: " (pr-str v)))))
    (when-not (string? note)
      (raise! (str "rateHistory[" index "].note must be a string")))
    {:effective-from effective-from
     :kenpo-base kenpo-base
     :kaigo kaigo
     :kosei kosei
     :kosodate kosodate
     :shien shien
     :note note}))

(defn validate-rate-history
  "unknown を RateEntry の vector として厳密に検証する。
   不正値は ex-info で例外送出（フォールバック禁止）。"
  [input]
  (when-not (sequential? input)
    (raise! "rateHistory must be an array"))
  (mapv validate-rate-entry input (range)))

(defn- validate-remuneration-entry [e index]
  (when-not (map? e)
    (raise! (str "remunerationHistory[" index "] must be an object")))
  (let [{:keys [effective-from std-remuneration gross-salary note]} e]
    (when-not (and (string? effective-from) (re-matches DATE-RE effective-from))
      (raise! (str "remunerationHistory[" index "].effectiveFrom invalid: " effective-from)))
    (when-not (non-negative-int? std-remuneration)
      (raise! (str "remunerationHistory[" index "].stdRemuneration must be non-negative integer")))
    (when-not (zero? (mod std-remuneration 1000))
      (raise! (str "remunerationHistory[" index "].stdRemuneration must be a multiple of 1000")))
    (when-not (non-negative-int? gross-salary)
      (raise! (str "remunerationHistory[" index "].grossSalary must be non-negative integer")))
    (when-not (string? note)
      (raise! (str "remunerationHistory[" index "].note must be a string")))
    {:effective-from effective-from
     :std-remuneration std-remuneration
     :gross-salary gross-salary
     :note note}))

(defn- validate-monthly-note [v key]
  (when-not (map? v)
    (raise! (str "monthlyNotes[" key "] must be an object")))
  (cond-> {}
    (contains? v :notified-amount)
    (assoc :notified-amount
           (let [n (:notified-amount v)]
             (when-not (non-negative-int? n)
               (raise! (str "monthlyNotes[" key "].notifiedAmount must be non-negative integer")))
             n))
    (contains? v :memo)
    (assoc :memo
           (let [m (:memo v)]
             (when-not (string? m)
               (raise! (str "monthlyNotes[" key "].memo must be a string")))
             m))))

(defn- normalize-birth-date [v]
  (cond
    (or (nil? v) (= v "")) nil
    (and (string? v) (re-matches DATE-RE v)) v
    :else (raise! "profile.birthDate must be null or YYYY-MM-DD")))

(defn validate-app-state
  "unknown を AppState として厳密に検証する。
   永続化・CSV インポートなど全入口で利用する想定。
   不正値は ex-info で例外送出（フォールバック禁止）。"
  [input]
  (when-not (map? input)
    (raise! "AppState must be an object"))
  (let [{:keys [schema-version profile remuneration-history monthly-notes]} input]
    (when-not (= schema-version CURRENT-SCHEMA-VERSION)
      (raise! (str "Unsupported schemaVersion: " (pr-str schema-version)
                   " (expected " CURRENT-SCHEMA-VERSION ")")))
    (when-not (map? profile)
      (raise! "profile must be an object"))
    (when-not (string? (:name profile))
      (raise! "profile.name must be a string"))
    (let [birth-date (normalize-birth-date (:birth-date profile))]
      (when-not (sequential? remuneration-history)
        (raise! "remunerationHistory must be an array"))
      (when-not (map? monthly-notes)
        (raise! "monthlyNotes must be an object"))
      (let [hist (mapv validate-remuneration-entry remuneration-history (range))
            notes (into {} (for [[k v] monthly-notes]
                             (do
                               (when-not (re-matches MONTH-RE k)
                                 (raise! (str "Invalid monthlyNotes key: " k)))
                               [k (validate-monthly-note v k)])))]
        {:schema-version CURRENT-SCHEMA-VERSION
         :profile {:name (:name profile) :birth-date birth-date}
         :remuneration-history hist
         :monthly-notes notes}))))
