# 給与計算 Web アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `solo-shaho` の Excel 給与計算ブックを、Cloudflare Workers Static Assets で配信される SvelteKit 静的 SPA に置換する(Phase 1: 社会保険料計算 + 履歴管理 + CSV 入出力)。

**Architecture:** SvelteKit + `@sveltejs/adapter-cloudflare` を全ルート prerender + ssr=false で運用し、純静的サイトとして Workers にデプロイする。計算ロジックは AppState 非依存の純粋関数群として `src/lib/payroll/` に配置し、UI ストア層が AppState からドメインデータを抽出して呼び出す。料率は 1/100,000 単位の整数で保持し、整数演算で Excel と bit-perfect 一致させる。

**Tech Stack:** TypeScript (strict), SvelteKit, Tailwind CSS, Vitest, Playwright, pnpm, Wrangler ≥ 4.34.0, Cloudflare Workers Static Assets (Workers Builds CI)

**Spec:** `docs/superpowers/specs/2026-04-25-payroll-web-app-design.md`

**Revisions:**

- 2026-04-25 v2: hachimoku レビュー反映 — Critical/Important 計 9 件
  - Task 29 の `buildLabels` の silent failure(`std=0` フォールバック)を削除し、表示範囲を履歴最古でクランプする方式へ
  - Task 19 の `localStorage.setItem` 失敗を `persistenceErrorStore`(Task 18 新規追加)経由で UI バナー通知
  - Task 30 の `await file.text()` を try/catch で囲んで I/O 失敗を表示
  - Task 17 の `as any` を排除、`MonthResult` ベースの直接渡しへ
  - Task 8/15: `MonthResult` に `year`/`month` を追加し並列配列パターンを排除
  - Task 22/24: `AppState` 型の所在を `payroll/types.ts` に移し csv→stores の層方向逆転を解消
  - Task 19/24: `loadFromStorage` と `validateAndConvert` で `validateAppState` を共有
  - Task 23: parseCsv を 1 パス状態機械に書き換え、クォート内改行(RFC 4180 multiline)に対応
  - Task 25: ラウンドトリップテストに改行ケース追加
  - Task 27: 新規行のデフォルト `effectiveFrom` を当月1日にし、空文字での暗黙ゼロフォールバックを排除
  - Task 29: ローカル `YearSummary` 型を `payroll/types.ts` の単一定義に統合
  - File structure: `appState.ts` のコメントを「バージョン検証」に修正

---

## File Structure

```
solo-shaho/
├── docs/                                # 既存(継続)
├── scripts/                             # 既存(凍結)
├── 給与計算.xlsx                       # 既存(凍結)
├── pyproject.toml                       # 既存
└── web/                                 # 新規プロジェクト ROOT
    ├── src/
    │   ├── lib/
    │   │   ├── payroll/                 # 計算エンジン(stores 非依存・純粋関数群)
    │   │   │   ├── types.ts             # ドメイン型: RateEntry, RemunerationEntry, MonthInput, MonthResult, YearSummary, AppState, MonthlyNote, CURRENT_SCHEMA_VERSION, validateAppState
    │   │   │   ├── lookup.ts            # findApplicableEntry<T>, EntryNotFoundError
    │   │   │   ├── rates.ts             # findApplicableRate (lookup の薄いラッパー)
    │   │   │   ├── remuneration.ts      # findApplicableRemuneration
    │   │   │   ├── kaigo.ts             # isKaigoApplicable, calculateAge
    │   │   │   ├── round.ts             # splitHalfEmployee, splitHalfEmployer, fullDownToYen
    │   │   │   ├── calculate.ts         # calculateMonth, calculateRange
    │   │   │   └── aggregate.ts         # aggregateByCalendarYear (MonthResult[] を直接受ける)
    │   │   ├── stores/
    │   │   │   ├── appState.ts          # AppState store + localStorage 永続化 + バージョン検証(types.ts の validateAppState を共有)
    │   │   │   ├── persistence.ts       # 永続化エラー store(QuotaExceeded 等を伝播)
    │   │   │   └── results.ts           # 派生 store(計算結果)
    │   │   ├── csv/
    │   │   │   ├── escape.ts            # Formula Injection エスケープ + RFC 4180
    │   │   │   ├── serialize.ts         # AppState → CSV 文字列
    │   │   │   ├── parse.ts             # CSV 文字列 → 中間表現
    │   │   │   └── validate.ts          # 中間表現 → AppState バリデーション
    │   │   ├── format/
    │   │   │   └── numbers.ts           # 円表示・%表示の整形
    │   │   └── data/
    │   │       └── rates.json           # 料率マスタ(全 17 エントリ)
    │   ├── routes/
    │   │   ├── +layout.ts               # prerender = true, ssr = false
    │   │   ├── +layout.svelte           # タブナビ + I/O メニュー
    │   │   ├── +page.svelte             # 設定タブ(/)
    │   │   ├── monthly/+page.svelte     # 月次タブ(/monthly)
    │   │   └── history/+page.svelte     # 履歴タブ(/history)
    │   ├── app.html
    │   └── app.css
    ├── tests/
    │   ├── unit/                        # Vitest
    │   │   ├── lookup.test.ts
    │   │   ├── kaigo.test.ts
    │   │   ├── round.test.ts
    │   │   ├── calculate.test.ts
    │   │   ├── aggregate.test.ts
    │   │   ├── csv-escape.test.ts
    │   │   ├── csv-roundtrip.test.ts
    │   │   └── store-migration.test.ts
    │   └── fixtures/                    # Excel 抽出データ(gitignore)
    │       ├── extract_from_excel.py    # Python スクリプト
    │       ├── README.md
    │       └── excel-snapshot.json      # ← gitignore
    ├── static/
    │   ├── _headers                     # CSP 等のセキュリティヘッダ
    │   └── favicon.ico
    ├── wrangler.jsonc
    ├── svelte.config.js
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── tsconfig.json
    ├── eslint.config.js
    ├── .prettierrc
    ├── package.json
    └── pnpm-lock.yaml
```

---

## Phase A: Setup & Configuration

### Task 1: Initialize SvelteKit project under `web/`

**Files:**
- Create: `web/` (ディレクトリ)
- Create: `web/package.json`, `web/svelte.config.js`, `web/vite.config.ts`, `web/tsconfig.json`, `web/src/app.html`, `web/src/routes/+page.svelte` (SvelteKit 標準テンプレート)
- Modify: `.gitignore` (リポジトリルート)

- [ ] **Step 1: 既存リポジトリ root から web/ を作成しないこと(後続のセットアップが上書きするため)、空ディレクトリを先に作成する**

```bash
cd /home/driller/repo/solo-shaho
mkdir -p web
```

- [ ] **Step 2: SvelteKit + adapter-cloudflare で初期化**

```bash
cd web
pnpm create svelte@latest .
```

対話式プロンプトで以下を選択:
- Which Svelte app template? → **Skeleton project**
- Add type checking with TypeScript? → **Yes, using TypeScript syntax**
- Select additional options → ESLint と Prettier をチェック

Vitest と Playwright の追加もここで選択(可能なら)。

- [ ] **Step 3: 依存関係のインストールと Cloudflare アダプタへの差し替え**

```bash
pnpm install
pnpm add -D @sveltejs/adapter-cloudflare
pnpm remove @sveltejs/adapter-auto
```

- [ ] **Step 4: ルート `.gitignore` に web 配下の生成物を追加**

`/home/driller/repo/solo-shaho/.gitignore` に以下を追記:

```
# web app
web/.svelte-kit/
web/build/
web/node_modules/
web/.wrangler/
web/tests/fixtures/excel-snapshot.json
```

- [ ] **Step 5: 動作確認**

```bash
cd web
pnpm dev --port 5173
```

ブラウザで http://localhost:5173/ にアクセスし、SvelteKit の初期画面が出ることを確認。終了は Ctrl-C。

- [ ] **Step 6: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add web/ .gitignore
git commit -m "feat(web): scaffold SvelteKit project with TypeScript"
```

---

### Task 2: Configure adapter-cloudflare + prerender + ssr=false

**Files:**
- Modify: `web/svelte.config.js`
- Create: `web/src/routes/+layout.ts`
- Modify: `web/src/app.html`(必要なら lang 属性を `ja` に)

- [ ] **Step 1: `web/svelte.config.js` を Cloudflare アダプタに切り替え**

完全な内容:

```javascript
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  }
};

export default config;
```

- [ ] **Step 2: `web/src/routes/+layout.ts` を新規作成**

```typescript
// 全ルートをビルド時に HTML 化(純静的サイト化)
export const prerender = true;
// 個人データはブラウザ内のみ。SSR は無効
export const ssr = false;
```

- [ ] **Step 3: `web/src/app.html` の `<html>` タグ言語を ja に変更**

```html
<html lang="ja">
```

- [ ] **Step 4: ビルドが通ることを確認**

```bash
cd web
pnpm build
```

期待: ビルド成功し、`.svelte-kit/cloudflare/` 配下にファイルが生成される。

- [ ] **Step 5: コミット**

```bash
git add web/svelte.config.js web/src/routes/+layout.ts web/src/app.html
git commit -m "feat(web): switch to adapter-cloudflare with full prerendering"
```

---

### Task 3: Add Tailwind CSS

**Files:**
- Modify: `web/package.json` (依存追加)
- Create: `web/postcss.config.js`, `web/tailwind.config.js`
- Modify: `web/src/app.css`
- Modify: `web/src/routes/+layout.svelte` (グローバル CSS 取り込み)

- [ ] **Step 1: 依存関係をインストール**

```bash
cd web
pnpm add -D tailwindcss postcss autoprefixer
pnpm exec tailwindcss init -p
```

- [ ] **Step 2: `web/tailwind.config.js` を更新**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: { extend: {} },
  plugins: []
};
```

- [ ] **Step 3: `web/src/app.css` に Tailwind ディレクティブを追加(全置換)**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: `web/src/routes/+layout.svelte` を新規作成しグローバル CSS を取り込む**

```html
<script lang="ts">
  import '../app.css';
</script>

<slot />
```

- [ ] **Step 5: ビルド確認**

```bash
pnpm build
```

期待: 成功。

- [ ] **Step 6: コミット**

```bash
git add web/
git commit -m "feat(web): add Tailwind CSS"
```

---

### Task 4: Configure `wrangler.jsonc` (minimal, static-only)

**Files:**
- Create: `web/wrangler.jsonc`
- Modify: `web/package.json` (deploy/preview スクリプト)

- [ ] **Step 1: `web/wrangler.jsonc` を新規作成**

```json
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "solo-shaho",
  "compatibility_date": "2026-04-25",
  "assets": {
    "directory": ".svelte-kit/cloudflare"
  }
}
```

注意: 純静的サイトのため `main`、`compatibility_flags`、`observability` は意図的に省略。

- [ ] **Step 2: `web/package.json` の `scripts` セクションに deploy / preview を追加**

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "wrangler dev",
    "deploy": "wrangler deploy",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write .",
    "typecheck": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json"
  }
}
```

- [ ] **Step 3: wrangler を dev dependency として追加**

```bash
pnpm add -D wrangler
```

- [ ] **Step 4: ローカルプレビューで動作確認**

```bash
pnpm build
pnpm preview
```

期待: `http://localhost:8787/` 等で SvelteKit のスケルトン画面が表示される。Ctrl-C で停止。

- [ ] **Step 5: コミット**

```bash
git add web/wrangler.jsonc web/package.json web/pnpm-lock.yaml
git commit -m "feat(web): add minimal wrangler.jsonc for static-only deployment"
```

---

### Task 5: Add `_headers` with CSP and security headers

**Files:**
- Create: `web/static/_headers`

- [ ] **Step 1: `web/static/_headers` を新規作成**

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: geolocation=(), camera=(), microphone=(), payment=(), usb=()
  X-Content-Type-Options: nosniff
```

- [ ] **Step 2: ビルドして `.svelte-kit/cloudflare/_headers` にコピーされることを確認**

```bash
cd web
pnpm build
ls -la .svelte-kit/cloudflare/_headers
```

期待: ファイルが存在する(SvelteKit の static アダプタが `static/` 配下を成果物にコピーする)。

- [ ] **Step 3: コミット**

```bash
git add web/static/_headers
git commit -m "feat(web): add _headers with CSP and security headers"
```

---

### Task 6: Configure Vitest

**Files:**
- Modify: `web/vite.config.ts`
- Modify: `web/tsconfig.json` (vitest 型を含める)
- Create: `web/tests/unit/smoke.test.ts` (動作確認のための初期テスト)

- [ ] **Step 1: vitest を依存に追加**

```bash
cd web
pnpm add -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: `web/vite.config.ts` を更新(全置換)**

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'happy-dom'
  }
});
```

- [ ] **Step 3: happy-dom を追加**

```bash
pnpm add -D happy-dom
```

- [ ] **Step 4: `web/tests/unit/smoke.test.ts` を作成**

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('vitest is wired up', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: テスト実行**

```bash
pnpm test
```

期待: 1 passed。

- [ ] **Step 6: コミット**

```bash
git add web/
git commit -m "test(web): wire up Vitest with happy-dom"
```

---

### Task 7: Add ESLint config (使用ルール最小)

**Files:**
- Modify: `web/eslint.config.js`(または `.eslintrc.cjs`)

- [ ] **Step 1: lint 実行で現状エラーがないことを確認**

```bash
cd web
pnpm lint
```

期待: pnpm create svelte で生成された設定で通る。失敗する場合は次のステップで対処。

- [ ] **Step 2: 失敗時のみ、最小設定に落とす(`web/eslint.config.js`)**

```javascript
import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  },
  { ignores: ['build/', '.svelte-kit/', 'dist/'] }
);
```

- [ ] **Step 3: 再度 lint 実行**

```bash
pnpm lint
```

期待: エラーゼロ。

- [ ] **Step 4: コミット(変更があった場合のみ)**

```bash
git add web/eslint.config.js
git commit -m "chore(web): minimal ESLint config" || echo "no changes"
```

---

## Phase B: Calculation Engine (TDD)

### Task 8: Define core types

**Files:**
- Create: `web/src/lib/payroll/types.ts`

- [ ] **Step 1: 型定義ファイルを作成(ドメイン型 + 構造バリデータ)**

```typescript
// web/src/lib/payroll/types.ts

export const CURRENT_SCHEMA_VERSION = 1 as const;

/** 料率履歴の 1 エントリ。すべて 1/100,000 単位の整数。 */
export interface RateEntry {
  effectiveFrom: string;        // "YYYY-MM-DD"
  kenpoBase: number;            // 例: 9850 = 9.85% (kenpoBase 2026)
  kaigo: number;                // 例: 1620 = 1.62%
  kosei: number;                // 例: 18300 = 18.30% / 17828 = 17.828% (歴史的)
  kosodate: number;             // 例: 360 = 0.36%
  shien: number;                // 例: 230 = 0.23% (2026/05 から)
  note: string;
}

/** 報酬改定履歴の 1 エントリ。note は必須(空文字許容)。 */
export interface RemunerationEntry {
  effectiveFrom: string;        // "YYYY-MM-DD"
  stdRemuneration: number;      // 標準報酬月額(整数円・1000 の倍数)
  grossSalary: number;          // 給与額面(整数円)
  note: string;                 // 空文字許容、undefined 不可(RateEntry と対称)
}

/** calculateMonth への入力。 */
export interface MonthInput {
  year: number;                 // 納付月の年
  month: number;                // 納付月の月 (1..12)
  stdRemuneration: number;
  grossSalary: number;
  birthDate: string | null;
  rates: RateEntry;
}

/** calculateMonth の戻り値。year/month を内包し、並列配列パターンを排除する。 */
export interface MonthResult {
  year: number;
  month: number;
  age: number | null;
  isKaigoApplicable: boolean;
  /** 適用済み健保料率(1/100,000 単位整数) = kenpoBase + (isKaigoApplicable ? kaigo : 0) */
  appliedKenpoRate: number;
  // 全額(整数円)
  kenpoTotal: number;
  koseiTotal: number;
  kosodateTotal: number;        // 事業主のみ・全額切捨て後の整数円
  shienTotal: number;
  // 社員側
  kenpoEmployee: number;
  koseiEmployee: number;
  shienEmployee: number;
  // 事業主側(残額方式)
  kenpoEmployer: number;
  koseiEmployer: number;
  kosodateEmployer: number;
  shienEmployer: number;
  // 集計
  employeeDeductionTotal: number;
  employerBurdenTotal: number;
  payableTotal: number;
  netSalary: number;
}

