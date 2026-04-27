# Clojure(Script) 再実装 — 学習・実験ポート 設計仕様

**日付**: 2026-04-27
**位置づけ**: 試験的な取り組み (PoC / 学習)
**ブランチ**: `experiment/clojure-port`（**main には永久にマージしない**）

---

## 1. 目的とスコープ

### 目的

Clojure / ClojureScript の習得を主目的に、solo-shaho の **コア計算ロジック + 簡素な UI** を CLJS で再実装する。本番置き換えは未定。

### 含めるもの（In scope）

- `web/src/lib/payroll/*` 相当: 月次計算、料率検索、報酬月額検索、介護該当判定、端数処理、暦年集計
- `web/src/lib/csv/*` 相当: CSV import / export（Formula Injection 対策含む）
- `web/src/lib/stores/*` 相当: app-db, events, subscriptions（re-frame）
- 簡素な UI: 設定タブ / 月次タブ / 履歴タブ（Reagent + Hiccup）
- localStorage 永続化（TS 版と非衝突なキー名）
- Excel スナップショット 127 ケースとの bit-perfect 一致

### 含めないもの（Out of scope）

- SSR / prerender（`shadow-cljs watch` のローカル開発のみ）
- Cloudflare Workers へのデプロイ
- 本番 CI / GitHub Actions の追加
- Excel 生成（現 Python `scripts/build_payroll.py`）の再実装
- E2E テスト（Playwright）
- アクセシビリティの完全対応（既存 TS 版水準は目指さない）
- 雇用保険・賞与・所得税源泉徴収（TS 版と同じく Phase 2 候補）
- main への成果物のマージ（**設計仕様書を含む一切**）

## 2. リポジトリ構成とブランチ運用

### 配置

```
solo-shaho/                              ← main は TS のまま、CLJS は不到達
└── (experiment/clojure-port ブランチのみ)
    ├── web/                              既存 TS、変更なし
    ├── web-cljs/                         新規
    │   ├── deps.edn
    │   ├── shadow-cljs.edn
    │   ├── package.json                  shadow-cljs / npm 依存
    │   ├── src/solo_shaho/               CLJS ソース
    │   │   ├── payroll/
    │   │   ├── csv/
    │   │   ├── db.cljs                   re-frame app-db スキーマ
    │   │   ├── events.cljs               re-frame events
    │   │   ├── subs.cljs                 re-frame subscriptions
    │   │   ├── views/                    Reagent コンポーネント
    │   │   ├── format/
    │   │   └── core.cljs                 entry point
    │   ├── test/solo_shaho/               cljs.test テスト
    │   ├── resources/public/              shadow-cljs 出力先 + index.html
    │   └── README.md                      実験目的・運用ルール明記
    └── docs/superpowers/specs/
        └── 2026-04-27-clojure-reimpl-design.md   ← この文書もブランチ内のみ
```

### ブランチ運用ルール

- main → `experiment/clojure-port` の **片方向 merge** は許可（料率改定や fixture 修正の追従）
- `experiment/clojure-port` → main は **永久にしない**
- 実験を撤退する場合は `git branch -D experiment/clojure-port` で完全消去
- 設計仕様書（この文書）も main に存在しない

### Git ignore 補足

`web-cljs/.shadow-cljs/` `web-cljs/node_modules/` `web-cljs/resources/public/js/` を `web-cljs/.gitignore` に追加。

## 3. 技術スタック

| 層 | 採用技術 | 選定理由 |
|---|---|---|
| 言語 | ClojureScript | 学習対象 |
| ビルド | shadow-cljs | CLJS de facto standard、REPL 統合 |
| UI | Reagent | React ベース、教材豊富 |
| 状態管理 | re-frame | event/effect/subscription 分離が現コアと写像性が高い |
| テンプレート | Hiccup | Reagent 標準 |
| スキーマ | Malli | Clojure 流の型・契約定義を学べる |
| テスト | cljs.test | shadow-cljs 統合、追加依存なし |
| スタイル | 最小 CSS or Tailwind | 実装着手時に判断（学習主目的、装飾は最小） |

明示的に **使わないもの**:
- Tailwind の自動セットアップ（学習のノイズになるため）
- TypeScript（CLJS のみ）
- Vite / SvelteKit（shadow-cljs に統一）

