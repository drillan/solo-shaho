# solo-shaho OSS 化準備 設計仕様書

- **作成日**: 2026-04-26
- **対象**: `solo-shaho` リポジトリの OSS 公開化(最小構成)
- **スタンス**: A — 「公開はするが基本は自分用。フォーク歓迎、PR は気が向いたら見る」

## 1. 背景と目的

`solo-shaho`(マイクロ法人向け社会保険月次計算ツール)を OSS として体裁を整える。Phase 1 リリース済みでコード・ドキュメント・サンプルは揃っているが、以下が未整備:

- LICENSE ファイルなし(`pyproject.toml` / `package.json` の `license` フィールドも未設定)
- 公開 URL がアカウント識別子を含む(`solo-shaho.drillertest1004a.workers.dev`)
- ドキュメント (Sphinx) はローカルビルドのみで、ホスト先がない
- README に計算結果の免責文がない

これらを「自分用 OSS」として違和感のない最小構成で整備する。

## 2. スコープ

### 2.1 やること

| 項目 | 決定内容 | 理由 |
|---|---|---|
| ライセンス | **MIT** | 寛容・OSS デファクト・特許性のあるアルゴリズムなし・料率データは公的事実データのため別ライセンス分離は不要 |
| 公開 URL | **`solo-shaho.quokka.trade`** | 既に Cloudflare で管理する `quokka.trade` のサブドメインを Workers Custom Domain で割当・追加費用ゼロ・URL がリポジトリ名と一致 |
| ドキュメントホスト | **GitHub Pages + Actions**(`https://drillan.github.io/solo-shaho/`) | A スタンスに最も合う最小構成・GitHub 完結・後からカスタムドメイン化は DNS 追加のみで可能 |
| 免責文 | README に追記 | 計算ツール特有の利用者誤解防止(社労士法・税理士法的リスクは低いが念のため) |
| GitHub リポジトリ設定 | About / topics を手動設定 | 検索性向上(GitHub UI 操作のみ) |

### 2.2 やらないこと(明示的に除外)

- **CI ワークフロー (lint / test の自動実行)** — 案 3 相当。A スタンスには過剰
- **CONTRIBUTING.md / CODE_OF_CONDUCT.md / Issue・PR テンプレ** — 同上
- **README / ドキュメントの英語化** — A スタンス選択時に却下
- **料率データ (`web/src/lib/data/rates.json`) のライセンス分離(CC0 等)** — 単一 MIT に統一して管理コストを抑える
- **`web/package.json` への `repository` / `bugs` / `homepage` フィールド追加** — 必要になったら別 PR
- **`*.workers.dev` URL の `wrangler.jsonc` レベルでの無効化(`workers_dev = false`)** — Cloudflare ダッシュボード側の preview 無効化のみで対応(設定変更が単一ファイルに閉じない場合の影響を避ける)

## 3. 実装単位(PR 一覧)

合計 6 タスク(うち 5 つは PR、1 つは GitHub UI 手動操作)。`#1`, `#3`, `#4` は並列実行可能。

### PR #1: `chore: add MIT LICENSE and license metadata`

**目的**: ライセンスを明文化し、各パッケージマニフェストに反映する。

**変更ファイル**:
- 新規: `LICENSE` — MIT ライセンス全文。`Copyright (c) 2026 driller`
- `pyproject.toml` — `[project]` セクションに `license = "MIT"`(SPDX 識別子)・`license-files = ["LICENSE"]` を追加
- `web/package.json` — トップレベルに `"license": "MIT"` を追加

**依存**: なし

**検証**: `uv sync` がエラーなく通ること・`pnpm install` が通ること

---

### PR #2: `docs(readme): add MIT badge and disclaimer`

**目的**: README で OSS であることと免責を明示する。

**変更ファイル**:
- `README.md`:
  - タイトル直下に MIT バッジ(`https://img.shields.io/badge/license-MIT-blue.svg` 等)を追加
  - 「個人情報の扱い」セクション付近、または末尾近くに **免責セクション** を追加:
    - 計算結果の正確性は保証しない旨
    - 料率改定タイミングのズレ等で実際の納付額と乖離する可能性
    - 最終判断・公式手続きは社労士・税理士・年金事務所等の専門家へ
    - 本ツールの利用により生じた損害について作者は一切の責任を負わない旨
  - 末尾に「ライセンス」セクション(MIT・LICENSE ファイルへのリンク)

**依存**: PR #1 マージ後

**検証**: README プレビューでバッジ表示・リンク動作

---

### PR #3: `chore(web): switch to custom domain solo-shaho.quokka.trade`

**目的**: 公開 URL からアカウント識別子を取り除き、覚えやすい URL に切り替える。

**手動作業(コード変更前)**:
1. Cloudflare ダッシュボードで Workers & Pages → `solo-shaho` Worker → Settings → Domains & Routes → Add Custom Domain で `solo-shaho.quokka.trade` を追加(DNS レコード・TLS 証明書は自動生成)
2. 同 Settings → `*.workers.dev` の preview URL を **無効化**(個人アカウント名の露出回避)

