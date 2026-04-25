# solo-shaho ドキュメント

**マイクロ法人・個人事業主向け** 社会保険料の月次計算ブック `給与計算.xlsx` の仕様書と運用ノートです。
社労士や SaaS に頼らずに月次の社会保険料計算を完結させるための、Excel + Python スクリプトでの自作運用を扱います。
ブック構成、計算ロジック、料率制度の知識、運用手順をまとめています。

## 主な構成

```{toctree}
:maxdepth: 2
:caption: 目次

overview
sheets
logic
rates
semantics
accounting
operation
limitations
reference
```

## 対象読者

- マイクロ法人・1 人法人の経営者(自分で社会保険料計算を回したい)
- 個人事業主から法人成りしたばかりで、SaaS 給与計算を導入する前の段階の方
- このブックを保守・更新する担当者
- 月次の社会保険料計算ロジックを検証したい経理担当者
- 同種のブックを別の事業者向けに作り直す技術者

## クイックスタート

```{code-block} bash
:caption: 環境セットアップ

uv sync --group docs
```

```{code-block} bash
:caption: Excel 再生成

uv run scripts/build_payroll.py
```

```{code-block} bash
:caption: ドキュメント HTML ビルド

uv run --group docs sphinx-build -b html docs docs/_build/html
```

## このドキュメントが扱う範囲

- ✅ 健保 / 介護(2号) / 厚年 / 子育て拠出金 / 子育て支援金
- ✅ 標準報酬月額 1 等級分(対象社員 1 名)の月次計算
- ❌ 賞与・雇用保険・労災保険(`limitations.md` 参照)
- ❌ 複数社員対応(同上)
