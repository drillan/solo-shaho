# 給与計算 Web アプリ 設計仕様書

- **作成日**: 2026-04-25
- **対象**: `solo-shaho` リポジトリの社会保険料計算 Excel を Web アプリ化
- **ステータス**: ブレインストーミング完了・設計承認待ち
- **配信先**: Cloudflare Workers Static Assets(無料枠)

## 0. 背景と目的

`給与計算_v2.xlsx` で運用している月次社会保険料計算を、ブラウザで動作する Web アプリに移植する。Excel は単独で動作する遺物として凍結し、Web アプリが日常運用の主要ツールとなる。

### スコープ(Phase 1)

- ✅ 健保・介護・厚年・拠出金・支援金 の月次計算(現 Excel と同等)
- ✅ 報酬改定履歴・料率改定履歴の管理
- ✅ 介護該当の生年月日からの自動判定
- ✅ 残額方式による事業主負担算出(1 円ズレ問題対応)
- ✅ 月次/履歴/年次集計ビュー
- ✅ CSV エクスポート/インポート
- ❌ 所得税源泉徴収・年末調整(Phase 2)
- ❌ 源泉徴収票生成(Phase 2)
- ❌ クラウド側でのデータ保存(将来対応)

### 非機能要件

- **プライバシー**: 個人データはブラウザ内のみ(localStorage)。サーバ送信なし
- **コスト**: 永久無料(Cloudflare 無料枠内)
- **可搬性**: CSV エクスポートで完全バックアップ可能
- **正確性**: Excel と同一値を出すことを fixture テストで保証

---

## 1. アーキテクチャ & 技術スタック

### 配信プラットフォーム

**Cloudflare Workers Static Assets** を採用する。Cloudflare 公式ドキュメント([Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/))は新規プロジェクトに対し Workers Static Assets の使用を推奨しており、Pages は新機能の対象外となっている。

| 項目 | 選択 |
|---|---|
| 言語 | TypeScript (strict) |
| フレームワーク | SvelteKit + `@sveltejs/adapter-cloudflare` |
| Prerender | 全ルートで `export const prerender = true`(純静的化) |
| SSR | 無効(`export const ssr = false` — 個人データはクライアント内のみ) |
| ビルド | Vite (SvelteKit 標準) |
| パッケージマネージャ | pnpm |
| CSS | Tailwind CSS |
| テスト | Vitest + `@testing-library/svelte` + Playwright(E2E) |
| 数値演算 | 整数演算(料率を 1/10000 単位の整数として保持) |
| Wrangler | `>= 4.34.0` |

### 設定ファイル

