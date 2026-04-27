# Clojure(Script) 再実装 — Phase 0+1+2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** solo-shaho の payroll コアロジックを ClojureScript に移植し、Excel スナップショット 127 ケースで bit-perfect 一致を達成する。

**Architecture:** `web-cljs/` を `experiment/clojure-port` ブランチ内にのみ作成。shadow-cljs ベースの CLJS プロジェクトとして単独で動作。テスト fixture は `web/tests/fixtures/excel-snapshot.json` を相対パスで共有。各モジュールは TS 版と 1:1 対応（`web/src/lib/payroll/calculate.ts` → `web-cljs/src/solo_shaho/payroll/calculate.cljs`）。

**Tech Stack:** ClojureScript 1.11+, shadow-cljs 2.27+, Malli (スキーマ), cljs.test (テスト), Node.js (test runner), npm (shadow-cljs 自体)

**Spec:** `docs/superpowers/specs/2026-04-27-clojure-reimpl-design.md`（同ブランチ内）

**Branch:** すべての作業は `experiment/clojure-port` で実施。**main にはマージしない**。

---

## File Structure

このフェーズで作成するファイル:

```
web-cljs/
├── .gitignore                                       Phase 0
├── package.json                                     Phase 0
├── deps.edn                                         Phase 0
├── shadow-cljs.edn                                  Phase 0
├── README.md                                        Phase 0
├── resources/public/index.html                      Phase 0
├── src/solo_shaho/
│   ├── core.cljs                                    Phase 0 (entry smoke test)
│   └── payroll/
│       ├── types.cljs                               Task 1.1 (Malli スキーマ + 検証)
│       ├── lookup.cljs                              Task 1.2
│       ├── rates.cljs                               Task 1.3
│       ├── remuneration.cljs                        Task 1.4
│       ├── round.cljs                               Task 1.5
│       ├── kaigo.cljs                               Task 1.6
│       ├── calculate.cljs                           Task 1.7
│       └── aggregate.cljs                           Task 1.8
└── test/solo_shaho/
    ├── smoke_test.cljs                              Phase 0 (cljs.test 動作確認)
    └── payroll/
        ├── types_test.cljs                          Task 1.1
        ├── lookup_test.cljs                         Task 1.2
        ├── rates_test.cljs                          Task 1.3
        ├── remuneration_test.cljs                   Task 1.4
        ├── round_test.cljs                          Task 1.5
        ├── kaigo_test.cljs                          Task 1.6
        ├── calculate_test.cljs                      Task 1.7
        ├── aggregate_test.cljs                      Task 1.8
        └── excel_snapshot_test.cljs                 Phase 2
```

**設計上の前提**:
- ファイル名はアンダースコア、namespace はハイフン（CLJS 慣習: `solo_shaho/payroll/calculate.cljs` ↔ `solo-shaho.payroll.calculate`）
- キー名はケバブケース（TS の `effectiveFrom` → `:effective-from`）
- 例外は `(throw (ex-info "..." {:error/type ...}))` 形式
- 全料率値は 1/100,000 単位整数（TS と同じ）
- `:std-remuneration` は 1000 の倍数（バリデーション制約、TS と同じ）

---

## Phase 0: 環境構築

### Task 0.1: ブランチ確認と web-cljs/ ディレクトリ作成

**Files:**
- Create: `web-cljs/`（ディレクトリ）

- [ ] **Step 1: 現在のブランチが experiment/clojure-port であることを確認**

```bash
git branch --show-current
```

Expected output: `experiment/clojure-port`

main にいた場合は `git checkout experiment/clojure-port` で切り替える（このブランチが存在しない場合は仕様書 §2 を参照してブランチを切る）。

- [ ] **Step 2: web-cljs/ ディレクトリ作成**

```bash
mkdir -p web-cljs/src/solo_shaho/payroll
mkdir -p web-cljs/test/solo_shaho/payroll
mkdir -p web-cljs/resources/public
```

- [ ] **Step 3: 確認**

```bash
ls -d web-cljs/src/solo_shaho/payroll web-cljs/test/solo_shaho/payroll web-cljs/resources/public
```

Expected: 3 ディレクトリすべて表示される。

### Task 0.2: web-cljs/.gitignore 作成

**Files:**
- Create: `web-cljs/.gitignore`

- [ ] **Step 1: ファイル作成**

`web-cljs/.gitignore` の内容:

```
# shadow-cljs
.shadow-cljs/
.cpcache/

# build output
resources/public/js/
resources/public/css/main.css

# node
node_modules/

# editor
.nrepl-port
.calva/
.lsp/
```

- [ ] **Step 2: 確認**

```bash
cat web-cljs/.gitignore
```

Expected: 上記の内容が表示される。

### Task 0.3: package.json 作成

**Files:**
- Create: `web-cljs/package.json`

- [ ] **Step 1: ファイル作成**

`web-cljs/package.json` の内容:

```json
{
  "name": "solo-shaho-cljs",
  "version": "0.0.1",
  "private": true,
  "description": "solo-shaho の Clojure(Script) 学習・実験ポート（experiment/clojure-port のみ）",
  "scripts": {
    "watch": "shadow-cljs watch app",
    "release": "shadow-cljs release app",
    "test": "shadow-cljs compile test && node out/test.js",
    "test:watch": "shadow-cljs watch test",
    "repl": "shadow-cljs cljs-repl app"
  },
  "devDependencies": {
    "shadow-cljs": "^2.27.0"
  }
}
```

- [ ] **Step 2: npm install 実行**

```bash
cd web-cljs && npm install
```

Expected: `node_modules/` が作成され、shadow-cljs がインストールされる。エラーなし。

### Task 0.4: deps.edn と shadow-cljs.edn 作成

**Files:**
- Create: `web-cljs/deps.edn`
- Create: `web-cljs/shadow-cljs.edn`

- [ ] **Step 1: deps.edn 作成**

`web-cljs/deps.edn` の内容（`clj` REPL や非 shadow-cljs ツール向け。shadow-cljs 自体はこれを参照しないスタンドアロン形式を採用するため、deps.edn は補助的扱い）:

```clojure
{:paths ["src" "test" "resources"]
 :deps  {org.clojure/clojure       {:mvn/version "1.12.0"}
         org.clojure/clojurescript {:mvn/version "1.11.132"}
         metosin/malli             {:mvn/version "0.16.4"}}}
```

- [ ] **Step 2: shadow-cljs.edn 作成**

`web-cljs/shadow-cljs.edn` の内容（スタンドアロン形式・`:dependencies` を直接記述）:

```clojure
{:source-paths ["src" "test"]
 :dependencies [[org.clojure/clojurescript "1.11.132"]
                [metosin/malli "0.16.4"]]

 :builds
 {:app  {:target     :browser
         :modules    {:main {:init-fn solo-shaho.core/init}}
         :output-dir "resources/public/js"
         :asset-path "/js"
         :devtools   {:http-root "resources/public"
                      :http-port 8080}}

  :test {:target    :node-test
         :output-to "out/test.js"
         :ns-regexp "-test$"}}}
```

- [ ] **Step 3: 構文チェック (compile dry-run)**

```bash
cd web-cljs && npx shadow-cljs help
```

Expected: shadow-cljs ヘルプが表示される。`Could not parse` 等のエラーなし。

### Task 0.5: index.html と core.cljs 作成（Smoke test）

**Files:**
- Create: `web-cljs/resources/public/index.html`
- Create: `web-cljs/src/solo_shaho/core.cljs`

- [ ] **Step 1: index.html 作成**

`web-cljs/resources/public/index.html` の内容:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <title>solo-shaho (CLJS experiment)</title>
  </head>
  <body>
    <div id="app">Loading…</div>
    <script src="/js/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: core.cljs 作成（最小エントリ）**

`web-cljs/src/solo_shaho/core.cljs` の内容:

```clojure
(ns solo-shaho.core)

(defn init []
  (let [el (.getElementById js/document "app")]
    (set! (.-textContent el) "solo-shaho CLJS experiment: Phase 0 OK")))
```

