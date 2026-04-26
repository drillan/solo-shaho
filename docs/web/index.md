# Web アプリケーション

マイクロ法人(1 人法人)向けに、社会保険(協会けんぽ + 厚生年金)の月次保険料計算をブラウザで完結させる Web アプリです。社労士や SaaS を介さず、健保・介護・厚年・拠出金・支援金の月次保険料を自前で算出できます。個人データはブラウザ内のみで保持し、サーバには送信しません。Cloudflare Workers Static Assets で永久無料運用しています。

```{note}
**対象は被用者保険のみ** です。個人事業主本人の国民健康保険 + 国民年金は別制度のため計算できません。個人事業主の方は「法人成り後」が利用想定です。
```

## 全体構成

```{mermaid}
flowchart LR
    User[利用者ブラウザ]
    CDN[Cloudflare<br/>Workers Static Assets]
    SK[SvelteKit SPA<br/>prerender + ssr=false]
    LS[(localStorage<br/>solo-shaho-state)]
    CSV[CSV<br/>エクスポート/インポート]

    User -->|HTTPS| CDN
    CDN -->|静的アセット配信| SK
    SK <-->|読み書き| LS
    SK -.->|ダウンロード/アップロード| CSV
```

## 主な特長

- **プライバシー**: 個人データはブラウザ内のみ(localStorage)。外部送信なし
- **コスト**: Cloudflare 無料枠内で永久無料
- **可搬性**: CSV エクスポートで完全バックアップ・別ブラウザ移行が可能
- **正確性**: 協会けんぽ公式の保険料額表と一致することを fixture テストで保証

## このセクションの内容

- [クイックスタート](quickstart.md) — 起動から初回計算まで
- [使い方](usage.md) — タブ別の画面解説
- [CSV 仕様](csv.md) — エクスポート/インポート形式
