"""solo-shaho 独立検算スクリプト.

`build_payroll.py` の `RATE_HISTORY` を再利用し、Excel 数式とは独立に
Python で社会保険料を再計算して、

1. 既知シナリオ(2026/4・2026/5 の納付額)が期待値と一致するか
2. 納付額が告知書(保険者)単位の合算丸めと一致するか(全 127 ヶ月 × 介護 ON/OFF)
3. 介護該当の境界判定(40 歳/65 歳到達月)が法定どおりか

を検証する。料率改定や数式変更のリグレッションテストとして使う想定。

実行:
    uv run scripts/verify_payroll.py
"""
from __future__ import annotations

import sys
from datetime import date, timedelta
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


def employee_share_sen(total_sen: int) -> int:
    """折半額の 50 銭超切上げ・50 銭以下切捨て(銭単位整数で計算).

    web 版 splitHalfEmployee と bit-perfect に一致する:
        floor(total_sen / 200) + (1 if total_sen % 200 > 100 else 0)
    50 銭ちょうど(total_sen % 200 == 100)は切捨て側に含まれる。
    """
    return total_sen // 200 + (1 if total_sen % 200 > 100 else 0)


def calc_month(year: int, month: int, kaigo: bool, std: int = 88000, salary: int = 83000) -> dict:
    """1 ヶ月分の社会保険料を告知書(保険者)単位の合算丸めで計算.

    納入告知額は「種別ごとに切捨て」ではなく「告知書(保険者)単位で合算してから
    1 円未満切捨て」(協会けんぽ料額表の脚注)。協会けんぽ告知に健保(介護込み)と
    支援金が同居するため、両者の銭端数が合算されてから切り捨てられる。
    """
    d = date(year, month, 1)
    kenpo, kaigo_rate, kosei, kosodate, shien = lookup_rates(d)
    applied = kenpo + (kaigo_rate if kaigo else 0)

    # 各保険料の全額(銭単位整数)。float 料率由来の端数を round で除去する。
    kenpo_sen = round(std * applied * 100)       # 健保(介護込み)
    kosei_sen = round(std * kosei * 100)         # 厚年
    kosodate_sen = round(std * kosodate * 100)   # 子ども・子育て拠出金(事業主全額)
    shien_sen = round(std * shien * 100)         # 子ども・子育て支援金

    # 社員負担は折半額の欄ごとに 50 銭超切上げ(拠出金は社員負担なし)
    kenpo_emp = employee_share_sen(kenpo_sen)
    kosei_emp = employee_share_sen(kosei_sen)
    shien_emp = employee_share_sen(shien_sen)

    # 納入告知額 = 告知書(保険者)単位で合算してから 1 円未満切捨て
    kyokai_notified = (kenpo_sen + shien_sen) // 100      # 協会けんぽ(健保+介護+支援金)
    nenkin_notified = (kosei_sen + kosodate_sen) // 100   # 年金機構(厚年+拠出金)

    # 事業主負担はグループごとの残額方式(告知額 − 社員負担)
    kyokai_emp = kenpo_emp + shien_emp
    nenkin_emp = kosei_emp
    kyokai_employer = kyokai_notified - kyokai_emp
    nenkin_employer = nenkin_notified - nenkin_emp

    X = kyokai_emp + nenkin_emp            # 社員天引き合計
    Y = kyokai_employer + nenkin_employer  # 事業主負担合計
    Z = kyokai_notified + nenkin_notified  # 法定福利費(納付額 = 通知額)

    return {
        "全額_sen": {"健保": kenpo_sen, "厚年": kosei_sen, "拠出金": kosodate_sen, "支援金": shien_sen},
        "告知額": {"協会けんぽ": kyokai_notified, "年金機構": nenkin_notified},
        "社員": {"協会けんぽ": kyokai_emp, "厚年": kosei_emp},
        "事業主": {"協会けんぽ": kyokai_employer, "年金機構": nenkin_employer},
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
        (2026, 5, True,  88000, 26716, "介護込み・支援金開始(協会けんぽ群=健保+支援金 合算丸め)"),
        (2026, 5, False, 88000, 25290, "介護なし・支援金開始(健保に銭端数なし→差なし)"),
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


def test_grouping_invariant() -> int:
    """全期間 × 介護 ON/OFF で告知書単位の合算丸めが成立するか.

    (1) 納付額 Z が告知書(保険者)単位の合算丸め(協会けんぽ・年金機構)と一致する。
    (2) 種別ごと切捨て(Σ⌊T_k⌋)との差が、各告知書内の銭端数和が 100 銭以上になる
        グループ数に一致する(その分だけ種別丸めは納付額を過小評価する)。
    """
    fails = 0
    checked = 0
    bumped = 0
    for kaigo in (True, False):
        for y, m in month_iter(START_YEAR_MONTH, END_YEAR_MONTH):
            r = calc_month(y, m, kaigo)
            s = r["全額_sen"]
            grouped = (s["健保"] + s["支援金"]) // 100 + (s["厚年"] + s["拠出金"]) // 100
            per_type = sum(v // 100 for v in s.values())
            kyokai_frac = s["健保"] % 100 + s["支援金"] % 100
            nenkin_frac = s["厚年"] % 100 + s["拠出金"] % 100
            expected_bump = (1 if kyokai_frac >= 100 else 0) + (1 if nenkin_frac >= 100 else 0)
            checked += 1
            if r["Z"] != grouped:
                fails += 1
                print(f"  [NG] {y}/{m:02} 介護={kaigo}: Z={r['Z']} != 合算丸め {grouped}")
            if grouped - per_type != expected_bump:
                fails += 1
                print(
                    f"  [NG] {y}/{m:02} 介護={kaigo}: 種別丸めとの差={grouped - per_type} "
                    f"期待={expected_bump} (協会端数和={kyokai_frac}銭, 年金端数和={nenkin_frac}銭)"
                )
            if expected_bump:
                bumped += 1
    marker = "OK" if fails == 0 else "NG"
    print(f"  [{marker}] {checked}件検証 / うち {bumped}件で種別丸めから+1円(告知書内の銭端数和≥100銭)")
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

    print("\n[2] 告知書単位の合算丸め(種別ごと切捨てとの差を検証)")
    f2 = test_grouping_invariant()

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