- [ ] **Step 3: ビルドして起動確認**

```bash
cd web-cljs && npx shadow-cljs compile app
```

Expected: ビルド成功 (`build completed`)、`resources/public/js/main.js` が生成される。

```bash
ls -1 web-cljs/resources/public/js/main.js
```

Expected: ファイルが存在する。

### Task 0.6: 最小テストで cljs.test 動作確認

shadow-cljs の `:node-test` ターゲットは `:ns-regexp "-test$"` で自動的にテスト namespace を発見・実行する。専用の runner は不要。

**Files:**
- Create: `web-cljs/test/solo_shaho/smoke_test.cljs`

- [ ] **Step 1: smoke_test.cljs 作成（最小テスト）**

`web-cljs/test/solo_shaho/smoke_test.cljs` の内容:

```clojure
(ns solo-shaho.smoke-test
  (:require [cljs.test :refer-macros [deftest is]]))

(deftest smoke-truthy
  (is (= 2 (+ 1 1))))
```

- [ ] **Step 2: テスト実行**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected output に以下が含まれる:

```
Testing solo-shaho.smoke-test
Ran 1 tests containing 1 assertions.
0 failures, 0 errors.
```

- [ ] **Step 3: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/
git commit -m "feat(web-cljs): scaffold shadow-cljs project (Phase 0)

experiment/clojure-port ブランチ内に CLJS 環境を構築。
shadow-cljs + Malli + cljs.test で smoke test まで通過。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: コミット成功。

### Task 0.7: README.md 作成

**Files:**
- Create: `web-cljs/README.md`

- [ ] **Step 1: README 作成**

`web-cljs/README.md` の内容:

````markdown
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
````

- [ ] **Step 2: コミット**

```bash
git add web-cljs/README.md
git commit -m "docs(web-cljs): add README for experimental Clojure port

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

Expected: コミット成功。

---

## Phase 1: payroll コア（TDD）

各 Task は **TDD サイクル**: ① テスト作成 → ② テスト実行（FAIL 確認）→ ③ 実装 → ④ テスト実行（PASS 確認）→ ⑤ コミット。

### Task 1.1: payroll.types — Malli スキーマと検証

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/types_test.cljs`
- Create: `web-cljs/src/solo_shaho/payroll/types.cljs`

- [ ] **Step 1: 失敗するテストを書く**

`web-cljs/test/solo_shaho/payroll/types_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.types-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.types :as t]))

(def valid-rate-entry
  {:effective-from "2026-04-01"
   :kenpo-base 9850
   :kaigo 1620
   :kosei 18300
   :kosodate 360
   :shien 0
   :note ""})

(def valid-app-state
  {:schema-version 1
   :profile {:name "" :birth-date nil}
   :remuneration-history []
   :monthly-notes {}})

(deftest current-schema-version
  (is (= 1 t/CURRENT-SCHEMA-VERSION)))

(deftest validate-rate-history-pass
  (is (= [valid-rate-entry] (t/validate-rate-history [valid-rate-entry]))))

(deftest kebabify-keys-converts-camelcase
  (testing "JSON 由来の camelCase キーを CLJS 流の kebab-case に変換する"
    (is (= {:effective-from "2026-04-01" :kenpo-base 9850}
           (t/kebabify-keys {:effectiveFrom "2026-04-01" :kenpoBase 9850})))
    (is (= [{:effective-from "x"}] (t/kebabify-keys [{:effectiveFrom "x"}])))
    (is (= "leaf" (t/kebabify-keys "leaf")))
    (is (= 42 (t/kebabify-keys 42)))))

(deftest validate-rate-history-rejects-non-vector
  (is (thrown-with-msg? js/Error #"rateHistory must be" (t/validate-rate-history "x"))))

(deftest validate-rate-history-rejects-bad-effective-from
  (is (thrown-with-msg? js/Error #"effectiveFrom"
        (t/validate-rate-history [(assoc valid-rate-entry :effective-from "2026/04/01")]))))

(deftest validate-rate-history-rejects-negative-kosei
  (is (thrown-with-msg? js/Error #"kosei"
        (t/validate-rate-history [(assoc valid-rate-entry :kosei -1)]))))

(deftest validate-app-state-pass
  (is (= valid-app-state (t/validate-app-state valid-app-state))))

(deftest validate-app-state-rejects-wrong-version
  (is (thrown-with-msg? js/Error #"schemaVersion"
        (t/validate-app-state (assoc valid-app-state :schema-version 2)))))

(deftest validate-app-state-normalizes-empty-birth-date
  (testing "空文字 birth-date は nil に正規化"
    (let [result (t/validate-app-state
                   (assoc-in valid-app-state [:profile :birth-date] ""))]
      (is (nil? (get-in result [:profile :birth-date]))))))

(deftest validate-app-state-rejects-bad-birth-date
  (is (thrown-with-msg? js/Error #"birthDate"
        (t/validate-app-state
          (assoc-in valid-app-state [:profile :birth-date] "garbage")))))

(deftest validate-app-state-rejects-non-multiple-of-1000-std-remuneration
  (is (thrown-with-msg? js/Error #"multiple of 1000"
        (t/validate-app-state
          (assoc valid-app-state :remuneration-history
                 [{:effective-from "2024-04-01"
                   :std-remuneration 88500
                   :gross-salary 83000
                   :note ""}])))))

(deftest validate-app-state-rejects-bad-monthly-notes-key
  (is (thrown-with-msg? js/Error #"monthlyNotes key"
        (t/validate-app-state
          (assoc valid-app-state :monthly-notes {"2026/04" {:memo "x"}})))))
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: コンパイルエラー（`Could not locate solo_shaho/payroll/types.cljs`）または、コンパイルが通っても `0 failures, 0 errors` 以外。

- [ ] **Step 3: types.cljs を実装**

`web-cljs/src/solo_shaho/payroll/types.cljs` の内容:

```clojure
(ns solo-shaho.payroll.types
  (:require [clojure.string :as str]))

(def CURRENT-SCHEMA-VERSION 1)

