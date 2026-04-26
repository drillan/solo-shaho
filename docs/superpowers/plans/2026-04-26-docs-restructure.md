# ドキュメント 3 部構成への再編 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/` を Web アプリ / 計算リファレンス / Excel(オマケ)の 3 部構成に物理ディレクトリで分割し、Sphinx を `shibuya` テーマ + `sphinx-oceanid`(Mermaid)+ MyST 数式に刷新する。

**Architecture:** 既存 9 ファイルを `git mv` で `web/` `reference/` `excel/` 配下に移動し、相互リンクを相対パスで再配線する。`docs/superpowers/` は `/brainstorming` `/writing-plans` の作業領域として温存し、`exclude_patterns` でビルド対象外にする。Web 部にはプレースホルダ 4 ページを新設し、`web/index.md` と `reference/index.md` に Mermaid 構成図を 1 枚ずつ追加する。

**Tech Stack:** Sphinx ≥ 9.1, MyST Parser ≥ 5(`dollarmath` + `amsmath` 有効化), shibuya ≥ 2026.1.9, sphinx-oceanid ≥ 0.1.2, Python ≥ 3.13, uv

**Spec:** `docs/superpowers/specs/2026-04-26-docs-restructure-design.md`

---

## File Structure

最終ディレクトリ:

```
docs/
├── conf.py                            # 修正: theme/extensions/exclude_patterns
├── index.md                           # 修正: toctree を 3 部構成に
├── _static/
├── web/                               # 新規ディレクトリ
│   ├── index.md                       # 新規(Mermaid 構成図)
│   ├── quickstart.md                  # 新規(プレースホルダ)
│   ├── usage.md                       # 新規(プレースホルダ)
│   └── csv.md                         # 新規(プレースホルダ)
├── reference/                         # 新規ディレクトリ
│   ├── index.md                       # 新規(Mermaid モジュール依存図)
│   ├── logic.md                       # ← git mv + 数式 math 化
│   ├── rates.md                       # ← git mv + 相互リンク修正
│   ├── semantics.md                   # ← git mv
│   ├── accounting.md                  # ← git mv + 相互リンク修正
│   └── sources.md                     # ← reference.md を git mv + 改名
├── excel/                             # 新規ディレクトリ
│   ├── index.md                       # ← overview.md を git mv + 改名 + 数式 math 化
│   ├── sheets.md                      # ← git mv + 相互リンク修正
│   ├── operation.md                   # ← git mv + 相互リンク修正
│   └── limitations.md                 # ← git mv
└── superpowers/                       # 温存・ビルド対象外
    ├── specs/
    └── plans/
```

ルートファイル変更:
- `pyproject.toml` — Python 3.13+、docs 依存差し替え
- `README.md` — docs 内パスへの参照を新パスに更新

---

## Phase A: Sphinx 設定と依存パッケージの差し替え

### Task 1: `pyproject.toml` の Python バージョンと docs 依存を更新

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: 現状確認**

```bash
sed -n '1,20p' pyproject.toml
```

確認すべき内容:
- `requires-python = ">=3.10"`
- `[dependency-groups].docs` に `furo>=2024` がある

- [ ] **Step 2: Edit ツールで requires-python と docs グループを書き換え**

`requires-python = ">=3.10"` → `requires-python = ">=3.13"`

`[dependency-groups]` セクションを以下に置換:

```toml
[dependency-groups]
docs = [
    "sphinx>=9.1",
    "myst-parser>=5",
    "shibuya>=2026.1.9",
    "sphinx-oceanid>=0.1.2",
    "sphinx-autobuild>=2024.10.3",
]
```

- [ ] **Step 3: コミット**

```bash
git add pyproject.toml
git commit -m "build(docs): switch to shibuya + sphinx-oceanid, bump Python to 3.13"
```

---

### Task 2: `docs/conf.py` を新設定に書き換え

**Files:**
- Modify: `docs/conf.py`