## 4. 層構造とモジュール対応

現 TS 版の単方向依存をそのまま写像する。

### TS → CLJS 対応表

| TS (`web/src/lib/`) | CLJS (`web-cljs/src/solo_shaho/`) | 役割 |
|---|---|---|
| `payroll/types.ts` | `payroll/types.cljs` (Malli スキーマ) | データ型定義 + バリデーション |
| `payroll/lookup.ts` | `payroll/lookup.cljs` | 効力発生日順での履歴検索 |
| `payroll/rates.ts` | `payroll/rates.cljs` | 適用料率検索 |
| `payroll/remuneration.ts` | `payroll/remuneration.cljs` | 適用報酬月額検索 |
| `payroll/kaigo.ts` | `payroll/kaigo.cljs` | 介護該当判定 + 年齢計算 |
| `payroll/round.ts` | `payroll/round.cljs` | 50銭ルール + 残額方式（BigInt 使用） |
| `payroll/calculate.ts` | `payroll/calculate.cljs` | 月次計算 orchestrator |
| `payroll/aggregate.ts` | `payroll/aggregate.cljs` | 暦年集計 |
| `csv/escape.ts` | `csv/escape.cljs` | Formula Injection 双方向変換 |
| `csv/serialize.ts` | `csv/serialize.cljs` | AppState → CSV |
| `csv/parse.ts` | `csv/parse.cljs` | RFC 4180 パーサ |
| `csv/validate.ts` | `csv/validate.cljs` | CSV → AppState |
| `stores/appState.ts` | `db.cljs` + `events.cljs` | re-frame app-db + events |
| `stores/persistence.ts` | `events.cljs` 内の effect | localStorage 永続化 |
| `stores/results.ts` | `subs.cljs` | 派生 subscription |
| `format/numbers.ts` | `format/numbers.cljs` | 表示整形 |
| `data/rates.json` | `resources/public/rates.json` | 料率マスタ（共有可） |
| `routes/+page.svelte` | `views/settings.cljs` | 設定タブ |
| `routes/monthly/+page.svelte` | `views/monthly.cljs` | 月次タブ |
| `routes/history/+page.svelte` | `views/history.cljs` | 履歴タブ |
| `routes/+layout.svelte` | `views/layout.cljs` + `core.cljs` | ルートレイアウト |

### 依存ルール（変更なし）

```
payroll  ←  csv
   ↑          ↑
   └─── events / subs ───→ views
```

`payroll` は `events`/`subs`/`views` に依存しない。`csv` は `payroll/types` のみに依存する。

## 5. データ型と純粋関数

### Malli スキーマ例

```clojure
(ns solo-shaho.payroll.types
  (:require [malli.core :as m]))

(def RateEntry
  [:map
   [:effective-from :string]
   [:kenpo-base :int]
   [:kaigo :int]
   [:kosei :int]
   [:kosodate :int]
   [:shien :int]
   [:note {:optional true} :string]])

(def RemunerationEntry
  [:map
   [:effective-from :string]
   [:standard-monthly :int]
   [:gross-monthly :int]])

(def AppState
  [:map
   [:profile [:map
              [:name {:optional true} :string]
              [:birth-date :string]]]
   [:remuneration-history [:vector RemunerationEntry]]
   [:monthly-notes [:map-of :string :string]]])

(defn validate-app-state [data]
  (or (m/validate AppState data)
      (throw (ex-info "Invalid AppState"
                      {:error/type :validation
                       :errors (m/explain AppState data)}))))
```

### 計算関数例

```clojure
(ns solo-shaho.payroll.calculate
  (:require [solo-shaho.payroll.rates :as rates]
            [solo-shaho.payroll.remuneration :as rem]
            [solo-shaho.payroll.kaigo :as kaigo]
            [solo-shaho.payroll.round :as round]))

(defn calculate-month
  "月次計算。app-state と year-month (\"2026-04\") から MonthResult を返す純粋関数"
  [app-state year-month]
  (let [rate (rates/find-applicable (:remuneration-history app-state) year-month)
        ...]
    {:employee-share ...
     :employer-share ...
     :total ...
     ...}))
```

### キー命名規約

