# アーキテクチャ

Web アプリの計算エンジンは、UI 状態(`AppState`)に依存しない純粋関数群として `src/lib/payroll/` に配置されます。各モジュールは単一責務を持ち、上位の `calculate.ts` がそれらを合成して月次計算を実行します。

## モジュール依存

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

## モジュールの責務

| モジュール | 責務 |
|---|---|
| `payroll/types.ts` | ドメイン型(`AppState`、`RemunerationEntry`、`RateEntry` 等)と既存値検証関数 |
| `payroll/lookup.ts` | 効力発生日順での共通検索(料率・報酬どちらの履歴検索でも利用) |
| `payroll/rates.ts` | `lookup.ts` のラッパー(料率専用エラー型を持つ) |
| `payroll/remuneration.ts` | `lookup.ts` のラッパー(報酬専用エラー型を持つ) |
| `payroll/kaigo.ts` | 介護該当の月単位判定(40〜64 歳の境界処理) |
| `payroll/round.ts` | 50 銭超切上げ + 残額方式の端数処理 |
| `payroll/calculate.ts` | 月次保険料の合成計算(各保険料の全額・社員側・事業主側) |
| `payroll/aggregate.ts` | 年次集計・履歴ビュー用の派生計算 |

## 設計原則

- **AppState 非依存**: 計算モジュールは UI 状態に触れず、必要なドメインデータを引数で受け取る。UI ストア層が `AppState` から抽出して呼び出す
- **整数演算**: 料率は 1/100,000 単位の整数として保持。浮動小数点誤差を排除し、Excel 版と bit-perfect 一致させる
- **明示的エラー伝播**: 履歴に該当エントリがない等の異常はエラー型を返し、`silent failure`(既定値での処理続行)はしない

計算の数学的根拠は [計算リファレンス](../reference/index.md) を参照してください。