(def DATE-RE #"^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
(def MONTH-RE #"^\d{4}-(0[1-9]|1[0-2])$")

(defn- camel->kebab [s]
  (-> s
      (str/replace #"([a-z0-9])([A-Z])" "$1-$2")
      str/lower-case))

(defn kebabify-keys
  "外部 JSON（TS 互換の camelCase キー）を CLJS 流の kebab-case に変換する。
   Map / sequential を再帰的にたどる。リーフ値は変更しない。"
  [x]
  (cond
    (map? x) (into {} (for [[k v] x]
                        [(keyword (camel->kebab (name k))) (kebabify-keys v)]))
    (sequential? x) (mapv kebabify-keys x)
    :else x))

(defn- non-negative-int? [v]
  (and (number? v) (integer? v) (>= v 0)))

(defn- raise! [msg]
  (throw (ex-info msg {:error/type :validation})))

(defn- validate-rate-entry [e index]
  (when-not (map? e)
    (raise! (str "rateHistory[" index "] must be an object")))
  (let [{:keys [effective-from kenpo-base kaigo kosei kosodate shien note]} e]
    (when-not (and (string? effective-from) (re-matches DATE-RE effective-from))
      (raise! (str "rateHistory[" index "].effectiveFrom invalid: " effective-from)))
    (doseq [[k v] [[:kenpo-base kenpo-base] [:kaigo kaigo] [:kosei kosei]
                   [:kosodate kosodate] [:shien shien]]]
      (when-not (non-negative-int? v)
        (raise! (str "rateHistory[" index "]." (name k)
                     " must be non-negative integer, got: " (pr-str v)))))
    (when-not (string? note)
      (raise! (str "rateHistory[" index "].note must be a string")))
    {:effective-from effective-from
     :kenpo-base kenpo-base
     :kaigo kaigo
     :kosei kosei
     :kosodate kosodate
     :shien shien
     :note note}))

(defn validate-rate-history
  "unknown を RateEntry の vector として厳密に検証する。
   不正値は ex-info で例外送出（フォールバック禁止）。"
  [input]
  (when-not (sequential? input)
    (raise! "rateHistory must be an array"))
  (mapv validate-rate-entry input (range)))

(defn- validate-remuneration-entry [e index]
  (when-not (map? e)
    (raise! (str "remunerationHistory[" index "] must be an object")))
  (let [{:keys [effective-from std-remuneration gross-salary note]} e]
    (when-not (and (string? effective-from) (re-matches DATE-RE effective-from))
      (raise! (str "remunerationHistory[" index "].effectiveFrom invalid: " effective-from)))
    (when-not (non-negative-int? std-remuneration)
      (raise! (str "remunerationHistory[" index "].stdRemuneration must be non-negative integer")))
    (when-not (zero? (mod std-remuneration 1000))
      (raise! (str "remunerationHistory[" index "].stdRemuneration must be a multiple of 1000")))
    (when-not (non-negative-int? gross-salary)
      (raise! (str "remunerationHistory[" index "].grossSalary must be non-negative integer")))
    (when-not (string? note)
      (raise! (str "remunerationHistory[" index "].note must be a string")))
    {:effective-from effective-from
     :std-remuneration std-remuneration
     :gross-salary gross-salary
     :note note}))

(defn- validate-monthly-note [v key]
  (when-not (map? v)
    (raise! (str "monthlyNotes[" key "] must be an object")))
  (cond-> {}
    (contains? v :notified-amount)
    (assoc :notified-amount
           (let [n (:notified-amount v)]
             (when-not (non-negative-int? n)
               (raise! (str "monthlyNotes[" key "].notifiedAmount must be non-negative integer")))
             n))
    (contains? v :memo)
    (assoc :memo
           (let [m (:memo v)]
             (when-not (string? m)
               (raise! (str "monthlyNotes[" key "].memo must be a string")))
             m))))

(defn- normalize-birth-date [v]
  (cond
    (or (nil? v) (= v "")) nil
    (and (string? v) (re-matches DATE-RE v)) v
    :else (raise! "profile.birthDate must be null or YYYY-MM-DD")))

(defn validate-app-state
  "unknown を AppState として厳密に検証する。
   永続化・CSV インポートなど全入口で利用する想定。
   不正値は ex-info で例外送出（フォールバック禁止）。"
  [input]
  (when-not (map? input)
    (raise! "AppState must be an object"))
  (let [{:keys [schema-version profile remuneration-history monthly-notes]} input]
    (when-not (= schema-version CURRENT-SCHEMA-VERSION)
      (raise! (str "Unsupported schemaVersion: " (pr-str schema-version)
                   " (expected " CURRENT-SCHEMA-VERSION ")")))
    (when-not (map? profile)
      (raise! "profile must be an object"))
    (when-not (string? (:name profile))
      (raise! "profile.name must be a string"))
    (let [birth-date (normalize-birth-date (:birth-date profile))]
      (when-not (sequential? remuneration-history)
        (raise! "remunerationHistory must be an array"))
      (when-not (map? monthly-notes)
        (raise! "monthlyNotes must be an object"))
      (let [hist (mapv validate-remuneration-entry remuneration-history (range))
            notes (into {} (for [[k v] monthly-notes]
                             (do
                               (when-not (re-matches MONTH-RE k)
                                 (raise! (str "Invalid monthlyNotes key: " k)))
                               [k (validate-monthly-note v k)])))]
        {:schema-version CURRENT-SCHEMA-VERSION
         :profile {:name (:name profile) :birth-date birth-date}
         :remuneration-history hist
         :monthly-notes notes}))))
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected output に以下が含まれる:

```
Testing solo-shaho.payroll.types-test
... (各 deftest の名前)
0 failures, 0 errors.
```

types-test の deftest は 12 個（current-schema-version、validate-rate-history-pass、kebabify-keys-converts-camelcase、validate-rate-history-rejects-non-vector、validate-rate-history-rejects-bad-effective-from、validate-rate-history-rejects-negative-kosei、validate-app-state-pass、validate-app-state-rejects-wrong-version、validate-app-state-normalizes-empty-birth-date、validate-app-state-rejects-bad-birth-date、validate-app-state-rejects-non-multiple-of-1000-std-remuneration、validate-app-state-rejects-bad-monthly-notes-key）。smoke-test と合わせて全体で 13 deftest 程度になる。重要なのは `0 failures, 0 errors`。

- [ ] **Step 5: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/src/solo_shaho/payroll/types.cljs web-cljs/test/solo_shaho/payroll/types_test.cljs
git commit -m "feat(web-cljs): payroll.types schema validation (Phase 1)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.2: payroll.lookup — 効力発生日順検索

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/lookup_test.cljs`
- Create: `web-cljs/src/solo_shaho/payroll/lookup.cljs`

- [ ] **Step 1: 失敗するテストを書く**

`web-cljs/test/solo_shaho/payroll/lookup_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.lookup-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.lookup :as l]))

(def history
  [{:effective-from "2024-04-01" :v "A"}
   {:effective-from "2025-04-01" :v "B"}
   {:effective-from "2026-04-01" :v "C"}])

(deftest finds-most-recent-applicable
  (is (= "C" (:v (l/find-applicable-entry "2026-04" history "test")))))

(deftest finds-prior-when-target-before-newer
  (is (= "A" (:v (l/find-applicable-entry "2024-12" history "test"))))
  (is (= "B" (:v (l/find-applicable-entry "2025-06" history "test")))))

(deftest exact-effective-from-month-matches
  (testing "effectiveFrom <= targetDate (= ym-01) を満たす"
    (is (= "B" (:v (l/find-applicable-entry "2025-04" history "test"))))))

(deftest throws-when-no-applicable
  (is (thrown-with-msg? js/Error #"No applicable test entry"
        (l/find-applicable-entry "2024-01" history "test"))))

(deftest throws-when-empty-history
  (is (thrown-with-msg? js/Error #"No applicable test entry"
        (l/find-applicable-entry "2026-04" [] "test"))))
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `Could not locate solo_shaho/payroll/lookup.cljs` または該当テストが失敗。

- [ ] **Step 3: lookup.cljs を実装**

`web-cljs/src/solo_shaho/payroll/lookup.cljs` の内容:

```clojure
(ns solo-shaho.payroll.lookup)

(defn find-applicable-entry
  "effective-from <= year-month-01 を満たす最新エントリを返す。
   該当なしは ex-info で例外送出（フォールバック禁止）。"
  [year-month history error-context]
  (let [target-date (str year-month "-01")
        applicable (filter #(<= (compare (:effective-from %) target-date) 0) history)]
    (if (empty? applicable)
      (throw (ex-info (str "No applicable " error-context " entry found for " year-month)
                      {:error/type :entry-not-found
                       :context error-context
                       :year-month year-month}))
      (apply max-key :effective-from applicable))))
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected:

```
Testing solo-shaho.payroll.lookup-test
Ran 5 tests containing 6 assertions.
0 failures, 0 errors.
```

- [ ] **Step 5: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/src/solo_shaho/payroll/lookup.cljs web-cljs/test/solo_shaho/payroll/lookup_test.cljs
git commit -m "feat(web-cljs): payroll.lookup find-applicable-entry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.3: payroll.rates — 適用料率検索

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/rates_test.cljs`
- Create: `web-cljs/src/solo_shaho/payroll/rates.cljs`

- [ ] **Step 1: 失敗するテストを書く**

