(ns solo-shaho.payroll.kaigo-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.kaigo :as k]))

(deftest is-kaigo-applicable-nil-or-empty
  (is (false? (k/kaigo-applicable? nil 2026 4)))
  (is (false? (k/kaigo-applicable? "" 2026 4))))

(deftest is-kaigo-applicable-throws-on-bad-format
  (is (thrown-with-msg? js/Error #"birthDate must be YYYY-MM-DD"
        (k/kaigo-applicable? "garbage" 2026 4))))

(deftest is-kaigo-applicable-true-when-in-range
  (testing "1985-06-15 生まれ → 2026-04 月末 は [40歳誕生日前日, 65歳誕生日前日) に入る"
    (is (true? (k/kaigo-applicable? "1985-06-15" 2026 4)))))

(deftest is-kaigo-applicable-false-before-40th-eve
  (testing "1985-06-15 生まれ → 2025-05 月末 (= 2025-05-31) は 40歳誕生日前日 (2025-06-14) より前 → false"
    (is (false? (k/kaigo-applicable? "1985-06-15" 2025 5)))))

(deftest is-kaigo-applicable-true-on-40th-eve
  (testing "1985-06-15 生まれ → 2025-06 月末 (= 2025-06-30) は 40歳誕生日前日以降 → true"
    (is (true? (k/kaigo-applicable? "1985-06-15" 2025 6)))))

(deftest is-kaigo-applicable-false-from-65th-eve
  (testing "1985-06-15 生まれ → 2050-06 月末 (= 2050-06-30) は 65歳誕生日前日 (2050-06-14) 以降 → false"
    (is (false? (k/kaigo-applicable? "1985-06-15" 2050 6)))))

(deftest calculate-age-pre-birthday
  (testing "1985-06-15 生まれ、2026-04 月末 (= 2026-04-30) は誕生日前 → year差 - 1 = 40"
    (is (= 40 (k/calculate-age "1985-06-15" 2026 4)))))

(deftest calculate-age-post-birthday
  (testing "1985-06-15 生まれ、2026-07 月末 (= 2026-07-31) は誕生日後 → year差 = 41"
    (is (= 41 (k/calculate-age "1985-06-15" 2026 7)))))

(deftest calculate-age-on-birthday-month-and-day
  (testing "誕生日と末日の関係: 1985-06-15 生まれ、2026-06 月末 (= 2026-06-30) は誕生日後 → 41"
    (is (= 41 (k/calculate-age "1985-06-15" 2026 6)))))
