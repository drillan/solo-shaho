# CSV 仕様

Web アプリは UTF-8 (BOM 付き) の独自 CSV 形式でエクスポート/インポートします。1 ファイルでアプリ全状態のバックアップ・復元が完結します。

`localStorage` は揮発するため、CSV をアプリ外部に保管しないと過去の入力は失われます。揮発の契機と推奨運用は [データの保存とバックアップ](storage.md) を参照してください。

## 主な性質

- セクション区切り(`[profile]` / `[remuneration_history]` / `[monthly_notes]`)で人間にも読みやすい形式
- `schemaVersion` を先頭コメントに保持し、将来の互換性境界を明示
- 自由記述フィールドは [CSV Formula Injection (CWE-1236)](https://cwe.mitre.org/data/definitions/1236.html) 対策のため、危険文字(`=` `+` `-` `@` 等)で始まる値を自動エスケープ
- 計算結果スナップショットはインポート時に無視(派生値のため再計算が正)

## 詳細仕様

完全なフィールド定義・往復ルール・バリデーション仕様は開発資料(`docs/superpowers/specs/2026-04-25-payroll-web-app-design.md` の第 5 章)を参照してください。
