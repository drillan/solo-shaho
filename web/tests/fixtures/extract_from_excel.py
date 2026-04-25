"""給与計算_v2.xlsx から計算結果を JSON fixture として抽出する.

個人データを含むため出力ファイルは gitignore 対象。
"""
import json
from datetime import date, datetime
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[3]
EXCEL = ROOT / "給与計算_v2.xlsx"
OUTPUT = Path(__file__).parent / "excel-snapshot.json"


def main() -> None:
    if not EXCEL.exists():
        raise SystemExit(f"Excel ファイルが見つかりません: {EXCEL}")

    wb = load_workbook(EXCEL, data_only=True)
    settings = wb["設定"]
    monthly = wb["月次計算"]

    birth_cell = settings["B3"].value
    birth = (
        birth_cell.strftime("%Y-%m-%d")
        if isinstance(birth_cell, date)
        else (birth_cell or "")
    )

    cases = []
    for row in monthly.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            continue
        year, month = int(row[0]), int(row[1])
        std = int(row[4])
        gross = int(row[5])
        cases.append(
            {
                "year": year,
                "month": month,
                "input": {
                    "stdRemuneration": std,
                    "grossSalary": gross,
                    "birthDate": birth,
                },
                "expected": {
                    "isKaigoApplicable": bool(row[3]),
                    "kenpoTotal": int(row[12]) if row[12] is not None else None,
                    "koseiTotal": int(row[13]) if row[13] is not None else None,
                    "kosodateTotal": int(row[14]) if row[14] is not None else None,
                    "shienTotal": int(row[15]) if row[15] is not None else None,
                    "kenpoEmployee": int(row[16]) if row[16] is not None else None,
                    "koseiEmployee": int(row[17]) if row[17] is not None else None,
                    "shienEmployee": int(row[18]) if row[18] is not None else None,
                    "kenpoEmployer": int(row[19]) if row[19] is not None else None,
                    "koseiEmployer": int(row[20]) if row[20] is not None else None,
                    "kosodateEmployer": int(row[21]) if row[21] is not None else None,
                    "shienEmployer": int(row[22]) if row[22] is not None else None,
                    "employeeDeductionTotal": int(row[23]) if row[23] is not None else None,
                    "employerBurdenTotal": int(row[24]) if row[24] is not None else None,
                    "payableTotal": int(row[25]) if row[25] is not None else None,
                    "netSalary": int(row[26]) if row[26] is not None else None,
                },
            }
        )

    OUTPUT.write_text(
        json.dumps(
            {
                "extractedAt": datetime.now().isoformat(),
                "sourceFile": str(EXCEL.relative_to(ROOT)),
                "birthDate": birth,
                "cases": cases,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT} with {len(cases)} cases")


if __name__ == "__main__":
    main()