`web-cljs/test/solo_shaho/payroll/rates_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.rates-test
  (:require [cljs.test :refer-macros [deftest is]]
            [solo-shaho.payroll.rates :as r]))

(def rate-history
  [{:effective-from "2025-04-01" :kenpo-base 9910 :kaigo 1590 :kosei 18300 :kosodate 360 :shien 0 :note ""}
   {:effective-from "2026-04-01" :kenpo-base 9850 :kaigo 1620 :kosei 18300 :kosodate 360 :shien 0 :note ""}
   {:effective-from "2026-05-01" :kenpo-base 9850 :kaigo 1620 :kosei 18300 :kosodate 360 :shien 230 :note ""}])

(deftest applies-most-recent
  (is (= 230 (:shien (r/find-applicable-rate "2026-06" rate-history)))))

(deftest applies-rate-before-shien-introduction
  (is (= 0 (:shien (r/find-applicable-rate "2026-04" rate-history)))))

(deftest throws-when-before-history
  (is (thrown-with-msg? js/Error #"No applicable 料率"
        (r/find-applicable-rate "2024-01" rate-history))))
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: コンパイルエラーまたは該当テストが失敗。

- [ ] **Step 3: rates.cljs を実装**

`web-cljs/src/solo_shaho/payroll/rates.cljs` の内容:

```clojure
(ns solo-shaho.payroll.rates
  (:require [solo-shaho.payroll.lookup :as lookup]))

(defn find-applicable-rate
  "year-month に適用される料率エントリを返す。"
  [year-month history]
  (lookup/find-applicable-entry year-month history "料率"))
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `Testing solo-shaho.payroll.rates-test` が `Ran 3 tests` で 0 failures。

- [ ] **Step 5: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/src/solo_shaho/payroll/rates.cljs web-cljs/test/solo_shaho/payroll/rates_test.cljs
git commit -m "feat(web-cljs): payroll.rates find-applicable-rate

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.4: payroll.remuneration — 適用報酬月額検索

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/remuneration_test.cljs`
- Create: `web-cljs/src/solo_shaho/payroll/remuneration.cljs`

- [ ] **Step 1: 失敗するテストを書く**

`web-cljs/test/solo_shaho/payroll/remuneration_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.remuneration-test
  (:require [cljs.test :refer-macros [deftest is]]
            [solo-shaho.payroll.remuneration :as r]))

(def history
  [{:effective-from "2024-04-01" :std-remuneration 88000 :gross-salary 83000 :note ""}
   {:effective-from "2025-09-01" :std-remuneration 98000 :gross-salary 93000 :note ""}])

(deftest applies-prior-entry
  (is (= 88000 (:std-remuneration (r/find-applicable-remuneration "2025-08" history)))))

(deftest applies-newer-entry
  (is (= 98000 (:std-remuneration (r/find-applicable-remuneration "2025-09" history)))))

(deftest throws-when-before-history
  (is (thrown-with-msg? js/Error #"No applicable 報酬"
        (r/find-applicable-remuneration "2024-03" history))))
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: コンパイルエラーまたは該当テストが失敗。

- [ ] **Step 3: remuneration.cljs を実装**

`web-cljs/src/solo_shaho/payroll/remuneration.cljs` の内容:

```clojure
(ns solo-shaho.payroll.remuneration
  (:require [solo-shaho.payroll.lookup :as lookup]))

(defn find-applicable-remuneration
  "year-month に適用される報酬月額エントリを返す。"
  [year-month history]
  (lookup/find-applicable-entry year-month history "報酬"))
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `Ran 3 tests`、 0 failures。

- [ ] **Step 5: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/src/solo_shaho/payroll/remuneration.cljs web-cljs/test/solo_shaho/payroll/remuneration_test.cljs
git commit -m "feat(web-cljs): payroll.remuneration find-applicable-remuneration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.5: payroll.round — 端数処理（残額方式）

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/round_test.cljs`
- Create: `web-cljs/src/solo_shaho/payroll/round.cljs`

これは **Excel との bit-perfect 一致を支える要石**。テストケースは TS 版の round.test.ts と完全同値。

- [ ] **Step 1: 失敗するテストを書く**

`web-cljs/test/solo_shaho/payroll/round_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.round-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.round :as r]))

(deftest split-half-employee-50sen-or-less-floor
  (testing "M=10093.6 (totalSen=1009360) → 5047 (1円ズレ問題のキー数値)"
    (is (= 5047 (r/split-half-employee 1009360))))
  (testing "M=10094.4 (sen=40 < 50) → 5047"
    (is (= 5047 (r/split-half-employee 1009440))))
  (testing "M=10095.0 (sen=50, 切捨て) → 5047"
    (is (= 5047 (r/split-half-employee 1009500))))
  (testing "M=10095.2 (sen=60 > 50) → 5048"
    (is (= 5048 (r/split-half-employee 1009520))))
  (testing "整数銭・偶数 M=16104 → 8052"
    (is (= 8052 (r/split-half-employee 1610400)))))

(deftest split-half-employee-odd-totalsen-boundary
  (testing "totalSen=10101: M=101.01, M/2=50.505, MOD(M,2)=1.01>1 → 51"
    (is (= 51 (r/split-half-employee 10101))))
  (testing "totalSen=10093: M=100.93, M/2=50.465, MOD(M,2)=0.93≤1 → 50"
    (is (= 50 (r/split-half-employee 10093)))))

(deftest split-half-employer-residue
  (testing "M=10093.6 で社員 5047 → 事業主 5046 (合計 = ROUNDDOWN(M))"
    (is (= 5046 (r/split-half-employer 1009360 5047)))
    (is (= 10093 (+ 5047 5046))))
  (testing "M=16104 で社員 8052 → 事業主 8052"
    (is (= 8052 (r/split-half-employer 1610400 8052)))))

(deftest full-down-to-yen
  (testing "M=316.8 → 316 (拠出金の例)"
    (is (= 316 (r/full-down-to-yen 31680))))
  (testing "M=316.0 → 316"
    (is (= 316 (r/full-down-to-yen 31600))))
  (testing "M=316.99 → 316"
    (is (= 316 (r/full-down-to-yen 31699)))))
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: コンパイルエラーまたは該当テストが失敗。

- [ ] **Step 3: round.cljs を実装**

`web-cljs/src/solo_shaho/payroll/round.cljs` の内容:

```clojure
(ns solo-shaho.payroll.round)

(defn full-down-to-yen
  "Excel ROUNDDOWN(M, 0) 相当: 円未満を切捨て。
   入力は銭単位整数、出力は円整数。"
  [total-sen]
  (quot total-sen 100))

(defn split-half-employee
  "銭単位整数 total-sen を社員負担（円・整数）に分割する。
   Excel の `=INT(M/2)+IF(MOD(M,2)>1,1,0)` を bit-perfect 再現。

   アルゴリズム:
     half-yen-floored = floor(total-sen / 200)
     remainder        = total-sen mod 200      ;; 0..199 (sen)
     return remainder > 100 ? half-yen-floored + 1 : half-yen-floored

   remainder > 100 ⇔ MOD(M,2) > 1（yen with sen 端数 > 1.00 yen）。
   半額が奇数銭になるケースでも 0.5 銭の精度を失わない。"
  [total-sen]
  (let [half-yen-floored (quot total-sen 200)
        remainder (mod total-sen 200)]
    (if (> remainder 100)
      (inc half-yen-floored)
      half-yen-floored)))

(defn split-half-employer
  "残額方式: ROUNDDOWN(全額) - 社員負担。"
  [total-sen employee]
  (- (full-down-to-yen total-sen) employee))
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `Ran 4 tests containing 12 assertions`、 0 failures。

- [ ] **Step 5: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/src/solo_shaho/payroll/round.cljs web-cljs/test/solo_shaho/payroll/round_test.cljs
git commit -m "feat(web-cljs): payroll.round half-yen split + residue method

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.6: payroll.kaigo — 介護該当判定 + 年齢計算

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/kaigo_test.cljs`
- Create: `web-cljs/src/solo_shaho/payroll/kaigo.cljs`

JS の `Date` 演算（day=0 や day=-1 で前月に正規化）の挙動を CLJS でも再現する必要がある。`(js/Date. y m d)` は JS と同じ挙動。

- [ ] **Step 1: 失敗するテストを書く**

`web-cljs/test/solo_shaho/payroll/kaigo_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.kaigo-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.kaigo :as k]))