/** 暦年集計の戻り値。 */
export interface YearSummary {
  year: number;
  monthCount: number;
  employeeDeductionTotal: number;
  employerBurdenTotal: number;
  payableTotal: number;
}

/** 月次メモ(ノート)。月情報は AppState.monthlyNotes の Record キーで一意に表現する。 */
export interface MonthlyNote {
  notifiedAmount?: number;
  memo?: string;
}

/** アプリケーションの永続化ドメイン状態。 */
export interface AppState {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  profile: {
    name: string;
    birthDate: string | null;
  };
  remunerationHistory: RemunerationEntry[];
  monthlyNotes: Record<string, MonthlyNote>;
}

export function createDefaultAppState(): AppState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { name: '', birthDate: null },
    remunerationHistory: [],
    monthlyNotes: {}
  };
}

export class AppStateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppStateValidationError';
  }
}

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * unknown を AppState として厳密に検証する。
 * loadFromStorage と csv/validate.ts の両方から呼び、入口での検証強度を統一する。
 * 不正値はすべて AppStateValidationError として throw(フォールバック禁止)。
 */
export function validateAppState(input: unknown): AppState {
  if (typeof input !== 'object' || input === null) {
    throw new AppStateValidationError('AppState must be an object');
  }
  const o = input as Record<string, unknown>;

  if (o.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new AppStateValidationError(
      `Unsupported schemaVersion: ${String(o.schemaVersion)} (expected ${CURRENT_SCHEMA_VERSION})`
    );
  }

  if (typeof o.profile !== 'object' || o.profile === null) {
    throw new AppStateValidationError('profile must be an object');
  }
  const p = o.profile as Record<string, unknown>;
  if (typeof p.name !== 'string') {
    throw new AppStateValidationError('profile.name must be a string');
  }
  if (p.birthDate !== null && (typeof p.birthDate !== 'string' || (p.birthDate !== '' && !DATE_RE.test(p.birthDate)))) {
    throw new AppStateValidationError('profile.birthDate must be null or YYYY-MM-DD');
  }

  if (!Array.isArray(o.remunerationHistory)) {
    throw new AppStateValidationError('remunerationHistory must be an array');
  }
  const remunerationHistory = o.remunerationHistory.map((e, i) => validateRemunerationEntry(e, i));

  if (typeof o.monthlyNotes !== 'object' || o.monthlyNotes === null || Array.isArray(o.monthlyNotes)) {
    throw new AppStateValidationError('monthlyNotes must be an object');
  }
  const monthlyNotes: Record<string, MonthlyNote> = {};
  for (const [key, value] of Object.entries(o.monthlyNotes as Record<string, unknown>)) {
    if (!MONTH_RE.test(key)) {
      throw new AppStateValidationError(`Invalid monthlyNotes key: ${key}`);
    }
    monthlyNotes[key] = validateMonthlyNote(value, key);
  }

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { name: p.name, birthDate: p.birthDate as string | null },
    remunerationHistory,
    monthlyNotes
  };
}

function validateRemunerationEntry(input: unknown, index: number): RemunerationEntry {
  if (typeof input !== 'object' || input === null) {
    throw new AppStateValidationError(`remunerationHistory[${index}] must be an object`);
  }
  const e = input as Record<string, unknown>;
  if (typeof e.effectiveFrom !== 'string' || !DATE_RE.test(e.effectiveFrom)) {
    throw new AppStateValidationError(`remunerationHistory[${index}].effectiveFrom invalid: ${String(e.effectiveFrom)}`);
  }
  if (!isNonNegativeInt(e.stdRemuneration)) {
    throw new AppStateValidationError(`remunerationHistory[${index}].stdRemuneration must be non-negative integer`);
  }
  if (!isNonNegativeInt(e.grossSalary)) {
    throw new AppStateValidationError(`remunerationHistory[${index}].grossSalary must be non-negative integer`);
  }
  if (typeof e.note !== 'string') {
    throw new AppStateValidationError(`remunerationHistory[${index}].note must be a string`);
  }
  return {
    effectiveFrom: e.effectiveFrom,
    stdRemuneration: e.stdRemuneration,
    grossSalary: e.grossSalary,
    note: e.note
  };
}

function validateMonthlyNote(input: unknown, key: string): MonthlyNote {
  if (typeof input !== 'object' || input === null) {
    throw new AppStateValidationError(`monthlyNotes[${key}] must be an object`);
  }
  const n = input as Record<string, unknown>;
  const out: MonthlyNote = {};
  if (n.notifiedAmount !== undefined) {
    if (!isNonNegativeInt(n.notifiedAmount)) {
      throw new AppStateValidationError(`monthlyNotes[${key}].notifiedAmount must be non-negative integer`);
    }
    out.notifiedAmount = n.notifiedAmount;
  }
  if (n.memo !== undefined) {
    if (typeof n.memo !== 'string') {
      throw new AppStateValidationError(`monthlyNotes[${key}].memo must be a string`);
    }
    out.memo = n.memo;
  }
  return out;
}

function isNonNegativeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}
```

- [ ] **Step 2: 型チェック**

```bash
cd web
pnpm typecheck
```

期待: エラーゼロ。

- [ ] **Step 3: validateAppState のテストを追加**

`web/tests/unit/types-validate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateAppState,
  AppStateValidationError,
  createDefaultAppState
} from '$lib/payroll/types';

describe('validateAppState', () => {
  it('accepts createDefaultAppState() output', () => {
    expect(() => validateAppState(createDefaultAppState())).not.toThrow();
  });

  it('throws on non-object input', () => {
    expect(() => validateAppState(null)).toThrow(AppStateValidationError);
    expect(() => validateAppState('x')).toThrow(AppStateValidationError);
  });

  it('throws on schemaVersion mismatch', () => {
    expect(() => validateAppState({ schemaVersion: 2 })).toThrow(/schemaVersion/);
  });

  it('throws when profile.name is not a string', () => {
    expect(() =>
      validateAppState({
        schemaVersion: 1,
        profile: { name: 123, birthDate: null },
        remunerationHistory: [],
        monthlyNotes: {}
      })
    ).toThrow(/profile.name/);
  });

  it('throws when profile.birthDate is invalid format', () => {
    expect(() =>
      validateAppState({
        schemaVersion: 1,
        profile: { name: '', birthDate: '1985/06/15' },
        remunerationHistory: [],
        monthlyNotes: {}
      })
    ).toThrow(/birthDate/);
  });

  it('throws when remunerationHistory is not an array', () => {
    expect(() =>
      validateAppState({
        schemaVersion: 1,
        profile: { name: '', birthDate: null },
        remunerationHistory: {},
        monthlyNotes: {}
      })
    ).toThrow(/remunerationHistory/);
  });

  it('throws when remunerationHistory entry has invalid effectiveFrom', () => {
    expect(() =>
      validateAppState({
        schemaVersion: 1,
        profile: { name: '', birthDate: null },
        remunerationHistory: [
          { effectiveFrom: '2024/04/01', stdRemuneration: 88000, grossSalary: 83000, note: '' }
        ],
        monthlyNotes: {}
      })
    ).toThrow(/effectiveFrom/);
  });

  it('throws when monthlyNotes key is invalid', () => {
    expect(() =>
      validateAppState({
        schemaVersion: 1,
        profile: { name: '', birthDate: null },
        remunerationHistory: [],
        monthlyNotes: { 'invalid': {} }
      })
    ).toThrow(/monthlyNotes key/);
  });

  it('throws on negative numeric value', () => {
    expect(() =>
      validateAppState({
        schemaVersion: 1,
        profile: { name: '', birthDate: null },
        remunerationHistory: [
          { effectiveFrom: '2024-04-01', stdRemuneration: -1, grossSalary: 0, note: '' }
        ],
        monthlyNotes: {}
      })
    ).toThrow(/non-negative/);
  });

  it('preserves valid input', () => {
    const valid = {
      schemaVersion: 1 as const,
      profile: { name: '山田', birthDate: '1985-06-15' },
      remunerationHistory: [
        { effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' }
      ],
      monthlyNotes: { '2024-05': { notifiedAmount: 25202 } }
    };
    expect(validateAppState(valid)).toEqual(valid);
  });
});
```

- [ ] **Step 4: テスト実行**

```bash
pnpm test tests/unit/types-validate.test.ts
```

期待: 10 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/types.ts web/tests/unit/types-validate.test.ts
git commit -m "feat(payroll): add domain types and validateAppState"
```

---

### Task 9: Add `rates.json` with full historical data

**Files:**
- Create: `web/src/lib/data/rates.json`

- [ ] **Step 1: `web/src/lib/data/rates.json` を新規作成**

参照元: `scripts/build_payroll.py` の `RATE_HISTORY`。1/100,000 単位整数に変換。

```json
{
  "schemaVersion": 1,
  "history": [
    { "effectiveFrom": "2016-06-01", "kenpoBase": 9960, "kaigo": 1580, "kosei": 17828, "kosodate": 200, "shien": 0, "note": "2016年6月分(既存ファイル開始)" },
    { "effectiveFrom": "2016-09-01", "kenpoBase": 9960, "kaigo": 1580, "kosei": 18182, "kosodate": 200, "shien": 0, "note": "2016年9月分・厚年改定" },
    { "effectiveFrom": "2017-03-01", "kenpoBase": 9910, "kaigo": 1650, "kosei": 18182, "kosodate": 200, "shien": 0, "note": "2017年3月分・健保改定" },
    { "effectiveFrom": "2017-04-01", "kenpoBase": 9910, "kaigo": 1650, "kosei": 18182, "kosodate": 230, "shien": 0, "note": "2017年4月分・拠出金改定" },
    { "effectiveFrom": "2017-09-01", "kenpoBase": 9910, "kaigo": 1650, "kosei": 18300, "kosodate": 230, "shien": 0, "note": "2017年9月分・厚年18.3%固定" },
    { "effectiveFrom": "2018-03-01", "kenpoBase": 9900, "kaigo": 1570, "kosei": 18300, "kosodate": 230, "shien": 0, "note": "2018年3月分・健保改定" },
    { "effectiveFrom": "2019-03-01", "kenpoBase": 9900, "kaigo": 1730, "kosei": 18300, "kosodate": 230, "shien": 0, "note": "2019年3月分・介護改定" },
    { "effectiveFrom": "2019-05-01", "kenpoBase": 9900, "kaigo": 1730, "kosei": 18300, "kosodate": 340, "shien": 0, "note": "2019年5月分・拠出金改定" },
    { "effectiveFrom": "2020-03-01", "kenpoBase": 9870, "kaigo": 1790, "kosei": 18300, "kosodate": 340, "shien": 0, "note": "2020年3月分・健保改定" },
    { "effectiveFrom": "2020-04-01", "kenpoBase": 9870, "kaigo": 1790, "kosei": 18300, "kosodate": 360, "shien": 0, "note": "2020年4月分・拠出金改定" },
    { "effectiveFrom": "2021-04-01", "kenpoBase": 9840, "kaigo": 1800, "kosei": 18300, "kosodate": 360, "shien": 0, "note": "2021年4月分・健保改定" },
    { "effectiveFrom": "2022-03-01", "kenpoBase": 9810, "kaigo": 1640, "kosei": 18300, "kosodate": 360, "shien": 0, "note": "2022年3月分・健保改定" },
    { "effectiveFrom": "2023-03-01", "kenpoBase": 10000, "kaigo": 1820, "kosei": 18300, "kosodate": 360, "shien": 0, "note": "2023年3月分・健保改定" },
    { "effectiveFrom": "2024-04-01", "kenpoBase": 9980, "kaigo": 1600, "kosei": 18300, "kosodate": 360, "shien": 0, "note": "2024年4月分・健保改定" },
    { "effectiveFrom": "2025-04-01", "kenpoBase": 9910, "kaigo": 1590, "kosei": 18300, "kosodate": 360, "shien": 0, "note": "2025年4月分・健保改定" },
    { "effectiveFrom": "2026-04-01", "kenpoBase": 9850, "kaigo": 1620, "kosei": 18300, "kosodate": 360, "shien": 0, "note": "2026年4月納付分(3月分)・健保改定" },
    { "effectiveFrom": "2026-05-01", "kenpoBase": 9850, "kaigo": 1620, "kosei": 18300, "kosodate": 360, "shien": 230, "note": "2026年5月納付分(4月分)・支援金開始" }
  ]
}
```

- [ ] **Step 2: TypeScript で読み込めることを確認(型チェック用テスト)**

`web/tests/unit/rates-data.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import ratesData from '$lib/data/rates.json';
import type { RateEntry } from '$lib/payroll/types';

describe('rates.json', () => {
  it('has schemaVersion 1', () => {
    expect(ratesData.schemaVersion).toBe(1);
  });

  it('has 17 entries in chronological order', () => {
    expect(ratesData.history).toHaveLength(17);
    const dates = ratesData.history.map((e) => e.effectiveFrom);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });

  it('all rates are non-negative integers', () => {
    for (const e of ratesData.history as RateEntry[]) {
      for (const k of ['kenpoBase', 'kaigo', 'kosei', 'kosodate', 'shien'] as const) {
        expect(Number.isInteger(e[k])).toBe(true);
        expect(e[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
```

- [ ] **Step 3: テスト実行**

```bash
pnpm test
```

期待: 3 passed。

- [ ] **Step 4: コミット**

```bash
git add web/src/lib/data/rates.json web/tests/unit/rates-data.test.ts
git commit -m "feat(payroll): add rates.json with 17 historical entries"
```

---

### Task 10: Implement `lookup.ts` `findApplicableEntry<T>` (TDD)

**Files:**
- Create: `web/src/lib/payroll/lookup.ts`
- Create: `web/tests/unit/lookup.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`web/tests/unit/lookup.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findApplicableEntry, EntryNotFoundError } from '$lib/payroll/lookup';

interface Stub {
  effectiveFrom: string;
  value: number;
}

const history: Stub[] = [
  { effectiveFrom: '2020-04-01', value: 1 },
  { effectiveFrom: '2022-03-01', value: 2 },
  { effectiveFrom: '2024-04-01', value: 3 }
];

