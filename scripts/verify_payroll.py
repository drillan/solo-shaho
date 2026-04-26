"""solo-shaho 独立検算スクリプト.

`build_payroll.py` の `RATE_HISTORY` を再利用し、Excel 数式とは独立に
Python で社会保険料を再計算して、

1. 既知シナリオ(2026/4・2026/5 の納付額)が期待値と一致するか
2. 折半額×2 と納付額の構造的なズレがないか(全 127 ヶ月 × 介護 ON/OFF)
3. 介護該当の境界判定(40 歳/65 歳到達月)が法定どおりか

を検証する。料率改定や数式変更のリグレッションテストとして使う想定。

実行:
    uv run scripts/verify_payroll.py
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
from math import floor
from pathlib import Path

# build_payroll.py から RATE_HISTORY を共有(単一の真実)
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_payroll import (  # noqa: E402
    END_YEAR_MONTH,
    RATE_HISTORY,
    START_YEAR_MONTH,
)


def lookup_rates(target: date) -> tuple[float, float, float, float, float]:
    """料率マスタから「対象日以下で最も新しい」料率を返す."""
    best = None
    for row in RATE_HISTORY:
        if row[0] <= target:
            best = row
    if best is None:
        raise ValueError(f"No rate applicable for {target}")
    _, kenpo, kaigo, kosei, kosodate, shien, _ = best
    return kenpo, kaigo, kosei, kosodate, shien


def employee_share(total: float) -> int:
    """50 銭以下切捨て・50 銭超切上げ.

    `INT(x/2) + IF(MOD(x,2)>1, 1, 0)` の Python 実装。
    """
    return int(total // 2) + (1 if (total % 2) > 1 else 0)


def calc_month(year: int, month: int, kaigo: bool, std: int = 88000, salary: int = 83000) -> dict:
    """1 ヶ月分の社会保険料を計算."""
    d = date(year, month, 1)
    kenpo, kaigo_rate, kosei, kosodate, shien = lookup_rates(d)
    applied = kenpo + (kaigo_rate if kaigo else 0)

    M = std * applied              # 健保(全額)
    N = std * kosei                # 厚年(全額)
    O = floor(std * kosodate)      # 拠出金(全額・整数)
    P = std * shien                # 支援金(全額)

    Q = employee_share(M)          # 健保社員
    R = employee_share(N)          # 厚年社員
    S = employee_share(P)          # 支援金社員

    T = floor(M) - Q               # 健保事業主(残額方式)
    U = floor(N) - R               # 厚年事業主
    V = O                          # 拠出金事業主(全額)
    W = floor(P) - S               # 支援金事業主

    X = Q + R + S                  # 社員天引き合計
    Y = T + U + V + W              # 事業主負担合計
    Z = X + Y                      # 法定福利費(納付額)

    return {
        "全額": {"健保": M, "厚年": N, "拠出金": O, "支援金": P},
        "社員": {"健保": Q, "厚年": R, "支援金": S},
        "事業主": {"健保": T, "厚年": U, "拠出金": V, "支援金": W},
        "X": X, "Y": Y, "Z": Z,
        "差引支給額": salary - X,
    }


def is_kaigo_target(birthday: date, year: int, month: int) -> bool:
    """対象月の介護該当判定. 40 歳誕生日の前日が属する月〜65 歳誕生日の前日が属する月の前月."""
    next_year = year + (1 if month == 12 else 0)
    next_month = (month % 12) + 1
    eom = date(next_year, next_month, 1) - timedelta(days=1)
    b40 = date(birthday.year + 40, birthday.month, birthday.day) - timedelta(days=1)
    b65 = date(birthday.year + 65, birthday.month, birthday.day) - timedelta(days=1)
    return b40 <= eom < b65


def month_iter(start: tuple[int, int], end: tuple[int, int]):
    y, m = start
    ey, em = end
    while (y, m) <= (ey, em):
        yield y, m
        m += 1
        if m == 13:
            m, y = 1, y + 1


# ---------------------------------------------------------------------------
# テストケース
# ---------------------------------------------------------------------------

def test_known_scenarios() -> int:
    """既知の 4 シナリオで納付額(Z)が期待値どおりか."""
    cases = [
        # (year, month, kaigo, std, expected_Z, 備考)
        (2026, 4, True,  88000, 26513, "介護込み・支援金前(通知額と一致)"),
        (2026, 4, False, 88000, 25088, "介護なし・支援金前"),
        (2026, 5, True,  88000, 26715, "介護込み・支援金開始"),
        (2026, 5, False, 88000, 25290, "介護なし・支援金開始"),
    ]
    fails = 0
    for year, month, kaigo, std, expected, note in cases:
        actual = calc_month(year, month, kaigo, std)["Z"]
        ok = actual == expected
        marker = "OK" if ok else "NG"
        print(f"  [{marker}] {year}/{month:02} 介護={kaigo} std={std:,}: Z={actual:,} (期待 {expected:,})  {note}")
        if not ok:
            fails += 1
    return fails


def test_structural_integrity() -> int:
    """全期間 × 介護 ON/OFF で X+Y == ROUNDDOWN(各全額) の合計 が成立するか."""
    fails = 0
    checked = 0
    for kaigo in (True, False):
        for y, m in month_iter(START_YEAR_MONTH, END_YEAR_MONTH):
            r = calc_month(y, m, kaigo)
            t = r["全額"]
            expected = floor(t["健保"]) + floor(t["厚年"]) + t["拠出金"] + floor(t["支援金"])
            checked += 1
            if r["Z"] != expected:
                fails += 1
                print(f"  [NG] {y}/{m:02} 介護={kaigo}: Z={r['Z']} expected={expected}")
    marker = "OK" if fails == 0 else "NG"
    print(f"  [{marker}] {checked}件中 {fails}件 不整合(折半額×2 と納付額のズレ)")
    return fails


def test_kaigo_boundaries() -> int:
    """介護該当境界(40 歳・65 歳到達月)が法定どおりか."""
    # 例: 1986/4/15 生まれ → 40 歳到達は 2026/4(誕生日前日 4/14 が属する月)
    bday = date(1986, 4, 15)
    cases = [
        (2026, 3,  False, "40 歳到達前月"),
        (2026, 4,  True,  "40 歳到達月(誕生日前日 4/14 を含む月)"),
        (2050, 12, True,  "64 歳途中"),
        (2051, 3,  True,  "65 歳到達前月"),
        (2051, 4,  False, "65 歳到達月(介護対象外に切替)"),
    ]
    fails = 0
    for y, m, expected, note in cases:
        actual = is_kaigo_target(bday, y, m)
        ok = actual == expected
        marker = "OK" if ok else "NG"
        print(f"  [{marker}] {y}/{m:02}: 介護該当={actual} (期待 {expected})  {note}")
        if not ok:
            fails += 1
    return fails


def main() -> int:
    print("=" * 64)
    print("solo-shaho 独立検算")
    print("=" * 64)

    print("\n[1] 既知シナリオ検証")
    f1 = test_known_scenarios()

    print("\n[2] 構造的整合性(折半額×2 と納付額のズレ無し)")
    f2 = test_structural_integrity()

    print("\n[3] 介護該当境界判定(生年月日 1986/4/15)")
    f3 = test_kaigo_boundaries()

    total = f1 + f2 + f3
    print("\n" + "=" * 64)
    if total == 0:
        print("All tests passed.")
        return 0
    print(f"{total} test(s) failed.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