- [ ] **Step 1: 現状確認**

```bash
cat docs/conf.py
```

- [ ] **Step 2: Edit ツールで conf.py 全体を以下に置換**

ファイル全体を Write ツールで上書き(全体置換が安全):

```python
"""Sphinx 設定ファイル."""

project = "solo-shaho"
author = "driller"
copyright = "2026, driller"
release = "0.1.0"

extensions = [
    "myst_parser",
    "sphinx_oceanid",
]

myst_enable_extensions = [
    "colon_fence",
    "deflist",
    "tasklist",
    "attrs_inline",
    "dollarmath",
    "amsmath",
]

myst_heading_anchors = 3

source_suffix = {".md": "markdown"}

language = "ja"
exclude_patterns = [
    "_build",
    "Thumbs.db",
    ".DS_Store",
    "superpowers",
]

html_theme = "shibuya"
html_static_path = ["_static"]
html_title = "solo-shaho ドキュメント"

myst_url_schemes = ("http", "https", "mailto", "ftp")
```

- [ ] **Step 3: コミット(まだ build しない — 依存未同期のため)**

```bash
git add docs/conf.py
git commit -m "build(docs): switch theme to shibuya, enable mermaid + math extensions"
```

---

### Task 3: 依存を同期して旧レイアウトでビルド成功を確認

**Files:**
- Modify: `uv.lock`(`uv sync` により自動更新)

- [ ] **Step 1: 依存同期**

```bash
uv sync --group docs
```

期待: `furo` が削除され `shibuya` `sphinx-oceanid` が追加されたことが出力される。エラーなく完了。

- [ ] **Step 2: 既存レイアウトのままビルド検証**

```bash
rm -rf docs/_build/html
uv run --group docs sphinx-build -W --keep-going docs docs/_build/html 2>&1 | tail -20
```

期待: `build succeeded` で完了(warning 0)。`html_theme = "shibuya"` が機能し、既存の toctree(まだ旧構造)もそのまま動作する。

- [ ] **Step 3: コミット(`uv.lock` の更新)**

```bash
git add uv.lock
git commit -m "build: sync deps after switching to shibuya + sphinx-oceanid"
```

---

### Task 3b: `docs/Makefile` に `serve` / `livehtml` ターゲットを追加

**Files:**
- Modify: `docs/Makefile`

- [ ] **Step 1: 現状確認**

```bash
cat docs/Makefile
```

- [ ] **Step 2: Makefile を全置換**

Write ツールで `docs/Makefile` を以下に上書き:

```makefile
# Minimal makefile for Sphinx documentation

SPHINXOPTS      ?= -W --keep-going
SPHINXBUILD     ?= uv run --group docs sphinx-build
SPHINXAUTOBUILD ?= uv run --group docs sphinx-autobuild
SOURCEDIR       = .
BUILDDIR        = _build
PORT            ?= 8000

.PHONY: help clean html serve livehtml

help:
	@$(SPHINXBUILD) -M help "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

clean:
	rm -rf $(BUILDDIR)/*

html:
	$(SPHINXBUILD) -M html "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)

serve: html
	@echo "Serving at http://localhost:$(PORT) — press Ctrl+C to stop"
	uv run python -m http.server -d $(BUILDDIR)/html $(PORT)

livehtml:
	$(SPHINXAUTOBUILD) "$(SOURCEDIR)" "$(BUILDDIR)/html" $(SPHINXOPTS) $(O)

%:
	@$(SPHINXBUILD) -M $@ "$(SOURCEDIR)" "$(BUILDDIR)" $(SPHINXOPTS) $(O)
```

**変更点:**
- `SPHINXBUILD` を `uv run --group docs sphinx-build` に変更(uv プロジェクトでも `make` 単体で動作)
- `SPHINXAUTOBUILD` を新規追加
- `serve` ターゲット追加(HTTP サーバ経由で `_build/html/` を配信、Mermaid 描画に必須)
- `livehtml` ターゲット追加(自動再ビルド + ライブリロード)
- `PORT` 変数で `make serve PORT=9000` 可能

