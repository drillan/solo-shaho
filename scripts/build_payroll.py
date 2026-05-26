"""給与計算.xlsx サンプルジェネレータ (C方式: 生年月日から介護該当を自動判定).

本スクリプトは sample/給与計算.xlsx を生成する用途です。実運用には Web アプリ
の利用を推奨します(個人データはブラウザ内のみで保持、サーバ送信なし)。

3 シート構成:
  - 設定: 氏名・生年月日・標準報酬月額/給与額面の現行値(備忘)
  - 料率マスタ: 適用開始日 / 健保(介護なし) / 介護料率 / 厚年 / 拠出金 / 支援金 / 備考
  - 月次計算: 各行で生年月日から介護該当を判定し、健保適用料率を動的合算

支援金 (令和8年4月分から開始・労使折半) は協会けんぽ告知(健保+介護+支援金)に
合算する。納入告知額は保険料の種別ごとではなく **告知書(保険者)単位で合算して
から 1 円未満切捨て**(協会けんぽ料額表の脚注ルール)。健保と支援金の銭端数が
告知書内で合算されるため、種別ごとに切り捨てると 1 円不足する。事業主負担は
告知額からの残額方式で算出する。
"""
from datetime import date
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "sample" / "給与計算.xlsx"

# 架空のサンプル人物。ドキュメントの計算例と整合させて 1986/4/15 を採用
# (2026/4 月から介護該当判定が TRUE になり、サンプルとして判定ロジックを示せる)。
SAMPLE_NAME = "サンプル 太郎"
SAMPLE_BIRTHDATE = date(1986, 4, 15)
STD_REMUNERATION = 88000
GROSS_SALARY = 83000

# 料率履歴 (協会けんぽ東京・公式公表値ベース). 既存ファイルの D列(健保介護込み合算)
# を 健保(介護なし) + 介護料率 に分割している。各行に当時時点の全料率スナップショット。
# (適用開始日, 健保介護なし, 介護料率, 厚年, 拠出金, 支援金, 備考)
RATE_HISTORY = [
    (date(2016, 6, 1),  0.0996, 0.0158, 0.17828, 0.002,  0.0,    "2016年6月分(既存ファイル開始)"),
    (date(2016, 9, 1),  0.0996, 0.0158, 0.18182, 0.002,  0.0,    "2016年9月分・厚年改定"),
    (date(2017, 3, 1),  0.0991, 0.0165, 0.18182, 0.002,  0.0,    "2017年3月分・健保改定"),
    (date(2017, 4, 1),  0.0991, 0.0165, 0.18182, 0.0023, 0.0,    "2017年4月分・拠出金改定"),
    (date(2017, 9, 1),  0.0991, 0.0165, 0.183,   0.0023, 0.0,    "2017年9月分・厚年18.3%固定"),
    (date(2018, 3, 1),  0.099,  0.0157, 0.183,   0.0023, 0.0,    "2018年3月分・健保改定"),
    (date(2019, 3, 1),  0.099,  0.0173, 0.183,   0.0023, 0.0,    "2019年3月分・介護改定"),
    (date(2019, 5, 1),  0.099,  0.0173, 0.183,   0.0034, 0.0,    "2019年5月分・拠出金改定"),
    (date(2020, 3, 1),  0.0987, 0.0179, 0.183,   0.0034, 0.0,    "2020年3月分・健保改定"),
    (date(2020, 4, 1),  0.0987, 0.0179, 0.183,   0.0036, 0.0,    "2020年4月分・拠出金改定"),
    (date(2021, 4, 1),  0.0984, 0.018,  0.183,   0.0036, 0.0,    "2021年4月分・健保改定"),
    (date(2022, 3, 1),  0.0981, 0.0164, 0.183,   0.0036, 0.0,    "2022年3月分・健保改定"),
    (date(2023, 3, 1),  0.10,   0.0182, 0.183,   0.0036, 0.0,    "2023年3月分・健保改定"),
    (date(2024, 4, 1),  0.0998, 0.016,  0.183,   0.0036, 0.0,    "2024年4月分・健保改定"),
    (date(2025, 4, 1),  0.0991, 0.0159, 0.183,   0.0036, 0.0,    "2025年4月分・健保改定"),
    (date(2026, 4, 1),  0.0985, 0.0162, 0.183,   0.0036, 0.0,    "2026年4月納付分(3月分)・健保改定"),
    (date(2026, 5, 1),  0.0985, 0.0162, 0.183,   0.0036, 0.0023, "2026年5月納付分(4月分)・支援金開始"),
]