- TS の camelCase → CLJS の kebab-case（`effectiveFrom` → `:effective-from`）
- ファイル名のアンダースコア → namespace のハイフン（`solo_shaho/payroll/calculate.cljs` ↔ `solo-shaho.payroll.calculate`）

### BigInt 端数処理

`web/src/lib/payroll/round.ts` の残額方式（折半額×2 と納付額のズレを構造的に回避）は CLJS でも `js/BigInt` を直接使用して再現する。整数演算の正確性が bit-perfect 一致の前提。

## 6. 状態管理（re-frame マッピング）

### app-db 構造（TS 版 AppState と同形）

```clojure
{:profile {:name "サンプル 太郎"
           :birth-date "1986-04-15"}
 :remuneration-history [{...} ...]
 :monthly-notes {"2026-04" "..."}
 :ui {:current-tab :monthly
      :selected-year-month "2026-04"
      :history-range {:from "2026-01" :to "2026-12"}}}
```

`:ui` キーは UI 専用状態（永続化しない）。

### Events（主要なもの）

| Event | 役割 |
|---|---|
| `[:db/init]` | localStorage から読み出し、なければ空 state |
| `[:profile/update {...}]` | プロフィール更新 |
| `[:rate-history/add {...}]` | 報酬改定エントリ追加 |
| `[:rate-history/update idx {...}]` | 既存エントリ編集 |
| `[:rate-history/remove idx]` | エントリ削除 |
| `[:monthly-notes/set ym text]` | 月次メモ設定 |
| `[:csv/import csv-text]` | CSV インポート（バリデーション失敗で例外） |
| `[:csv/export]` | エフェクト経由で CSV ダウンロード |
| `[:db/clear]` | 全データクリア |
| `[:ui/set-tab tab]` | タブ切替 |

### Subscriptions

| Sub | 役割 |
|---|---|
| `[:profile]` | プロフィール |
| `[:rate-history]` | 報酬履歴（時系列ソート済） |
| `[:monthly/result year-month]` | 単月計算結果（派生） |
| `[:history/range from to]` | 範囲計算結果 + 暦年集計（派生） |
| `[:ui/current-tab]` | 現在タブ |

### Effects

| Effect | 役割 |
|---|---|
| `:fx/persist-to-local-storage` | app-db を localStorage に書き込む |
| `:fx/load-from-local-storage` | localStorage から読み出す |
| `:fx/download-csv` | CSV をブラウザダウンロード |

`:fx/persist-to-local-storage` は app-db の `:profile`, `:remuneration-history`, `:monthly-notes` のみを保存（`:ui` は除く）。

### LocalStorage キー

`solo-shaho-cljs-app-state-v1`（TS 版の `solo-shaho-app-state` と非衝突）。

## 7. テスト戦略（学習進捗の客観指標）

### 受け入れの最重要基準

**Excel スナップショット 127 ケース（2016/06〜2026/12 の月次計算結果）が bit-perfect で一致する**こと。これが達成できれば、コア計算ロジックの移植は完了とみなす。

### 共有 fixture の使用

```
web/tests/fixtures/excel-snapshot.json   (TS 側が抽出した JSON)
       ↑
       └── web-cljs/test/ から相対パスで読む
```

CLJS 側で `js/fetch` または `cljs.reader/read-string`（JSON は `js/JSON.parse`）で読み出す。**fixture を CLJS 側で再生成しない**（TS 側に一元化）。

### テスト分類

| 種別 | 対象 | フレームワーク |
|---|---|---|
| Unit | `payroll/`, `csv/` の各関数 | cljs.test |
| Integration | Excel スナップショット 127 ケース | cljs.test |
| Property-based（任意） | `csv` round-trip など | test.check (学習が進んでから) |
| UI / E2E | なし | スコープ外 |

### CI 不要

main にマージしないため CI は構築しない。ローカルで `npx shadow-cljs compile test && node out/test.js` を手動実行。

## 8. ビルド・開発フロー

### 初回セットアップ

```sh
git checkout experiment/clojure-port
cd web-cljs
npm install                       # shadow-cljs 等
```

### 開発ループ

```sh
# 開発サーバ + REPL
npx shadow-cljs watch app
# → http://localhost:8080
# REPL 接続:
npx shadow-cljs cljs-repl app
```

### テスト実行

