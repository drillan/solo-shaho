# 計算リファレンス

社会保険料計算のしくみと根拠をまとめたリファレンスです。Excel 版・Web 版いずれの実装にも共通する仕様を記述します。

## 計算エンジンのモジュール構成(Web 版)

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

## このセクションの内容

- [計算ロジック](logic.md) — 端数処理・残額方式・健保料率合算
- [料率の知識](rates.md) — 5 種類の保険料率と改定タイミング
- [納付月セマンティクス](semantics.md) — 「年/月」ラベルが何を指すか
- [経理処理](accounting.md) — 預り金と仕訳
- [出典](sources.md) — 公的資料・参考文献
