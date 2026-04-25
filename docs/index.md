# solo-shaho ドキュメント

**マイクロ法人・個人事業主向け** に、月次の社会保険料計算を社労士や SaaS に頼らず自前で完結させるためのドキュメントです。

ブラウザで動作する **Web アプリ** を主要ツールとして提供し、計算の根拠は **リファレンス** として整理しています。Excel + Python による自作運用は、付録として残しています。

## 主な構成

```{toctree}
:maxdepth: 2
:caption: Web アプリケーション

web/index
web/quickstart
web/usage
web/csv
web/architecture
```

```{toctree}
:maxdepth: 2
:caption: 社会保険料計算 — リファレンス

reference/index
reference/logic
reference/rates
reference/semantics
reference/accounting
reference/sources
```

```{toctree}
:maxdepth: 2
:caption: Excel 作成(オマケ)

excel/index
excel/sheets
excel/operation
excel/limitations
```

## 対象読者

- マイクロ法人・1 人法人の経営者(自分で社会保険料計算を回したい)
- 個人事業主から法人成りしたばかりで、SaaS 給与計算を導入する前の段階の方
- 月次の社会保険料計算ロジックを検証したい経理担当者
- 同種の運用を別の事業者向けに作り直す技術者

## クイックスタート

ドキュメントを HTML としてビルドして閲覧する方法:

```{code-block} bash
:caption: 環境セットアップ

uv sync --group docs
```

```{code-block} bash
:caption: ドキュメント HTML ビルド

make -C docs html
```

ビルド後、`docs/_build/html/index.html` をブラウザで開いてください。Mermaid 図を正しく表示するには `make -C docs serve` または `make -C docs livehtml` で HTTP サーバ経由で閲覧します。

Web アプリの起動方法は [Web アプリのクイックスタート](web/quickstart.md) を参照してください。

## このドキュメントが扱う範囲

- ✅ 健保 / 介護(2 号) / 厚年 / 子育て拠出金 / 子育て支援金
- ✅ 標準報酬月額 1 等級分(対象社員 1 名)の月次計算
- ❌ 賞与・雇用保険・労災保険([既知の制限](excel/limitations.md) 参照)
- ❌ 複数社員対応(同上)