```sh
npx shadow-cljs compile test
node out/test.js
```

### 本番ビルド（参考）

```sh
npx shadow-cljs release app
# → resources/public/js/main.js が生成される（学習段階では不要）
```

### REPL 駆動開発の重視

CLJS の最大の学習価値は REPL での即時評価。エディタ統合（Cursive / Calva / Conjure）を最初に整えることを README で推奨する。

## 9. エラー処理ポリシー

CLAUDE.md の **「フォールバック禁止」** を厳守する。

### 例外送出ルール

```clojure
;; 入力検証失敗
(throw (ex-info "Invalid CSV format"
                {:error/type :validation
                 :line line-num
                 :reason ...}))

;; localStorage 読み出し失敗
(throw (ex-info "Failed to load app-state"
                {:error/type :persistence
                 :cause (ex-message e)}))
```

### 禁止事項

- 例外を握りつぶして空 state を返す
- 「失敗時は空文字列を返す」「失敗時はゼロを入れる」式のフォールバック
- `(try ... (catch js/Error _ nil))` のような無音 catch

### UI 表示

re-frame 内の例外は `:fx/show-error-banner` エフェクトでバナー表示する。詳細はコンソールに出す（学習段階では十分）。

## 10. 段階的実装の進め方（参考）

writing-plans スキルで詳細化するが、大きな段階は次の通り:

1. **環境構築**: ブランチ作成済み → `web-cljs/` 雛形 (`deps.edn`, `shadow-cljs.edn`, package.json, README, .gitignore)
2. **Phase 1 — payroll コア**: types, lookup, rates, remuneration, kaigo, round, calculate, aggregate を CLJS で実装。各関数のユニットテスト
3. **Phase 2 — Excel スナップショット結合**: 127 ケースで bit-perfect 一致を達成
4. **Phase 3 — CSV 層**: escape, serialize, parse, validate を実装。round-trip テスト
5. **Phase 4 — re-frame 状態管理**: db, events, subs, effects（永続化含む）
6. **Phase 5 — UI 最低限**: layout + 設定タブ
7. **Phase 6 — UI 残り**: 月次タブ、履歴タブ
8. **Phase 7 — 仕上げ**: README、`shadow-cljs watch` で全機能動作確認

各 Phase の終わりに `git merge main` で main の更新を取り込む（料率改定があれば）。

## 11. 受け入れ基準（学習プロジェクトの完了条件）

1. `web-cljs/test/` の全ユニットテストが green
2. **Excel スナップショット 127 ケースが bit-perfect で一致**
3. ローカル `npx shadow-cljs watch app` で 設定 / 月次 / 履歴 タブが動作
4. CSV import/export が TS 版と同じファイル形式で round-trip 成立
5. localStorage 永続化が `solo-shaho-cljs-app-state-v1` キーで動作（TS 版と非衝突）
6. すべての成果物（この設計仕様書を含む）が `experiment/clojure-port` ブランチのみに存在し、main は無変更

## 12. リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| BigInt 端数処理の差異で snapshot 不一致 | 受け入れ基準未達成 | TS 版 `round.ts` をテストケース単位で 1:1 写像、差分が出たら REPL で逐次比較 |
| Reagent / re-frame の学習コストが想定超 | 期間延伸 | UI 着手前にチュートリアル（learnreframe.com 等）を 1 周する |
| main のコア更新（料率改定）取り込みコンフリクト | 開発停滞 | `web-cljs/` と `web/` はディレクトリが分離、`rates.json` 共有なら衝突は最小 |
| 学習意欲低下 | プロジェクト放置 | ブランチごと削除すれば完全撤退できる構造（リスク受容） |
| Excel fixture が個人データ依存 | CI 不可（既知の制約） | ローカル実行のみ。現 TS 版と同じ運用 |

## 13. 参考資料

- shadow-cljs: <https://shadow-cljs.org/>
- Reagent: <https://reagent-project.github.io/>
- re-frame: <https://day8.github.io/re-frame/>
- learnreframe.com（公式チュートリアル）
- Malli: <https://github.com/metosin/malli>
- 既存設計仕様: `docs/superpowers/specs/2026-04-25-payroll-web-app-design.md`（main にあり、この実験ブランチでも参照可能）