**`web/wrangler.jsonc`**:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "solo-shaho",
  "compatibility_date": "2026-04-25",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".svelte-kit/cloudflare"
  },
  "observability": {
    "enabled": true
  }
}
```

純静的サイトのため `main` エントリは不要。将来 API を生やす場合は `main: ".svelte-kit/cloudflare/_worker.js"` を追加する。

**`web/svelte.config.js`**:

```javascript
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: { adapter: adapter() }
};
```

**`web/src/routes/+layout.ts`**:

```typescript
export const prerender = true;
export const ssr = false;
```

### CI/CD

**Workers Builds**(Cloudflare 内蔵)に集約する。`.github/workflows` は作成しない。

| 項目 | 値 |
|---|---|
| Repository | GitHub `<user>/solo-shaho` |
| Build watch path | `web/**` |
| Root directory | `web` |
| Build command | `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build` |
| Deploy command | `pnpm exec wrangler deploy` |
| Production branch | `main` |
| Non-production branches | 全 PR でプレビュー URL 自動発行 |
| Node.js version | 22 |

ビルド途中のいずれかが失敗するとデプロイされず、PR には Check Run + PR コメントで通知される。

### 無料枠

| サービス | 無料枠 | 本プロジェクト | 結論 |
|---|---|---|---|
| Workers リクエスト(静的アセット) | **無料・無制限** | 個人利用 | 余裕 |
| Workers Builds | 月数百ビルドまで | 月数〜十数回 | 余裕 |
| 静的アセットファイル数 | 20,000 / Worker version | 数百 | 余裕 |
| ファイルサイズ | 25 MiB / file | < 1 MiB | 余裕 |

**永久無料** で運用可能。

### リポジトリ構成

```
solo-shaho/
├── docs/                       # 既存 Sphinx (継続。仕様書として現役)
│   └── superpowers/specs/
│       └── 2026-04-25-payroll-web-app-design.md  ← 本ドキュメント
├── scripts/                    # 既存 (凍結)
├── 給与計算_v2.xlsx              # 既存 (凍結)
├── pyproject.toml              # 既存
├── web/                        # 新規 — SvelteKit + Workers Assets
│   ├── src/
│   │   ├── lib/
│   │   │   ├── payroll/        # 計算エンジン (純粋関数群)
│   │   │   │   ├── types.ts
│   │   │   │   ├── rates.ts
│   │   │   │   ├── remuneration.ts
│   │   │   │   ├── kaigo.ts
│   │   │   │   ├── round.ts
│   │   │   │   └── calculate.ts
│   │   │   ├── stores/                 # Svelte stores + localStorage
│   │   │   ├── csv/                    # CSV import/export
│   │   │   └── data/
│   │   │       └── rates.json          # 料率マスタ (唯一の真実)
│   │   ├── routes/
│   │   │   ├── +layout.ts              # prerender=true, ssr=false
│   │   │   ├── +layout.svelte          # タブナビ
│   │   │   ├── +page.svelte            # 設定タブ
│   │   │   ├── monthly/+page.svelte    # 月次タブ
│   │   │   └── history/+page.svelte    # 履歴タブ
│   │   ├── app.html
│   │   └── app.css
│   ├── tests/
│   │   ├── fixtures/                   # Excel から抽出した期待値 (gitignore)
│   │   └── unit/
│   ├── static/                         # favicon 等
│   ├── wrangler.jsonc
│   ├── svelte.config.js
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── pnpm-lock.yaml
└── .gitignore                          # web/.svelte-kit, web/node_modules を追加
```

### 初期セットアップ

```bash
cd /home/driller/repo/solo-shaho
pnpm create cloudflare@latest web --framework=svelte
# Pages ではないため --platform=pages は付けない
```

---

## 2. データモデル & 永続化

### localStorage に保持する状態(キー: `solo-shaho-state`)

```typescript
interface AppState {
  schemaVersion: 1;
  profile: {
    name: string;
    birthDate: string | null;       // "YYYY-MM-DD" or null
  };
  remunerationHistory: RemunerationEntry[];
  monthlyNotes: Record<string, MonthlyNote>;  // "YYYY-MM" → MonthlyNote
}

interface RemunerationEntry {
  effectiveFrom: string;            // "YYYY-MM-DD"
  stdRemuneration: number;          // 標準報酬月額(整数円)
  grossSalary: number;              // 給与額面(整数円)
  note?: string;
}

interface MonthlyNote {
  month: string;                    // "YYYY-MM" (= 納付月)
  notifiedAmount?: number;          // 協会けんぽ通知額(検算用)
  memo?: string;
  // 将来: incomeTax?, withholdingBasis?, dependents? を追加可能
}
```

### 永続化戦略

| データ | 場所 | 同期タイミング |
|---|---|---|
| AppState 全体 | localStorage | 入力ごと(debounce 300ms) |
| 料率マスタ | バンドル内 `rates.json` | コード変更時のみ |
| 計算結果(派生) | メモリ内(Svelte derived store) | 入力変更時に自動再計算 |

### マイグレーション

`schemaVersion` 不一致時はモーダルで警告、CSV エクスポートを促してから初期化。Phase 1 では破壊的変更なしで運用。Phase 2(源泉徴収票)で v2 へ。

### プライバシー

- すべてブラウザ内完結。送信先は CDN(静的アセット取得のみ)
- localStorage は同一オリジン専用、Cloudflare 側からは読めない
- README に「個人データはあなたのブラウザにのみ保存されます」と明記

---

## 3. UI 構造

### タブ構成(`+layout.svelte` で共通ナビ)

```
┌─────────────────────────────────────────┐
│ solo-shaho [設定] [月次] [履歴]  ⚙ I/O │
├─────────────────────────────────────────┤
│ (現在のタブのコンテンツ)                  │
└─────────────────────────────────────────┘
```

右上 ⚙I/O メニュー: `CSV エクスポート` / `CSV インポート` / `全データクリア` / `料率マスタを表示`

### タブ 1: 設定 (`/`)

| セクション | 内容 |
|---|---|
| プロフィール | 氏名(任意)、生年月日(必須・介護判定用) |
| 報酬改定履歴 | 編集可能テーブル: 適用開始日 / 標準報酬月額 / 給与額面 / 備考。最新行を太字で「現行値」表示。「+行を追加」ボタン |
| 介護該当の現状 | 生年月日から「現在 介護該当: ✅ / ❌」と「該当期間: 2030-04 〜 2055-03」を表示 |

### タブ 2: 月次 (`/monthly`)

単月ビュー。年月ピッカー(デフォルト = 当月の納付月)で月を選択 → その月の計算結果を Excel の月次行 1 行分 + 内訳パネルで表示。

```
[2026年 4月 ▼ ] (← 前月 | 次月 →)

■ 入力 (この月の参照値)
  標準報酬月額:  88,000  (履歴: 2024-04 適用)
  給与額面:      83,000
  介護該当:      ❌ (40歳未満)
  健保料率:      9.85%
  厚年料率:      18.30%

■ 計算結果
  健保 全額:        8,668     社員: 4,334   事業主: 4,334
  厚年 全額:       16,104     社員: 8,052   事業主: 8,052
  拠出金:                                    事業主:   316
  支援金 全額:        ─        社員:   ─    事業主:   ─
  ─────────────────────────────────────────
  社員天引き合計: 12,386
  事業主負担合計: 12,702
  納付額:        25,088
  差引支給額:    70,614

■ 通知額(任意・検算用)
  通知額: [____] 差分: ─

■ メモ
  [自由記述]
```

### タブ 3: 履歴 (`/history`)

スプレッドシート風テーブル。Excel の月次計算シートを画面に再現。

- 行: 月(設定で指定した期間。デフォルトは「最古の改定 〜 現在月+12ヶ月」)
- 列: 年/月/標準報酬月額/介護該当/健保適用料率/健保社員/厚年社員/支援金社員/社員合計/事業主合計/納付額/差引支給額/通知額/差分
- 入力可能セル: 通知額・メモのみ(他は派生)
- 暦年で区切り、各暦年末に **年次集計行**(社会保険料控除額の年合計)を挿入 ← 源泉徴収票への布石

### モバイル対応

- 設定タブ: 縦並び
- 月次タブ: 縦スクロール
- 履歴タブ: 横スクロール + sticky 列(年/月)、または「主要列のみモード」トグル

### アクセシビリティ・体験

- ダークモード(`prefers-color-scheme`)
- キーボード操作(タブ移動 + Enter で行追加)
- 数値は `Intl.NumberFormat('ja-JP')` でカンマ区切り
- 印刷スタイル(履歴タブを A4 横で印刷可能 ← 税務調査用)

---

## 4. 計算エンジン

### モジュール構成(純粋関数のみ)

```typescript
// types.ts
export interface RateEntry {
  effectiveFrom: string;
  kenpoBase: number;        // 1/10000 単位整数 (例: 985 = 9.85%)
  kaigo: number;
  kosei: number;
  kosodate: number;
  shien: number;
  note: string;
}

export interface MonthInput {
  year: number;
  month: number;
  stdRemuneration: number;
  grossSalary: number;
  birthDate: string | null;
  rates: RateEntry;
}

export interface MonthResult {
  age: number | null;
  isKaigoApplicable: boolean;
  appliedKenpoRate: number;
  // 全額(整数円)
  kenpoTotal: number;
  koseiTotal: number;
  kosodateTotal: number;    // 事業主のみ・全額切捨て
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
```

### 主要関数 API

```typescript
// rates.ts
findApplicableRate(yearMonth: string, history: RateEntry[]): RateEntry
// XLOOKUP 相当: 該当なしは Error throw(フォールバック禁止)

// remuneration.ts
findApplicableRemuneration(yearMonth: string, history: RemunerationEntry[]): RemunerationEntry

// kaigo.ts
isKaigoApplicable(birthDate: string | null, year: number, month: number): boolean
// 40歳誕生日の前日 ≦ 当月末日 < 65歳誕生日の前日
calculateAge(birthDate: string, year: number, month: number): number

// round.ts
splitHalfEmployee(totalSen: number): number
// = 50銭以下切捨て・50銭超切上げ
// totalSen は銭単位の整数

splitHalfEmployer(totalSen: number, employee: number): number
// = ROUNDDOWN(total, 0) - employee  (残額方式)

// calculate.ts
calculateMonth(input: MonthInput): MonthResult
calculateRange(start: string, end: string, state: AppState, rates: RateEntry[]): MonthResult[]
aggregateByCalendarYear(results: MonthResult[]): YearSummary[]
```

### 整数演算

料率を「1/10000 単位の整数」として保持し、`stdRemuneration * rateX10000` で銭単位の整数を得る。`Math.floor` 等の整数操作で Excel の `ROUNDDOWN`/`MOD` を bit-perfect に再現する。

`rates.json`:

```json
{
  "schemaVersion": 1,
  "history": [
    {
      "effectiveFrom": "2026-04-01",
      "kenpoBase": 985,
      "kaigo": 162,
      "kosei": 1830,
      "kosodate": 36,
      "shien": 0,
      "note": "2026年4月納付分(3月分)・健保改定"
    }
  ]
}
```

### エラー処理(フォールバック禁止)

- 料率履歴より前の月を計算 → `RateNotFoundError` を throw
- 報酬履歴が空 → 計算不可、UI で誘導
- 生年月日が無効 → 入力時バリデーションで拒否
- localStorage 破損 → モーダル警告、初期化を促す(自動回復しない)

---

## 5. CSV スキーマ

### エクスポート形式(BOM 付き UTF-8)

```csv
# solo-shaho v0.2.0 export 2026-04-25T14:30:00+09:00
# schemaVersion=1

[profile]
name,birthDate
山田太郎,1985-06-15

[remuneration_history]
effectiveFrom,stdRemuneration,grossSalary,note
2024-04-01,88000,83000,定時決定
2025-04-01,88000,85000,定時決定

[monthly_notes]
month,notifiedAmount,memo
2024-05,16834,
2026-04,25088,健保改定後初月

# (オプション) 計算結果スナップショット — import 時は無視
[calculated_snapshot]
year,month,stdRemuneration,kenpoEmployee,koseiEmployee,shienEmployee,employeeDeductionTotal,employerBurdenTotal,payableTotal,netSalary,notifiedAmount,diff
2024,05,88000,4356,8052,0,12408,12724,25132,70592,16834,8298
```

### 設計の根拠

| 判断 | 理由 |
|---|---|
| 1 ファイル + セクション区切り | バックアップ/復元が 1 ファイルで完結 |
| `# コメント行` 許容 | バージョン情報・エクスポート日時を保持 |
| `[section_name]` 形式 | 人間が読みやすい、独自パーサで簡単に分離可能 |
| `calculated_snapshot` は import 時無視 | 計算結果は派生値 → 再計算が正 |
| 日付は ISO 8601 | 国際標準、ソート可能 |
| 金額は raw integer | パース簡素化 |

### 将来拡張(Phase 2)

```csv
[monthly_notes]
month,notifiedAmount,memo,incomeTax,withholdingBasis,dependents
```

未知の列はインポート時に警告ログ + 無視で続行。計算結果に影響する列なら Error。

### インポート時バリデーション

| チェック | 失敗時の動作 |
|---|---|
| schemaVersion が現行と一致 | 不一致なら警告モーダル、続行可否を確認 |
| profile セクション必須 | エラー、中止 |
| remuneration_history が 1 行以上 | エラー |
| 日付フォーマット(YYYY-MM-DD) | エラー、行番号表示 |
| 数値が非負整数 | エラー、行番号表示 |
| 既存データとのマージ vs 上書き | インポート前にモーダルで選択 |

---

## 6. 検証戦略

### 三層テスト構造

```
┌─────────────────────────────────────────────┐
│ E2E (Playwright)  — 数本                    │
│  例: 設定→月次→履歴→CSV出力→クリア→CSV復元  │
├─────────────────────────────────────────────┤
│ Component (Vitest + @testing-library/svelte)│
│  例: 履歴タブの行レンダリング、CSV パーサ     │
├─────────────────────────────────────────────┤
│ Unit (Vitest)  — 厚い層                     │
│  payroll/* の純粋関数を fixture で総当たり   │
└─────────────────────────────────────────────┘
```

### Excel からの fixture 抽出(個人データ・gitignore)

`web/tests/fixtures/extract_from_excel.py`:

```python
# uv run python web/tests/fixtures/extract_from_excel.py
from openpyxl import load_workbook
wb = load_workbook("給与計算_v2.xlsx", data_only=True)
# 月次計算シートの全行を走査、入力値と期待値を JSON 配列で保存
```

出力: `web/tests/fixtures/excel-snapshot.json`(gitignore)

### 汎用テストケース(CI 実行可能・個人データ非依存)

| カテゴリ | ケース数 | 内容 |
|---|---|---|
| 1円ズレ問題(残額方式) | 5 | 標準報酬月額 88,000 / 98,000 等で 社員+事業主 = 全額切捨て |
| 介護該当境界 | 8 | 40歳/65歳誕生日前後・月末誕生日・閏年生まれ |
| 料率改定境界 | 17 | 各 effectiveFrom 月で正しい料率が引かれる |
| 支援金開始(2026/05) | 2 | 2026/04 はゼロ、2026/05 から労使折半 |
| 拠出金切捨て | 3 | `ROUNDDOWN(E*J, 0)` の挙動 |
| 報酬改定 | 4 | 同年内に標準報酬月額が変わる場合の月次切替 |
| エラー系 | 6 | 料率履歴範囲外、空履歴、無効生年月日 |

`web/tests/unit/payroll.test.ts` にハードコード、Workers Builds の CI で常時実行。

### Workers Builds パイプライン

ビルドコマンド:
```sh
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

`pnpm test` には Excel fixture テストは含めず、汎用テストケースのみ実行。Excel fixture テストは個人マシンで `pnpm test:fixtures` として別途実行。

### TDD ワークフロー

CLAUDE.md の TDD ポリシーに従う:

1. テスト先行作成
2. Red 確認
3. 実装(Green)
4. リファクタリング

Excel fixture が手元にある状態で実装を進めるため、「Excel と同じ結果を出す」が Green の判定基準になる。

### 受け入れ基準(Phase 1 完了条件)

- [ ] Excel snapshot 127 ケース全てで TS 計算結果が完全一致
- [ ] 汎用テストケース(45 ケース)が Workers Builds 上で全て通過
- [ ] `pnpm typecheck` `pnpm lint` がエラーゼロ
- [ ] 設定/月次/履歴の 3 タブが操作可能
- [ ] CSV エクスポート → クリア → インポートでデータが完全復元
- [ ] localStorage 破損時のエラー表示が正しく動作
- [ ] Cloudflare Workers にデプロイ済み、URL でアクセス可能
- [ ] README に「個人データはブラウザ内に閉じる」旨を記載

---

## 7. 実装ロードマップ(概要)

詳細は別途 `superpowers:writing-plans` で実装計画を作成する。大枠の順序:

1. `web/` ディレクトリ初期化(C3 + adapter-cloudflare)
2. `rates.json` 整備 + 料率参照ロジック(`findApplicableRate`)
3. 介護判定ロジック(`isKaigoApplicable`)
4. 端数処理ロジック(`splitHalfEmployee` / `splitHalfEmployer`)
5. 月次計算 orchestrator(`calculateMonth`)
6. 設定タブ UI(プロフィール + 報酬改定履歴)
7. 月次タブ UI(単月詳細)
8. 履歴タブ UI(スプレッドシート風)
9. CSV エクスポート/インポート
10. localStorage 永続化 + マイグレーション
11. Excel fixture 抽出 + スナップショット回帰テスト
12. Workers Builds 設定 + 初回デプロイ
13. README 更新
