# solo-shaho

**マイクロ法人・個人事業主向け** 社会保険料の月次計算ツール。

社労士や SaaS に頼らず、自分のブラウザだけで月次の社会保険料計算を完結させることを目的にしています。協会けんぽ東京の保険料額表を一次情報として参照し、計算ロジックは公式の端数処理ルールに準拠しています(残額方式で折半額×2 と納付額のズレを構造的に回避)。

## 構成

| 形態 | 用途 | 状態 |
|---|---|---|
| **Web アプリ** (`web/`) | 日常運用の主役。ブラウザで動作、Cloudflare Workers Static Assets で配信 | Phase 1 リリース済み |
| **Excel ブック** (`給与計算.xlsx`) | 税務調査・印刷用のバックアップ | 凍結(現役) |
| **ドキュメント** (`docs/`) | Sphinx + MyST の仕様書 | 現役 |

## 対応スコープ

- ✅ 健康保険・介護保険(40〜64 歳の 2 号被保険者)
- ✅ 厚生年金保険
- ✅ 子ども・子育て拠出金(事業主のみ)
- ✅ 子ども・子育て支援金(令和 8 年 4 月分から・労使折半)
- ❌ 賞与・雇用保険・労災保険・所得税源泉徴収(Phase 2 候補)
- ❌ 複数社員(対象は 1 名)

## 個人情報の扱い

- 氏名・生年月日・標準報酬月額・給与額面は **あなたのブラウザの localStorage にのみ保存** されます
- 計算ロジックは静的アセットとして配信され、サーバへのリクエストは静的ファイル取得のみです
- CSP・X-Frame-Options 等のセキュリティヘッダで XSS による漏洩リスクを軽減しています
- Excel ファイル(`*.xlsx`)は gitignore で除外されており、リポジトリには計算ロジックと仕様書のみが含まれます

---

## Web アプリ版の使い方

### 必要な環境

- Node.js 22+
- pnpm

### ローカル開発

```sh
cd web
pnpm install
pnpm dev          # http://localhost:5173/(ホットリロード・CSP は反映されない)
```

### ローカル本番相当(Cloudflare Workers エミュレーション)

セキュリティヘッダー(CSP 等)も含めて本番と同じ動作を確認したい場合:

```sh
cd web
pnpm preview      # vite build → wrangler dev → http://localhost:8787/
```

別ターミナルでヘッダーを検証:

```sh
curl -I http://localhost:8787/
```

期待されるヘッダー: `Content-Security-Policy`(HTML 内 meta tag・sha256 hash 付き)、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、`Permissions-Policy: ...`、`X-Content-Type-Options: nosniff`

### Cloudflare Workers にデプロイ

#### 初回のみ

```sh
cd web
pnpm exec wrangler login        # ブラウザで Cloudflare 認証
```

#### 通常のデプロイ

```sh
cd web
pnpm deploy                      # vite build → wrangler deploy
```

デプロイ完了後、出力される URL でアクセス可能。

```
https://solo-shaho.<your-account>.workers.dev
```

#### 本番のセキュリティヘッダー検証

```sh
curl -I https://solo-shaho.<your-account>.workers.dev/
curl -s https://solo-shaho.<your-account>.workers.dev/ | grep -i content-security-policy
```

### Workers Builds(GitHub 連携・自動デプロイ)

Cloudflare ダッシュボードで以下を設定すると、`main` への push で自動デプロイ + PR ごとにプレビュー URL が発行されます。

| 項目 | 値 |
|---|---|
| Repository | あなたの GitHub リポジトリ |
| Root directory | `web` |
| Build watch path | `web/**` |
| Build command | `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build` |
| Deploy command | `pnpm exec wrangler deploy` |
| Production branch | `main` |
| Non-production branch builds | enabled |
| Node.js version | 22 |

### Web アプリの操作

1. **設定タブ** — 氏名(任意)、生年月日(必須)、報酬改定履歴(適用開始日 + 標準報酬月額 + 給与額面)を入力
2. **月次タブ** — 年月を選んで単月の計算結果(社員/事業主/拠出金/支援金/納付額/差引支給額)を確認、通知額を入力して差分を検算
3. **履歴タブ** — 範囲を指定してスプレッドシート風に複数月を表示、暦年ごとに集計行が挿入される
4. **⚙ I/O メニュー(右上)** — CSV エクスポート/インポート/全データクリア。バックアップ用に定期的にエクスポートを推奨

### CSV ファイル形式

ヘッダー + 3 セクション(`[profile]`、`[remuneration_history]`、`[monthly_notes]`)で構成された UTF-8 BOM 付き CSV。エクスポート時に Formula Injection 対策で先頭が `=`/`+`/`-`/`@`/TAB/CR の文字列はシングルクォートでエスケープされます。

### 料率改定への対応

協会けんぽや厚労省が料率改定を発表したら:

1. `web/src/lib/data/rates.json` の末尾に新エントリを追加
   ```json
   { "effectiveFrom": "2027-04-01", "kenpoBase": ..., "kaigo": ..., "kosei": ..., "kosodate": ..., "shien": ..., "note": "..." }
   ```
   - 全料率は **1/100,000 単位の整数**(例: 9.85% → 9850、0.17828 → 17828)
2. `pnpm test` で `rates-data.test.ts` の chronological order 等が通ることを確認
3. PR を作成してマージ → 自動デプロイ

### 計算精度の検証(オプション・ローカル)

Excel との完全一致を確認したい場合(個人データ含むため CI では実行されません):

```sh
# プロジェクトルートで Excel から fixture を抽出
uv run python web/tests/fixtures/extract_from_excel.py

# 抽出された fixture(gitignore 対象)を使って回帰テストを実行
cd web && pnpm test tests/fixtures/excel-snapshot.test.ts
```

127 ケース(2016/06〜2026/12 の月次計算結果)が Excel と bit-perfect で一致することを確認できます。

---

## Excel ブック版の使い方(バックアップ用)

Web アプリ版と独立に動作するため、税務調査・印刷用に必要なら従来通り使えます。

### Excel 再生成

```sh
uv sync                                              # Python 環境セットアップ
uv run python scripts/build_payroll.py               # 給与計算.xlsx を再生成
```

### ドキュメントビルド

```sh
uv sync --group docs
uv run --group docs sphinx-build -b html docs docs/_build/html
```

ビルド後、`docs/_build/html/index.html` をブラウザで開くと閲覧できます。

### 主なドキュメント目次

詳細は `docs/index.md` から参照してください。

- **概要** — ブック構成と残額方式の概略
- **シート仕様** — 設定 / 料率マスタ / 月次計算 の全列定義
- **計算ロジック** — 端数処理・残額方式・介護該当判定・XLOOKUP
- **料率の知識** — 健保 / 介護 / 厚年 / 拠出金 / 支援金 の制度概要と料率履歴
- **納付月セマンティクス** — 行ラベル「年/月」が意味するもの
- **経理処理** — 預り金と法定福利費の仕訳例
- **運用ガイド** — 料率改定・生年月日変更・標準報酬月額改定への対応
- **既知の制限** — 賞与・複数名・雇用保険等の未対応範囲
- **参考資料** — 公式 PDF・解説記事・用語集

---

## 開発者向け

### Web アプリの技術スタック

- TypeScript (strict)
- SvelteKit + Svelte 5 runes mode
- `@sveltejs/adapter-cloudflare`(全ルート prerender、SSR 無効)
- Tailwind CSS v3
- Vitest + happy-dom(unit) / Playwright(E2E)
- Cloudflare Workers Static Assets(`wrangler` 4.34+)

### コード組織

```
web/src/lib/
├── payroll/           # 純粋計算関数 + ドメイン型 + validator
│   ├── types.ts       # AppState / RateEntry / MonthInput / MonthResult + validateAppState / validateRateHistory
│   ├── lookup.ts      # 共通: 効力発生日順での XLOOKUP 相当
│   ├── rates.ts       # findApplicableRate
│   ├── remuneration.ts# findApplicableRemuneration
│   ├── kaigo.ts       # 介護該当判定 + 年齢計算
│   ├── round.ts       # 50銭以下切捨て・50銭超切上げ + 残額方式
│   ├── calculate.ts   # 月次計算 orchestrator
│   └── aggregate.ts   # 暦年集計
├── stores/            # Svelte stores + localStorage(payroll に依存しない)
│   ├── appState.ts    # AppState store + 永続化(DI)
│   ├── persistence.ts # 永続化エラー通知 store
│   └── results.ts     # 派生 store(計算結果)
├── csv/               # CSV import/export(payroll に依存)
│   ├── escape.ts      # Formula Injection bijection
│   ├── serialize.ts   # AppState → CSV
│   ├── parse.ts       # RFC 4180 1 パス state machine
│   └── validate.ts    # CSV → AppState
├── format/numbers.ts  # 円・% 表示の整形
└── data/rates.json    # 料率マスタ(17 エントリ)
```

層分離: `payroll/` は `stores/` に依存せず、`stores/` と `csv/` の両方が `payroll/types.ts` に片方向依存します。

### 設計仕様書 / 実装計画書

- `docs/superpowers/specs/2026-04-25-payroll-web-app-design.md` — Phase 1 設計仕様
- `docs/superpowers/plans/2026-04-25-payroll-web-app.md` — 34 タスク TDD 計画

### テスト・型チェック・リント

```sh
cd web
pnpm typecheck    # svelte-check
pnpm lint         # prettier + eslint
pnpm test         # vitest
pnpm format       # prettier --write
```

---

## ライセンス

未設定(個人プロジェクト)。
