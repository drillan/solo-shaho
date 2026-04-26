# OSS Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** solo-shaho を「自分用 OSS」として体裁を整える(MIT ライセンス・カスタムドメイン・GitHub Pages 公開)。

**Architecture:** 5 PR + 1 GitHub UI 操作の合計 6 タスク。`#1`,`#3`,`#4` は並列実行可能、`#2 ← #1`、`#5 ← #4`、`#6 ← #3` の依存。コード変更は最小で、ライセンス明文化・URL 切替・CI 追加に集中する。

**Tech Stack:** MIT License / Cloudflare Workers Custom Domain / GitHub Actions + GitHub Pages / Sphinx + uv / pnpm

**Spec:** `docs/superpowers/specs/2026-04-26-oss-readiness-design.md`

---

## 前提

- 作業ディレクトリ: `/home/driller/repo/solo-shaho`(`main` ブランチから出発)
- 各タスクは独立したブランチ + PR(タイトルは仕様書の通り)
- コミット末尾に `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` を付与
- Python 関連変更があれば `uv run ruff check --fix . && uv run ruff format . && uv run mypy .` をコミット前に実行(本計画では Python コード変更はないため省略可)

---

## Task 1: MIT LICENSE と license メタデータ追加

**Files:**
- Create: `LICENSE`
- Modify: `pyproject.toml`(末尾に license 関連 2 行追加)
- Modify: `web/package.json:5`(`"version"` の直後に `"license"` フィールド追加)

**Branch:** `chore/license-mit`

- [ ] **Step 1: ブランチ作成**

```bash
git checkout main && git pull
git checkout -b chore/license-mit
```

- [ ] **Step 2: `LICENSE` ファイル作成**

`LICENSE` を新規作成し、以下の内容を保存:

```
MIT License

Copyright (c) 2026 driller

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 3: `pyproject.toml` に license フィールド追加**

`pyproject.toml` の `[project]` セクション(`dependencies` の前)に 2 行追加:

```toml
[project]
name = "solo-shaho"
version = "0.1.0"
description = "マイクロ法人(1 人法人)向け 社会保険(協会けんぽ + 厚生年金)月次計算ツール (Web アプリ + 給与計算.xlsx ジェネレータ + 仕様書)"
requires-python = ">=3.13"
license = "MIT"
license-files = ["LICENSE"]
dependencies = [
    "openpyxl>=3.1",
]
```

- [ ] **Step 4: `web/package.json` に license フィールド追加**

`web/package.json` の `"version": "0.0.1",` 直後の行に追加:

```json
{
	"name": "web",
	"private": true,
	"version": "0.0.1",
	"license": "MIT",
	"type": "module",
```

- [ ] **Step 5: 検証 — `uv sync` と `pnpm install` が通ること**

```bash
uv sync
cd web && pnpm install && cd ..
```

期待: いずれもエラーなく完了。`uv sync` が `license = "MIT"` を SPDX として受理する。

- [ ] **Step 6: GitHub の License 認識を予測検証**

```bash
ls -la LICENSE && head -1 LICENSE
```

期待: `MIT License` の行が表示される(GitHub はファイル名 `LICENSE` + 内容で MIT を自動認識する)。

- [ ] **Step 7: コミットと PR 作成**

```bash
git add LICENSE pyproject.toml web/package.json
git commit -m "$(cat <<'EOF'
chore: add MIT LICENSE and license metadata

LICENSE ファイルを追加し、pyproject.toml と web/package.json の
license フィールドを MIT に設定。GitHub 上で MIT License と認識される。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin chore/license-mit
gh pr create --title "chore: add MIT LICENSE and license metadata" --body "$(cat <<'EOF'
## Summary
- LICENSE ファイル(MIT)を追加
- pyproject.toml に license = "MIT" / license-files = ["LICENSE"] を追加
- web/package.json に "license": "MIT" を追加

Spec: docs/superpowers/specs/2026-04-26-oss-readiness-design.md (PR #1)

## Test plan
- [ ] `uv sync` がエラーなく完了
- [ ] `pnpm install` がエラーなく完了
- [ ] マージ後、GitHub のリポジトリトップで「MIT License」と表示される

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 2: README に MIT バッジと免責文を追加

**Files:**
- Modify: `README.md`(タイトル直下にバッジ追加・「個人情報の扱い」セクション後ろに免責セクション追加・末尾にライセンスセクション追加)

**Branch:** `docs/readme-license-disclaimer`

**依存:** Task 1 がマージされてから着手(LICENSE ファイルへのリンクが解決するため)

- [ ] **Step 1: 最新 main を取り込みブランチ作成**

```bash
git checkout main && git pull
git checkout -b docs/readme-license-disclaimer
```

- [ ] **Step 2: README タイトル直下に MIT バッジを追加**

`README.md` の 1 行目 `# solo-shaho` の直後に空行 + バッジ行を挿入:

```markdown
# solo-shaho

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**マイクロ法人(1 人法人)向け** 社会保険(協会けんぽ + 厚生年金)月次計算ツール。
```

- [ ] **Step 3: 「個人情報の扱い」セクション直後に免責セクションを追加**

`README.md` 内の `## 個人情報の扱い` ブロックの直後(`---` 区切り線の **前**)に以下を追加:

```markdown
## 免責事項

本ツールは月次の社会保険料計算を補助する目的で提供される **計算補助ツール** であり、社労士・税理士業務を代替するものではありません。

- 計算結果の **正確性は保証しません**。料率改定の反映遅延、特殊な被保険者区分(海外赴任者・短時間労働者の特例等)、端数処理ルールの改正などにより、実際の納付額と乖離する可能性があります
- 本ツールの計算結果に基づく **公式手続き(算定基礎届・月変届・納付等)は利用者の責任** で行ってください。最終判断は社労士・税理士・年金事務所等の専門家にご相談ください
- 本ツールの利用により生じた **いかなる損害についても作者は責任を負いません**

料率改定や仕様変更に気づかれた場合は、Issue または Pull Request でお知らせいただけると助かります(対応はベストエフォートです)。
```

- [ ] **Step 4: README 末尾にライセンスセクションを追加**

`README.md` の最終行に以下を追加(末尾の改行も維持):

```markdown

---

## ライセンス

[MIT License](LICENSE) © 2026 driller
```

- [ ] **Step 5: 検証 — Markdown プレビュー**

```bash
grep -n "License: MIT\|## 免責事項\|## ライセンス" README.md
```

期待: 3 行すべてマッチする。

- [ ] **Step 6: コミットと PR 作成**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): add MIT badge and disclaimer

タイトル直下に MIT バッジを追加し、計算結果の無保証・専門家相談推奨・
作者免責を明記する免責セクションと、末尾にライセンスセクションを追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin docs/readme-license-disclaimer
gh pr create --title "docs(readme): add MIT badge and disclaimer" --body "$(cat <<'EOF'
## Summary
- README タイトル直下に MIT バッジ
- 「個人情報の扱い」セクション後に免責セクション(計算結果無保証・専門家相談推奨・作者免責)
- 末尾にライセンスセクション

Spec: docs/superpowers/specs/2026-04-26-oss-readiness-design.md (PR #2)

## Test plan
- [ ] GitHub 上で README プレビューでバッジが表示される
- [ ] バッジクリックで LICENSE ファイルへ遷移
- [ ] 免責文に専門家相談・作者免責の文言が含まれる

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 3: Cloudflare Custom Domain への切替

**Files:**
- Modify: `docs/web/deploy.md`(URL 言及部分の更新と「正規 URL」セクション追加)

**Branch:** `chore/web-custom-domain`

**手動作業(コード変更前に実施):**

1. Cloudflare ダッシュボード → Workers & Pages → `solo-shaho` Worker を選択
2. **Settings → Domains & Routes → Add → Custom Domain**
3. ドメイン入力欄に `solo-shaho.quokka.trade` を入力 → Add Custom Domain
4. DNS レコードと TLS 証明書が自動生成されるのを待つ(1〜2 分)
5. 同 Settings → 一覧から **`*.workers.dev` (preview)** を選び、**Disable** に切り替え
6. ブラウザで `https://solo-shaho.quokka.trade/` にアクセスして 200 応答を確認

- [ ] **Step 1: 上記の手動作業を完了したら、ブランチ作成**

```bash
git checkout main && git pull
git checkout -b chore/web-custom-domain
```

- [ ] **Step 2: 切替後の URL を curl で検証**

```bash
curl -sI https://solo-shaho.quokka.trade/ | head -5
curl -sI https://solo-shaho.drillertest1004a.workers.dev/ 2>&1 | head -3
```

期待:
- 新 URL は `HTTP/2 200` を返す
- 旧 URL は接続失敗もしくは無効化応答

- [ ] **Step 3: `docs/web/deploy.md` を更新**

ファイル冒頭(タイトル直後)に「正規デプロイ URL」セクションを追加:

```markdown
# デプロイ・運用

Web アプリ(SvelteKit + Cloudflare Workers Static Assets)を自分で動かすための、ローカル開発から本番デプロイまでの手順をまとめます。

## 正規の公開 URL

本リポジトリの正規(作者運用)デプロイ先は **<https://solo-shaho.quokka.trade/>** です。フォークして自分用に運用する場合は、以下の手順で別の URL にデプロイしてください。
```

`docs/web/deploy.md:62` 周辺の `solo-shaho.<your-account>.workers.dev` 言及はそのまま残す(フォーク利用者向けの手順なので変更不要)。

- [ ] **Step 4: README に正規 URL を追記**

`README.md` の「Web アプリ版の使い方」セクション冒頭(`### 必要な環境` の **前**)に正規 URL の行を追加:

```markdown
## Web アプリ版の使い方

正規(作者運用)の公開 URL: **<https://solo-shaho.quokka.trade/>**

### 必要な環境
```

- [ ] **Step 5: 検証 — リンク確認**

```bash
grep -n "solo-shaho.quokka.trade" README.md docs/web/deploy.md
```

期待: README に 1 件、deploy.md に 1 件マッチする。

- [ ] **Step 6: コミットと PR 作成**

```bash
git add README.md docs/web/deploy.md
git commit -m "$(cat <<'EOF'
chore(web): switch to custom domain solo-shaho.quokka.trade

Cloudflare Workers の Custom Domain として solo-shaho.quokka.trade を
追加(ダッシュボード操作)。旧 *.workers.dev URL は preview を無効化。
README と docs/web/deploy.md に正規 URL を明記。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin chore/web-custom-domain
gh pr create --title "chore(web): switch to custom domain solo-shaho.quokka.trade" --body "$(cat <<'EOF'
## Summary
- Cloudflare ダッシュボードで solo-shaho.quokka.trade を Custom Domain として追加(手動)
- *.workers.dev preview URL を無効化(個人アカウント名の露出回避)
- README と docs/web/deploy.md に「正規の公開 URL」を明記

Spec: docs/superpowers/specs/2026-04-26-oss-readiness-design.md (PR #3)

## Test plan
- [ ] https://solo-shaho.quokka.trade/ で 200 応答・HTTPS 有効
- [ ] 旧 https://solo-shaho.drillertest1004a.workers.dev/ がアクセス不能
- [ ] CSP / X-Frame-Options 等のセキュリティヘッダが新 URL でも返る
- [ ] フォーク運用者向けの `<your-account>.workers.dev` 表記は維持されている

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 4: GitHub Pages への Sphinx ドキュメント自動公開

**Files:**
- Create: `.github/workflows/docs.yml`
- Modify: `docs/conf.py`(末尾に `html_baseurl` 追加)

**Branch:** `ci/docs-github-pages`

**手動作業(初回のみ・workflow を merge する前に実施):**

1. GitHub リポジトリの **Settings → Pages**
2. **Source** を **GitHub Actions** に設定(Deploy from a branch ではなく)

- [ ] **Step 1: ブランチ作成**

```bash
git checkout main && git pull
git checkout -b ci/docs-github-pages
```

- [ ] **Step 2: `.github/workflows/docs.yml` を新規作成**

```yaml
name: Deploy Sphinx docs to GitHub Pages

on:
  push:
    branches: [main]
    paths:
      - "docs/**"
      - "pyproject.toml"
      - "uv.lock"
      - ".github/workflows/docs.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6

      - uses: actions/configure-pages@v6

      - uses: astral-sh/setup-uv@v8
        with:
          enable-cache: true

      - name: Set up Python
        run: uv python install 3.13

      - name: Install docs dependencies
        run: uv sync --group docs

      - name: Build Sphinx docs
        run: uv run sphinx-build -b html -W --keep-going docs docs/_build/html

      - name: Add .nojekyll
        run: touch docs/_build/html/.nojekyll

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v5
        with:
          path: docs/_build/html

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v5
```

- [ ] **Step 3: `docs/conf.py` に `html_baseurl` を追加**

`docs/conf.py` の末尾(`oceanid_fullscreen = True` の **後**)に追加:

```python
# GitHub Pages 公開時の絶対 URL ベース
html_baseurl = "https://drillan.github.io/solo-shaho/"
```

- [ ] **Step 4: ローカルで Sphinx ビルドが通ることを検証**

```bash
uv sync --group docs
uv run sphinx-build -b html -W --keep-going docs docs/_build/html
ls docs/_build/html/index.html
```

期待: `-W` 警告→エラー昇格でもビルドが通り、`docs/_build/html/index.html` が生成される。

- [ ] **Step 5: workflow YAML 構文チェック**

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/docs.yml'))" 2>&1 || echo "YAML エラー"
```

期待: 何も出力されない(構文 OK)。

- [ ] **Step 6: コミットと PR 作成(マージ前に Settings → Pages → Source = GitHub Actions が必須)**

```bash
git add .github/workflows/docs.yml docs/conf.py
git commit -m "$(cat <<'EOF'
ci(docs): publish Sphinx docs to GitHub Pages

main への push で docs/ 配下が変更された場合に Sphinx を uv でビルドし、
actions/deploy-pages で https://drillan.github.io/solo-shaho/ に公開する。
docs/conf.py に html_baseurl を追加。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin ci/docs-github-pages
gh pr create --title "ci(docs): publish Sphinx docs to GitHub Pages" --body "$(cat <<'EOF'
## Summary
- .github/workflows/docs.yml で Sphinx を自動ビルド & GitHub Pages にデプロイ
- docs/conf.py に html_baseurl = "https://drillan.github.io/solo-shaho/" を追加
- -W (warning-as-error) + --keep-going でドキュメント品質を維持

Spec: docs/superpowers/specs/2026-04-26-oss-readiness-design.md (PR #4)

## Pre-merge checklist
- [ ] GitHub Settings → Pages → Source を **GitHub Actions** に設定済み

## Test plan
- [ ] PR の Actions でビルド成功(-W ありで)
- [ ] マージ後、Actions の deploy ジョブ完了で Environments の page_url 出力を確認
- [ ] https://drillan.github.io/solo-shaho/ で index ページが表示される
- [ ] toctree 内の各カテゴリ(web/reference/excel)が正しく表示される

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 5: README から GitHub Pages docs サイトへのリンク追加

**Files:**
- Modify: `README.md`(冒頭近くに公開 docs へのリンクを追加)

**Branch:** `docs/readme-link-pages`

**依存:** Task 4 がマージされ GitHub Pages デプロイが成功してから着手(リンク先 URL の到達性を担保するため)

- [ ] **Step 1: GitHub Pages の到達性を確認**

```bash
curl -sI https://drillan.github.io/solo-shaho/ | head -3
```

期待: `HTTP/2 200`。404 の場合は Task 4 のデプロイを再確認してから再開。

- [ ] **Step 2: ブランチ作成**

```bash
git checkout main && git pull
git checkout -b docs/readme-link-pages
```

- [ ] **Step 3: README の「構成」表に公開 docs リンク列を追加 / バッジ行に docs バッジを追加**

`README.md` の MIT バッジ行に並べて docs バッジを追加:

```markdown
# solo-shaho

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Docs](https://img.shields.io/badge/docs-GitHub_Pages-blue.svg)](https://drillan.github.io/solo-shaho/)
```

- [ ] **Step 4: 「構成」テーブルの下に公開 docs への案内を追加**

`README.md` の `## 構成` テーブルの直後に 1 段落追加:

```markdown
| 形態 | 用途 | 状態 |
|---|---|---|
| **Web アプリ** (`web/`) | 日常運用の主役。ブラウザで動作、Cloudflare Workers Static Assets で配信 | Phase 1 リリース済み |
| **Excel ブック** ([`sample/給与計算.xlsx`](sample/給与計算.xlsx)) | サンプル公開・参考実装。架空人物データで生成済み | サンプル公開 |
| **ドキュメント** (`docs/`) | Sphinx + MyST の仕様書 | 現役 |

ドキュメントの最新ビルドは **<https://drillan.github.io/solo-shaho/>** で公開しています。GitHub 上のソース(`docs/` 配下)も併記してリンクします。
```

- [ ] **Step 5: docs ディレクトリへの本文中リンクを公開 URL 併記に更新**

`README.md` 内の `[デプロイ・運用](docs/web/deploy.md)` のような相対リンクは **そのまま残す**(GitHub 上で README を読む人向け)。新たに以下を該当箇所に追加するのみ:

ファイル末尾の「ライセンス」セクション直前(`---` 区切り線直前)に「ドキュメント」セクションを追加:

```markdown
---

## ドキュメント

- 公開ドキュメントサイト: <https://drillan.github.io/solo-shaho/>
- リポジトリ内ソース: [`docs/`](docs/)
- 主な入口:
  - Web アプリ運用: [`docs/web/`](docs/web/) / [公開版](https://drillan.github.io/solo-shaho/web/index.html)
  - 計算ロジック リファレンス: [`docs/reference/`](docs/reference/) / [公開版](https://drillan.github.io/solo-shaho/reference/index.html)
  - Excel ブック(オマケ): [`docs/excel/`](docs/excel/) / [公開版](https://drillan.github.io/solo-shaho/excel/index.html)
```

- [ ] **Step 6: 検証 — リンクの整合性**

```bash
grep -n "drillan.github.io/solo-shaho" README.md
curl -sI https://drillan.github.io/solo-shaho/web/index.html | head -1
curl -sI https://drillan.github.io/solo-shaho/reference/index.html | head -1
curl -sI https://drillan.github.io/solo-shaho/excel/index.html | head -1
```

期待: README に 5〜6 件マッチ・各 curl が `HTTP/2 200` を返す。

- [ ] **Step 7: コミットと PR 作成**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): link to GitHub Pages docs site

公開ドキュメントサイト https://drillan.github.io/solo-shaho/ への
バッジと案内を追加。リポジトリ内の相対リンクは維持しつつ、
公開版へのリンクを併記する。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin docs/readme-link-pages
gh pr create --title "docs(readme): link to GitHub Pages docs site" --body "$(cat <<'EOF'
## Summary
- README に Docs バッジを追加
- 「構成」テーブル下に公開 docs サイトへの案内
- 末尾に「ドキュメント」セクション(ソースリンクと公開版を併記)

Spec: docs/superpowers/specs/2026-04-26-oss-readiness-design.md (PR #5)

## Test plan
- [ ] README プレビューで Docs バッジが表示・クリックで Pages サイトに遷移
- [ ] Web/Reference/Excel カテゴリのリンクがすべて 200
- [ ] GitHub 上のソースリンクと公開版リンクの両方が有効

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 6: GitHub リポジトリ About / Topics 設定(手動・コード変更なし)

**Files:** なし(GitHub UI 操作のみ)

**依存:** Task 3 マージ後(Website URL を確定するため)

- [ ] **Step 1: GitHub リポジトリページにアクセス**

```bash
gh repo view drillan/solo-shaho --web
```

リポジトリトップが開く。

- [ ] **Step 2: About 欄の歯車アイコン → 以下を設定**

| フィールド | 値 |
|---|---|
| Description | `マイクロ法人向け 社会保険(協会けんぽ + 厚生年金)月次計算ツール` |
| Website | `https://solo-shaho.quokka.trade/` |
| Topics(8〜10 個) | `social-insurance`, `payroll`, `japan`, `cloudflare-workers`, `sveltekit`, `sphinx`, `micro-corporation`, `health-insurance`, `pension` |

「Use your GitHub Pages website」のチェックは外す(Website は Web アプリ URL を優先)。

- [ ] **Step 3: 「Releases」「Packages」「Deployments」セクションの表示制御**

About 編集モーダル下部のチェックボックスから:
- `Releases` → 必要に応じて非表示(Phase 1 にタグなしなら非表示推奨)
- `Packages` → 非表示(npm/PyPI 公開予定なし)
- `Deployments` → 非表示(個人運用のみ)

- [ ] **Step 4: gh CLI で設定を確認**

```bash
gh repo view drillan/solo-shaho --json description,homepageUrl,repositoryTopics
```

期待: description / homepageUrl / topics の 3 フィールドすべてが上記の値で表示される。

- [ ] **Step 5: 完了報告(コミットなし)**

このタスクはコード変更を伴わないため、PR は作成しない。完了したら Spec のチェックリスト「リポジトリの About / topics が設定済み」を満たした旨を報告するのみ。

---

## 完了基準(Spec の Section 5 に対応)

すべての PR がマージされ、Task 6 の手動操作も完了したら、以下を最終確認:

- [ ] `LICENSE` ファイルがリポジトリルートに存在し、GitHub UI で「MIT License」と認識される
- [ ] `https://solo-shaho.quokka.trade/` で Web アプリが動作する
- [ ] `https://drillan.github.io/solo-shaho/` で Sphinx ドキュメントが公開される
- [ ] README に MIT バッジ・免責文・公開 docs へのリンクが含まれる
- [ ] GitHub リポジトリの About / topics が設定済み
- [ ] 旧 `*.workers.dev` URL が無効化されている

---

## Self-Review メモ(計画作成者)

- **Spec カバレッジ**: Spec Section 3 の 6 タスクすべてに対応する Task 1〜6 を作成済み
- **プレースホルダ**: なし(すべてのコードブロック・コマンド・URL を確定値で記載)
- **型/識別子整合**: 各 PR タイトル・ブランチ名・コミットメッセージは Spec 記載と一致
- **依存関係**: `#2 ← #1`、`#5 ← #4`、`#6 ← #3` の前提を各 Task の冒頭に明記
- **手動作業の明示**: Task 3, 4, 6 の Cloudflare ダッシュボード / GitHub Settings 操作は「手動作業」として独立して記載