- [ ] **Step 3: `make html` で動作確認**

```bash
make -C docs clean
make -C docs html 2>&1 | tail -10
```

期待: `build succeeded` で完了(warning 0)。

- [ ] **Step 4: `livehtml` の起動確認(短時間)**

```bash
timeout 8 make -C docs livehtml 2>&1 | head -20 || true
```

期待: `[sphinx-autobuild] Serving on http://127.0.0.1:8000` のような出力が出てから timeout で自然終了。エラーで即時終了しないこと。

- [ ] **Step 5: コミット**

```bash
git add docs/Makefile
git commit -m "build(docs): add serve and livehtml targets via uv"
```

---

## Phase B: ディレクトリ再編とファイル移動

### Task 4: 新ディレクトリを作成

**Files:**
- Create: `docs/web/`, `docs/reference/`, `docs/excel/`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p docs/web docs/reference docs/excel
```

- [ ] **Step 2: git の都合上、空ディレクトリは追跡されないため、この時点でのコミットは不要**

次タスクで `git mv` した時点で自動的に追跡される。

---

### Task 5: 既存 9 ファイルを `git mv` で 3 部に振り分け

**Files:**
- Move: 既存 9 ファイル(2 ファイルはリネーム同時)

- [ ] **Step 1: Excel 部への移動(リネーム 1 件含む)**

```bash
git mv docs/overview.md docs/excel/index.md
git mv docs/sheets.md docs/excel/sheets.md
git mv docs/operation.md docs/excel/operation.md
git mv docs/limitations.md docs/excel/limitations.md
```

- [ ] **Step 2: Reference 部への移動(リネーム 1 件含む)**

```bash
git mv docs/logic.md docs/reference/logic.md
git mv docs/rates.md docs/reference/rates.md
git mv docs/semantics.md docs/reference/semantics.md
git mv docs/accounting.md docs/reference/accounting.md
git mv docs/reference.md docs/reference/sources.md
```

- [ ] **Step 3: 移動結果の確認**

```bash
ls docs/*.md docs/web/ docs/reference/ docs/excel/ 2>&1
```

期待: `docs/index.md` のみがフラット配置で残り、各サブディレクトリに移動済みファイルが存在。

- [ ] **Step 4: 履歴温存の確認**

```bash
git log --follow --oneline docs/excel/index.md | head -3
```

期待: `git mv` 前のコミット履歴が辿れる。

- [ ] **Step 5: コミット**

```bash
git commit -m "docs: move existing pages into 3-part directory structure"
```

---

### Task 6: 移動したファイル内の相互リンクを新パスへ修正

**Files:**
- Modify: `docs/excel/index.md`、`docs/excel/sheets.md`、`docs/excel/operation.md`、`docs/reference/rates.md`、`docs/reference/accounting.md`

- [ ] **Step 1: 修正対象のリンクを再確認**

```bash
grep -rn '\.md)' docs/excel/ docs/reference/ 2>&1
```

期待される検出結果(全 9 リンク):
- `docs/excel/index.md`: `(sheets.md)` `(logic.md)` `(rates.md)` `(semantics.md)`
- `docs/excel/sheets.md`: `(rates.md)` `(logic.md)`
- `docs/excel/operation.md`: `(semantics.md)`
- `docs/reference/rates.md`: `(semantics.md)` `(limitations.md)`
- `docs/reference/accounting.md`: `(semantics.md)`

- [ ] **Step 2: `docs/excel/index.md` を修正**

Edit:
- `(sheets.md)` → `(sheets.md)`(同一ディレクトリのため変更なし)
- `(logic.md)` → `(../reference/logic.md)`
- `(rates.md)` → `(../reference/rates.md)`
- `(semantics.md)` → `(../reference/semantics.md)`

- [ ] **Step 3: `docs/excel/sheets.md` を修正**

Edit:
- `(rates.md)` → `(../reference/rates.md)`
- `(logic.md)` → `(../reference/logic.md)`

- [ ] **Step 4: `docs/excel/operation.md` を修正**

Edit:
- `(semantics.md)` → `(../reference/semantics.md)`

- [ ] **Step 5: `docs/reference/rates.md` を修正**

Edit:
- `(semantics.md)` → `(semantics.md)`(同一ディレクトリ・変更なし)
- `(limitations.md)` → `(../excel/limitations.md)`

- [ ] **Step 6: `docs/reference/accounting.md` を修正**

Edit:
- `(semantics.md)` → `(semantics.md)`(同一ディレクトリ・変更なし)

- [ ] **Step 7: 修正後の確認**

```bash
grep -rn '\.md)' docs/excel/ docs/reference/ 2>&1
```

期待: 上記 9 リンクが新パスに更新済み。

- [ ] **Step 8: コミット**

```bash
git add docs/excel docs/reference
git commit -m "docs: update cross-references after directory restructure"
```

---

### Task 7: `docs/index.md` の toctree を 3 部構成に書き換え

**Files:**
- Modify: `docs/index.md`

- [ ] **Step 1: 現状確認**

```bash
cat docs/index.md
```

- [ ] **Step 2: Edit ツールで toctree ブロックを置換**

`docs/index.md` の最初の toctree ブロック(`overview` から `reference` までを列挙しているもの)と、ある場合は「Web アプリ計画」キャプションの toctree ブロックを、以下 3 ブロックに置き換え:

```markdown
```{toctree}
:maxdepth: 2
:caption: Web アプリケーション

web/index
web/quickstart
web/usage
web/csv
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
```

注: この時点で `web/` 配下の 4 ファイルと `reference/index.md` はまだ存在しないため、ビルドは Phase C で新規作成後に実施する。

- [ ] **Step 3: コミット**

```bash
git add docs/index.md
git commit -m "docs(index): rewrite toctree for 3-part structure"
```

---

## Phase C: 新規ページとプレースホルダ作成

### Task 8: `docs/web/index.md` を作成(Mermaid 構成図入り)

**Files:**
- Create: `docs/web/index.md`

- [ ] **Step 1: ファイル作成**

Write:

````markdown
# Web アプリケーション

`給与計算.xlsx` の月次社会保険料計算を、ブラウザで動作する SPA に移植したアプリです。個人データはブラウザ内のみで保持し、サーバ送信はありません。Cloudflare Workers Static Assets で永久無料運用しています。

## 全体構成

```{mermaid}
flowchart LR
    User[利用者ブラウザ]
    CDN[Cloudflare<br/>Workers Static Assets]
    SK[SvelteKit SPA<br/>prerender + ssr=false]
    LS[(localStorage<br/>solo-shaho-state)]
    CSV[CSV<br/>エクスポート/インポート]

    User -->|HTTPS| CDN
    CDN -->|静的アセット配信| SK
    SK <-->|読み書き| LS
    SK -.->|ダウンロード/アップロード| CSV
```

## 主な特長

- **プライバシー**: 個人データはブラウザ内のみ(localStorage)。外部送信なし
- **コスト**: Cloudflare 無料枠内で永久無料
- **可搬性**: CSV エクスポートで完全バックアップ・別ブラウザ移行が可能
- **正確性**: Excel と同一値を出すことを fixture テストで保証

## このセクションの内容

- [クイックスタート](quickstart.md) — 起動から初回計算まで
- [使い方](usage.md) — タブ別の画面解説
- [CSV 仕様](csv.md) — エクスポート/インポート形式
````

- [ ] **Step 2: コミット**

```bash
git add docs/web/index.md
git commit -m "docs(web): add web app index page with architecture diagram"
```

---

### Task 9: `docs/web/quickstart.md` プレースホルダを作成

**Files:**
- Create: `docs/web/quickstart.md`

- [ ] **Step 1: ファイル作成**

Write:

```markdown
# クイックスタート

## 配信 URL を開く

ブラウザで配信 URL にアクセスします。インストール作業は不要です。

## 設定タブで初期入力

1. 氏名(任意)
2. 生年月日(必須・介護該当判定に使用)
3. 報酬改定履歴を 1 行以上追加し、適用開始日・標準報酬月額・給与額面を入力

## 月次タブで計算結果を確認

対象の年・月を選択すると、健保・厚年・拠出金・支援金の月次保険料が計算されます。社員天引き額・事業主負担額・納付総額・差引支給額が一目で確認できます。

## バックアップ

I/O メニューから CSV エクスポートでバックアップを取得してください。詳細は [CSV 仕様](csv.md) を参照。
```

- [ ] **Step 2: コミット**

```bash
git add docs/web/quickstart.md
git commit -m "docs(web): add quickstart placeholder"
```

---

### Task 10: `docs/web/usage.md` プレースホルダを作成

**Files:**
- Create: `docs/web/usage.md`

- [ ] **Step 1: ファイル作成**

Write:

```markdown
# 使い方

## 設定タブ

プロフィール(氏名・生年月日)と報酬改定履歴を管理します。報酬改定履歴は適用開始日順に管理され、月次計算時にその時点で有効な値が自動選択されます。

## 月次タブ

対象年月を選んでその月の計算結果を表示します。介護該当の有無、適用された健保料率(介護込み/なし)、各保険料の社員側・事業主側内訳、納付総額、差引支給額を確認できます。

## 履歴タブ

報酬改定履歴と計算済み月次の集約ビューです。年次集計や複数月の差分比較に使います。

## I/O メニュー

CSV エクスポート、CSV インポート、全データクリアの 3 操作を提供します。詳細は [CSV 仕様](csv.md) を参照。
```

- [ ] **Step 2: コミット**

```bash
git add docs/web/usage.md
git commit -m "docs(web): add usage placeholder"
```

---

### Task 11: `docs/web/csv.md` プレースホルダを作成

**Files:**
- Create: `docs/web/csv.md`

- [ ] **Step 1: ファイル作成**

Write:

```markdown
# CSV 仕様

Web アプリは UTF-8 (BOM 付き) の独自 CSV 形式でエクスポート/インポートします。1 ファイルでアプリ全状態のバックアップ・復元が完結します。

## 主な性質

- セクション区切り(`[profile]` / `[remuneration_history]` / `[monthly_notes]`)で人間にも読みやすい形式
- `schemaVersion` を先頭コメントに保持し、将来の互換性境界を明示
- 自由記述フィールドは [CSV Formula Injection (CWE-1236)](https://cwe.mitre.org/data/definitions/1236.html) 対策のため、危険文字(`=` `+` `-` `@` 等)で始まる値を自動エスケープ
- 計算結果スナップショットはインポート時に無視(派生値のため再計算が正)

## 詳細仕様

完全なフィールド定義・往復ルール・バリデーション仕様は開発資料(`docs/superpowers/specs/2026-04-25-payroll-web-app-design.md` の第 5 章)を参照してください。
```

- [ ] **Step 2: コミット**

```bash
git add docs/web/csv.md
git commit -m "docs(web): add csv placeholder"
```

---

### Task 12: `docs/reference/index.md` を作成(Mermaid モジュール依存図入り)

**Files:**
- Create: `docs/reference/index.md`

- [ ] **Step 1: ファイル作成**

Write:

````markdown
# 計算リファレンス

社会保険料計算のしくみと根拠をまとめたリファレンスです。Excel 版・Web 版いずれの実装にも共通する仕様を記述します。

## 計算エンジンのモジュール構成(Web 版)

```{mermaid}
flowchart TD
    types[payroll/types.ts<br/>ドメイン型]
    lookup[payroll/lookup.ts<br/>共通検索]
    rates[payroll/rates.ts]
    rem[payroll/remuneration.ts]
    kaigo[payroll/kaigo.ts]
    round[payroll/round.ts]
    calc[payroll/calculate.ts]
    agg[payroll/aggregate.ts]

    types --> lookup
    lookup --> rates
    lookup --> rem
    types --> kaigo
    types --> round
    rates --> calc
    rem --> calc
    kaigo --> calc
    round --> calc
    calc --> agg
```

## このセクションの内容

- [計算ロジック](logic.md) — 端数処理・残額方式・健保料率合算
- [料率の知識](rates.md) — 5 種類の保険料率と改定タイミング
- [納付月セマンティクス](semantics.md) — 「年/月」ラベルが何を指すか
- [経理処理](accounting.md) — 預り金と仕訳
- [出典](sources.md) — 公的資料・参考文献
````

- [ ] **Step 2: コミット**

```bash
git add docs/reference/index.md
git commit -m "docs(reference): add reference index with module dependency diagram"
```

---

### Task 13: ビルド検証(Phase B + C 完了時点)

**Files:**
- 検証のみ

- [ ] **Step 1: クリーンビルド**

```bash
rm -rf docs/_build/html
uv run --group docs sphinx-build -W --keep-going docs docs/_build/html 2>&1 | tail -30
```

期待: `build succeeded` と表示され warning 0。`docs/superpowers/` 配下のファイルが「ソースを読み込み中」のリストに含まれないことを確認。

- [ ] **Step 2: 出力ファイル確認**

```bash
ls docs/_build/html/web/ docs/_build/html/reference/ docs/_build/html/excel/
```

期待: 各サブディレクトリ配下に `index.html` 等が出力されている。

- [ ] **Step 3: superpowers が出力されていないことの確認**

```bash
test ! -d docs/_build/html/superpowers && echo "OK: superpowers excluded" || echo "FAIL: superpowers leaked into build"
```

期待: `OK: superpowers excluded`

---

## Phase D: 数式の MyST math 化

### Task 14: `docs/excel/index.md` の残額方式を `{math}` ブロックに変換

**Files:**
- Modify: `docs/excel/index.md`

- [ ] **Step 1: 現状確認**

```bash
grep -n 'math\|residual\|社員側\|事業主側' docs/excel/index.md
```

既存の `{math} :label: residual` ブロックがあれば数式は既に math 化済み。インラインの算式 (`88,000 × 0.1147 = 10,093.6` 等) を `$ ... $` (dollarmath) に変換する余地がある。

- [ ] **Step 2: インライン式の dollarmath 化**

`docs/excel/index.md` の以下に該当する箇所を Edit ツールで修正:

修正対象例:

- 行: `健保(全額)= 88,000 × 0.1147 = **10,093.6**`
  - 変更後: `健保(全額) $= 88{,}000 \times 0.1147 = 10{,}093.6$`
- 行: `半額 = 5,046.8 → 50 銭超切上げで **5,047**(社員側)`
  - 変更後: `半額 $= 5{,}046.8 \to 5{,}047$(50 銭超切上げ・社員側)`
- 行: `5,047 × 2 = **10,094**`
  - 変更後: `$5{,}047 \times 2 = 10{,}094$`

注意: ファイルに該当行が無ければ、その時点の本文に応じて該当する 2〜3 箇所だけを最小限変換する。**仮に元の `## 解決方針 — 残額方式` セクションがすでに math 化済みなら、追加変換は不要で次タスクへ進む。**

- [ ] **Step 3: ビルド検証**

```bash
rm -rf docs/_build/html
uv run --group docs sphinx-build -W --keep-going docs docs/_build/html 2>&1 | tail -10
```

期待: warning 0 で完了。

- [ ] **Step 4: コミット**

```bash
git add docs/excel/index.md
git commit -m "docs(excel): convert inline formulas to dollarmath"
```

---

### Task 15: `docs/reference/logic.md` のインライン式を dollarmath に変換

**Files:**
- Modify: `docs/reference/logic.md`

- [ ] **Step 1: 対象範囲の確認**

```bash
grep -n 'math\|ROUNDDOWN\|社員 + 事業主\|事業主側 =' docs/reference/logic.md
```

`logic.md` は既に `{math}` ブロックを 1 箇所以上含む(spec 第 6 節想定)。**ブロック式は対象外**。本タスクではインライン算式 2 箇所のみ dollarmath 化する。

- [ ] **Step 2: インライン式 (a) を変換**

Edit ツールで以下を置換:

old_string:
```
事業主側 = ROUNDDOWN(全額, 0) - 社員側
```

new_string:
```
$\text{事業主側} = \mathrm{ROUNDDOWN}(\text{全額},\ 0) - \text{社員側}$
```

`old_string` がファイル内で一意でない場合は前後 1 行を含めて再実行。**該当文字列が見つからない場合は何もせず Step 3 へ**(既に変換済み)。

- [ ] **Step 3: インライン式 (b) を変換**

Edit ツールで以下を置換:

old_string:
```
社員 + 事業主 = ROUNDDOWN(全額)
```

new_string:
```
$\text{社員} + \text{事業主} = \mathrm{ROUNDDOWN}(\text{全額})$
```

該当文字列が見つからない場合は何もせず Step 4 へ。

- [ ] **Step 4: ビルド検証**

```bash
rm -rf docs/_build/html
uv run --group docs sphinx-build -W --keep-going docs docs/_build/html 2>&1 | tail -10
```

期待: warning 0。

- [ ] **Step 5: コミット**

Step 2 または Step 3 でファイルを変更した場合のみ:

```bash
git add docs/reference/logic.md
git commit -m "docs(reference): convert inline formulas in logic.md to dollarmath"
```

両ステップとも変更なしの場合はコミット不要(空コミット禁止)。

---

## Phase E: README とのリンク整合

### Task 16: `README.md` 内の docs パス参照を新構成に追従

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 既存参照の検出**

```bash
grep -n 'docs/' README.md
```

検出される行:
- `| **ドキュメント** (docs/) | Sphinx + MyST の仕様書 | 現役 |`
- `uv run --group docs sphinx-build -b html docs docs/_build/html`
- `ビルド後、docs/_build/html/index.html をブラウザで開くと閲覧できます。`
- `詳細は docs/index.md から参照してください。`
- `- docs/superpowers/specs/2026-04-25-payroll-web-app-design.md — Phase 1 設計仕様`
- `- docs/superpowers/plans/2026-04-25-payroll-web-app.md — 34 タスク TDD 計画`

- [ ] **Step 2: 判断**

`docs/superpowers/` 配下のパスは **ファイルシステム上は有効**(spec で温存対象)で、GitHub 上で直接閲覧できる。Sphinx ビルド対象外なので「HTML には現れないが、リポジトリ内では引き続き読める」ことを明記する。

Edit ツールで該当 2 行を以下に書き換え(該当箇所を特定):

```markdown
- `docs/superpowers/specs/2026-04-25-payroll-web-app-design.md` — Phase 1 設計仕様(GitHub で閲覧。Sphinx ビルドには含めない)
- `docs/superpowers/plans/2026-04-25-payroll-web-app.md` — 34 タスク TDD 計画(同上)
```

その他のパス(`docs/` `docs/index.md` `docs/_build/html/`)は変更不要。

- [ ] **Step 3: コミット**

```bash
git add README.md
git commit -m "docs(readme): clarify that superpowers/ is excluded from Sphinx build"
```

---

## Phase F: 最終検証

### Task 17: クリーンビルドで全受け入れ基準を確認

**Files:**
- 検証のみ

- [ ] **Step 1: 完全クリーンビルド**

```bash
rm -rf docs/_build
uv run --group docs sphinx-build -W --keep-going docs docs/_build/html 2>&1 | tail -40
```

期待: `build succeeded` で warning 0。

- [ ] **Step 2: 受け入れ基準チェック(spec セクション 10)**

以下を 1 つずつ確認:

```bash
# 3 ディレクトリ存在
test -d docs/web && test -d docs/reference && test -d docs/excel && echo "OK: 3 dirs"

# 既存 9 ファイルが各サブディレクトリに移動済み
ls docs/excel/index.md docs/excel/sheets.md docs/excel/operation.md docs/excel/limitations.md \
   docs/reference/logic.md docs/reference/rates.md docs/reference/semantics.md docs/reference/accounting.md docs/reference/sources.md \
   && echo "OK: 9 files moved"

# superpowers が温存され、ビルドから除外
test -d docs/superpowers && test ! -d docs/_build/html/superpowers && echo "OK: superpowers preserved & excluded"

# Web 部の新規 4 ファイル
ls docs/web/index.md docs/web/quickstart.md docs/web/usage.md docs/web/csv.md && echo "OK: web placeholders"

# Reference index
ls docs/reference/index.md && echo "OK: reference index"

# pyproject 確認
grep '>=3.13' pyproject.toml && grep 'shibuya' pyproject.toml && grep 'sphinx-oceanid' pyproject.toml \
   && ! grep 'furo' pyproject.toml && echo "OK: pyproject"

# conf.py 確認
grep '"shibuya"' docs/conf.py && grep 'sphinx_oceanid' docs/conf.py && grep '"superpowers"' docs/conf.py \
   && echo "OK: conf.py"

# Makefile 確認
grep 'SPHINXAUTOBUILD' docs/Makefile && grep '^livehtml:' docs/Makefile && grep '^serve:' docs/Makefile \
   && echo "OK: Makefile targets"

# make html / livehtml の動作確認
make -C docs clean && make -C docs html 2>&1 | tail -5 && echo "OK: make html"
timeout 8 make -C docs livehtml 2>&1 | head -10 | grep -q "Serving on" && echo "OK: make livehtml" || echo "FAIL: livehtml did not start"
```

すべての行で OK が出力されること。

- [ ] **Step 3: 履歴温存の最終確認**

```bash
for f in docs/excel/index.md docs/excel/sheets.md docs/reference/logic.md; do
  echo "=== $f ==="
  git log --follow --oneline "$f" | head -3
done
```

期待: 各ファイルとも `git mv` 前のコミットがログに表示される。

- [ ] **Step 4: ブラウザで目視確認(任意・手動)**

```bash
echo "Open: file://$(pwd)/docs/_build/html/index.html"
```

確認項目:
- shibuya テーマが適用され、サイドバーに 3 部のキャプションが表示されている
- `web/index.md` の Mermaid 構成図が SVG で描画されている
- `reference/index.md` のモジュール依存図が SVG で描画されている
- `excel/index.md` `reference/logic.md` の数式が MathJax で描画されている

CI 専用環境ではこのステップはスキップしても良い。

- [ ] **Step 5: 最終コミット(必要なら)**

ここまでの変更でコミット漏れがないことを確認:

```bash
git status
```

期待: `nothing to commit, working tree clean`

- [ ] **Step 6: ブランチ全体の差分サマリ**

```bash
git log --oneline main..HEAD
```

期待: 各 Phase ごとに小さなコミットが順序立てて並んでいる。

---

## 完了条件

- [ ] Phase A〜F すべての Task が完了
- [ ] 受け入れ基準(spec セクション 10)10 項目すべてに ✅
- [ ] `uv run --group docs sphinx-build -W --keep-going docs docs/_build/html` が warning 0 で成功
- [ ] `docs/superpowers/` のファイルがビルド出力に含まれていない
- [ ] 既存ドキュメント間の相互リンクが破綻していない(`grep -rn '\.md)' docs/ --include='*.md' | grep -v _build | grep -v superpowers` の結果がすべて新パス)
