# データ保存とバックアップに関するドキュメント整備 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web アプリの `localStorage` データ保存仕様と揮発リスク・推奨バックアップ運用を集約した専用ページ `docs/web/storage.md` を新設し、関連ドキュメント(`docs/index.md`、`docs/web/{index,quickstart,usage,csv}.md`、`README.md`)から導線を張る。

**Architecture:** 単一の新規ページ + 既存 6 ファイルへの最小限の編集。Sphinx (MyST) のビルドで warning 0 を維持する。仕様変更や機能追加は伴わず、純粋なドキュメント整備。

**Tech Stack:** Sphinx + MyST Markdown、`make -C docs html` でビルド、shibuya テーマ、`{admonition}` などの MyST directives。

**仕様書:** [`docs/superpowers/specs/2026-04-26-storage-docs-design.md`](../specs/2026-04-26-storage-docs-design.md)(commit `b233875`)

---

## ファイル構成

| 種別 | パス | 責務 |
|---|---|---|
| 新規 | `docs/web/storage.md` | データ保存仕様・揮発契機・バックアップ運用ガイド |
| 編集 | `docs/index.md` | toctree に `web/storage` を追加 |
| 編集 | `docs/web/index.md` | 「主な特長」と「このセクションの内容」へ反映 |
| 編集 | `docs/web/quickstart.md` | バックアップ節の動機強化 |
| 編集 | `docs/web/usage.md` | I/O メニュー節からのリンク追加 |
| 編集 | `docs/web/csv.md` | 冒頭リードに揮発リスクを 1 文追加 |
| 編集 | `README.md` | I/O メニュー説明強化 |

各タスクは 1 ファイル変更 = 1 コミットとし、コミットメッセージは Conventional Commits 形式 (`docs(scope): ...`) を使う。

---

## Task 1: `docs/web/storage.md` を新規作成

**Files:**
- Create: `docs/web/storage.md`

- [ ] **Step 1: ファイル新規作成**

`docs/web/storage.md` を以下の内容で作成する。

````markdown
# データの保存とバックアップ

Web アプリのデータがブラウザのどこに保存され、どのような契機で消えるか、どう守るかをまとめます。揮発リスクと推奨運用を理解した上で利用してください。

## 保存される情報

入力したデータはブラウザの `localStorage`(ブラウザ内のデータ保管領域)に、キー `solo-shaho-state` で保存されます。

| データ種別 | 保存される | 備考 |
|---|---|---|
| プロフィール(氏名・生年月日) | ✅ | 設定タブで入力した値 |
| 報酬改定履歴(適用開始日・標準報酬月額・給与額面) | ✅ | 設定タブで管理する全行 |
| 月次メモ(通知額など) | ✅ | 月次タブで入力した値 |
| 計算結果(社員/事業主負担・納付総額・差引支給額) | ❌ | 派生値のため、毎回再計算で求める |

保存形式はアプリ全状態をシリアライズした JSON 1 件です。`localStorage` は配信ドメイン単位で分離されるため、別ドメイン版や別ホスティング先からは参照できません。

## データが消える契機

```{admonition} 重要
:class: warning
`localStorage` に保存されたデータは、ブラウザ操作・端末変更・自動削除など複数の要因で予告なく消えることがあります。**CSV エクスポートしたファイルをアプリの外部(クラウドストレージや別フォルダ等)に保管する習慣** を持たないと、過去の入力が完全に失われます。
```

| 契機 | 影響 | CSV による復元 |
|---|---|---|
| ブラウザ設定でサイトデータを削除 | 全消失 | ✅ 直近のエクスポート時点まで復元可 |
| シークレット/プライベートモードで使用 | セッション終了で消失 | ⚠ 利用前の import が必須 |
| Safari の ITP による自動削除(7 日間アクセスがない場合) | 全消失 | ✅ 復元可だが運用に注意 |
| デバイス変更・OS 再インストール | 全消失 | ✅ CSV を別保管していれば復元可 |
| 異なるブラウザ間(Chrome ↔ Firefox 等) | 同期されない | ✅ CSV で移行可 |
| ブラウザのキャッシュ自動削除設定が有効 | タイミングにより消失 | ✅ 復元可だが頻度に注意 |

## CSV エクスポートで防ぐ

エクスポート機能は **ボタンを押した瞬間にダウンロードするだけ** で、ファイルが残るかどうかは利用者の運用次第です。次の方針を推奨します。