(deftest is-kaigo-applicable-nil-or-empty
  (is (false? (k/kaigo-applicable? nil 2026 4)))
  (is (false? (k/kaigo-applicable? "" 2026 4))))

(deftest is-kaigo-applicable-throws-on-bad-format
  (is (thrown-with-msg? js/Error #"birthDate must be YYYY-MM-DD"
        (k/kaigo-applicable? "garbage" 2026 4))))

(deftest is-kaigo-applicable-true-when-in-range
  (testing "1985-06-15 生まれ → 2026-04 月末 は [40歳誕生日前日, 65歳誕生日前日) に入る"
    (is (true? (k/kaigo-applicable? "1985-06-15" 2026 4)))))

(deftest is-kaigo-applicable-false-before-40th-eve
  (testing "1985-06-15 生まれ → 2025-05 月末 (= 2025-05-31) は 40歳誕生日前日 (2025-06-14) より前 → false"
    (is (false? (k/kaigo-applicable? "1985-06-15" 2025 5)))))

(deftest is-kaigo-applicable-true-on-40th-eve
  (testing "1985-06-15 生まれ → 2025-06 月末 (= 2025-06-30) は 40歳誕生日前日以降 → true"
    (is (true? (k/kaigo-applicable? "1985-06-15" 2025 6)))))

(deftest is-kaigo-applicable-false-from-65th-eve
  (testing "1985-06-15 生まれ → 2050-06 月末 (= 2050-06-30) は 65歳誕生日前日 (2050-06-14) 以降 → false"
    (is (false? (k/kaigo-applicable? "1985-06-15" 2050 6)))))

(deftest calculate-age-pre-birthday
  (testing "1985-06-15 生まれ、2026-04 月末 (= 2026-04-30) は誕生日前 → year差 - 1 = 40"
    (is (= 40 (k/calculate-age "1985-06-15" 2026 4)))))

(deftest calculate-age-post-birthday
  (testing "1985-06-15 生まれ、2026-07 月末 (= 2026-07-31) は誕生日後 → year差 = 41"
    (is (= 41 (k/calculate-age "1985-06-15" 2026 7)))))

(deftest calculate-age-on-birthday-month-and-day
  (testing "誕生日と末日の関係: 1985-06-15 生まれ、2026-06 月末 (= 2026-06-30) は誕生日後 → 41"
    (is (= 41 (k/calculate-age "1985-06-15" 2026 6)))))
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: コンパイルエラーまたは該当テストが失敗。

- [ ] **Step 3: kaigo.cljs を実装**

`web-cljs/src/solo_shaho/payroll/kaigo.cljs` の内容:

```clojure
(ns solo-shaho.payroll.kaigo
  (:require [solo-shaho.payroll.types :as t]))

(defn- end-of-month
  "year, month (1-based) の末日を js/Date で返す。
   js/Date の day=0 は前月に正規化される性質を利用して `new Date(y, m, 0)` で末日を得る。"
  [year month]
  (js/Date. year month 0))

(defn- parse-birth-date [s]
  (when-not (and (string? s) (re-matches t/DATE-RE s))
    (throw (ex-info (str "birthDate must be YYYY-MM-DD, got: " s)
                    {:error/type :invalid-birth-date :value s})))
  (let [[y m d] (->> (.split s "-") (map js/parseInt))]
    [y m d]))

(defn kaigo-applicable?
  "引数 year/month は納付月として解釈する。
   該当判定: 40歳誕生日の前日 ≦ 当月末日 < 65歳誕生日の前日
   birth-date が nil または空文字の場合は false。
   YYYY-MM-DD 形式以外の文字列の場合は ex-info を throw。"
  [birth-date year month]
  (if (or (nil? birth-date) (= birth-date ""))
    false
    (let [eom (end-of-month year month)
          [by bm bd] (parse-birth-date birth-date)
          ;; JS Date は day=0 や day=-1 で前月に正規化されるので bd-1 を渡せる
          b40 (js/Date. (+ by 40) (dec bm) (dec bd))
          b65 (js/Date. (+ by 65) (dec bm) (dec bd))]
      (and (>= (.getTime eom) (.getTime b40))
           (< (.getTime eom) (.getTime b65))))))

(defn calculate-age
  "年齢計算: 当月末日が誕生日より前なら year差 - 1。"
  [birth-date year month]
  (let [eom (end-of-month year month)
        [by bm bd] (parse-birth-date birth-date)
        eom-month (inc (.getMonth eom))
        eom-date (.getDate eom)
        diff (- year by)]
    (if (or (< eom-month bm)
            (and (= eom-month bm) (< eom-date bd)))
      (dec diff)
      diff)))
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `Ran 9 tests`、 0 failures。

- [ ] **Step 5: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/src/solo_shaho/payroll/kaigo.cljs web-cljs/test/solo_shaho/payroll/kaigo_test.cljs
git commit -m "feat(web-cljs): payroll.kaigo applicability + age calculation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.7: payroll.calculate — 月次計算 orchestrator

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/calculate_test.cljs`
- Create: `web-cljs/src/solo_shaho/payroll/calculate.cljs`

- [ ] **Step 1: 失敗するテストを書く**

`web-cljs/test/solo_shaho/payroll/calculate_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.calculate-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.calculate :as c]))

(def rate-2026-apr
  {:effective-from "2026-04-01"
   :kenpo-base 9850
   :kaigo 1620
   :kosei 18300
   :kosodate 360
   :shien 0
   :note ""})

(def rate-2026-may
  (assoc rate-2026-apr :effective-from "2026-05-01" :shien 230))

(def rate-history
  [(assoc rate-2026-apr :effective-from "2024-04-01")
   rate-2026-apr
   rate-2026-may])

(def remuneration-history
  [{:effective-from "2024-04-01" :std-remuneration 88000 :gross-salary 83000 :note ""}])

(def base-input
  {:year 2026 :month 4
   :std-remuneration 88000 :gross-salary 83000
   :birth-date "1985-06-15"
   :rates rate-2026-apr})

(deftest calculate-month-2026-04-kaigo-applicable
  (let [r (c/calculate-month base-input)]
    (testing "結果に year=2026, month=4 が埋め込まれる"
      (is (= 2026 (:year r)))
      (is (= 4 (:month r))))
    (testing "age = 40 (April month-end before June birthday)"
      (is (= 40 (:age r))))
    (testing "介護該当"
      (is (true? (:kaigo-applicable? r))))
    (testing "appliedKenpoRate = kenpo-base + kaigo"
      (is (= (+ 9850 1620) (:applied-kenpo-rate r))))
    (testing "kenpo-total = ROUNDDOWN(88000 * 11.47%) = 10093"
      (is (= 10093 (:kenpo-total r))))
    (testing "kenpo-employee + kenpo-employer = kenpo-total"
      (is (= (:kenpo-total r) (+ (:kenpo-employee r) (:kenpo-employer r)))))
    (testing "kenpo-employee = 5047"
      (is (= 5047 (:kenpo-employee r)))
      (is (= (- 10093 5047) (:kenpo-employer r))))
    (testing "kosei-total = ROUNDDOWN(88000 * 18.30%) = 16104"
      (is (= 16104 (:kosei-total r))))
    (testing "kosei-employee = kosei-employer = 8052"
      (is (= 8052 (:kosei-employee r)))
      (is (= 8052 (:kosei-employer r))))
    (testing "kosodate-employer = ROUNDDOWN(88000 * 0.36%) = 316"
      (is (= 316 (:kosodate-employer r)))
      (is (= 316 (:kosodate-total r))))
    (testing "shien = 0 (2026/04 月分は支援金開始前)"
      (is (= 0 (:shien-total r)))
      (is (= 0 (:shien-employee r)))
      (is (= 0 (:shien-employer r))))
    (testing "集計値が一致"
      (is (= (:employee-deduction-total r)
             (+ (:kenpo-employee r) (:kosei-employee r) (:shien-employee r))))
      (is (= (:employer-burden-total r)
             (+ (:kenpo-employer r) (:kosei-employer r)
                (:kosodate-employer r) (:shien-employer r))))
      (is (= (:payable-total r)
             (+ (:employee-deduction-total r) (:employer-burden-total r))))
      (is (= (:net-salary r) (- 83000 (:employee-deduction-total r)))))))

(deftest calculate-month-birth-date-nil
  (let [r (c/calculate-month (assoc base-input :birth-date nil))]
    (is (false? (:kaigo-applicable? r)))
    (is (= 9850 (:applied-kenpo-rate r)))
    (is (nil? (:age r)))))

(deftest calculate-month-2026-05-shien-introduced
  (let [r (c/calculate-month (assoc base-input
                                    :year 2026 :month 5
                                    :rates rate-2026-may))]
    (testing "shien-total = ROUNDDOWN(88000 * 0.23%) = 202"
      (is (= 202 (:shien-total r))))
    (testing "shien は労使折半"
      (is (= (:shien-total r) (+ (:shien-employee r) (:shien-employer r)))))))

(deftest calculate-range-3-months
  (let [results (c/calculate-range "2026-03" "2026-05"
                                   {:birth-date "1985-06-15"
                                    :remuneration-history remuneration-history
                                    :rate-history rate-history})]
    (is (= 3 (count results)))
    (is (= 0 (:shien-total (nth results 1))))
    (is (pos? (:shien-total (nth results 2))))))

(deftest calculate-range-start-after-end
  (is (= [] (c/calculate-range "2026-05" "2026-03"
                               {:birth-date "1985-06-15"
                                :remuneration-history remuneration-history
                                :rate-history rate-history}))))

(deftest calculate-range-bad-start-throws
  (is (thrown-with-msg? js/Error #"start must be YYYY-MM"
        (c/calculate-range "2026/03" "2026-05"
                           {:birth-date "1985-06-15"
                            :remuneration-history remuneration-history
                            :rate-history rate-history}))))

(deftest calculate-range-bad-end-throws
  (is (thrown-with-msg? js/Error #"end must be YYYY-MM"
        (c/calculate-range "2026-03" "garbage"
                           {:birth-date "1985-06-15"
                            :remuneration-history remuneration-history
                            :rate-history rate-history}))))
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: コンパイルエラーまたは該当テストが失敗。

- [ ] **Step 3: calculate.cljs を実装**

`web-cljs/src/solo_shaho/payroll/calculate.cljs` の内容:

```clojure
(ns solo-shaho.payroll.calculate
  (:require [solo-shaho.payroll.types :as t]
            [solo-shaho.payroll.kaigo :as kaigo]
            [solo-shaho.payroll.round :as round]
            [solo-shaho.payroll.rates :as rates]
            [solo-shaho.payroll.remuneration :as rem]))

