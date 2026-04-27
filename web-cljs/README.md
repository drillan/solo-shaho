# web-cljs — solo-shaho の Clojure(Script) 学習・実験ポート

> **このディレクトリは `experiment/clojure-port` ブランチにのみ存在します**。
> main には永遠にマージされません。詳細は `docs/superpowers/specs/2026-04-27-clojure-reimpl-design.md` を参照してください。

## 目的

ClojureScript の習得を主目的に、solo-shaho の payroll コアロジックと簡素な UI を再実装する試み。本番置き換えは未定。

## 必要環境

- Node.js 22+
- Java 21+ (shadow-cljs 用)

## クイックスタート

```sh
npm install
npx shadow-cljs watch app    # http://localhost:8080
```

## テスト

```sh
npm test                     # 1 回実行
npm run test:watch           # ウォッチモード
```

## REPL

```sh
npx shadow-cljs cljs-repl app
```

エディタ統合は Calva (VS Code) / Cursive (IntelliJ) / Conjure (Vim) を推奨。

## 構成

```
src/solo_shaho/
├── core.cljs            entry point
└── payroll/             純粋計算ロジック
test/solo_shaho/
└── payroll/             ユニットテスト
resources/public/        shadow-cljs 出力先 + index.html
```

## fixture 共有

Excel スナップショットは TS 版に一元化されており、`../web/tests/fixtures/excel-snapshot.json` を相対パスで読み出します。fixture の生成は TS 側の `web/tests/fixtures/extract_from_excel.py` を使用してください。