- 月次計算を行うたびに毎回エクスポートする(設定タブを変更したときも忘れずに)
- エクスポートファイルをクラウドストレージ(Google Drive・iCloud・Dropbox 等)・社内ファイルサーバ・Git リポジトリなど、**アプリの外部** に保管する
- ファイル名にタイムスタンプを含めて複数世代を保管する(直近 1 件だけだと、上書き保存ミスで全滅します)

## シークレット/プライベートモード使用時の注意

シークレット/プライベートモードでは、セッション終了時にブラウザが `localStorage` を破棄します。「他人のデバイスで一時的に使う」「機微データを端末に残したくない」といった用途で利用する場合、次の運用が必要です。

- 利用開始時に CSV インポートで前回までの状態を読み込む
- 利用終了時に最新 CSV をエクスポートして自分の保管先へ持ち帰る

## 復元手順

1. 復元先のブラウザでアプリ配信 URL を開く
2. 右上の I/O メニューから「CSV インポート」を選択
3. 保管しておいた CSV ファイルを指定
4. 設定タブ・履歴タブで値が復元されていることを確認
5. 月次タブで対象年月を選択(計算結果は派生値のため自動で再計算される)

## 関連

- [CSV 仕様](csv.md) — エクスポート/インポート形式の詳細
- [使い方 — I/O メニュー](usage.md) — メニューからの操作手順
````

- [ ] **Step 2: Sphinx ビルドで syntax を検証**

Run: `make -C docs html 2>&1 | tee /tmp/sphinx-task1.log`

期待値: `build succeeded` で完了し、`/tmp/sphinx-task1.log` に `WARNING` が含まれない(`grep -i warning /tmp/sphinx-task1.log` の終了コードが 1)。

注意: この時点では `docs/index.md` の toctree に `web/storage` を追加していないため、Sphinx が **「document isn't included in any toctree」** という warning を出すのは想定内。Task 2 で解消する。それ以外の warning(MyST 構文エラー、admonition の書式不正など)が出たら修正してから次へ進む。

- [ ] **Step 3: 想定 warning と未想定 warning を切り分け**

Run:
```
grep -i warning /tmp/sphinx-task1.log | grep -v "isn't included in any toctree"
```

期待値: 出力なし(終了コード 1)。何か出た場合は `storage.md` の MyST 構文を見直す。

- [ ] **Step 4: コミット**

Run:
```
git add docs/web/storage.md
git commit -m "docs(web): add storage and backup documentation page

localStorage の保存仕様・揮発契機・推奨バックアップ運用を集約した
新規ページを追加。次タスクで toctree に組み込む。"
```

---

## Task 2: `docs/index.md` の toctree に `web/storage` を追加

**Files:**
- Modify: `docs/index.md:13-23`

- [ ] **Step 1: 現状を確認**

Run: `sed -n '13,23p' docs/index.md`

期待出力:
```
```{toctree}
:maxdepth: 2
:caption: Web アプリケーション

web/index
web/quickstart
web/usage
web/csv
web/architecture
web/deploy
```
```

- [ ] **Step 2: Edit ツールで toctree を更新**

`docs/index.md` 内の以下のブロックを置換する。

old_string:
```
web/index
web/quickstart
web/usage
web/csv
web/architecture
web/deploy
```

new_string:
```
web/index
web/quickstart
web/usage
web/storage
web/csv
web/architecture
web/deploy
```

挿入位置の根拠: 利用者の認知順序「使い方を覚える(usage) → データの所在を知る(storage) → CSV 詳細(csv)」に揃える。

- [ ] **Step 3: Sphinx ビルドで toctree 解決を検証**

Run: `make -C docs html 2>&1 | tee /tmp/sphinx-task2.log`

期待値: `build succeeded` で完了し、warning が 0 件。

Run: `grep -i warning /tmp/sphinx-task2.log`
期待: 出力なし(終了コード 1)。

特に Task 1 で出ていた「`web/storage` isn't included in any toctree」warning が解消されていることを確認する。

- [ ] **Step 4: コミット**

Run:
```
git add docs/index.md
git commit -m "docs: include web/storage in main toctree"
```

---

## Task 3: `docs/web/index.md` の「主な特長」と「このセクションの内容」を更新

**Files:**
- Modify: `docs/web/index.md:25-38`

- [ ] **Step 1: 現状を確認**

Run: `sed -n '25,38p' docs/web/index.md`

- [ ] **Step 2: Edit ツールで「主な特長」の「可搬性」項目を置換**

old_string:
```
- **可搬性**: CSV エクスポートで完全バックアップ・別ブラウザ移行が可能
```

new_string:
```
- **データ保管とバックアップ運用**: 個人データはブラウザ内のみ(`localStorage`)に保存。揮発リスクがあるため、CSV エクスポートでアプリ外部に保管する運用を前提とする(詳細: [データの保存とバックアップ](storage.md))
```

