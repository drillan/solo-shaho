# solo-shaho ドキュメント

**マイクロ法人(1 人法人)向け** に、社会保険(健康保険 + 厚生年金)の月次保険料計算を社労士や SaaS に頼らず自前で完結させるためのドキュメントです。

ブラウザで動作する **Web アプリ** を主要ツールとして提供し、計算の根拠は **リファレンス** として整理しています。Excel + Python による自作運用は、付録として残しています。

```{note}
本プロジェクトは **被用者保険(協会けんぽ + 厚生年金)** を対象とします。個人事業主本人の **国民健康保険 + 国民年金** は計算対象外です。個人事業主の方は「法人成り後」が利用想定です。
```

## 主な構成

```{toctree}
:maxdepth: 2
:caption: Web アプリケーション

web/index
web/quickstart
web/usage
web/storage
web/csv
web/architecture
web/deploy
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
:caption: Excel ブック(オマケ)

excel/index
excel/sheets
excel/operation
excel/limitations
```

## 対象読者

- マイクロ法人(1 人法人)の代表者・経営者(自分で社会保険料計算を回したい)
- 個人事業主から **法人成りしたばかり** で、SaaS 給与計算を導入する前の段階の方
- 月次の社会保険料計算ロジックを検証したい経理担当者
- 同種の運用を別の事業者向けに作り直す技術者

## 扱う制度・扱わない制度

| 制度 | 扱い |
|---|---|
| 健康保険(協会けんぽ)+ 厚生年金 | ✅ 主たる対象 |
| 介護保険(健康保険 2 号被保険者) | ✅ 自動該当判定込み |
| 子ども・子育て拠出金・支援金 | ✅ |
| 国民健康保険 + 国民年金(個人事業主本人) | ❌ 対象外(別制度) |
| 雇用保険・労災保険 | ❌ 対象外([既知の制限](excel/limitations.md) 参照) |

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
