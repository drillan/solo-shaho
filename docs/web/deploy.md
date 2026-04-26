# デプロイ・運用

Web アプリ(SvelteKit + Cloudflare Workers Static Assets)を自分で動かすための、ローカル開発から本番デプロイまでの手順をまとめます。

## 正規の公開 URL

本リポジトリの正規(作者運用)デプロイ先は **<https://solo-shaho.quokka.trade/>** です。フォークして自分用に運用する場合は、以下の手順で別の URL にデプロイしてください。

## 必要な環境

- Node.js 22+
- pnpm

## ローカル開発

ホットリロードで素早く反復するための開発モード。CSP 等のセキュリティヘッダは反映されません。

```sh
cd web
pnpm install
pnpm dev          # http://localhost:5173/
```

## ローカル本番相当(Cloudflare Workers エミュレーション)

セキュリティヘッダ(CSP 等)も含めて本番と同じ動作を確認したい場合は、Vite ビルドの成果物を `wrangler dev` で配信します。

```sh
cd web
pnpm preview      # vite build → wrangler dev → http://localhost:8787/
```

別ターミナルでヘッダを検証:

```sh
curl -I http://localhost:8787/
```

期待される主要ヘッダ:

- `Content-Security-Policy`(HTML 内 meta tag・sha256 hash 付き)
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: ...`
- `X-Content-Type-Options: nosniff`

## Cloudflare Workers にデプロイ

### 初回のみ — Cloudflare 認証

```sh
cd web
pnpm exec wrangler login        # ブラウザで Cloudflare 認証
```

### 通常のデプロイ

```sh
cd web
pnpm deploy                      # vite build → wrangler deploy
```

デプロイ完了後、出力される URL でアクセス可能:

```
https://solo-shaho.<your-account>.workers.dev
```

### 本番のセキュリティヘッダ検証

```sh
curl -I https://solo-shaho.<your-account>.workers.dev/
curl -s https://solo-shaho.<your-account>.workers.dev/ | grep -i content-security-policy
```

## Workers Builds(GitHub 連携・自動デプロイ)

Cloudflare ダッシュボードで Workers Builds を有効にすると、`main` への push で自動デプロイ + PR ごとにプレビュー URL が発行されます。

```{list-table}
:header-rows: 1
:widths: 30 70

* - 項目
  - 値
* - Repository
  - GitHub リポジトリ
* - Root directory
  - `web`
* - Build watch path
  - `web/**`
* - Build command
  - `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
* - Deploy command
  - `pnpm exec wrangler deploy`
* - Production branch
  - `main`
* - Non-production branch builds
  - enabled(PR ごとにプレビュー URL を発行)
* - Node.js version
  - 22
```

ビルドのいずれかのステップ(typecheck / lint / test / build)が失敗するとデプロイされず、PR には Check Run + コメントで通知されます。