注意: 元の「プライバシー」項目に「個人データはブラウザ内のみ(localStorage)。外部送信なし」が既にあるため、新項目では「データ保管とバックアップ運用」という別観点に焦点を絞り、揮発リスクと運用前提を強調する。

- [ ] **Step 3: Edit ツールで「このセクションの内容」リストに storage を追加**

old_string:
```
- [使い方](usage.md) — タブ別の画面解説
- [CSV 仕様](csv.md) — エクスポート/インポート形式
```

new_string:
```
- [使い方](usage.md) — タブ別の画面解説
- [データの保存とバックアップ](storage.md) — `localStorage` の揮発リスクと推奨バックアップ運用
- [CSV 仕様](csv.md) — エクスポート/インポート形式
```

- [ ] **Step 4: Sphinx ビルドで検証**

Run: `make -C docs html 2>&1 | grep -iE "warning|error"`

期待: 出力なし(終了コード 1)。

- [ ] **Step 5: コミット**

Run:
```
git add docs/web/index.md
git commit -m "docs(web): surface storage volatility on web overview page"
```

---

## Task 4: `docs/web/quickstart.md` の「バックアップ」節を強化

**Files:**
- Modify: `docs/web/quickstart.md:17-19`

- [ ] **Step 1: 現状を確認**

Run: `sed -n '17,19p' docs/web/quickstart.md`

期待出力:
```
## バックアップ

I/O メニューから CSV エクスポートでバックアップを取得してください。詳細は [CSV 仕様](csv.md) を参照。
```

- [ ] **Step 2: Edit ツールで本文を置換**

old_string:
```
## バックアップ

I/O メニューから CSV エクスポートでバックアップを取得してください。詳細は [CSV 仕様](csv.md) を参照。
```

new_string:
```
## バックアップ

アプリのデータは **ブラウザの `localStorage`** に保存され、ブラウザ設定変更・端末変更・自動削除などで消えることがあります。**エクスポートした CSV を別途保管しないと、過去の入力は復元できません。**

I/O メニューから CSV エクスポートでバックアップを取得し、クラウドストレージ等のアプリ外部に保管してください。詳細な揮発契機と運用は [データの保存とバックアップ](storage.md)、ファイル仕様は [CSV 仕様](csv.md) を参照。
```

- [ ] **Step 3: Sphinx ビルドで検証**

Run: `make -C docs html 2>&1 | grep -iE "warning|error"`

期待: 出力なし。

- [ ] **Step 4: コミット**

Run:
```
git add docs/web/quickstart.md
git commit -m "docs(web): explain volatility motive in quickstart backup section"
```

---

## Task 5: `docs/web/usage.md` の「I/O メニュー」節にリンクを追加

**Files:**
- Modify: `docs/web/usage.md:15-17`

- [ ] **Step 1: 現状を確認**

Run: `sed -n '15,17p' docs/web/usage.md`

期待出力:
```
## I/O メニュー

CSV エクスポート、CSV インポート、全データクリアの 3 操作を提供します。詳細は [CSV 仕様](csv.md) を参照。
```

- [ ] **Step 2: Edit ツールで本文を置換**

old_string:
```
## I/O メニュー

CSV エクスポート、CSV インポート、全データクリアの 3 操作を提供します。詳細は [CSV 仕様](csv.md) を参照。
```

new_string:
```
## I/O メニュー

CSV エクスポート、CSV インポート、全データクリアの 3 操作を提供します。詳細は [CSV 仕様](csv.md) を参照。`localStorage` の揮発リスクと推奨バックアップ運用は [データの保存とバックアップ](storage.md) を参照。
```

- [ ] **Step 3: Sphinx ビルドで検証**

Run: `make -C docs html 2>&1 | grep -iE "warning|error"`

期待: 出力なし。

- [ ] **Step 4: コミット**

Run:
```
git add docs/web/usage.md
git commit -m "docs(web): link storage page from I/O menu section"
```

---

## Task 6: `docs/web/csv.md` の冒頭リードに揮発リスクを追加

**Files:**
- Modify: `docs/web/csv.md:1-3`

- [ ] **Step 1: 現状を確認**

Run: `sed -n '1,3p' docs/web/csv.md`

期待出力:
```
# CSV 仕様

Web アプリは UTF-8 (BOM 付き) の独自 CSV 形式でエクスポート/インポートします。1 ファイルでアプリ全状態のバックアップ・復元が完結します。
```

- [ ] **Step 2: Edit ツールで冒頭を置換**