START_YEAR_MONTH = (2016, 6)
END_YEAR_MONTH = (2026, 12)

HEADER_FILL = PatternFill("solid", fgColor="D9E1F2")
INPUT_FILL = PatternFill("solid", fgColor="FFF2CC")
DERIVED_FILL = PatternFill("solid", fgColor="F2F2F2")
CHECK_FILL = PatternFill("solid", fgColor="E2EFDA")
HEADER_FONT = Font(bold=True)


def month_iter(start, end):
    y, m = start
    ey, em = end
    while (y, m) <= (ey, em):
        yield y, m
        m += 1
        if m == 13:
            m = 1
            y += 1


def build_settings(ws):
    ws.title = "設定"
    rows = [
        ("項目", "値", "備考"),
        ("氏名", SAMPLE_NAME, "サンプル(架空人物)"),
        ("生年月日", SAMPLE_BIRTHDATE, "YYYY/MM/DD で入力。空のままだと全期間 介護該当=FALSE"),
        ("標準報酬月額(現行)", STD_REMUNERATION, "改定があれば月次計算 E列を該当月から書換"),
        ("給与額面(現行)", GROSS_SALARY, "改定があれば月次計算 F列を該当月から書換"),
        ("対応スコープ", "健保・介護(2号)・厚年・拠出金・支援金", "雇用/労災/賞与は対象外"),
        ("行ラベル(年/月)の意味", "納付月", "例: 2026/4行 = 2026年4月に納付する分(=2026年3月分の保険料)。料率マスタの適用開始日もこの基準で記入。"),
    ]
    for r, row in enumerate(rows, start=1):
        for c, value in enumerate(row, start=1):
            cell = ws.cell(row=r, column=c, value=value)
            if r == 1:
                cell.font = HEADER_FONT
                cell.fill = HEADER_FILL
            elif c == 2:
                cell.fill = INPUT_FILL
    # B3 (生年月日) を日付書式に
    ws["B3"].number_format = "yyyy/mm/dd"
    ws.column_dimensions["A"].width = 24
    ws.column_dimensions["B"].width = 32
    ws.column_dimensions["C"].width = 56


def build_rates(wb):
    ws = wb.create_sheet("料率マスタ")
    headers = [
        "適用開始日", "健保(介護なし)", "介護料率",
        "厚年料率", "拠出金率", "支援金率", "備考",
    ]
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=c, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    for r, (eff, kenpo, kaigo, kosei, kosodate, shien, note) in enumerate(RATE_HISTORY, start=2):
        ws.cell(row=r, column=1, value=eff).number_format = "yyyy-mm-dd"
        for col, val in enumerate([kenpo, kaigo, kosei, kosodate, shien], start=2):
            ws.cell(row=r, column=col, value=val).number_format = "0.0000"
        ws.cell(row=r, column=7, value=note)

    ws.column_dimensions["A"].width = 14
    for col in ("B", "C", "D", "E", "F"):
        ws.column_dimensions[col].width = 14
    ws.column_dimensions["G"].width = 36
    ws.freeze_panes = "B2"
    return ws