**変更ファイル**:
- `README.md` — 本文中の Web アプリ URL 言及を `https://solo-shaho.quokka.trade/` に置換
- `docs/web/deploy.md` — 同上(URL とデプロイ後動作確認の記述)
- `docs/web/quickstart.md` 等、URL に言及するすべての docs ファイル

**依存**: なし(PR #1 と並列可能)

**検証**: `solo-shaho.quokka.trade` で 200 応答・HTTPS 有効・旧 URL アクセスで 404 もしくは無効化応答

---

### PR #4: `ci(docs): publish Sphinx docs to GitHub Pages`

**目的**: Sphinx ドキュメントを GitHub Pages で自動公開する。

**変更ファイル**:
- 新規: `.github/workflows/docs.yml` — main への push をトリガに以下を実行(GitHub Actions は計画時点の最新メジャーを採用):
  1. `actions/checkout@v6`
  2. `actions/configure-pages@v6`(GitHub Pages 配信先のセットアップ)
  3. `astral-sh/setup-uv@v8`(Python 3.13 セットアップ)
  4. `uv sync --group docs`
  5. `uv run sphinx-build -b html -W --keep-going docs docs/_build/html`
  6. `touch docs/_build/html/.nojekyll`(`_static/` が Jekyll に無視されるのを防ぐ)
  7. `actions/upload-pages-artifact@v5`(`path: docs/_build/html`)
  8. `actions/deploy-pages@v5`(別ジョブで `permissions: pages: write, id-token: write`)
- `docs/conf.py` — `html_baseurl = "https://drillan.github.io/solo-shaho/"` を追加(absolute URL でリンクが正しく解決されるため)

**手動作業(初回のみ)**:
- GitHub リポジトリ Settings → Pages → Source を **GitHub Actions** に設定

**依存**: なし(PR #1, #3 と並列可能)

**検証**: workflow が成功し `https://drillan.github.io/solo-shaho/` で docs index が表示されること

---

### PR #5: `docs(readme): link to GitHub Pages docs site`

**目的**: README から GitHub Pages 上のドキュメントへリンクする。

**変更ファイル**:
- `README.md` — docs への言及箇所を相対リンク(`docs/web/deploy.md` 等)に加えて、または置き換えて GitHub Pages URL(`https://drillan.github.io/solo-shaho/web/deploy.html` 等)を案内する形に更新
  - 方針: GitHub 上のソースリンクと公開 docs リンクを併記(GitHub 上で README を読む人と、公開 docs を読む人の両方に配慮)

**依存**: PR #4 マージ & GitHub Pages デプロイ成功後

**検証**: 各 README リンクから公開 docs ページに遷移できること

---

### タスク #6(手動・コード変更なし): GitHub リポジトリ About / topics 設定

**目的**: GitHub 上での発見性向上。

**手動作業**:
- GitHub リポジトリページ右側「About」歯車から:
  - **Description**: 「マイクロ法人向け 社会保険(協会けんぽ + 厚生年金)月次計算ツール」(README 1 行目と整合)
  - **Website**: `https://solo-shaho.quokka.trade/`
  - **Topics**: `social-insurance`, `payroll`, `japan`, `cloudflare-workers`, `sveltekit`, `sphinx`, `micro-corporation`, `health-insurance`, `pension`(8〜10 個)
  - 「Releases」「Packages」「Deployments」セクションは A スタンスに不要なら非表示でも可

**依存**: PR #3 マージ後(Website URL を確定するため)

**検証**: リポジトリトップで About 表示・topics クリックで GitHub 検索遷移

## 4. リスクと緩和

| リスク | 緩和策 |
|---|---|
| Custom Domain 切替時の DNS 伝搬遅延で一時的にアクセス不能 | 旧 `*.workers.dev` URL は切替後に無効化(切替前は併存)・低トラフィックなので影響軽微 |
| GitHub Pages デプロイ失敗で docs 公開できない | Workflow 失敗時は通知・main 直 push 前に PR 上で workflow を走らせて確認 |
| 料率データを MIT で公開することへの懸念 | 協会けんぽ料率表は公的事実データ・著作物性が弱い・MIT は配布制限を加えないので問題なし(出典は `docs/reference/sources.md` で明記済み) |
| 免責文の文言が法的に弱い/強すぎる | 社労士法・税理士法に抵触しない範囲で「計算補助ツール」「専門家相談推奨」を明記・公式書類提出義務には触れない |

## 5. 完了基準

すべての PR がマージされ、以下が成立すること:

- [ ] `LICENSE` ファイルがリポジトリルートに存在し、GitHub UI で「MIT License」と認識される
- [ ] `https://solo-shaho.quokka.trade/` で Web アプリが動作する
- [ ] `https://drillan.github.io/solo-shaho/` で Sphinx ドキュメントが公開される
- [ ] README に MIT バッジ・免責文・公開 docs へのリンクが含まれる
- [ ] GitHub リポジトリの About / topics が設定済み
- [ ] 旧 `*.workers.dev` URL が無効化されている