(defn- pad2 [n]
  (let [s (str n)]
    (if (= 1 (count s)) (str "0" s) s)))

(defn- raise-ym! [value role]
  (throw (ex-info (str (name role) " must be YYYY-MM, got: " value)
                  {:error/type :invalid-year-month :role role :value value})))

(defn calculate-month
  "1 ヶ月分の社会保険料を計算する純粋関数。
   引数 input.year/month は納付月として解釈する（Excel と同じ）。"
  [{:keys [year month std-remuneration gross-salary birth-date rates]}]
  (let [is-kaigo (kaigo/kaigo-applicable? birth-date year month)
        age (when birth-date (kaigo/calculate-age birth-date year month))
        applied-kenpo-rate (+ (:kenpo-base rates) (if is-kaigo (:kaigo rates) 0))
        ;; 全額（銭単位整数）。std-remuneration が 1000 の倍数なので除算は厳密整数。
        kenpo-total-sen     (quot (* std-remuneration applied-kenpo-rate) 1000)
        kosei-total-sen     (quot (* std-remuneration (:kosei rates))    1000)
        kosodate-total-sen  (quot (* std-remuneration (:kosodate rates)) 1000)
        shien-total-sen     (quot (* std-remuneration (:shien rates))    1000)
        kenpo-total    (round/full-down-to-yen kenpo-total-sen)
        kosei-total    (round/full-down-to-yen kosei-total-sen)
        kosodate-total (round/full-down-to-yen kosodate-total-sen)
        shien-total    (round/full-down-to-yen shien-total-sen)
        kenpo-employee  (round/split-half-employee kenpo-total-sen)
        kosei-employee  (round/split-half-employee kosei-total-sen)
        shien-employee  (round/split-half-employee shien-total-sen)
        kenpo-employer  (round/split-half-employer kenpo-total-sen kenpo-employee)
        kosei-employer  (round/split-half-employer kosei-total-sen kosei-employee)
        kosodate-employer kosodate-total
        shien-employer  (round/split-half-employer shien-total-sen shien-employee)
        employee-deduction-total (+ kenpo-employee kosei-employee shien-employee)
        employer-burden-total    (+ kenpo-employer kosei-employer
                                    kosodate-employer shien-employer)
        payable-total            (+ employee-deduction-total employer-burden-total)
        net-salary               (- gross-salary employee-deduction-total)]
    {:year year
     :month month
     :age age
     :kaigo-applicable? is-kaigo
     :applied-kenpo-rate applied-kenpo-rate
     :kenpo-total kenpo-total
     :kosei-total kosei-total
     :kosodate-total kosodate-total
     :shien-total shien-total
     :kenpo-employee kenpo-employee
     :kosei-employee kosei-employee
     :shien-employee shien-employee
     :kenpo-employer kenpo-employer
     :kosei-employer kosei-employer
     :kosodate-employer kosodate-employer
     :shien-employer shien-employer
     :employee-deduction-total employee-deduction-total
     :employer-burden-total employer-burden-total
     :payable-total payable-total
     :net-salary net-salary}))

(defn- month-range-seq
  "\"YYYY-MM\" を start..end の範囲で lazy seq として返す純粋関数。"
  [start end]
  (let [[sy sm] (->> (.split start "-") (map js/parseInt))
        [ey em] (->> (.split end "-")   (map js/parseInt))]
    (->> (iterate (fn [[y m]]
                    (if (= m 12) [(inc y) 1] [y (inc m)]))
                  [sy sm])
         (take-while (fn [[y m]]
                       (or (< y ey) (and (= y ey) (<= m em)))))
         (map (fn [[y m]] (str y "-" (pad2 m)))))))

(defn calculate-range
  "範囲計算。AppState には依存しない（層分離）。
   start/end は包含。start > end なら空 vector。
   YYYY-MM 形式違反は ex-info で例外送出（silent な空配列返しを防ぐ）。"
  [start end {:keys [birth-date remuneration-history rate-history]}]
  (when-not (re-matches t/MONTH-RE start) (raise-ym! start :start))
  (when-not (re-matches t/MONTH-RE end) (raise-ym! end :end))
  (if (pos? (compare start end))
    []
    (mapv (fn [ym]
            (let [[y-str m-str] (.split ym "-")
                  year (js/parseInt y-str)
                  month (js/parseInt m-str)
                  rate (rates/find-applicable-rate ym rate-history)
                  rem-entry (rem/find-applicable-remuneration ym remuneration-history)]
              (calculate-month {:year year :month month
                                :std-remuneration (:std-remuneration rem-entry)
                                :gross-salary (:gross-salary rem-entry)
                                :birth-date birth-date
                                :rates rate})))
          (month-range-seq start end))))
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `Ran 7 tests`、0 failures（calculate.cljs の各 deftest が green）。

- [ ] **Step 5: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/src/solo_shaho/payroll/calculate.cljs web-cljs/test/solo_shaho/payroll/calculate_test.cljs
git commit -m "feat(web-cljs): payroll.calculate calculate-month + calculate-range

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.8: payroll.aggregate — 暦年集計

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/aggregate_test.cljs`
- Create: `web-cljs/src/solo_shaho/payroll/aggregate.cljs`

- [ ] **Step 1: 失敗するテストを書く**

`web-cljs/test/solo_shaho/payroll/aggregate_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.aggregate-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.aggregate :as a]))