def build_monthly(wb):
    ws = wb.create_sheet("月次計算")
    headers = [
        "年", "月",                                               # A, B
        "満年齢", "介護該当",                                      # C, D
        "標準報酬月額", "給与額面",                                # E, F
        "健保(介護なし)", "介護料率", "厚年料率", "拠出金率", "支援金率",  # G-K
        "健保適用料率",                                            # L (=G+IF(D,H,0))
        "健保(全額)", "支援金(全額)", "厚年(全額)", "拠出金(全額)",  # M-P (補助・小数)
        "協会けんぽ(全額)", "協会けんぽ・社員", "協会けんぽ・事業主",  # Q, R, S (健保+介護+支援金 告知)
        "厚年(全額・円)", "厚年・社員", "厚年・事業主",              # T, U, V
        "拠出金(全額・円)", "拠出金・事業主",                        # W, X
        "社員天引き合計", "事業主負担合計", "法定福利費(納付額)",     # Y, Z, AA
        "差引支給額",                                              # AB
        "通知額", "通知額差分",                                    # AC, AD
    ]
    for c, h in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=c, value=h)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

    # 介護該当の定義: 40歳誕生日の前日が属する月から、65歳誕生日の前日が属する月の前月まで
    #   ⇔ 40歳誕生日 - 1日 ≦ 対象月末日 < 65歳誕生日 - 1日
    bday_ref = "設定!$B$3"

    def kaigo_formula(r):
        eom = f"EOMONTH(DATE(A{r},B{r},1),0)"
        b40 = f"DATE(YEAR({bday_ref})+40,MONTH({bday_ref}),DAY({bday_ref}))-1"
        b65 = f"DATE(YEAR({bday_ref})+65,MONTH({bday_ref}),DAY({bday_ref}))-1"
        return f"=IF({bday_ref}=\"\",FALSE,AND({eom}>={b40},{eom}<{b65}))"

    def age_formula(r):
        eom = f"EOMONTH(DATE(A{r},B{r},1),0)"
        return f'=IF({bday_ref}="","",DATEDIF({bday_ref},{eom},"Y"))'

    for i, (year, month) in enumerate(month_iter(START_YEAR_MONTH, END_YEAR_MONTH)):
        r = i + 2
        # 入力 (黄)
        ws.cell(row=r, column=1, value=year)
        ws.cell(row=r, column=2, value=month)
        ws.cell(row=r, column=5, value=STD_REMUNERATION)
        ws.cell(row=r, column=6, value=GROSS_SALARY)

        # 派生 (グレー)
        ws.cell(row=r, column=3, value=age_formula(r))
        ws.cell(row=r, column=4, value=kaigo_formula(r))

        # 料率参照 (XLOOKUP・降順検索で「一致または直前」)
        date_expr = f"DATE(A{r},B{r},1)"
        for col_idx, master_col in [(7, "B"), (8, "C"), (9, "D"), (10, "E"), (11, "F")]:
            ws.cell(row=r, column=col_idx,
                    value=f"=XLOOKUP({date_expr},料率マスタ!$A:$A,料率マスタ!${master_col}:${master_col},,-1,-1)")

        # 健保適用料率 (介護該当なら介護を足す)
        ws.cell(row=r, column=12, value=f"=G{r}+IF(D{r},H{r},0)")

        # 全額 (補助列・小数を含む。M+N が協会けんぽ告知、O+P が年金機構告知)
        ws.cell(row=r, column=13, value=f"=E{r}*L{r}")              # M 健保(介護込み)
        ws.cell(row=r, column=14, value=f"=E{r}*K{r}")              # N 支援金
        ws.cell(row=r, column=15, value=f"=E{r}*I{r}")              # O 厚年
        ws.cell(row=r, column=16, value=f"=ROUNDDOWN(E{r}*J{r},0)")  # P 拠出金 (事業主のみ・全額切捨て)

        # 協会けんぽ告知 (健保+介護+支援金): 合算してから 1 円未満切捨て。
        # ROUND(...,2) は float 由来の銭端数を除去して整数境界での誤切捨てを防ぐ。
        ws.cell(row=r, column=17, value=f"=ROUNDDOWN(ROUND(M{r}+N{r},2),0)")  # Q 全額(告知額)
        ws.cell(row=r, column=18,
                value=f"=INT(M{r}/2)+IF(MOD(M{r},2)>1,1,0)+INT(N{r}/2)+IF(MOD(N{r},2)>1,1,0)")  # R 社員(折半額の欄ごとに50銭超切上げの和)
        ws.cell(row=r, column=19, value=f"=Q{r}-R{r}")             # S 事業主(残額方式)

        # 厚年告知 (厚年全額は標準報酬月額が1000円単位ゆえ常に整数円)
        ws.cell(row=r, column=20, value=f"=ROUNDDOWN(O{r},0)")     # T 全額
        ws.cell(row=r, column=21, value=f"=INT(O{r}/2)+IF(MOD(O{r},2)>1,1,0)")  # U 社員
        ws.cell(row=r, column=22, value=f"=T{r}-U{r}")            # V 事業主(残額方式)

        # 子ども・子育て拠出金 (事業主全額)
        ws.cell(row=r, column=23, value=f"=P{r}")                 # W 全額・円
        ws.cell(row=r, column=24, value=f"=W{r}")                 # X 事業主

        # 集計
        ws.cell(row=r, column=25, value=f"=R{r}+U{r}")            # Y 社員天引き合計
        ws.cell(row=r, column=26, value=f"=S{r}+V{r}+X{r}")       # Z 事業主負担合計
        ws.cell(row=r, column=27, value=f"=Q{r}+T{r}+W{r}")       # AA 納付額(=各告知額の和=Y+Z)

        # 差引支給額
        ws.cell(row=r, column=28, value=f"=F{r}-Y{r}")            # AB

        # 通知額差分 (通知額 AC は手入力)
        ws.cell(row=r, column=30, value=f'=IF(AC{r}="","",AA{r}-AC{r})')  # AD

    # 列幅
    widths = {
        "A": 7, "B": 5, "C": 8, "D": 9,
        "E": 13, "F": 11,
        "G": 14, "H": 11, "I": 11, "J": 11, "K": 11,
        "L": 13,
        "M": 13, "N": 13, "O": 13, "P": 13,
        "Q": 15, "R": 16, "S": 16,
        "T": 13, "U": 12, "V": 13,
        "W": 14, "X": 14,
        "Y": 14, "Z": 14, "AA": 16,
        "AB": 12, "AC": 11, "AD": 11,
    }
    for col_letter, w in widths.items():
        ws.column_dimensions[col_letter].width = w

    last_row = ws.max_row
    rate_cols = (7, 8, 9, 10, 11, 12)
    money_cols = (5, 6, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30)
    input_letters = ("A", "B", "E", "F", "AC")
    derived_letters = ("C", "D", "G", "H", "I", "J", "K", "L")
    check_letters = ("AD",)

    for r in range(2, last_row + 1):
        for c in rate_cols:
            ws.cell(row=r, column=c).number_format = "0.0000"
        for c in money_cols:
            ws.cell(row=r, column=c).number_format = "#,##0"
        for letter in input_letters:
            ws[f"{letter}{r}"].fill = INPUT_FILL
        for letter in derived_letters:
            ws[f"{letter}{r}"].fill = DERIVED_FILL
        for letter in check_letters:
            ws[f"{letter}{r}"].fill = CHECK_FILL

    ws.freeze_panes = "C2"
    legend = ws.cell(row=1, column=31,
                     value="凡例: 黄=入力 / 灰=自動算出 / 緑=検算  ※介護該当は設定!B3 の生年月日から自動判定  ※納付額は告知書(協会けんぽ=健保+介護+支援金 / 年金機構=厚年+拠出金)単位で合算後切捨て")
    legend.font = Font(italic=True, size=9)
    return ws


def main():
    wb = Workbook()
    build_settings(wb.active)
    build_rates(wb)
    build_monthly(wb)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUTPUT_PATH)
    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