describe('findApplicableEntry', () => {
  it('returns the latest entry whose effectiveFrom <= target month', () => {
    expect(findApplicableEntry('2025-12', history, 'test').value).toBe(3);
    expect(findApplicableEntry('2024-04', history, 'test').value).toBe(3);
    expect(findApplicableEntry('2023-12', history, 'test').value).toBe(2);
    expect(findApplicableEntry('2022-03', history, 'test').value).toBe(2);
    expect(findApplicableEntry('2020-04', history, 'test').value).toBe(1);
  });

  it('treats yearMonth as the first day of that month', () => {
    // 2024-03 < 2024-04-01, so the 2024-04 entry should NOT match
    expect(findApplicableEntry('2024-03', history, 'test').value).toBe(2);
  });

  it('throws EntryNotFoundError when no entry is applicable', () => {
    expect(() => findApplicableEntry('2019-12', history, 'rate')).toThrow(
      EntryNotFoundError
    );
    expect(() => findApplicableEntry('2019-12', history, 'rate')).toThrow(
      /rate/
    );
  });

  it('throws on empty history', () => {
    expect(() => findApplicableEntry('2024-01', [], 'rate')).toThrow(
      EntryNotFoundError
    );
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

```bash
cd web
pnpm test tests/unit/lookup.test.ts
```

期待: FAIL — `Cannot find module '$lib/payroll/lookup'`。

- [ ] **Step 3: 実装**

`web/src/lib/payroll/lookup.ts`:

```typescript
export class EntryNotFoundError extends Error {
  constructor(context: string, yearMonth: string) {
    super(`No applicable ${context} entry found for ${yearMonth}`);
    this.name = 'EntryNotFoundError';
  }
}

/**
 * effectiveFrom <= yearMonth-01 を満たす最新エントリを返す。
 * 該当なしは EntryNotFoundError を throw(フォールバック禁止)。
 */
export function findApplicableEntry<T extends { effectiveFrom: string }>(
  yearMonth: string,
  history: readonly T[],
  errorContext: string
): T {
  const targetDate = `${yearMonth}-01`;
  let best: T | null = null;
  for (const entry of history) {
    if (entry.effectiveFrom <= targetDate) {
      if (best === null || entry.effectiveFrom > best.effectiveFrom) {
        best = entry;
      }
    }
  }
  if (best === null) {
    throw new EntryNotFoundError(errorContext, yearMonth);
  }
  return best;
}
```

- [ ] **Step 4: テスト実行 — 成功確認**

```bash
pnpm test tests/unit/lookup.test.ts
```

期待: 4 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/lookup.ts web/tests/unit/lookup.test.ts
git commit -m "feat(payroll): implement generic findApplicableEntry with TDD"
```

---

### Task 11: Implement `rates.ts` thin wrapper (TDD)

**Files:**
- Create: `web/src/lib/payroll/rates.ts`
- Modify: `web/tests/unit/lookup.test.ts` (続けて rates のテストを書くか別ファイル化、ここでは別ファイル `rates.test.ts`)
- Create: `web/tests/unit/rates.test.ts`

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/rates.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findApplicableRate } from '$lib/payroll/rates';
import { EntryNotFoundError } from '$lib/payroll/lookup';
import type { RateEntry } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const history = ratesData.history as RateEntry[];

describe('findApplicableRate', () => {
  it('returns the 2026-04 entry for 2026-04', () => {
    const r = findApplicableRate('2026-04', history);
    expect(r.kenpoBase).toBe(9850);
    expect(r.shien).toBe(0);
  });

  it('returns the 2026-05 entry for 2026-05 (shien onset)', () => {
    const r = findApplicableRate('2026-05', history);
    expect(r.shien).toBe(230);
  });

  it('throws with "料率" in the error context for too-old months', () => {
    expect(() => findApplicableRate('2015-12', history)).toThrow(
      EntryNotFoundError
    );
    expect(() => findApplicableRate('2015-12', history)).toThrow(/料率/);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

```bash
pnpm test tests/unit/rates.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/payroll/rates.ts`:

```typescript
import { findApplicableEntry } from './lookup';
import type { RateEntry } from './types';

export function findApplicableRate(
  yearMonth: string,
  history: readonly RateEntry[]
): RateEntry {
  return findApplicableEntry(yearMonth, history, '料率');
}
```

- [ ] **Step 4: テスト実行 — 成功確認**

```bash
pnpm test tests/unit/rates.test.ts
```

期待: 3 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/rates.ts web/tests/unit/rates.test.ts
git commit -m "feat(payroll): add findApplicableRate wrapper"
```

---

### Task 12: Implement `remuneration.ts` thin wrapper (TDD)

**Files:**
- Create: `web/src/lib/payroll/remuneration.ts`
- Create: `web/tests/unit/remuneration.test.ts`

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/remuneration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { findApplicableRemuneration } from '$lib/payroll/remuneration';
import { EntryNotFoundError } from '$lib/payroll/lookup';
import type { RemunerationEntry } from '$lib/payroll/types';

const history: RemunerationEntry[] = [
  { effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' },
  { effectiveFrom: '2025-09-01', stdRemuneration: 98000, grossSalary: 92000, note: '随時改定' }
];

describe('findApplicableRemuneration', () => {
  it('returns the 2024-04 entry for 2025-08', () => {
    const r = findApplicableRemuneration('2025-08', history);
    expect(r.stdRemuneration).toBe(88000);
  });

  it('returns the 2025-09 entry for 2025-09', () => {
    const r = findApplicableRemuneration('2025-09', history);
    expect(r.stdRemuneration).toBe(98000);
  });

  it('throws with "報酬" in the error context for too-old months', () => {
    expect(() => findApplicableRemuneration('2024-03', history)).toThrow(
      /報酬/
    );
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

```bash
pnpm test tests/unit/remuneration.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/payroll/remuneration.ts`:

```typescript
import { findApplicableEntry } from './lookup';
import type { RemunerationEntry } from './types';

export function findApplicableRemuneration(
  yearMonth: string,
  history: readonly RemunerationEntry[]
): RemunerationEntry {
  return findApplicableEntry(yearMonth, history, '報酬');
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/remuneration.test.ts
```

期待: 3 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/remuneration.ts web/tests/unit/remuneration.test.ts
git commit -m "feat(payroll): add findApplicableRemuneration wrapper"
```

---

### Task 13: Implement `kaigo.ts` (TDD)

**Files:**
- Create: `web/src/lib/payroll/kaigo.ts`
- Create: `web/tests/unit/kaigo.test.ts`

仕様: 介護該当 = `40歳誕生日の前日 ≦ 当月末日 < 65歳誕生日の前日`(納付月ベース)

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/kaigo.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { isKaigoApplicable, calculateAge } from '$lib/payroll/kaigo';

describe('isKaigoApplicable', () => {
  it('returns false when birthDate is null', () => {
    expect(isKaigoApplicable(null, 2025, 6)).toBe(false);
  });

  it('returns false when birthDate is empty string', () => {
    expect(isKaigoApplicable('', 2025, 6)).toBe(false);
  });

  it('40歳誕生月: 月の途中で40歳→当月末日が40歳誕生日前日以降なら該当', () => {
    // 1985-06-15 生まれ → 40歳誕生日 = 2025-06-15、前日 = 2025-06-14
    // 2025-06 月末 = 2025-06-30 ≥ 2025-06-14 → 該当
    expect(isKaigoApplicable('1985-06-15', 2025, 6)).toBe(true);
  });

  it('40歳誕生月の前月: 該当しない', () => {
    expect(isKaigoApplicable('1985-06-15', 2025, 5)).toBe(false);
  });

  it('40歳誕生日が月初(1日)生まれ: 前月から該当', () => {
    // 1985-06-01 生まれ → 40歳誕生日 = 2025-06-01、前日 = 2025-05-31
    // 2025-05-31 ≥ 2025-05-31 → 該当
    expect(isKaigoApplicable('1985-06-01', 2025, 5)).toBe(true);
    expect(isKaigoApplicable('1985-06-01', 2025, 4)).toBe(false);
  });

  it('65歳誕生月: 月初の前日と同月末の関係で当月末が前日未満なら該当継続、以上なら非該当', () => {
    // 1960-06-15 生まれ → 65歳誕生日 = 2025-06-15、前日 = 2025-06-14
    // 2025-06 月末 = 2025-06-30 ≥ 2025-06-14 → 非該当(=Excel: < ではないので false)
    expect(isKaigoApplicable('1960-06-15', 2025, 6)).toBe(false);
    // 前月 2025-05: 月末 2025-05-31 < 2025-06-14 → 該当
    expect(isKaigoApplicable('1960-06-15', 2025, 5)).toBe(true);
  });

  it('閏年生まれ(2/29)の処理: JS Date が自動正規化する', () => {
    // 1984-02-29 生まれ → 40歳誕生日 = 2024-02-29(2024 も閏年)、前日 = 2024-02-28
    // 2024-02 月末 = 2024-02-29 ≥ 2024-02-28 → 該当
    expect(isKaigoApplicable('1984-02-29', 2024, 2)).toBe(true);
  });
});

describe('calculateAge', () => {
  it('returns 40 when the month-end equals the 40th birthday (1985-06-30 / 2025-06)', () => {
    expect(calculateAge('1985-06-30', 2025, 6)).toBe(40);
  });

  it('returns 39 for the month before the 40th birthday', () => {
    expect(calculateAge('1985-06-15', 2025, 5)).toBe(39);
  });

  it('returns 40 for the 40th birthday month (mid-month birthday)', () => {
    expect(calculateAge('1985-06-15', 2025, 6)).toBe(40);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

```bash
pnpm test tests/unit/kaigo.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/payroll/kaigo.ts`:

```typescript
/**
 * 引数 year/month は納付月として解釈する(Excel と同じ)。
 * 該当判定: 40歳誕生日の前日 ≦ 当月末日 < 65歳誕生日の前日
 * birthDate が null/empty の場合は false を返す。
 */
export function isKaigoApplicable(
  birthDate: string | null,
  year: number,
  month: number
): boolean {
  if (birthDate === null || birthDate === '') return false;
  const eom = endOfMonth(year, month);
  const [by, bm, bd] = parseBirthDate(birthDate);
  // JS Date は day=0 や day=-1 を前月に正規化する
  const b40 = new Date(by + 40, bm - 1, bd - 1);
  const b65 = new Date(by + 65, bm - 1, bd - 1);
  return eom.getTime() >= b40.getTime() && eom.getTime() < b65.getTime();
}

export function calculateAge(
  birthDate: string,
  year: number,
  month: number
): number {
  const eom = endOfMonth(year, month);
  const [by, bm, bd] = parseBirthDate(birthDate);
  let age = year - by;
  // 当月末日が誕生日より前なら 1 歳引く
  if (eom.getMonth() + 1 < bm || (eom.getMonth() + 1 === bm && eom.getDate() < bd)) {
    age -= 1;
  }
  return age;
}

function endOfMonth(year: number, month: number): Date {
  // new Date(year, month, 0) = 指定月の末日(month は 1-based をそのまま渡す)
  return new Date(year, month, 0);
}

function parseBirthDate(s: string): [number, number, number] {
  const [y, m, d] = s.split('-').map(Number);
  return [y, m, d];
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/kaigo.test.ts
```

期待: 全 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/kaigo.ts web/tests/unit/kaigo.test.ts
git commit -m "feat(payroll): implement isKaigoApplicable and calculateAge"
```

---

### Task 14: Implement `round.ts` (TDD)

**Files:**
- Create: `web/src/lib/payroll/round.ts`
- Create: `web/tests/unit/round.test.ts`

仕様:
- `splitHalfEmployee(totalSen)`: Excel `=INT(M/2)+IF(MOD(M,2)>1,1,0)` を bit-perfect 再現
  - 実装: `floor(totalSen/200)` + (`totalSen % 200 > 100` なら +1)
- `splitHalfEmployer(totalSen, employee)`: `ROUNDDOWN(M, 0) - employee` = `floor(totalSen/100) - employee`
- `fullDownToYen(totalSen)`: `ROUNDDOWN(M, 0)` = `floor(totalSen/100)`(拠出金など)

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/round.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  splitHalfEmployee,
  splitHalfEmployer,
  fullDownToYen
} from '$lib/payroll/round';

describe('splitHalfEmployee (50銭以下切捨て・50銭超切上げ)', () => {
  it('M=10093.6 (totalSen=1009360) → 5047 (案件: 1円ズレ問題のキー数値)', () => {
    expect(splitHalfEmployee(1009360)).toBe(5047);
  });

  it('M=10094.4 (sen=40 < 50) → 5047', () => {
    expect(splitHalfEmployee(1009440)).toBe(5047);
  });

  it('M=10095.0 (sen=50, 切捨て) → 5047', () => {
    expect(splitHalfEmployee(1009500)).toBe(5047);
  });

  it('M=10095.2 (sen=60 > 50) → 5048', () => {
    expect(splitHalfEmployee(1009520)).toBe(5048);
  });

  it('整数銭・偶数 M=16104 → 8052', () => {
    expect(splitHalfEmployee(1610400)).toBe(8052);
  });

  it('odd totalSen 境界: 10101 → 51 (Excel と一致)', () => {
    // M = 101.01, M/2 = 50.505, MOD(M,2)=1.01>1 → 51
    expect(splitHalfEmployee(10101)).toBe(51);
  });

  it('odd totalSen 境界: 10093 → 50', () => {
    // M = 100.93, M/2 = 50.465, MOD(M,2)=0.93≤1 → 50
    expect(splitHalfEmployee(10093)).toBe(50);
  });
});

describe('splitHalfEmployer (残額方式)', () => {
  it('M=10093.6 で社員 5047 → 事業主 5046 (合計 = ROUNDDOWN(M))', () => {
    expect(splitHalfEmployer(1009360, 5047)).toBe(5046);
    expect(5047 + 5046).toBe(10093);
  });

  it('M=16104 で社員 8052 → 事業主 8052', () => {
    expect(splitHalfEmployer(1610400, 8052)).toBe(8052);
  });
});

describe('fullDownToYen (ROUNDDOWN)', () => {
  it('M=316.8 → 316 (拠出金の例)', () => {
    expect(fullDownToYen(31680)).toBe(316);
  });

  it('M=316.0 → 316', () => {
    expect(fullDownToYen(31600)).toBe(316);
  });

  it('M=316.99 → 316', () => {
    expect(fullDownToYen(31699)).toBe(316);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

```bash
pnpm test tests/unit/round.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/payroll/round.ts`:

```typescript
/**
 * 銭単位の整数 totalSen を社員負担(円・整数)に分割する。
 * Excel の `=INT(M/2)+IF(MOD(M,2)>1,1,0)` を bit-perfect 再現。
 *
 * アルゴリズム:
 *   half_yen_floored = floor(totalSen / 200)        // = INT(M/2) in yen
 *   remainder        = totalSen % 200               // 0..199 (sen)
 *   return remainder > 100 ? half_yen_floored + 1 : half_yen_floored
 *
 * remainder > 100 ⇔ MOD(M, 2) > 1(yen with sen 端数 > 1.00 yen)。
 * これにより 50 銭超切上げ・50 銭以下切捨ての境界判定が、
 * 半額が奇数銭になるケースでも 0.5 銭の精度を失わない。
 */
export function splitHalfEmployee(totalSen: number): number {
  const halfYenFloored = Math.floor(totalSen / 200);
  const remainder = totalSen % 200;
  return remainder > 100 ? halfYenFloored + 1 : halfYenFloored;
}

/** 残額方式: ROUNDDOWN(全額) - 社員負担。 */
export function splitHalfEmployer(totalSen: number, employee: number): number {
  return fullDownToYen(totalSen) - employee;
}

/** Excel ROUNDDOWN(M, 0) 相当: 円未満を切捨て。 */
export function fullDownToYen(totalSen: number): number {
  return Math.floor(totalSen / 100);
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/round.test.ts
```

期待: 全 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/round.ts web/tests/unit/round.test.ts
git commit -m "feat(payroll): implement splitHalf with sen-precision rounding"
```

---

### Task 15: Implement `calculate.ts` `calculateMonth` (TDD)

**Files:**
- Create: `web/src/lib/payroll/calculate.ts`
- Create: `web/tests/unit/calculate.test.ts`

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/calculate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateMonth } from '$lib/payroll/calculate';
import type { MonthInput, RateEntry } from '$lib/payroll/types';

const rate2026Apr: RateEntry = {
  effectiveFrom: '2026-04-01',
  kenpoBase: 9850,
  kaigo: 1620,
  kosei: 18300,
  kosodate: 360,
  shien: 0,
  note: '2026年4月納付分'
};

const rate2026May: RateEntry = {
  ...rate2026Apr,
  effectiveFrom: '2026-05-01',
  shien: 230,
  note: '2026年5月納付分(支援金開始)'
};

describe('calculateMonth — 2026/04 (kaigo applicable, no shien yet)', () => {
  const input: MonthInput = {
    year: 2026,
    month: 4,
    stdRemuneration: 88000,
    grossSalary: 83000,
    birthDate: '1985-06-15',
    rates: rate2026Apr
  };
  const r = calculateMonth(input);

  it('結果に year=2026, month=4 が埋め込まれる', () => {
    expect(r.year).toBe(2026);
    expect(r.month).toBe(4);
  });

  it('age = 40 (April month-end is before the June birthday → year diff − 1)', () => {
    // 1985-06-15 生まれ、2026-04 月末 = 2026-04-30
    // 月日比較で 04-30 < 06-15 のため year 差から 1 引く → 41 - 1 = 40
    expect(r.age).toBe(40);
  });

  it('介護該当 (40歳誕生日 2025-06-15 前日以降、65歳誕生日前日未満)', () => {
    // 40歳誕生日前日 = 2025-06-14、65歳誕生日前日 = 2050-06-14
    // 2026-04-30 ∈ [2025-06-14, 2050-06-14) → 該当
    expect(r.isKaigoApplicable).toBe(true);
  });

  it('appliedKenpoRate = kenpoBase + kaigo (kaigo applicable)', () => {
    expect(r.appliedKenpoRate).toBe(9850 + 1620);
  });

  it('kenpoTotal = floor(88000 * 11470 / 1000 / 100) = 10093 (after ROUNDDOWN)', () => {
    // ※ kenpoTotal は MonthResult では「全額(整数円・ROUNDDOWN 後)」として保持
    // 全額_sen = 88000 * 11470 / 1000 = 1,009,360 → 10093.60 yen → ROUNDDOWN = 10093
    expect(r.kenpoTotal).toBe(10093);
  });

  it('kenpoEmployee + kenpoEmployer = kenpoTotal (1円ズレ問題が起きない)', () => {
    expect(r.kenpoEmployee + r.kenpoEmployer).toBe(r.kenpoTotal);
  });

  it('kenpoEmployee = 5047 (kaigo 込み 11.47% の半額・50銭超切上げ)', () => {
    // 全額 = 88000 × 11.47% = 10093.6, 半額 = 5046.8, 60銭は50銭超 → 切上げ → 5047
    expect(r.kenpoEmployee).toBe(5047);
    expect(r.kenpoEmployer).toBe(10093 - 5047);
  });

  it('koseiTotal = ROUNDDOWN(88000 * 18.30%) = 16104', () => {
    expect(r.koseiTotal).toBe(16104);
  });

  it('koseiEmployee = 8052, employer = 8052', () => {
    expect(r.koseiEmployee).toBe(8052);
    expect(r.koseiEmployer).toBe(8052);
  });

  it('kosodateEmployer = floor(88000 * 0.36% ROUNDDOWN) = 316', () => {
    expect(r.kosodateEmployer).toBe(316);
    expect(r.kosodateTotal).toBe(316);
  });

  it('shien = 0 (2026/04 月分は支援金開始前)', () => {
    expect(r.shienTotal).toBe(0);
    expect(r.shienEmployee).toBe(0);
    expect(r.shienEmployer).toBe(0);
  });

  it('集計値が一致する', () => {
    expect(r.employeeDeductionTotal).toBe(r.kenpoEmployee + r.koseiEmployee + r.shienEmployee);
    expect(r.employerBurdenTotal).toBe(
      r.kenpoEmployer + r.koseiEmployer + r.kosodateEmployer + r.shienEmployer
    );
    expect(r.payableTotal).toBe(r.employeeDeductionTotal + r.employerBurdenTotal);
    expect(r.netSalary).toBe(83000 - r.employeeDeductionTotal);
  });
});

describe('calculateMonth — birthDate=null (kaigo は false)', () => {
  it('appliedKenpoRate = kenpoBase only', () => {
    const r = calculateMonth({
      year: 2026, month: 4,
      stdRemuneration: 88000, grossSalary: 83000,
      birthDate: null, rates: rate2026Apr
    });
    expect(r.isKaigoApplicable).toBe(false);
    expect(r.appliedKenpoRate).toBe(9850);
    expect(r.age).toBe(null);
  });
});

describe('calculateMonth — 2026/05 (支援金開始, kaigo 該当)', () => {
  it('shien は労使折半', () => {
    const r = calculateMonth({
      year: 2026, month: 5,
      stdRemuneration: 88000, grossSalary: 83000,
      birthDate: '1985-06-15', rates: rate2026May
    });
    // shienTotal = ROUNDDOWN(88000 * 0.23%) = ROUNDDOWN(202.4) = 202
    expect(r.shienTotal).toBe(202);
    expect(r.shienEmployee + r.shienEmployer).toBe(r.shienTotal);
  });
});
```

- [ ] **Step 2: テスト実行 — 失敗確認**

```bash
pnpm test tests/unit/calculate.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/payroll/calculate.ts`:

```typescript
import type { MonthInput, MonthResult } from './types';
import { isKaigoApplicable, calculateAge } from './kaigo';
import { splitHalfEmployee, splitHalfEmployer, fullDownToYen } from './round';

/**
 * 1 ヶ月分の社会保険料を計算する。
 * 引数 input.year/month は納付月として解釈する(Excel と同じ)。
 */
export function calculateMonth(input: MonthInput): MonthResult {
  const { year, month, stdRemuneration, grossSalary, birthDate, rates } = input;

  const isKaigo = isKaigoApplicable(birthDate, year, month);
  const age = birthDate ? calculateAge(birthDate, year, month) : null;
  const appliedKenpoRate = rates.kenpoBase + (isKaigo ? rates.kaigo : 0);

  // 全額(銭単位整数)
  const kenpoTotalSen = (stdRemuneration * appliedKenpoRate) / 1000;
  const koseiTotalSen = (stdRemuneration * rates.kosei) / 1000;
  const kosodateTotalSen = (stdRemuneration * rates.kosodate) / 1000;
  const shienTotalSen = (stdRemuneration * rates.shien) / 1000;

  // 全額(整数円・ROUNDDOWN 後)
  const kenpoTotal = fullDownToYen(kenpoTotalSen);
  const koseiTotal = fullDownToYen(koseiTotalSen);
  const kosodateTotal = fullDownToYen(kosodateTotalSen);
  const shienTotal = fullDownToYen(shienTotalSen);

  // 社員負担(50銭以下切捨て・50銭超切上げ)
  const kenpoEmployee = splitHalfEmployee(kenpoTotalSen);
  const koseiEmployee = splitHalfEmployee(koseiTotalSen);
  const shienEmployee = splitHalfEmployee(shienTotalSen);

  // 事業主負担(残額方式 + 拠出金は事業主全額)
  const kenpoEmployer = splitHalfEmployer(kenpoTotalSen, kenpoEmployee);
  const koseiEmployer = splitHalfEmployer(koseiTotalSen, koseiEmployee);
  const kosodateEmployer = kosodateTotal;
  const shienEmployer = splitHalfEmployer(shienTotalSen, shienEmployee);

  const employeeDeductionTotal = kenpoEmployee + koseiEmployee + shienEmployee;
  const employerBurdenTotal =
    kenpoEmployer + koseiEmployer + kosodateEmployer + shienEmployer;
  const payableTotal = employeeDeductionTotal + employerBurdenTotal;
  const netSalary = grossSalary - employeeDeductionTotal;

  return {
    year,
    month,
    age,
    isKaigoApplicable: isKaigo,
    appliedKenpoRate,
    kenpoTotal,
    koseiTotal,
    kosodateTotal,
    shienTotal,
    kenpoEmployee,
    koseiEmployee,
    shienEmployee,
    kenpoEmployer,
    koseiEmployer,
    kosodateEmployer,
    shienEmployer,
    employeeDeductionTotal,
    employerBurdenTotal,
    payableTotal,
    netSalary
  };
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/calculate.test.ts
```

期待: 全 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/calculate.ts web/tests/unit/calculate.test.ts
git commit -m "feat(payroll): implement calculateMonth with residual method"
```

---

### Task 16: Implement `calculateRange` (TDD)

**Files:**
- Modify: `web/src/lib/payroll/calculate.ts`
- Modify: `web/tests/unit/calculate.test.ts`

- [ ] **Step 1: 失敗するテストを追加**

`web/tests/unit/calculate.test.ts` の末尾に追加:

```typescript
import { calculateRange } from '$lib/payroll/calculate';
import type { RemunerationEntry } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const allRates = ratesData.history as RateEntry[];

describe('calculateRange', () => {
  const remunerationHistory: RemunerationEntry[] = [
    { effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' }
  ];

  it('returns 3 results for "2026-03" .. "2026-05"', () => {
    const results = calculateRange('2026-03', '2026-05', {
      birthDate: '1985-06-15',
      remunerationHistory,
      rateHistory: allRates
    });
    expect(results).toHaveLength(3);
  });

  it('2026-04 行は shien=0、2026-05 行は shien>0', () => {
    const results = calculateRange('2026-03', '2026-05', {
      birthDate: '1985-06-15',
      remunerationHistory,
      rateHistory: allRates
    });
    expect(results[1].shienTotal).toBe(0);    // 2026-04
    expect(results[2].shienTotal).toBeGreaterThan(0); // 2026-05
  });

  it('start > end のとき空配列', () => {
    const results = calculateRange('2026-05', '2026-03', {
      birthDate: '1985-06-15',
      remunerationHistory,
      rateHistory: allRates
    });
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
pnpm test tests/unit/calculate.test.ts
```

期待: FAIL — `calculateRange is not a function`。

- [ ] **Step 3: `calculate.ts` に追記**

```typescript
import { findApplicableRate } from './rates';
import { findApplicableRemuneration } from './remuneration';
import type { RateEntry, RemunerationEntry } from './types';

/**
 * 範囲計算。AppState には依存しない(層分離)。
 * start/end は包含 ("YYYY-MM")。start > end なら空配列。
 */
export function calculateRange(
  start: string,
  end: string,
  params: {
    birthDate: string | null;
    remunerationHistory: readonly RemunerationEntry[];
    rateHistory: readonly RateEntry[];
  }
): MonthResult[] {
  if (start > end) return [];
  const results: MonthResult[] = [];
  for (const ym of monthRange(start, end)) {
    const [yStr, mStr] = ym.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const rates = findApplicableRate(ym, params.rateHistory);
    const rem = findApplicableRemuneration(ym, params.remunerationHistory);
    results.push(
      calculateMonth({
        year,
        month,
        stdRemuneration: rem.stdRemuneration,
        grossSalary: rem.grossSalary,
        birthDate: params.birthDate,
        rates
      })
    );
  }
  return results;
}

/** "YYYY-MM" を start..end の範囲で yield する純粋関数。 */
function* monthRange(start: string, end: string): Generator<string> {
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    yield `${y}-${String(m).padStart(2, '0')}`;
    m++;
    if (m === 13) {
      m = 1;
      y++;
    }
  }
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/calculate.test.ts
```

期待: 全 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/calculate.ts web/tests/unit/calculate.test.ts
git commit -m "feat(payroll): implement calculateRange with layer-isolated params"
```

---

### Task 17: Implement `aggregate.ts` `aggregateByCalendarYear` (TDD)

**Files:**
- Create: `web/src/lib/payroll/aggregate.ts`
- Create: `web/tests/unit/aggregate.test.ts`

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/aggregate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { aggregateByCalendarYear } from '$lib/payroll/aggregate';
import { calculateRange } from '$lib/payroll/calculate';
import type { MonthResult, RateEntry, RemunerationEntry } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const rateHistory = ratesData.history as RateEntry[];
const remunerationHistory: RemunerationEntry[] = [
  { effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '' }
];

function makeStub(year: number, month: number, ed: number, eb: number, total: number): MonthResult {
  return {
    year, month,
    age: null,
    isKaigoApplicable: false,
    appliedKenpoRate: 0,
    kenpoTotal: 0, koseiTotal: 0, kosodateTotal: 0, shienTotal: 0,
    kenpoEmployee: 0, koseiEmployee: 0, shienEmployee: 0,
    kenpoEmployer: 0, koseiEmployer: 0, kosodateEmployer: 0, shienEmployer: 0,
    employeeDeductionTotal: ed,
    employerBurdenTotal: eb,
    payableTotal: total,
    netSalary: 0
  };
}

describe('aggregateByCalendarYear', () => {
  it('returns one summary per calendar year present in the input', () => {
    const results = calculateRange('2024-12', '2025-02', {
      birthDate: '1985-06-15',
      remunerationHistory,
      rateHistory
    });
    // results は MonthResult[] で year/month を内包しているため、そのまま渡せる
    const summaries = aggregateByCalendarYear(results);
    expect(summaries).toHaveLength(2);
    expect(summaries[0].year).toBe(2024);
    expect(summaries[0].monthCount).toBe(1);
    expect(summaries[1].year).toBe(2025);
    expect(summaries[1].monthCount).toBe(2);
  });

  it('合計値が正しい', () => {
    const summaries = aggregateByCalendarYear([
      makeStub(2024, 5, 100, 200, 300),
      makeStub(2024, 6, 110, 210, 320)
    ]);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].employeeDeductionTotal).toBe(210);
    expect(summaries[0].employerBurdenTotal).toBe(410);
    expect(summaries[0].payableTotal).toBe(620);
  });

  it('空配列なら空配列を返す', () => {
    expect(aggregateByCalendarYear([])).toEqual([]);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
pnpm test tests/unit/aggregate.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/payroll/aggregate.ts`:

```typescript
import type { MonthResult, YearSummary } from './types';

/**
 * 月次計算結果を暦年で集計する。MonthResult が year/month を内包しているため
 * 並列配列パターンや TaggedMonth ラッパーは不要。
 */
export function aggregateByCalendarYear(
  months: readonly MonthResult[]
): YearSummary[] {
  const byYear = new Map<number, YearSummary>();
  for (const r of months) {
    let s = byYear.get(r.year);
    if (!s) {
      s = {
        year: r.year,
        monthCount: 0,
        employeeDeductionTotal: 0,
        employerBurdenTotal: 0,
        payableTotal: 0
      };
      byYear.set(r.year, s);
    }
    s.monthCount += 1;
    s.employeeDeductionTotal += r.employeeDeductionTotal;
    s.employerBurdenTotal += r.employerBurdenTotal;
    s.payableTotal += r.payableTotal;
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/aggregate.test.ts
```

期待: 全 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/payroll/aggregate.ts web/tests/unit/aggregate.test.ts
git commit -m "feat(payroll): implement aggregateByCalendarYear"
```

---

## Phase C: State Management

### Task 18: Persistence error store

**Files:**
- Create: `web/src/lib/stores/persistence.ts`
- Create: `web/tests/unit/persistence-store.test.ts`

`localStorage.setItem` 失敗(QuotaExceededError、SecurityError 等)を購読可能にして UI でユーザーへ通知するための専用 store。silent failure を防止する。

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/persistence-store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { persistenceErrorStore, reportPersistenceError, clearPersistenceError } from '$lib/stores/persistence';

describe('persistenceErrorStore', () => {
  beforeEach(() => clearPersistenceError());

  it('initial value is null', () => {
    expect(get(persistenceErrorStore)).toBeNull();
  });

  it('reportPersistenceError sets the latest error', () => {
    reportPersistenceError(new Error('quota'));
    expect(get(persistenceErrorStore)?.message).toBe('quota');
  });

  it('clearPersistenceError resets to null', () => {
    reportPersistenceError(new Error('x'));
    clearPersistenceError();
    expect(get(persistenceErrorStore)).toBeNull();
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
pnpm test tests/unit/persistence-store.test.ts
```

- [ ] **Step 3: 実装**

`web/src/lib/stores/persistence.ts`:

```typescript
import { writable, type Readable } from 'svelte/store';

const _errorStore = writable<Error | null>(null);

export const persistenceErrorStore: Readable<Error | null> = {
  subscribe: _errorStore.subscribe
};

export function reportPersistenceError(e: Error): void {
  _errorStore.set(e);
}

export function clearPersistenceError(): void {
  _errorStore.set(null);
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/persistence-store.test.ts
```

期待: 3 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/stores/persistence.ts web/tests/unit/persistence-store.test.ts
git commit -m "feat(store): add persistenceErrorStore for surfacing localStorage failures"
```

---

### Task 19: Implement localStorage persistence with debounce + structural validation

**Files:**
- Create: `web/src/lib/stores/appState.ts`
- Create: `web/tests/unit/store-persistence.test.ts`

`appState.ts` は `payroll/types.ts` のドメイン型(`AppState`、`createDefaultAppState`、`validateAppState`)を import し、Svelte store + localStorage 永続化のみを担当する。

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/store-persistence.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { createAppStateStore, STORAGE_KEY } from '$lib/stores/appState';
import { persistenceErrorStore, clearPersistenceError } from '$lib/stores/persistence';
import { AppStateValidationError } from '$lib/payroll/types';

describe('createAppStateStore', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPersistenceError();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns default state when localStorage is empty', () => {
    const store = createAppStateStore();
    expect(get(store).profile.name).toBe('');
  });

  it('persists changes to localStorage after debounce', () => {
    const store = createAppStateStore();
    store.update((s) => ({ ...s, profile: { ...s.profile, name: '山田' } }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(400);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.profile.name).toBe('山田');
  });

  it('loads existing state from localStorage on init', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        profile: { name: '佐藤', birthDate: '1985-06-15' },
        remunerationHistory: [],
        monthlyNotes: {}
      })
    );
    const store = createAppStateStore();
    expect(get(store).profile.name).toBe('佐藤');
  });

  it('throws StorageCorruptError on invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    expect(() => createAppStateStore()).toThrow(/parse/);
  });

  it('throws AppStateValidationError on schemaVersion mismatch', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, profile: {}, remunerationHistory: [], monthlyNotes: {} })
    );
    expect(() => createAppStateStore()).toThrow(AppStateValidationError);
  });

  it('throws AppStateValidationError on structural corruption (e.g., remunerationHistory not array)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        profile: { name: '', birthDate: null },
        remunerationHistory: 'not-an-array',
        monthlyNotes: {}
      })
    );
    expect(() => createAppStateStore()).toThrow(AppStateValidationError);
  });

  it('reports persistence error to persistenceErrorStore on setItem failure', () => {
    const store = createAppStateStore();
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
    try {
      store.update((s) => ({ ...s, profile: { ...s.profile, name: 'X' } }));
      vi.advanceTimersByTime(400);
      const err = get(persistenceErrorStore);
      expect(err).not.toBeNull();
      expect(err?.message).toMatch(/Quota/);
    } finally {
      Storage.prototype.setItem = originalSetItem;
    }
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
pnpm test tests/unit/store-persistence.test.ts
```

期待: FAIL。

- [ ] **Step 3: `web/src/lib/stores/appState.ts` を実装**

```typescript
import { writable, type Writable } from 'svelte/store';
import { browser } from '$app/environment';
import {
  validateAppState,
  createDefaultAppState,
  type AppState
} from '$lib/payroll/types';
import { reportPersistenceError } from './persistence';

export const STORAGE_KEY = 'solo-shaho-state' as const;
const DEBOUNCE_MS = 300;

export class StorageCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageCorruptError';
  }
}

export function createAppStateStore(): Writable<AppState> {
  const initial = loadFromStorage();
  const store = writable<AppState>(initial);
  let timer: ReturnType<typeof setTimeout> | null = null;
  store.subscribe((state) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (e) {
        // QuotaExceededError, SecurityError 等を専用 store に push して
        // UI レイヤがバナー表示等で必ずユーザーに伝える(silent data loss を防ぐ)
        reportPersistenceError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        timer = null;
      }
    }, DEBOUNCE_MS);
  });
  return store;
}

function loadFromStorage(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return createDefaultAppState();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new StorageCorruptError(`Failed to parse localStorage: ${(e as Error).message}`);
  }
  // CSV インポートと同じ validateAppState を使い、入口の検証強度を統一する
  return validateAppState(parsed);
}

let _store: Writable<AppState> | null = null;

/** ブラウザでのみ初期化されるシングルトンの AppState ストア。 */
export function getAppStateStore(): Writable<AppState> {
  if (!browser) return writable(createDefaultAppState());
  if (_store === null) _store = createAppStateStore();
  return _store;
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/store-persistence.test.ts
```

期待: 7 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/stores/appState.ts web/tests/unit/store-persistence.test.ts
git commit -m "feat(store): persist AppState with shared validator + persistence error reporting"
```

---

### Task 20: Add derived calculation results store

**Files:**
- Create: `web/src/lib/stores/results.ts`

これは UI から消費する派生 store。複雑なロジックは含まないため最小実装 + 動作確認用に SvelteKit dev で起動して目視確認する。

- [ ] **Step 1: `web/src/lib/stores/results.ts` を作成**

```typescript
import { derived, type Readable, type Writable } from 'svelte/store';
import type { AppState, MonthResult, RateEntry } from '$lib/payroll/types';
import { calculateRange } from '$lib/payroll/calculate';
import ratesData from '$lib/data/rates.json';

const RATE_HISTORY = ratesData.history as RateEntry[];

export function createResultsStore(
  appState: Writable<AppState>,
  range: { start: string; end: string }
): Readable<MonthResult[]> {
  return derived(appState, ($s) => {
    if ($s.remunerationHistory.length === 0) return [];
    return calculateRange(range.start, range.end, {
      birthDate: $s.profile.birthDate,
      remunerationHistory: $s.remunerationHistory,
      rateHistory: RATE_HISTORY
    });
  });
}
```

- [ ] **Step 2: 型チェックでエラーがないことを確認**

```bash
cd web
pnpm typecheck
```

期待: エラーゼロ。

- [ ] **Step 3: コミット**

```bash
git add web/src/lib/stores/results.ts
git commit -m "feat(store): add derived results store for calculations"
```

---

## Phase D: CSV Import/Export

### Task 21: Implement `csv/escape.ts` (Formula Injection + RFC 4180) (TDD)

**Files:**
- Create: `web/src/lib/csv/escape.ts`
- Create: `web/tests/unit/csv-escape.test.ts`

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/csv-escape.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { escapeCell, unescapeCell } from '$lib/csv/escape';

describe('escapeCell — Formula Injection 対策', () => {
  it('= で始まる値は先頭にシングルクォートを付ける', () => {
    expect(escapeCell('=cmd|/c calc')).toBe(`"'=cmd|/c calc"`);
  });

  it('+ - @ TAB CR で始まる値も同様にエスケープ', () => {
    expect(escapeCell('+1234')).toBe(`"'+1234"`);
    expect(escapeCell('-1234')).toBe(`"'-1234"`);
    expect(escapeCell('@hostname')).toBe(`"'@hostname"`);
    expect(escapeCell('\tcmd')).toBe(`"'\tcmd"`);
    expect(escapeCell('\rcmd')).toBe(`"'\rcmd"`);
  });

  it('通常の値はそのまま(クォートも不要)', () => {
    expect(escapeCell('山田太郎')).toBe('山田太郎');
    expect(escapeCell('123')).toBe('123');
  });

  it('カンマを含む値は RFC 4180 でクォート', () => {
    expect(escapeCell('a,b')).toBe(`"a,b"`);
  });

  it('ダブルクォートを含む値はエスケープ', () => {
    expect(escapeCell('a"b')).toBe(`"a""b"`);
  });

  it('改行を含む値はクォート', () => {
    expect(escapeCell('a\nb')).toBe(`"a\nb"`);
  });

  it('空文字はそのまま', () => {
    expect(escapeCell('')).toBe('');
  });
});

describe('unescapeCell — シングルクォート剥がし', () => {
  it('escape→unescape ラウンドトリップで元の値に戻る(Formula Injection 文字列)', () => {
    const original = '=cmd|/c calc';
    // escapeCell の結果から quote を取り除き、unescapeCell に渡すケースをシミュレート
    // パーサが先に `"`の処理をしてシングルクォートを剥がす責務をここに持たせる
    expect(unescapeCell(`'=cmd|/c calc`)).toBe('=cmd|/c calc');
  });

  it('シングルクォートで始まらない値はそのまま', () => {
    expect(unescapeCell('山田')).toBe('山田');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
pnpm test tests/unit/csv-escape.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/csv/escape.ts`:

```typescript
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * CSV セル値をエクスポート用にエスケープする。
 * 1) Formula Injection 対策: 先頭が = + - @ TAB CR の場合、先頭にシングルクォートを付与
 * 2) RFC 4180: 値が , " 改行 を含むか、Formula 対策で `'` を付与した場合、ダブルクォートで囲み内部の `"` を `""` にする
 */
export function escapeCell(value: string): string {
  let v = value;
  let needsQuote = false;
  if (FORMULA_PREFIX.test(v)) {
    v = `'${v}`;
    needsQuote = true;
  }
  if (/[,\"\n\r]/.test(v)) needsQuote = true;
  if (!needsQuote) return v;
  return `"${v.replace(/"/g, '""')}"`;
}

/**
 * パース済みのセル値からシングルクォート(Formula Injection エスケープ)を剥がす。
 * 値が `'` で始まり、かつそれが Formula prefix のエスケープと判別できる場合のみ剥がす。
 */
export function unescapeCell(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && FORMULA_PREFIX.test(value.slice(1))) {
    return value.slice(1);
  }
  return value;
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/csv-escape.test.ts
```

期待: 全 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/csv/escape.ts web/tests/unit/csv-escape.test.ts
git commit -m "feat(csv): implement Formula Injection-safe cell escape"
```

---

### Task 22: Implement `csv/serialize.ts` (TDD)

**Files:**
- Create: `web/src/lib/csv/serialize.ts`
- Create: `web/tests/unit/csv-serialize.test.ts`

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/csv-serialize.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeAppState } from '$lib/csv/serialize';
import type { AppState } from '$lib/payroll/types';

const sample: AppState = {
  schemaVersion: 1,
  profile: { name: '山田太郎', birthDate: '1985-06-15' },
  remunerationHistory: [
    { effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' }
  ],
  monthlyNotes: {
    '2024-05': { notifiedAmount: 25202 },
    '2026-04': { notifiedAmount: 25088, memo: '健保改定後初月' }
  }
};

describe('serializeAppState', () => {
  const csv = serializeAppState(sample, { exportedAt: '2026-04-25T14:30:00+09:00' });

  it('starts with BOM (UTF-8 BOM EF BB BF)', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('includes header comment with version and exportedAt', () => {
    expect(csv).toContain('# solo-shaho');
    expect(csv).toContain('# schemaVersion=1');
    expect(csv).toContain('exportedAt=2026-04-25T14:30:00+09:00');
  });

  it('contains [profile] section', () => {
    expect(csv).toMatch(/\[profile\]\nname,birthDate\n山田太郎,1985-06-15/);
  });

  it('contains [remuneration_history] section', () => {
    expect(csv).toContain('[remuneration_history]');
    expect(csv).toContain('2024-04-01,88000,83000,定時決定');
  });

  it('contains [monthly_notes] section sorted by month', () => {
    expect(csv).toContain('[monthly_notes]');
    const lines = csv.split('\n');
    const idx2024 = lines.findIndex((l) => l.startsWith('2024-05'));
    const idx2026 = lines.findIndex((l) => l.startsWith('2026-04'));
    expect(idx2024).toBeLessThan(idx2026);
  });

  it('escapes Formula Injection in memo field', () => {
    const dangerous: AppState = {
      ...sample,
      monthlyNotes: { '2024-05': { memo: '=cmd|/c calc' } }
    };
    const out = serializeAppState(dangerous, { exportedAt: 'x' });
    expect(out).toContain(`"'=cmd|/c calc"`);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
pnpm test tests/unit/csv-serialize.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/csv/serialize.ts`:

```typescript
import type { AppState } from '$lib/payroll/types';
import { escapeCell } from './escape';

const BOM = '﻿';

export interface SerializeOptions {
  exportedAt: string;
  appVersion?: string;
}

export function serializeAppState(state: AppState, opts: SerializeOptions): string {
  const lines: string[] = [];
  lines.push(`# solo-shaho ${opts.appVersion ?? 'v0'} export ${opts.exportedAt}`);
  lines.push(`# schemaVersion=${state.schemaVersion} exportedAt=${opts.exportedAt}`);
  lines.push('');

  // [profile]
  lines.push('[profile]');
  lines.push('name,birthDate');
  lines.push(
    [escapeCell(state.profile.name), escapeCell(state.profile.birthDate ?? '')].join(',')
  );
  lines.push('');

  // [remuneration_history]
  lines.push('[remuneration_history]');
  lines.push('effectiveFrom,stdRemuneration,grossSalary,note');
  for (const e of state.remunerationHistory) {
    lines.push(
      [
        escapeCell(e.effectiveFrom),
        String(e.stdRemuneration),
        String(e.grossSalary),
        escapeCell(e.note ?? '')
      ].join(',')
    );
  }
  lines.push('');

  // [monthly_notes] (sort by month key)
  lines.push('[monthly_notes]');
  lines.push('month,notifiedAmount,memo');
  const sortedMonths = Object.keys(state.monthlyNotes).sort();
  for (const m of sortedMonths) {
    const n = state.monthlyNotes[m];
    lines.push(
      [
        m,
        n.notifiedAmount === undefined ? '' : String(n.notifiedAmount),
        escapeCell(n.memo ?? '')
      ].join(',')
    );
  }

  return BOM + lines.join('\n') + '\n';
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/csv-serialize.test.ts
```

期待: 6 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/csv/serialize.ts web/tests/unit/csv-serialize.test.ts
git commit -m "feat(csv): implement serializeAppState with sectioned format"
```

---

### Task 23: Implement `csv/parse.ts` (TDD)

**Files:**
- Create: `web/src/lib/csv/parse.ts`
- Create: `web/tests/unit/csv-parse.test.ts`

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/csv-parse.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseCsv, type ParsedCsv } from '$lib/csv/parse';

const SAMPLE = `﻿# solo-shaho v0 export 2026-04-25T14:30:00+09:00
# schemaVersion=1

[profile]
name,birthDate
山田太郎,1985-06-15

[remuneration_history]
effectiveFrom,stdRemuneration,grossSalary,note
2024-04-01,88000,83000,定時決定

[monthly_notes]
month,notifiedAmount,memo
2024-05,25202,
2026-04,25088,健保改定後初月
`;

describe('parseCsv', () => {
  const parsed: ParsedCsv = parseCsv(SAMPLE);

  it('strips BOM', () => {
    // 内部表現でセクションが取れていれば BOM は処理されている
    expect(parsed.sections.profile).toBeDefined();
  });

  it('parses [profile] section as single row', () => {
    expect(parsed.sections.profile?.rows).toHaveLength(1);
    expect(parsed.sections.profile?.rows[0]).toEqual({
      name: '山田太郎',
      birthDate: '1985-06-15'
    });
  });

  it('parses [remuneration_history] section', () => {
    expect(parsed.sections.remuneration_history?.rows).toHaveLength(1);
    expect(parsed.sections.remuneration_history?.rows[0].effectiveFrom).toBe('2024-04-01');
    expect(parsed.sections.remuneration_history?.rows[0].stdRemuneration).toBe('88000');
  });

  it('parses [monthly_notes] section', () => {
    expect(parsed.sections.monthly_notes?.rows).toHaveLength(2);
    expect(parsed.sections.monthly_notes?.rows[1].memo).toBe('健保改定後初月');
  });

  it('captures schemaVersion from header comments', () => {
    expect(parsed.headerMeta.schemaVersion).toBe(1);
  });

  it('handles quoted values with commas', () => {
    const csv = `[remuneration_history]
effectiveFrom,stdRemuneration,grossSalary,note
2024-04-01,88000,83000,"特別事情, 産育休"
`;
    const p = parseCsv(csv);
    expect(p.sections.remuneration_history?.rows[0].note).toBe('特別事情, 産育休');
  });

  it('handles quoted values containing newlines (RFC 4180 multiline)', () => {
    const csv = `[monthly_notes]
month,notifiedAmount,memo
2024-05,25202,"line1\nline2\nline3"
`;
    const p = parseCsv(csv);
    expect(p.sections.monthly_notes?.rows[0].memo).toBe('line1\nline2\nline3');
  });

  it('unescapes Formula Injection escape', () => {
    const csv = `[monthly_notes]
month,notifiedAmount,memo
2024-05,25202,"'=cmd"
`;
    const p = parseCsv(csv);
    expect(p.sections.monthly_notes?.rows[0].memo).toBe('=cmd');
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
pnpm test tests/unit/csv-parse.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/csv/parse.ts`:

```typescript
import { unescapeCell } from './escape';

export interface ParsedSection {
  header: string[];
  rows: Record<string, string>[];
}

export interface ParsedCsv {
  headerMeta: {
    schemaVersion: number | null;
    appVersion: string | null;
    exportedAt: string | null;
  };
  sections: Record<string, ParsedSection | undefined>;
}

/**
 * RFC 4180 準拠の CSV パーサ。クォート内の改行をフィールド値として扱うため、
 * 行分割 → 行パーサの 2 段階構成ではなく入力全体を 1 パスで走査する状態機械として実装する。
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.startsWith('﻿') ? input.slice(1) : input;
  const records = parseRfc4180(text);

  const headerMeta = {
    schemaVersion: null as number | null,
    appVersion: null as string | null,
    exportedAt: null as string | null
  };
  const sections: Record<string, ParsedSection> = {};

  let currentSection: string | null = null;
  let currentHeader: string[] | null = null;

  for (const record of records) {
    // 空行(全フィールドが空文字 1 個)はセクション境界
    if (record.length === 1 && record[0] === '') {
      currentHeader = null;
      continue;
    }
    const first = record[0];
    if (first.startsWith('#')) {
      const fullLine = record.join(',');
      const m = fullLine.match(/schemaVersion=(\d+)/);
      if (m) headerMeta.schemaVersion = Number(m[1]);
      const m2 = fullLine.match(/exportedAt=(\S+)/);
      if (m2) headerMeta.exportedAt = m2[1];
      const m3 = fullLine.match(/^# solo-shaho (\S+)/);
      if (m3) headerMeta.appVersion = m3[1];
      continue;
    }
    if (first.startsWith('[') && first.endsWith(']') && record.length === 1) {
      currentSection = first.slice(1, -1);
      sections[currentSection] = { header: [], rows: [] };
      currentHeader = null;
      continue;
    }
    if (currentSection === null) continue;
    if (currentHeader === null) {
      currentHeader = record;
      sections[currentSection].header = record;
    } else {
      const row: Record<string, string> = {};
      for (let i = 0; i < currentHeader.length; i++) {
        row[currentHeader[i]] = unescapeCell(record[i] ?? '');
      }
      sections[currentSection].rows.push(row);
    }
  }

  return { headerMeta, sections };
}

/**
 * RFC 4180 準拠の CSV を入力全体を 1 パスで走査して records へ分解する。
 * クォート内の改行はフィールド値として保持される。
 */
function parseRfc4180(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          buf += '"';
          i++;
          continue;
        }
        inQuote = false;
        continue;
      }
      buf += c;
      continue;
    }
    if (c === '"') {
      inQuote = true;
      continue;
    }
    if (c === ',') {
      record.push(buf);
      buf = '';
      continue;
    }
    if (c === '\r') continue; // CRLF の CR は無視
    if (c === '\n') {
      record.push(buf);
      records.push(record);
      record = [];
      buf = '';
      continue;
    }
    buf += c;
  }
  // 末尾改行なしの最終フィールドを取りこぼさない
  if (buf !== '' || record.length > 0) {
    record.push(buf);
    records.push(record);
  }
  return records;
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/csv-parse.test.ts
```

期待: 7 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/csv/parse.ts web/tests/unit/csv-parse.test.ts
git commit -m "feat(csv): implement RFC 4180 parser with section + Formula unescape"
```

---

### Task 24: Implement `csv/validate.ts` (intermediate → AppState) (TDD)

**Files:**
- Create: `web/src/lib/csv/validate.ts`
- Create: `web/tests/unit/csv-validate.test.ts`

- [ ] **Step 1: 失敗するテスト**

`web/tests/unit/csv-validate.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateAndConvert, ImportError } from '$lib/csv/validate';
import { parseCsv } from '$lib/csv/parse';

const VALID = `# schemaVersion=1

[profile]
name,birthDate
山田,1985-06-15

[remuneration_history]
effectiveFrom,stdRemuneration,grossSalary,note
2024-04-01,88000,83000,定時決定

[monthly_notes]
month,notifiedAmount,memo
2024-05,25202,メモ
`;

describe('validateAndConvert', () => {
  it('converts a valid parsed CSV into AppState', () => {
    const result = validateAndConvert(parseCsv(VALID));
    expect(result.profile.name).toBe('山田');
    expect(result.profile.birthDate).toBe('1985-06-15');
    expect(result.remunerationHistory).toHaveLength(1);
    expect(result.remunerationHistory[0].stdRemuneration).toBe(88000);
    expect(result.monthlyNotes['2024-05'].notifiedAmount).toBe(25202);
  });

  it('throws when schemaVersion is missing', () => {
    const csv = VALID.replace('# schemaVersion=1', '');
    expect(() => validateAndConvert(parseCsv(csv))).toThrow(ImportError);
  });

  it('throws when schemaVersion mismatches', () => {
    const csv = VALID.replace('schemaVersion=1', 'schemaVersion=2');
    expect(() => validateAndConvert(parseCsv(csv))).toThrow(/schemaVersion/);
  });

  it('throws when [profile] section is missing', () => {
    const csv = VALID.replace(/\[profile\][\s\S]*?\n\n/, '');
    expect(() => validateAndConvert(parseCsv(csv))).toThrow(/profile/);
  });

  it('throws when remuneration_history is empty', () => {
    const csv = VALID.replace(/2024-04-01,88000,83000,定時決定\n/, '');
    expect(() => validateAndConvert(parseCsv(csv))).toThrow(/remuneration/);
  });

  it('throws on invalid date format', () => {
    const csv = VALID.replace('2024-04-01', '2024/04/01');
    expect(() => validateAndConvert(parseCsv(csv))).toThrow(/date/);
  });

  it('throws on invalid month key in monthly_notes', () => {
    const csv = VALID.replace('2024-05', 'invalid');
    expect(() => validateAndConvert(parseCsv(csv))).toThrow(/month/);
  });

  it('throws on negative numeric value', () => {
    const csv = VALID.replace('88000', '-1');
    expect(() => validateAndConvert(parseCsv(csv))).toThrow(/non-negative/);
  });
});
```

- [ ] **Step 2: テスト失敗確認**

```bash
pnpm test tests/unit/csv-validate.test.ts
```

期待: FAIL。

- [ ] **Step 3: 実装**

`web/src/lib/csv/validate.ts`:

```typescript
import {
  validateAppState,
  CURRENT_SCHEMA_VERSION,
  type AppState
} from '$lib/payroll/types';
import type { ParsedCsv } from './parse';

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/**
 * CSV パース結果を中間オブジェクトに変換した上で、
 * payroll/types.ts の `validateAppState` で構造検証を行う。
 * これにより loadFromStorage と validateAndConvert で検証ロジックを共有できる。
 */
export function validateAndConvert(parsed: ParsedCsv): AppState {
  if (parsed.headerMeta.schemaVersion === null) {
    throw new ImportError('Missing schemaVersion in header');
  }
  if (parsed.headerMeta.schemaVersion !== CURRENT_SCHEMA_VERSION) {
    throw new ImportError(
      `Unsupported schemaVersion: ${parsed.headerMeta.schemaVersion} (expected ${CURRENT_SCHEMA_VERSION})`
    );
  }

  const profileSec = parsed.sections.profile;
  if (!profileSec || profileSec.rows.length === 0) {
    throw new ImportError('Missing [profile] section');
  }
  const profileRow = profileSec.rows[0];

  const remSec = parsed.sections.remuneration_history;
  if (!remSec || remSec.rows.length === 0) {
    throw new ImportError('Missing or empty [remuneration_history]');
  }

  // 中間オブジェクト構築 — 数値・日付・キーの構造検証は validateAppState に委譲
  const intermediate: unknown = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: {
      name: profileRow.name ?? '',
      birthDate: profileRow.birthDate === '' ? null : profileRow.birthDate ?? null
    },
    remunerationHistory: remSec.rows.map((r) => ({
      effectiveFrom: r.effectiveFrom ?? '',
      stdRemuneration: r.stdRemuneration === '' ? -1 : Number(r.stdRemuneration),
      grossSalary: r.grossSalary === '' ? -1 : Number(r.grossSalary),
      note: r.note ?? ''
    })),
    monthlyNotes: Object.fromEntries(
      (parsed.sections.monthly_notes?.rows ?? []).map((r) => {
        const note: { notifiedAmount?: number; memo?: string } = {};
        if (r.notifiedAmount !== undefined && r.notifiedAmount !== '') {
          note.notifiedAmount = Number(r.notifiedAmount);
        }
        if (r.memo !== undefined && r.memo !== '') note.memo = r.memo;
        return [r.month ?? '', note];
      })
    )
  };

  try {
    return validateAppState(intermediate);
  } catch (e) {
    // AppStateValidationError を ImportError に統一して、UI で同じハンドリングが可能に
    throw new ImportError(`CSV validation failed: ${(e as Error).message}`);
  }
}
```

- [ ] **Step 4: テスト成功確認**

```bash
pnpm test tests/unit/csv-validate.test.ts
```

期待: 8 passed。

- [ ] **Step 5: コミット**

```bash
git add web/src/lib/csv/validate.ts web/tests/unit/csv-validate.test.ts
git commit -m "feat(csv): implement strict validateAndConvert with no fallbacks"
```

---

### Task 25: CSV roundtrip integration test

**Files:**
- Create: `web/tests/unit/csv-roundtrip.test.ts`

- [ ] **Step 1: 失敗するテスト(統合テスト)**

`web/tests/unit/csv-roundtrip.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeAppState } from '$lib/csv/serialize';
import { parseCsv } from '$lib/csv/parse';
import { validateAndConvert } from '$lib/csv/validate';
import type { AppState } from '$lib/payroll/types';

const original: AppState = {
  schemaVersion: 1,
  profile: { name: '山田太郎', birthDate: '1985-06-15' },
  remunerationHistory: [
    { effectiveFrom: '2024-04-01', stdRemuneration: 88000, grossSalary: 83000, note: '定時決定' }
  ],
  monthlyNotes: {
    '2024-05': { notifiedAmount: 25202, memo: '通常月' },
    '2026-04': { notifiedAmount: 25088, memo: '=cmd|/c calc' },
    '2026-05': { notifiedAmount: 25290, memo: '改行を\n含む\nメモ' }
  }
};

describe('CSV roundtrip', () => {
  it('serialize → parse → validate restores AppState (with newlines, formula injection)', () => {
    const csv = serializeAppState(original, { exportedAt: '2026-04-25T14:30:00+09:00' });
    const restored = validateAndConvert(parseCsv(csv));
    expect(restored.profile).toEqual(original.profile);
    expect(restored.remunerationHistory).toEqual(original.remunerationHistory);
    // Formula Injection 文字列もそのまま復元される(エスケープが対称)
    expect(restored.monthlyNotes['2026-04'].memo).toBe('=cmd|/c calc');
    expect(restored.monthlyNotes['2024-05'].memo).toBe('通常月');
    // クォート内改行(RFC 4180 multiline)も保持される
    expect(restored.monthlyNotes['2026-05'].memo).toBe('改行を\n含む\nメモ');
  });

  it('Formula Injection 文字列がエクスポート CSV では先頭シングルクォート付き', () => {
    const csv = serializeAppState(original, { exportedAt: 'x' });
    expect(csv).toContain(`"'=cmd|/c calc"`);
  });
});
```

- [ ] **Step 2: テスト実行**

```bash
pnpm test tests/unit/csv-roundtrip.test.ts
```

期待: 2 passed(各部品が完成しているため、追加実装なしで通る)。

- [ ] **Step 3: コミット**

```bash
git add web/tests/unit/csv-roundtrip.test.ts
git commit -m "test(csv): add roundtrip integration test"
```

---

## Phase E: UI Components

### Task 26: Layout + tab navigation

**Files:**
- Modify: `web/src/routes/+layout.svelte`
- Create: `web/src/routes/monthly/+page.svelte`
- Create: `web/src/routes/history/+page.svelte`

- [ ] **Step 1: `web/src/routes/+layout.svelte` を更新**

```text
<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';

  const tabs = [
    { href: '/', label: '設定' },
    { href: '/monthly', label: '月次' },
    { href: '/history', label: '履歴' }
  ];

  $: current = $page.url.pathname;
</script>

<div class="min-h-screen bg-white text-gray-900">
  <header class="border-b bg-gray-50">
    <nav class="container mx-auto flex items-center gap-4 px-4 py-3">
      <h1 class="text-lg font-bold">solo-shaho</h1>
      <ul class="flex gap-2">
        {#each tabs as t}
          <li>
            <a
              href={t.href}
              class="rounded px-3 py-1.5 text-sm hover:bg-gray-200"
              class:bg-gray-200={current === t.href}
              class:font-bold={current === t.href}
            >{t.label}</a>
          </li>
        {/each}
      </ul>
    </nav>
  </header>
  <main class="container mx-auto px-4 py-6">
    <slot />
  </main>
</div>
```

- [ ] **Step 2: `web/src/routes/monthly/+page.svelte` を作成(プレースホルダ)**

```text
<h2 class="text-2xl font-bold">月次計算</h2>
<p class="mt-2 text-gray-600">準備中。</p>
```

- [ ] **Step 3: `web/src/routes/history/+page.svelte` を作成(プレースホルダ)**

```text
<h2 class="text-2xl font-bold">履歴</h2>
<p class="mt-2 text-gray-600">準備中。</p>
```

- [ ] **Step 4: `web/src/routes/+page.svelte` を一旦プレースホルダに**

```text
<h2 class="text-2xl font-bold">設定</h2>
<p class="mt-2 text-gray-600">準備中。</p>
```

- [ ] **Step 5: dev サーバで目視確認**

```bash
cd web
pnpm dev
```

ブラウザで `http://localhost:5173/`, `/monthly`, `/history` を開き、3 タブが切り替わることを確認。Ctrl-C で終了。

- [ ] **Step 6: コミット**

```bash
git add web/src/routes/
git commit -m "feat(ui): tab navigation layout with placeholder pages"
```

---

### Task 27: Settings tab — profile + remuneration history table

**Files:**
- Modify: `web/src/routes/+page.svelte`
- Create: `web/src/lib/format/numbers.ts`

- [ ] **Step 1: `getAppStateStore` シングルトンは Task 19 で既に export 済み(本ステップは不要、確認のみ)**

- [ ] **Step 2: `web/src/lib/format/numbers.ts` を作成**

```typescript
const yenFmt = new Intl.NumberFormat('ja-JP');

export function formatYen(n: number): string {
  return yenFmt.format(n);
}

/** 1/100,000 単位の整数を "X.XX%" にする。 */
export function formatRatePercent(rateX100k: number, fractionDigits = 2): string {
  return (rateX100k / 1000).toFixed(fractionDigits) + '%';
}
```

- [ ] **Step 3: `web/src/routes/+page.svelte` を実装**

```text
<script lang="ts">
  import { getAppStateStore } from '$lib/stores/appState';
  import { formatYen } from '$lib/format/numbers';
  import { isKaigoApplicable } from '$lib/payroll/kaigo';

  const store = getAppStateStore();

  function todayDateString(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  }

  function addRemunerationRow() {
    // 新規行のデフォルト effectiveFrom は当月1日。空文字を入れて
    // 文字列辞書順比較で常時マッチしてしまう silent な ゼロフォールバックを防ぐ。
    store.update((s) => ({
      ...s,
      remunerationHistory: [
        ...s.remunerationHistory,
        {
          effectiveFrom: todayDateString(),
          stdRemuneration: 0,
          grossSalary: 0,
          note: ''
        }
      ]
    }));
  }

  function removeRemunerationRow(idx: number) {
    store.update((s) => ({
      ...s,
      remunerationHistory: s.remunerationHistory.filter((_, i) => i !== idx)
    }));
  }

  $: today = new Date();
  $: currentY = today.getFullYear();
  $: currentM = today.getMonth() + 1;
  $: kaigoNow = isKaigoApplicable($store.profile.birthDate, currentY, currentM);

  // 履歴に空 effectiveFrom が含まれている場合、計算結果は信頼できない。
  // バリデーションメッセージで明示する(silent failure 防止)。
  $: emptyEffectiveCount = $store.remunerationHistory.filter(
    (r) => r.effectiveFrom === ''
  ).length;
</script>

<h2 class="text-2xl font-bold">設定</h2>

<section class="mt-6">
  <h3 class="text-lg font-semibold">プロフィール</h3>
  <div class="mt-3 grid grid-cols-2 gap-3 max-w-xl">
    <label class="block">
      <span class="text-sm text-gray-600">氏名(任意)</span>
      <input class="mt-1 w-full rounded border px-2 py-1" type="text" bind:value={$store.profile.name} />
    </label>
    <label class="block">
      <span class="text-sm text-gray-600">生年月日(必須・介護判定用)</span>
      <input
        class="mt-1 w-full rounded border px-2 py-1"
        type="date"
        bind:value={$store.profile.birthDate}
      />
    </label>
  </div>
  <p class="mt-2 text-sm text-gray-600">
    現在 介護該当: <strong>{kaigoNow ? '✅' : '❌'}</strong>
  </p>
</section>

{#if emptyEffectiveCount > 0}
  <p class="mt-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800">
    報酬改定履歴に「適用開始日」が未入力の行が {emptyEffectiveCount} 件あります。月次・履歴タブの計算は信頼できません。
  </p>
{/if}

<section class="mt-8">
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-semibold">報酬改定履歴</h3>
    <button
      type="button"
      class="rounded border px-3 py-1 text-sm hover:bg-gray-100"
      on:click={addRemunerationRow}>+ 行を追加</button
    >
  </div>
  <table class="mt-3 w-full text-sm">
    <thead class="bg-gray-100 text-gray-600">
      <tr>
        <th class="px-2 py-1 text-left">適用開始日</th>
        <th class="px-2 py-1 text-right">標準報酬月額</th>
        <th class="px-2 py-1 text-right">給与額面</th>
        <th class="px-2 py-1 text-left">備考</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      {#each $store.remunerationHistory as r, idx (idx)}
        <tr class="border-b" class:font-bold={idx === $store.remunerationHistory.length - 1}>
          <td class="px-2 py-1"><input type="date" bind:value={r.effectiveFrom} class="rounded border px-1 py-0.5" /></td>
          <td class="px-2 py-1 text-right"><input type="number" min="0" bind:value={r.stdRemuneration} class="w-32 rounded border px-1 py-0.5 text-right" /></td>
          <td class="px-2 py-1 text-right"><input type="number" min="0" bind:value={r.grossSalary} class="w-32 rounded border px-1 py-0.5 text-right" /></td>
          <td class="px-2 py-1"><input type="text" bind:value={r.note} class="w-full rounded border px-1 py-0.5" /></td>
          <td class="px-2 py-1"><button type="button" class="text-red-600 hover:underline" on:click={() => removeRemunerationRow(idx)}>削除</button></td>
        </tr>
      {/each}
      {#if $store.remunerationHistory.length === 0}
        <tr><td colspan="5" class="px-2 py-3 text-center text-gray-500">「+ 行を追加」で履歴を登録してください</td></tr>
      {/if}
    </tbody>
  </table>
</section>
```

- [ ] **Step 4: dev サーバで目視確認**

```bash
pnpm dev
```

`/` を開き、フォーム入力 → リロード後も値が保持されること(localStorage 動作)を確認。

- [ ] **Step 5: 型チェック**

```bash
pnpm typecheck
```

期待: エラーゼロ。

- [ ] **Step 6: コミット**

```bash
git add web/
git commit -m "feat(ui): settings tab with profile and remuneration history"
```

---

### Task 28: Monthly tab — single month detail view

**Files:**
- Modify: `web/src/routes/monthly/+page.svelte`

- [ ] **Step 1: 月次タブを実装**

`web/src/routes/monthly/+page.svelte`:

```text
<script lang="ts">
  import { getAppStateStore } from '$lib/stores/appState';
  import { formatYen, formatRatePercent } from '$lib/format/numbers';
  import { findApplicableRate } from '$lib/payroll/rates';
  import { findApplicableRemuneration } from '$lib/payroll/remuneration';
  import { calculateMonth } from '$lib/payroll/calculate';
  import type { RateEntry } from '$lib/payroll/types';
  import ratesData from '$lib/data/rates.json';

  const store = getAppStateStore();
  const rateHistory = ratesData.history as RateEntry[];

  const today = new Date();
  let selectedYear = today.getFullYear();
  let selectedMonth = today.getMonth() + 1;

  function shift(delta: number) {
    let y = selectedYear;
    let m = selectedMonth + delta;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    selectedYear = y;
    selectedMonth = m;
  }

  $: ym = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  $: hasRemuneration = $store.remunerationHistory.length > 0;
  $: result = (() => {
    if (!hasRemuneration) return null;
    try {
      const rates = findApplicableRate(ym, rateHistory);
      const rem = findApplicableRemuneration(ym, $store.remunerationHistory);
      return {
        rates,
        rem,
        result: calculateMonth({
          year: selectedYear,
          month: selectedMonth,
          stdRemuneration: rem.stdRemuneration,
          grossSalary: rem.grossSalary,
          birthDate: $store.profile.birthDate,
          rates
        })
      };
    } catch (e) {
      return { error: (e as Error).message };
    }
  })();

  $: note = $store.monthlyNotes[ym] ?? {};
  function saveNote(field: 'notifiedAmount' | 'memo', value: number | string) {
    store.update((s) => ({
      ...s,
      monthlyNotes: {
        ...s.monthlyNotes,
        [ym]: { ...(s.monthlyNotes[ym] ?? {}), [field]: value }
      }
    }));
  }
</script>

<h2 class="text-2xl font-bold">月次計算</h2>

<div class="mt-4 flex items-center gap-2">
  <button class="rounded border px-2 py-1 text-sm" on:click={() => shift(-1)}>← 前月</button>
  <input type="number" min="2016" max="2100" bind:value={selectedYear} class="w-20 rounded border px-2 py-1" />
  <span>年</span>
  <input type="number" min="1" max="12" bind:value={selectedMonth} class="w-16 rounded border px-2 py-1" />
  <span>月</span>
  <button class="rounded border px-2 py-1 text-sm" on:click={() => shift(1)}>次月 →</button>
</div>

{#if !hasRemuneration}
  <p class="mt-6 rounded bg-yellow-50 p-3 text-sm">
    設定タブで報酬改定履歴を 1 行以上登録してください。
  </p>
{:else if result && 'error' in result}
  <p class="mt-6 rounded bg-red-50 p-3 text-sm text-red-700">エラー: {result.error}</p>
{:else if result}
  <section class="mt-6 grid grid-cols-2 gap-6 max-w-3xl">
    <div>
      <h3 class="font-semibold">入力</h3>
      <dl class="mt-2 grid grid-cols-2 gap-1 text-sm">
        <dt class="text-gray-600">標準報酬月額</dt><dd class="text-right">{formatYen(result.rem.stdRemuneration)}</dd>
        <dt class="text-gray-600">給与額面</dt><dd class="text-right">{formatYen(result.rem.grossSalary)}</dd>
        <dt class="text-gray-600">介護該当</dt><dd>{result.result.isKaigoApplicable ? '✅' : '❌'}</dd>
        <dt class="text-gray-600">健保適用料率</dt><dd>{formatRatePercent(result.result.appliedKenpoRate)}</dd>
        <dt class="text-gray-600">厚年料率</dt><dd>{formatRatePercent(result.rates.kosei)}</dd>
        <dt class="text-gray-600">拠出金率</dt><dd>{formatRatePercent(result.rates.kosodate, 3)}</dd>
        <dt class="text-gray-600">支援金率</dt><dd>{formatRatePercent(result.rates.shien, 3)}</dd>
      </dl>
    </div>
    <div>
      <h3 class="font-semibold">計算結果</h3>
      <table class="mt-2 w-full text-sm">
        <thead class="text-gray-600">
          <tr><th class="text-left">項目</th><th class="text-right">全額</th><th class="text-right">社員</th><th class="text-right">事業主</th></tr>
        </thead>
        <tbody>
          <tr><td>健保</td><td class="text-right">{formatYen(result.result.kenpoTotal)}</td><td class="text-right">{formatYen(result.result.kenpoEmployee)}</td><td class="text-right">{formatYen(result.result.kenpoEmployer)}</td></tr>
          <tr><td>厚年</td><td class="text-right">{formatYen(result.result.koseiTotal)}</td><td class="text-right">{formatYen(result.result.koseiEmployee)}</td><td class="text-right">{formatYen(result.result.koseiEmployer)}</td></tr>
          <tr><td>拠出金</td><td class="text-right">{formatYen(result.result.kosodateTotal)}</td><td class="text-right">─</td><td class="text-right">{formatYen(result.result.kosodateEmployer)}</td></tr>
          <tr><td>支援金</td><td class="text-right">{formatYen(result.result.shienTotal)}</td><td class="text-right">{formatYen(result.result.shienEmployee)}</td><td class="text-right">{formatYen(result.result.shienEmployer)}</td></tr>
          <tr class="border-t font-semibold"><td>合計</td><td></td><td class="text-right">{formatYen(result.result.employeeDeductionTotal)}</td><td class="text-right">{formatYen(result.result.employerBurdenTotal)}</td></tr>
          <tr class="font-bold"><td>納付額</td><td colspan="3" class="text-right">{formatYen(result.result.payableTotal)}</td></tr>
          <tr><td>差引支給額</td><td colspan="3" class="text-right">{formatYen(result.result.netSalary)}</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="mt-6 max-w-3xl">
    <h3 class="font-semibold">通知額(任意・検算用)</h3>
    <div class="mt-2 flex items-center gap-3 text-sm">
      <label>
        通知額: <input type="number" min="0" value={note.notifiedAmount ?? ''} on:change={(e) => saveNote('notifiedAmount', Number((e.target as HTMLInputElement).value))} class="w-32 rounded border px-2 py-0.5 text-right" />
      </label>
      {#if note.notifiedAmount !== undefined}
        <span>差分: {formatYen(result.result.payableTotal - note.notifiedAmount)}</span>
      {/if}
    </div>
    <label class="mt-3 block text-sm">
      メモ
      <textarea bind:value={note.memo} on:change={(e) => saveNote('memo', (e.target as HTMLTextAreaElement).value)} rows="2" class="mt-1 w-full rounded border px-2 py-1"></textarea>
    </label>
  </section>
{/if}
```

- [ ] **Step 2: dev サーバで目視確認**

```bash
pnpm dev
```

`/monthly` を開き、設定タブで入力した報酬改定履歴に基づき計算結果が出ることを確認。

- [ ] **Step 3: 型チェック**

```bash
pnpm typecheck
```

期待: エラーゼロ。

- [ ] **Step 4: コミット**

```bash
git add web/src/routes/monthly/
git commit -m "feat(ui): monthly tab with full calculation breakdown"
```

---

### Task 29: History tab — spreadsheet-like table with annual aggregation

**Files:**
- Modify: `web/src/routes/history/+page.svelte`

- [ ] **Step 1: 履歴タブを実装**

`web/src/routes/history/+page.svelte`:

```text
<script lang="ts">
  import { getAppStateStore } from '$lib/stores/appState';
  import { formatYen } from '$lib/format/numbers';
  import { calculateRange } from '$lib/payroll/calculate';
  import { aggregateByCalendarYear } from '$lib/payroll/aggregate';
  import { findApplicableRemuneration } from '$lib/payroll/remuneration';
  import { EntryNotFoundError } from '$lib/payroll/lookup';
  import type { MonthResult, RateEntry, YearSummary } from '$lib/payroll/types';
  import ratesData from '$lib/data/rates.json';

  const store = getAppStateStore();
  const rateHistory = ratesData.history as RateEntry[];

  type Row =
    | { kind: 'month'; result: MonthResult; std: number }
    | { kind: 'year'; summary: YearSummary };

  // ユーザー指定の表示範囲を、報酬改定履歴に基づく適用可能範囲にクランプする。
  // 履歴より古い月を含めた瞬間に EntryNotFoundError が出るのを防ぎつつ、
  // フォールバックでゼロ値を捏造することもしない(「クランプして表示しない」を選択)。
  function effectiveStartYM(userStart: string, history: readonly { effectiveFrom: string }[]): string | null {
    if (history.length === 0) return null;
    const oldest = [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0];
    const oldestYM = oldest.effectiveFrom.slice(0, 7);
    return userStart < oldestYM ? oldestYM : userStart;
  }

  let userStartYM = '2024-04';
  let endYM = `${new Date().getFullYear() + 1}-12`;

  $: hasRem = $store.remunerationHistory.length > 0;
  $: clampedStart = effectiveStartYM(userStartYM, $store.remunerationHistory);
  $: months = hasRem && clampedStart !== null
    ? calculateRange(clampedStart, endYM, {
        birthDate: $store.profile.birthDate,
        remunerationHistory: $store.remunerationHistory,
        rateHistory
      })
    : [];
  $: yearSummaries = aggregateByCalendarYear(months);
  $: rows = (() => {
    const out: Row[] = [];
    let curYear: number | null = null;
    for (const r of months) {
      if (curYear !== null && curYear !== r.year) {
        const sum = yearSummaries.find((s) => s.year === curYear);
        if (sum) out.push({ kind: 'year', summary: sum });
      }
      // findApplicableRemuneration の throw は現時点で発生しない契約
      // (clampedStart で履歴範囲外を排除済み)。万一 throw した場合は
      // 上位の reactive ブロックでそのまま伝播させる(ユーザーに表示する)。
      const std = findApplicableRemuneration(`${r.year}-${String(r.month).padStart(2, '0')}`, $store.remunerationHistory).stdRemuneration;
      out.push({ kind: 'month', result: r, std });
      curYear = r.year;
    }
    if (curYear !== null) {
      const sum = yearSummaries.find((s) => s.year === curYear);
      if (sum) out.push({ kind: 'year', summary: sum });
    }
    return out;
  })();

  // 表示範囲のクランプをユーザーに開示する(silent failure 防止)
  $: rangeClamped = clampedStart !== null && clampedStart !== userStartYM;
</script>

<h2 class="text-2xl font-bold">履歴</h2>

<div class="mt-4 flex items-center gap-3 text-sm">
  <label>開始: <input type="month" bind:value={userStartYM} class="rounded border px-2 py-1" /></label>
  <label>終了: <input type="month" bind:value={endYM} class="rounded border px-2 py-1" /></label>
</div>

{#if rangeClamped}
  <p class="mt-2 rounded bg-yellow-50 p-2 text-sm text-yellow-800">
    指定の開始月 {userStartYM} は報酬改定履歴の最古エントリより古いため、{clampedStart} から表示しています。
  </p>
{/if}

{#if !hasRem}
  <p class="mt-6 rounded bg-yellow-50 p-3 text-sm">設定タブで報酬改定履歴を登録してください。</p>
{:else}
  <div class="mt-6 overflow-x-auto">
    <table class="w-full min-w-max text-sm">
      <thead class="bg-gray-100">
        <tr>
          <th class="px-2 py-1 text-right">年/月</th>
          <th class="px-2 py-1 text-right">標報</th>
          <th class="px-2 py-1 text-right">介護</th>
          <th class="px-2 py-1 text-right">社員天引き</th>
          <th class="px-2 py-1 text-right">事業主負担</th>
          <th class="px-2 py-1 text-right">納付額</th>
          <th class="px-2 py-1 text-right">差引支給</th>
          <th class="px-2 py-1 text-right">通知額</th>
          <th class="px-2 py-1 text-right">差分</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          {#if row.kind === 'month'}
            <tr class="border-b">
              <td class="px-2 py-1 text-right">{row.result.year}/{row.result.month}</td>
              <td class="px-2 py-1 text-right">{formatYen(row.std)}</td>
              <td class="px-2 py-1 text-right">{row.result.isKaigoApplicable ? '✅' : '─'}</td>
              <td class="px-2 py-1 text-right">{formatYen(row.result.employeeDeductionTotal)}</td>
              <td class="px-2 py-1 text-right">{formatYen(row.result.employerBurdenTotal)}</td>
              <td class="px-2 py-1 text-right">{formatYen(row.result.payableTotal)}</td>
              <td class="px-2 py-1 text-right">{formatYen(row.result.netSalary)}</td>
              {@const monthKey = `${row.result.year}-${String(row.result.month).padStart(2, '0')}`}
              {@const notified = $store.monthlyNotes[monthKey]?.notifiedAmount}
              <td class="px-2 py-1 text-right">
                {#if notified !== undefined}
                  {formatYen(notified)}
                {:else}─{/if}
              </td>
              <td class="px-2 py-1 text-right">
                {#if notified !== undefined}
                  {formatYen(row.result.payableTotal - notified)}
                {:else}─{/if}
              </td>
            </tr>
          {:else}
            <tr class="border-y-2 border-gray-400 bg-gray-50 font-semibold">
              <td colspan="3" class="px-2 py-1 text-right">{row.summary.year}年 集計({row.summary.monthCount}月分)</td>
              <td class="px-2 py-1 text-right">{formatYen(row.summary.employeeDeductionTotal)}</td>
              <td class="px-2 py-1 text-right">{formatYen(row.summary.employerBurdenTotal)}</td>
              <td class="px-2 py-1 text-right">{formatYen(row.summary.payableTotal)}</td>
              <td colspan="3"></td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{/if}
```

- [ ] **Step 2: dev サーバで目視確認**

```bash
pnpm dev
```

`/history` を開き、月次行と年次集計行が混在表示されること、暦年が変わるところで集計行が入ることを確認。

- [ ] **Step 3: 型チェック**

```bash
pnpm typecheck
```

- [ ] **Step 4: コミット**

```bash
git add web/src/routes/history/
git commit -m "feat(ui): history tab with monthly grid + annual aggregation rows"
```

---

### Task 30: I/O menu (CSV export, import, clear)

**Files:**
- Modify: `web/src/routes/+layout.svelte`

- [ ] **Step 1: I/O メニューを layout に追加**

`web/src/routes/+layout.svelte` を更新(全置換):

```text
<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { getAppStateStore } from '$lib/stores/appState';
  import { createDefaultAppState } from '$lib/payroll/types';
  import { persistenceErrorStore, clearPersistenceError } from '$lib/stores/persistence';
  import { serializeAppState } from '$lib/csv/serialize';
  import { parseCsv } from '$lib/csv/parse';
  import { validateAndConvert } from '$lib/csv/validate';

  const tabs = [
    { href: '/', label: '設定' },
    { href: '/monthly', label: '月次' },
    { href: '/history', label: '履歴' }
  ];

  const store = getAppStateStore();
  let menuOpen = false;
  let fileInput: HTMLInputElement;
  let importMessage = '';

  function exportCsv() {
    const csv = serializeAppState($store, { exportedAt: new Date().toISOString() });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `solo-shaho-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    menuOpen = false;
  }

  async function importCsv() {
    const file = fileInput.files?.[0];
    if (!file) return;

    // ファイル読込・パース・バリデーションの 3 段階すべてでエラーをユーザーに伝える
    let text: string;
    try {
      text = await file.text();
    } catch (e) {
      importMessage = `ファイル読み取り失敗: ${(e as Error).message}`;
      fileInput.value = '';
      menuOpen = false;
      return;
    }

    let next;
    try {
      next = validateAndConvert(parseCsv(text));
    } catch (e) {
      importMessage = `CSV パース/バリデーション失敗: ${(e as Error).message}`;
      fileInput.value = '';
      menuOpen = false;
      return;
    }

    if (!confirm('既存データを上書きします。本当に取り込みますか?')) {
      fileInput.value = '';
      menuOpen = false;
      return;
    }
    store.set(next);
    importMessage = '取り込み成功';
    fileInput.value = '';
    menuOpen = false;
  }

  function clearAll() {
    if (!confirm('すべてのデータを削除します。事前に CSV エクスポートしましたか?')) return;
    store.set(createDefaultAppState());
    menuOpen = false;
  }

  $: current = $page.url.pathname;
</script>

<div class="min-h-screen bg-white text-gray-900">
  <header class="border-b bg-gray-50">
    <nav class="container mx-auto flex items-center gap-4 px-4 py-3">
      <h1 class="text-lg font-bold">solo-shaho</h1>
      <ul class="flex gap-2">
        {#each tabs as t}
          <li>
            <a
              href={t.href}
              class="rounded px-3 py-1.5 text-sm hover:bg-gray-200"
              class:bg-gray-200={current === t.href}
              class:font-bold={current === t.href}
            >{t.label}</a>
          </li>
        {/each}
      </ul>
      <div class="ml-auto relative">
        <button class="rounded border px-3 py-1 text-sm" on:click={() => (menuOpen = !menuOpen)}>⚙ I/O</button>
        {#if menuOpen}
          <div class="absolute right-0 top-full z-10 mt-1 w-48 rounded border bg-white p-1 shadow">
            <button class="block w-full rounded px-3 py-1 text-left text-sm hover:bg-gray-100" on:click={exportCsv}>CSV エクスポート</button>
            <label class="block w-full rounded px-3 py-1 text-left text-sm hover:bg-gray-100">
              CSV インポート
              <input bind:this={fileInput} type="file" accept=".csv,text/csv" class="hidden" on:change={importCsv} />
            </label>
            <button class="block w-full rounded px-3 py-1 text-left text-sm text-red-600 hover:bg-red-50" on:click={clearAll}>全データクリア</button>
          </div>
        {/if}
      </div>
    </nav>
  </header>
  <main class="container mx-auto px-4 py-6">
    {#if $persistenceErrorStore !== null}
      <div class="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
        <strong>データの保存に失敗しました</strong>: {$persistenceErrorStore.message}<br />
        ストレージ容量超過などの可能性があります。CSV エクスポートでバックアップを取り、ブラウザの保存データを整理してください。
        <button class="ml-2 underline" on:click={clearPersistenceError}>閉じる</button>
      </div>
    {/if}
    {#if importMessage !== ''}
      <p class="mb-4 rounded bg-blue-50 p-2 text-sm">{importMessage}</p>
    {/if}
    <slot />
  </main>
</div>
```

- [ ] **Step 2: dev サーバで動作確認**

```bash
pnpm dev
```

操作確認:
1. 設定タブで何か入力 → I/O > CSV エクスポート → ファイルダウンロード
2. I/O > 全データクリア → 確認後リセット
3. I/O > CSV インポート → ダウンロードしたファイルを選択 → データ復元

- [ ] **Step 3: 型チェック**

```bash
pnpm typecheck
```

- [ ] **Step 4: コミット**

```bash
git add web/src/routes/+layout.svelte
git commit -m "feat(ui): I/O menu with CSV export, import, and clear"
```

---

## Phase F: Excel Fixture Regression Test (Optional, gitignored)

### Task 31: Python `extract_from_excel.py` script

**Files:**
- Create: `web/tests/fixtures/extract_from_excel.py`
- Create: `web/tests/fixtures/README.md`

注意: Excel ファイルは個人データ含有のため fixture JSON は gitignore 済み。スクリプト本体のみコミットする。

- [ ] **Step 1: README を先に作成**

`web/tests/fixtures/README.md`:

```markdown
# Excel Fixture (gitignored)

`給与計算.xlsx` から計算結果を抽出して、TS 計算エンジンの回帰テストに
使用する fixture を生成するためのツール。

個人データを含むため `excel-snapshot.json` は gitignore 対象。
ローカル環境でのみ生成・使用する。

## 使い方

```sh
# プロジェクトルートで
uv run python web/tests/fixtures/extract_from_excel.py
# → web/tests/fixtures/excel-snapshot.json が生成される

# 抽出データを使った回帰テストの実行
cd web && pnpm test tests/fixtures/excel-snapshot.test.ts
```
```

- [ ] **Step 2: 抽出スクリプトを作成**

`web/tests/fixtures/extract_from_excel.py`:

```python
"""給与計算.xlsx から計算結果を JSON fixture として抽出する.

個人データを含むため出力ファイルは gitignore 対象。
"""
import json
from datetime import date
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[3]
EXCEL = ROOT / "給与計算.xlsx"
OUTPUT = Path(__file__).parent / "excel-snapshot.json"


def main() -> None:
    if not EXCEL.exists():
        raise SystemExit(f"Excel ファイルが見つかりません: {EXCEL}")

    wb = load_workbook(EXCEL, data_only=True)
    settings = wb["設定"]
    monthly = wb["月次計算"]

    birth_cell = settings["B3"].value
    birth = (
        birth_cell.strftime("%Y-%m-%d")
        if isinstance(birth_cell, date)
        else (birth_cell or "")
    )

    cases = []
    for row in monthly.iter_rows(min_row=2, values_only=True):
        if row[0] is None:
            continue
        year, month = int(row[0]), int(row[1])
        std = int(row[4])
        gross = int(row[5])
        cases.append(
            {
                "year": year,
                "month": month,
                "input": {
                    "stdRemuneration": std,
                    "grossSalary": gross,
                    "birthDate": birth,
                },
                "expected": {
                    "isKaigoApplicable": bool(row[3]),
                    "kenpoTotal": int(row[12]) if row[12] is not None else None,
                    "koseiTotal": int(row[13]) if row[13] is not None else None,
                    "kosodateTotal": int(row[14]) if row[14] is not None else None,
                    "shienTotal": int(row[15]) if row[15] is not None else None,
                    "kenpoEmployee": int(row[16]) if row[16] is not None else None,
                    "koseiEmployee": int(row[17]) if row[17] is not None else None,
                    "shienEmployee": int(row[18]) if row[18] is not None else None,
                    "kenpoEmployer": int(row[19]) if row[19] is not None else None,
                    "koseiEmployer": int(row[20]) if row[20] is not None else None,
                    "kosodateEmployer": int(row[21]) if row[21] is not None else None,
                    "shienEmployer": int(row[22]) if row[22] is not None else None,
                    "employeeDeductionTotal": int(row[23]) if row[23] is not None else None,
                    "employerBurdenTotal": int(row[24]) if row[24] is not None else None,
                    "payableTotal": int(row[25]) if row[25] is not None else None,
                    "netSalary": int(row[26]) if row[26] is not None else None,
                },
            }
        )

    OUTPUT.write_text(
        json.dumps(
            {
                "extractedAt": __import__("datetime").datetime.now().isoformat(),
                "sourceFile": str(EXCEL.relative_to(ROOT)),
                "birthDate": birth,
                "cases": cases,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT} with {len(cases)} cases")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: スクリプト実行**

```bash
cd /home/driller/repo/solo-shaho
uv run python web/tests/fixtures/extract_from_excel.py
```

期待: `web/tests/fixtures/excel-snapshot.json` が作成され、127 件 (2016/06〜2026/12) のケースが含まれる。

- [ ] **Step 4: gitignore 確認**

```bash
git status
```

期待: `excel-snapshot.json` が gitignore 済みで untracked にも出ない。

- [ ] **Step 5: コミット(スクリプトと README のみ)**

```bash
git add web/tests/fixtures/extract_from_excel.py web/tests/fixtures/README.md
git commit -m "feat(test): add Excel fixture extraction script (gitignored output)"
```

---

### Task 32: Excel snapshot regression test

**Files:**
- Create: `web/tests/fixtures/excel-snapshot.test.ts`

このテストは `excel-snapshot.json` の存在に依存するため、ファイル不在時は skip する。CI(Workers Builds)では fixture が無いので skip され、ローカルでのみ実行される。

- [ ] **Step 1: 失敗するテスト**

`web/tests/fixtures/excel-snapshot.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { calculateMonth } from '$lib/payroll/calculate';
import { findApplicableRate } from '$lib/payroll/rates';
import type { RateEntry } from '$lib/payroll/types';
import ratesData from '$lib/data/rates.json';

const SNAPSHOT_PATH = resolve(__dirname, 'excel-snapshot.json');
const SKIP = !existsSync(SNAPSHOT_PATH);
const rateHistory = ratesData.history as RateEntry[];

interface SnapshotCase {
  year: number;
  month: number;
  input: { stdRemuneration: number; grossSalary: number; birthDate: string };
  expected: Record<string, number | boolean | null>;
}

describe.skipIf(SKIP)('Excel snapshot regression', () => {
  const data = SKIP
    ? { cases: [] as SnapshotCase[] }
    : (JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { cases: SnapshotCase[] });

  for (const c of data.cases) {
    it(`${c.year}/${c.month}`, () => {
      const ym = `${c.year}-${String(c.month).padStart(2, '0')}`;
      const rates = findApplicableRate(ym, rateHistory);
      const got = calculateMonth({
        year: c.year,
        month: c.month,
        stdRemuneration: c.input.stdRemuneration,
        grossSalary: c.input.grossSalary,
        birthDate: c.input.birthDate || null,
        rates
      });
      for (const [k, v] of Object.entries(c.expected)) {
        if (v === null) continue;
        expect((got as Record<string, unknown>)[k]).toBe(v);
      }
    });
  }
});
```

- [ ] **Step 2: テスト実行**

```bash
cd web
pnpm test tests/fixtures/excel-snapshot.test.ts
```

期待:
- ローカル(fixture あり): 全 127 ケース pass
- もし失敗するケースがあれば `calculateMonth` のバグ。修正してテストが全 pass するまで繰り返す
- CI 環境(fixture なし): skip(0 tests)

- [ ] **Step 3: コミット(テストファイルのみ)**

```bash
git add web/tests/fixtures/excel-snapshot.test.ts
git commit -m "test(payroll): add Excel snapshot regression test (skipped if no fixture)"
```

---

## Phase G: Deployment

### Task 33: Update repository README

**Files:**
- Modify: `/home/driller/repo/solo-shaho/README.md`

- [ ] **Step 1: README を更新(末尾に Web アプリ節を追加)**

既存の README の末尾に以下を追加:

```markdown
## Web アプリ版 (Phase 1)

`web/` ディレクトリに、ブラウザで動作する SvelteKit + Cloudflare Workers Static Assets 版を実装しています。

- **配信**: Cloudflare Workers(無料枠で永久運用可)
- **データ保管**: ブラウザの localStorage のみ。サーバには送信されません
- **バックアップ**: 設定タブの ⚙ I/O メニューから CSV エクスポート/インポート

### ローカル開発

```sh
cd web
pnpm install
pnpm dev    # http://localhost:5173/
```

### Excel との関係

`給与計算.xlsx` と `scripts/build_payroll.py` は **凍結** されており、
Web アプリ版とは独立に動作し続けます。Web アプリ版が日常運用の主役、
Excel は税務調査・印刷用のバックアップとして残しています。

### プライバシー

- 氏名・生年月日・標準報酬月額・給与額面はあなたのブラウザの localStorage にのみ保存されます
- 計算ロジックは静的アセットとして配信され、サーバへのリクエストは静的ファイル取得のみです
- CSP・X-Frame-Options 等のセキュリティヘッダで XSS による漏洩リスクを軽減しています
```

- [ ] **Step 2: コミット**

```bash
cd /home/driller/repo/solo-shaho
git add README.md
git commit -m "docs: add web app section to README"
```

---

### Task 34: Initial deployment to Cloudflare Workers

**Files:** (no code changes; manual setup)

- [ ] **Step 1: Cloudflare アカウントでログインしている状態を確認**

```bash
cd web
pnpm exec wrangler whoami
```

未ログインなら `pnpm exec wrangler login` を実行してブラウザ認証。

- [ ] **Step 2: 初回ローカルデプロイテスト**

```bash
pnpm build
pnpm exec wrangler deploy
```

期待: `https://solo-shaho.<account>.workers.dev` のような URL が出力される。

- [ ] **Step 3: ブラウザで開いて動作確認**

出力された URL をブラウザで開き、3 タブが正しく動作するか確認。

- [ ] **Step 4: セキュリティヘッダの検証**

```bash
curl -I https://solo-shaho.<account>.workers.dev/
```

期待: 以下のヘッダが含まれる
- `Content-Security-Policy: default-src 'self'; ...`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy: ...`
- `X-Content-Type-Options: nosniff`

不足があれば `web/static/_headers` を見直して再デプロイ。

- [ ] **Step 5: Workers Builds(GitHub 連携)を Cloudflare Dashboard で設定**

ダッシュボードで以下を設定(コードコミットなし、ドキュメント手順):

- Workers & Pages → solo-shaho → Settings → Build → Connect to Git
- Repository: `<github-user>/solo-shaho`
- Root directory: `web`
- Build command: `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- Deploy command: `pnpm exec wrangler deploy`
- Production branch: `main`
- Non-production branch builds: enabled

`pnpm install` 前に Node 22 と pnpm が選択されることを確認(必要なら `nvmrc` や `package.json` の `packageManager` を設定)。

- [ ] **Step 6: GitHub に push して自動デプロイを確認**

```bash
cd /home/driller/repo/solo-shaho
git push origin main
```

Cloudflare ダッシュボードで Workers Build が走り、テスト → デプロイが順次成功することを確認。

- [ ] **Step 7: 最終受け入れチェック(spec の Phase 1 完了条件)**

以下を順に確認:

- [ ] Excel snapshot 127 ケース完全一致(ローカル実行)
- [ ] 汎用テスト(全 unit テスト)が CI 上で pass
- [ ] `pnpm typecheck` `pnpm lint` がエラーゼロ
- [ ] 設定/月次/履歴の 3 タブが操作可能
- [ ] CSV エクスポート → クリア → インポートでデータが完全復元
- [ ] CSV Formula Injection の単体テストが pass
- [ ] localStorage 破損時のエラー表示が動作
- [ ] Cloudflare Workers にデプロイ済み
- [ ] `curl -I` で全セキュリティヘッダが返る
- [ ] README に「個人データはブラウザ内」旨を記載

すべてチェックがついたら Phase 1 完了。