(defn- mk-result [year month emp-ded emp-bur pay]
  {:year year :month month
   :employee-deduction-total emp-ded
   :employer-burden-total emp-bur
   :payable-total pay})

(deftest aggregate-empty
  (is (= [] (a/aggregate-by-calendar-year []))))

(deftest aggregate-single-year
  (let [results [(mk-result 2025 11 100 200 300)
                 (mk-result 2025 12 100 200 300)
                 (mk-result 2026 1 50 100 150)]
        summaries (a/aggregate-by-calendar-year results)]
    (is (= 2 (count summaries)))
    (let [[y2025 y2026] summaries]
      (is (= 2025 (:year y2025)))
      (is (= 2 (:month-count y2025)))
      (is (= 200 (:employee-deduction-total y2025)))
      (is (= 400 (:employer-burden-total y2025)))
      (is (= 600 (:payable-total y2025)))
      (is (= 2026 (:year y2026)))
      (is (= 1 (:month-count y2026)))
      (is (= 150 (:payable-total y2026))))))

(deftest aggregate-sorted-by-year
  (let [results [(mk-result 2026 1 0 0 0)
                 (mk-result 2024 1 0 0 0)
                 (mk-result 2025 1 0 0 0)]
        summaries (a/aggregate-by-calendar-year results)]
    (is (= [2024 2025 2026] (mapv :year summaries)))))
```

- [ ] **Step 2: テスト実行（FAIL を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: コンパイルエラーまたは該当テストが失敗。

- [ ] **Step 3: aggregate.cljs を実装**

`web-cljs/src/solo_shaho/payroll/aggregate.cljs` の内容:

```clojure
(ns solo-shaho.payroll.aggregate)

(defn aggregate-by-calendar-year
  "月次計算結果を暦年で集計する。MonthResult が year/month を内包しているため
   並列配列パターンや TaggedMonth ラッパーは不要。
   結果は year 昇順。"
  [months]
  (->> months
       (group-by :year)
       (map (fn [[year ms]]
              {:year year
               :month-count (count ms)
               :employee-deduction-total (reduce + 0 (map :employee-deduction-total ms))
               :employer-burden-total (reduce + 0 (map :employer-burden-total ms))
               :payable-total (reduce + 0 (map :payable-total ms))}))
       (sort-by :year)
       vec))
```

- [ ] **Step 4: テスト実行（PASS を確認）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `Ran 3 tests`、0 failures。

- [ ] **Step 5: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/src/solo_shaho/payroll/aggregate.cljs web-cljs/test/solo_shaho/payroll/aggregate_test.cljs
git commit -m "feat(web-cljs): payroll.aggregate by calendar year

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 1.9: rates.json バリデーションのスモークテスト

**Files:**
- Create: `web-cljs/test/solo_shaho/payroll/rates_data_test.cljs`

`web/src/lib/data/rates.json` を CLJS から読み出して `validate-rate-history` に通すことで、料率マスタのリグレッションを検出する（TS 版 `rates-data.test.ts` 相当）。

`shadow-cljs.edn` の `:source-paths` に `../web/src/lib/data` を追加せず、テスト時のみ Node.js の `fs` でファイルを読む方式を採用する（運用シンプル化）。

- [ ] **Step 1: テスト作成**

`web-cljs/test/solo_shaho/payroll/rates_data_test.cljs` の内容:

```clojure
(ns solo-shaho.payroll.rates-data-test
  (:require [cljs.test :refer-macros [deftest is testing]]
            [solo-shaho.payroll.types :as t]
            ["fs" :as fs]
            ["path" :as path]))

;; node-test の `out/test.js` から見て、プロジェクトルートは 2 階層上。
;; web-cljs/out/test.js → web-cljs/ → solo-shaho/ → web/src/lib/data/rates.json
(def rates-json-path
  (path/resolve js/__dirname ".." ".." "web" "src" "lib" "data" "rates.json"))

(defn- load-rates []
  (-> (fs/readFileSync rates-json-path "utf8")
      js/JSON.parse
      (js->clj :keywordize-keys true)
      t/kebabify-keys      ;; camelCase → kebab-case 変換（rates.json は TS 互換のため camelCase）
      :history))

(deftest rates-json-loads-and-validates
  (let [history (load-rates)]
    (is (sequential? history))
    (is (pos? (count history)))
    (testing "validate-rate-history が例外を投げない"
      (is (some? (t/validate-rate-history history))))))

(deftest rates-history-chronological-order
  (let [history (load-rates)
        validated (t/validate-rate-history history)]
    (is (= (mapv :effective-from validated)
           (sort (mapv :effective-from validated)))
        "rates.json の history は effective-from の昇順でなければならない")))
```

- [ ] **Step 2: テスト実行（PASS を期待）**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `Ran 2 tests`, 0 failures。`__dirname` から `web/src/lib/data/rates.json` への相対パス解決ができていることを確認。

問題が出る場合（例: `__dirname` の解決が異なる、JSON パスがずれる）は次の手順で確認:

```bash
cd web-cljs && node -e "console.log(__dirname); console.log(require('path').resolve('out', '..', '..', 'web', 'src', 'lib', 'data', 'rates.json'))"
ls /home/driller/repo/solo-shaho/web/src/lib/data/rates.json
```

期待: `__dirname` が `web-cljs/out` のとき、上記で `/home/driller/repo/solo-shaho/web/src/lib/data/rates.json` と表示される。階層数が違う場合（例: shadow-cljs が `out/` を別の場所に出力）は ".." の数を調整する。

- [ ] **Step 3: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/test/solo_shaho/payroll/rates_data_test.cljs
git commit -m "test(web-cljs): rates.json schema regression

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 2: Excel スナップショット結合

### Task 2.1: 共有 fixture を CLJS から読み出すテストを作成

**Files:**
- Create: `web-cljs/test/solo_shaho/excel_snapshot_test.cljs`

このテストは fixture (`web/tests/fixtures/excel-snapshot.json`) が存在する場合のみ実行する。fixture は個人データ依存のため `web/tests/fixtures/extract_from_excel.py` をローカルで一度実行して生成する必要がある。CI では実行されない（main にマージしないため CI 自体ない）。

**Excel snapshot fixture の構造（`web/tests/fixtures/excel-snapshot.test.ts` と TS 版で確認済み）:**

```json
{
  "cases": [
    {
      "year": 2026, "month": 4,
      "input": { "stdRemuneration": 88000, "grossSalary": 83000, "birthDate": "1985-06-15" },
      "expected": { "kenpoTotal": 10093, "kenpoEmployee": 5047, "kenpoEmployer": 5046, ... }
    },
    ...
  ]
}
```

`expected` のキーは TS の MonthResult フィールド名（camelCase）。CLJS は kebab-case なので、テスト時に変換する。

- [ ] **Step 1: テスト作成**

`web-cljs/test/solo_shaho/excel_snapshot_test.cljs` の内容:

```clojure
(ns solo-shaho.excel-snapshot-test
  (:require [cljs.test :refer-macros [deftest is testing async]]
            [solo-shaho.payroll.types :as t]
            [solo-shaho.payroll.calculate :as c]
            [solo-shaho.payroll.rates :as r]
            ["fs" :as fs]
            ["path" :as path]))

;; node-test の `out/test.js` から見てプロジェクトルートは 2 階層上。
(def fixture-path
  (path/resolve js/__dirname ".." ".." "web" "tests" "fixtures" "excel-snapshot.json"))

(def rates-json-path
  (path/resolve js/__dirname ".." ".." "web" "src" "lib" "data" "rates.json"))

(def fixture-exists?
  (try (fs/accessSync fixture-path) true (catch :default _ false)))

(defn- load-rate-history []
  (-> (fs/readFileSync rates-json-path "utf8")
      js/JSON.parse
      (js->clj :keywordize-keys true)
      t/kebabify-keys
      :history
      t/validate-rate-history))

