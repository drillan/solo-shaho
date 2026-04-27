(ns solo-shaho.payroll.rates-data-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.types :as t]
            ["fs" :as fs]
            ["path" :as path]))

;; node-test の `out/test.js` から見て、プロジェクトルートは 2 階層上。
;; web-cljs/out/test.js → web-cljs/ → solo-shaho/ → web/src/lib/data/rates.json
(def rates-json-path
  (path/resolve js/__dirname ".." ".." "web" "src" "lib" "data" "rates.json"))

(defn- load-rates []
  (-> (fs/readFileSync rates-json-path "utf8")
      js/JSON.parse
      (js->clj :keywordize-keys true)
      t/kebabify-keys      ;; camelCase → kebab-case 変換（rates.json は TS 互換のため camelCase）
      :history))

(deftest rates-json-loads-and-validates
  (let [history (load-rates)]
    (is (sequential? history))
    (is (pos? (count history)))
    (testing "validate-rate-history が例外を投げない"
      (is (some? (t/validate-rate-history history))))))

(deftest rates-history-chronological-order
  (let [history (load-rates)
        validated (t/validate-rate-history history)]
    (is (= (mapv :effective-from validated)
           (sort (mapv :effective-from validated)))
        "rates.json の history は effective-from の昇順でなければならない")))