old_string:
```
# CSV 仕様

Web アプリは UTF-8 (BOM 付き) の独自 CSV 形式でエクスポート/インポートします。1 ファイルでアプリ全状態のバックアップ・復元が完結します。
```

new_string:
```
# CSV 仕様

Web アプリは UTF-8 (BOM 付き) の独自 CSV 形式でエクスポート/インポートします。1 ファイルでアプリ全状態のバックアップ・復元が完結します。

`localStorage` は揮発するため、CSV をアプリ外部に保管しないと過去の入力は失われます。揮発の契機と推奨運用は [データの保存とバックアップ](storage.md) を参照してください。
```

- [ ] **Step 3: Sphinx ビルドで検証**

Run: `make -C docs html 2>&1 | grep -iE "warning|error"`

期待: 出力なし。

- [ ] **Step 4: コミット**

Run:
```
git add docs/web/csv.md
git commit -m "docs(web): note volatility risk at top of CSV spec page"
```

---

## Task 7: `README.md` の I/O メニュー説明を強化

**Files:**
- Modify: `README.md:57`

- [ ] **Step 1: 現状を確認**

Run: `sed -n '54,58p' README.md`

期待出力(該当行):
```
4. **⚙ I/O メニュー(右上)** — CSV エクスポート/インポート/全データクリア。バックアップ用に定期的にエクスポートを推奨
```

- [ ] **Step 2: Edit ツールで該当行を置換**

old_string:
```
4. **⚙ I/O メニュー(右上)** — CSV エクスポート/インポート/全データクリア。バックアップ用に定期的にエクスポートを推奨
```

new_string:
```
4. **⚙ I/O メニュー(右上)** — CSV エクスポート/インポート/全データクリア。**`localStorage` は揮発するため、エクスポートした CSV を外部保管しないとデータが失われます**。月次計算ごとのエクスポートを推奨(詳細は [データの保存とバックアップ](docs/web/storage.md))
```

- [ ] **Step 3: リンクパスの確認**

README.md はリポジトリルートにあるため、新ページへの相対リンクは `docs/web/storage.md` で正しい。GitHub 上で README を表示したときにリンクが解決することを確認するため、ローカルでパスが存在することをチェック:

Run: `test -f docs/web/storage.md && echo "OK" || echo "MISSING"`

期待: `OK`。

- [ ] **Step 4: コミット**

Run:
```
git add README.md
git commit -m "docs(readme): warn about localStorage volatility in I/O menu"
```

---

## Task 8: 最終ビルド検証と完了確認

**Files:** なし(検証のみ)

- [ ] **Step 1: Sphinx を完全な状態でリビルド**

Run:
```
make -C docs clean
make -C docs html 2>&1 | tee /tmp/sphinx-final.log
```

期待: `build succeeded` で完了。

- [ ] **Step 2: warning / error が 0 件であることを確認**

Run: `grep -iE "warning|error" /tmp/sphinx-final.log`

期待: 出力なし(終了コード 1)。

- [ ] **Step 3: 生成された HTML に新ページが含まれていることを確認**

Run: `test -f docs/_build/html/web/storage.html && echo "OK" || echo "MISSING"`

期待: `OK`。

- [ ] **Step 4: 主要な内部リンクが解決していることを HTML レベルで確認**

Run:
```
grep -c 'href="storage.html"' docs/_build/html/web/index.html docs/_build/html/web/quickstart.html docs/_build/html/web/usage.html docs/_build/html/web/csv.html
```

期待: 各ファイルに 1 件以上の `storage.html` への参照が含まれる(数字 0 のファイルがないこと)。

- [ ] **Step 5: ナビゲーション最短経路の確認**

Run:
```
grep -E 'href="(web/)?storage' docs/_build/html/index.html
```

期待: 1 件以上ヒット(`docs/index.md` のトップから `web/storage` へのリンクが存在)。

- [ ] **Step 6: 全コミットの確認**

Run: `git log --oneline -8`

期待: Task 1〜7 のコミット 7 件が新規に並んでいる。

- [ ] **Step 7: 最終確認(ユーザーレビュー用)**

ローカルでブラウザ閲覧する場合:

Run: `make -C docs serve`(プロジェクトの慣習)

`http://localhost:<port>/web/storage.html` を開いて以下を目視確認:
1. `{warning}` admonition が黄色の警告ボックスとして描画されている
2. 揮発契機の表が 6 行表示されている
3. 「関連」のリンク 2 件(csv.md / usage.md)がクリック可能
4. `docs/index.md` のトップから 1 クリックで storage ページに到達できる