(defn- load-fixture-cases []
  (-> (fs/readFileSync fixture-path "utf8")
      js/JSON.parse
      (js->clj :keywordize-keys true)
      :cases))

;; TS の camelCase → CLJS の kebab-case 変換表
(def expected-key->result-key
  {:kenpoTotal :kenpo-total
   :koseiTotal :kosei-total
   :kosodateTotal :kosodate-total
   :shienTotal :shien-total
   :kenpoEmployee :kenpo-employee
   :koseiEmployee :kosei-employee
   :shienEmployee :shien-employee
   :kenpoEmployer :kenpo-employer
   :koseiEmployer :kosei-employer
   :kosodateEmployer :kosodate-employer
   :shienEmployer :shien-employer
   :employeeDeductionTotal :employee-deduction-total
   :employerBurdenTotal :employer-burden-total
   :payableTotal :payable-total
   :netSalary :net-salary
   :appliedKenpoRate :applied-kenpo-rate
   :age :age
   :isKaigoApplicable :kaigo-applicable?
   :year :year
   :month :month})

(defn- pad2 [n]
  (let [s (str n)]
    (if (= 1 (count s)) (str "0" s) s)))

(when fixture-exists?
  (deftest excel-snapshot-bit-perfect
    (let [rate-history (load-rate-history)
          cases (load-fixture-cases)]
      (testing (str (count cases) " cases must match Excel exactly")
        (doseq [{:keys [year month input expected]} cases]
          (let [ym (str year "-" (pad2 month))
                rates (r/find-applicable-rate ym rate-history)
                got (c/calculate-month
                      {:year year :month month
                       :std-remuneration (:stdRemuneration input)
                       :gross-salary (:grossSalary input)
                       :birth-date (let [b (:birthDate input)]
                                     (if (or (nil? b) (= b "")) nil b))
                       :rates rates})]
            (doseq [[exp-key exp-val] expected]
              (let [result-key (expected-key->result-key exp-key)
                    actual (get got result-key)]
                (is (= exp-val actual)
                    (str year "/" month " " (name exp-key)
                         " expected=" exp-val " actual=" actual))))))))))

(when-not fixture-exists?
  (deftest excel-snapshot-fixture-missing-warning
    (testing (str "Fixture not found at " fixture-path
                  " — run web/tests/fixtures/extract_from_excel.py to generate it")
      ;; 存在しない場合はテストをスキップ扱いにする（fail させない）
      (is true))))
```

- [ ] **Step 2: fixture が存在しない状態でテスト実行**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js
```

Expected: `excel-snapshot-fixture-missing-warning` が pass し、`excel-snapshot-bit-perfect` は登録されない。`Ran ?? tests`、0 failures。

- [ ] **Step 3: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web-cljs/test/solo_shaho/excel_snapshot_test.cljs
git commit -m "test(web-cljs): Excel snapshot regression skeleton

fixture が存在しない場合は skip warning のみ。
fixture 生成は web/tests/fixtures/extract_from_excel.py（手動実行）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 2.2: fixture を生成して bit-perfect 一致を達成

**Files:**
- Read only: `web/tests/fixtures/extract_from_excel.py`
- Generated (gitignored): `web/tests/fixtures/excel-snapshot.json`

このタスクは **個人データ（Excel ブック）依存**なので、ローカルでのみ実行可能。

- [ ] **Step 1: Excel ブックの存在確認**

```bash
ls -la /home/driller/repo/solo-shaho/web/tests/fixtures/
```

Excel ブック（給与計算.xlsx）が `web/tests/fixtures/` または別パスに存在することを確認する。スクリプト中身を見て期待パスを確認:

```bash
grep -nE 'xlsx|workbook|load_workbook' /home/driller/repo/solo-shaho/web/tests/fixtures/extract_from_excel.py | head -20
```

- [ ] **Step 2: fixture を生成**

```bash
cd /home/driller/repo/solo-shaho
uv run python web/tests/fixtures/extract_from_excel.py
```

Expected: `web/tests/fixtures/excel-snapshot.json` が作成される（gitignore 対象）。

```bash
ls -la web/tests/fixtures/excel-snapshot.json
```

- [ ] **Step 3: CLJS 側で bit-perfect 一致を確認**

```bash
cd web-cljs && npx shadow-cljs compile test && node out/test.js 2>&1 | tee /tmp/cljs-snapshot-result.txt
grep -E 'snapshot|Ran|FAIL|ERROR' /tmp/cljs-snapshot-result.txt | head -30
```

Expected:
- `excel-snapshot-bit-perfect` が登録され、`Ran ?? tests` の中に含まれる
- `0 failures, 0 errors`
- 127 ケース分のアサーションがすべて pass

**もし FAIL が出た場合のデバッグ手順:**

1. 失敗ケースの year/month を特定（出力ログに記載される）
2. REPL で対応する月を再計算:

```bash
cd web-cljs && npx shadow-cljs cljs-repl app
```

REPL 内で:

```clojure
(require '[solo-shaho.payroll.calculate :as c]
         '[solo-shaho.payroll.rates :as r]
         '[solo-shaho.payroll.types :as t])
(require '["fs" :as fs])
(def rates-json (-> (fs/readFileSync "../web/src/lib/data/rates.json" "utf8")
                    js/JSON.parse
                    (js->clj :keywordize-keys true)
                    :history
                    t/validate-rate-history))
(c/calculate-month {:year 2020 :month 3
                    :std-remuneration 88000 :gross-salary 83000
                    :birth-date "1985-06-15"
                    :rates (r/find-applicable-rate "2020-03" rates-json)})
```

差異の典型的な原因と対処:
- 端数処理ズレ → `payroll.round` のテストを追加して TS 版と挙動を比較
- kaigo 該当判定ズレ → 月末日の計算 (`end-of-month`) で month を 1-based のまま渡しているか確認
- 料率参照ズレ → `find-applicable-entry` の比較演算子（`<=`）を確認

- [ ] **Step 4: 結果のコミット（fixture 自体はコミットしない、gitignore 対象）**

このタスクは「fixture を生成して結果を確認した」ことが成果物。新規ファイルは追加されない（CLJS 側コードは Task 2.1 で commit 済み）。

スナップショット 127 ケース pass を確認できた時点で受け入れ基準クリア。コミットは以下のメモコミット（任意）:

```bash
cd /home/driller/repo/solo-shaho
git commit --allow-empty -m "chore(web-cljs): Excel snapshot 127 cases bit-perfect ✓

Phase 2 受け入れ基準達成。fixture 自体は gitignore 対象。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 完了条件

このプランの完了 = 以下すべてを満たすこと:

1. ✅ `experiment/clojure-port` ブランチに `web-cljs/` 一式が存在
2. ✅ `npx shadow-cljs watch app` でローカル開発サーバが起動し、`http://localhost:8080` で "solo-shaho CLJS experiment: Phase 0 OK" が表示される
3. ✅ `npm test` で全テストが pass（payroll 各モジュール + rates-data + excel-snapshot）
4. ✅ Excel snapshot 127 ケースが bit-perfect で一致
5. ✅ main は無変更（`git log main` の HEAD が `77c4bd5` のまま、または当初取得時から進んでいない）

完了後、Phase 3（CSV 層）の計画書を新たに作成して進める。

---

## リスク・補足

- `js/Date` の月引数は **0-based**（`new Date(2026, 3, 1)` = 2026-04-01）。コード中で `(dec bm)` で変換していることに注意。
- shadow-cljs の `:node-test` ターゲットは `__dirname` が `web-cljs/out/` を指す。`path/resolve js/__dirname ".." ".." "web" ...` で `solo-shaho/web/...` を解決する前提（2 階層上がプロジェクトルート）。実際の階層数はビルド構成により変わる可能性があるので、Task 1.9 Step 2 のデバッグ手順で実測すること。
- `(re-matches DATE-RE s)` は文字列全体マッチ（`re-find` ではない）。
- Malli は依存に追加したが Phase 0+1+2 では使用していない（型は手書き検証）。Phase 3 以降で活用予定（仕様書 §5）。
