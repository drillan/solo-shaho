# Excel Fixture (gitignored)

`給与計算_v2.xlsx` から計算結果を抽出して、TS 計算エンジンの回帰テストに
使用する fixture を生成するためのツール。

個人データを含むため `excel-snapshot.json` は gitignore 対象。
ローカル環境でのみ生成・使用する。

## 使い方

```sh
# プロジェクトルートで
uv run python web/tests/fixtures/extract_from_excel.py
# → web/tests/fixtures/excel-snapshot.json が生成される

# 抽出データを使った回帰テストの実行
cd web && pnpm test tests/fixtures/excel-snapshot.test.ts
```
