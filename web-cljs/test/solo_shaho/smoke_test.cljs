(ns solo-shaho.smoke-test
  (:require [cljs.test :refer-macros [deftest is]]))

(deftest smoke-truthy
  (is (= 2 (+ 1 1))))
