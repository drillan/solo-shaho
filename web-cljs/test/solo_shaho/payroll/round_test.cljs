(ns solo-shaho.payroll.round-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.round :as r]))

(deftest split-half-employee-50sen-or-less-floor
  (testing "M=10093.6 (totalSen=1009360) → 5047 (1円ズレ問題のキー数値)"
    (is (= 5047 (r/split-half-employee 1009360))))
  (testing "M=10094.4 (sen=40 < 50) → 5047"
    (is (= 5047 (r/split-half-employee 1009440))))
  (testing "M=10095.0 (sen=50, 切捨て) → 5047"
    (is (= 5047 (r/split-half-employee 1009500))))
  (testing "M=10095.2 (sen=60 > 50) → 5048"
    (is (= 5048 (r/split-half-employee 1009520))))
  (testing "整数銭・偶数 M=16104 → 8052"
    (is (= 8052 (r/split-half-employee 1610400)))))

(deftest split-half-employee-odd-totalsen-boundary
  (testing "totalSen=10101: M=101.01, M/2=50.505, MOD(M,2)=1.01>1 → 51"
    (is (= 51 (r/split-half-employee 10101))))
  (testing "totalSen=10093: M=100.93, M/2=50.465, MOD(M,2)=0.93≤1 → 50"
    (is (= 50 (r/split-half-employee 10093)))))

(deftest split-half-employer-residue
  (testing "M=10093.6 で社員 5047 → 事業主 5046 (合計 = ROUNDDOWN(M))"
    (is (= 5046 (r/split-half-employer 1009360 5047)))
    (is (= 10093 (+ 5047 5046))))
  (testing "M=16104 で社員 8052 → 事業主 8052"
    (is (= 8052 (r/split-half-employer 1610400 8052)))))

(deftest full-down-to-yen
  (testing "M=316.8 → 316 (拠出金の例)"
    (is (= 316 (r/full-down-to-yen 31680))))
  (testing "M=316.0 → 316"
    (is (= 316 (r/full-down-to-yen 31600))))
  (testing "M=316.99 → 316"
    (is (= 316 (r/full-down-to-yen 31699)))))
