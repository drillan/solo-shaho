# 運用ガイド

`給与計算.xlsx` を保守・更新するための手順集です。

## 環境セットアップ(初回のみ)

```{code-block} bash
# uv で本体依存とドキュメント依存を一括同期
uv sync --group docs
```

これで `.venv` が作成され、openpyxl・sphinx・myst-parser・furo がインストールされます。

## ブックの再生成

`scripts/build_payroll.py` は **冪等な生成スクリプト** で、既存の `給与計算.xlsx` を上書きします(過去データは設定とコードに含まれているため、何度実行しても同じ結果)。

```{code-block} bash
uv run scripts/build_payroll.py
```

```{warning}
**Excel で `給与計算.xlsx` を開いている状態では再生成できません**(ファイルロック)。閉じてから実行してください。
```

(rate-update-procedure)=
## 料率改定時の更新

協会けんぽや厚生労働省から新しい料率が発表されたら、次の手順で反映します。

### データの単一の真実(SoT)

```{important}
料率の **唯一の正(Single Source of Truth)は `scripts/build_payroll.py` の `RATE_HISTORY` 定数** です。`docs/rates.md` の表は、この定数を人間が読みやすく転記したものに過ぎません。

両者は手動で同期する必要があります。**コード側を変更したら必ず docs 側の表も同じ内容で更新してください**。検証スクリプト `scripts/verify_payroll.py` は `RATE_HISTORY` を直接 import するので、そちらは自動的に同期されます。
```

### 手順

1. `scripts/build_payroll.py` を開く
2. `RATE_HISTORY` リストの末尾に 1 行追加

   ```{code-block} python
   :emphasize-lines: 3-4

   RATE_HISTORY = [
       ...
       (date(2027, 4, 1), 0.0985, 0.0162, 0.183, 0.0036, 0.0023,
        "2027年4月分・料率変動なし(例)"),
   ]
   ```

3. 月次計算シートの行範囲を延ばす場合は `END_YEAR_MONTH` も更新

   ```{code-block} python
   END_YEAR_MONTH = (2027, 12)  # 2027 年 12 月まで
   ```

4. 再生成

   ```{code-block} bash
   uv run scripts/build_payroll.py
   ```

5. **検証スクリプトを実行してリグレッションがないことを確認**

   ```{code-block} bash
   uv run scripts/verify_payroll.py
   ```

   既知シナリオ・構造的整合性・介護該当境界の 3 種類のテストがすべて OK で終わることを確認。

6. **`docs/rates.md` の料率履歴表に同じ行を追記**(コード側と人間用ドキュメント側の両方を更新)
7. Excel を開いて、追加した適用開始日以降の月で料率が新しい値になっていることを確認

### 行ラベル(納付月)に注意

新料率の適用開始日は **納付月セマンティクス** で記入してください。例えば「令和 X 年 3 月分から」と公式が言っていれば、月次計算上は **4 月行から適用** されるよう、料率マスタには `date(X, 4, 1)` で登録します。詳しくは [納付月セマンティクス](semantics.md)。

## 検証スクリプト

`scripts/verify_payroll.py` は、Excel 数式とは独立に Python で社会保険料を再計算し、以下を検証します:

```{list-table}
:header-rows: 1

* - テスト
  - 内容
* - 既知シナリオ
  - 2026/4 と 2026/5 の納付額(介護 ON/OFF × 4 ケース)が期待値どおりか
* - 構造的整合性
  - 全 127 ヶ月 × 介護 ON/OFF = 254 ケースで `社員 + 事業主 = ROUNDDOWN(全額)` が成立するか
* - 介護該当境界
  - 40 歳/65 歳到達月の判定が法定どおりか(誕生日の前日が属する月基準)
```

```{code-block} bash
uv run scripts/verify_payroll.py
```

ロジック改修(端数処理の式変更、列構成の変更など)を行ったあとは、必ずこのスクリプトを実行してリグレッションを検出してください。失敗すると終了コード 1 を返すので、CI / pre-commit フックに組み込むことも可能です。

## 生年月日変更時(年齢区分の変更を反映)

設定シートの **B3 セル(生年月日)** を書き換えるだけ。再生成は不要です。

- D 列(介護該当)は数式で自動切替
- 40 歳到達月から介護料率が加算
- 65 歳到達月から介護料率が外れる

## 標準報酬月額・給与額面の改定

社員の昇給などで標準報酬月額が変わった場合:

1. 月次計算の **E 列(標準報酬月額)** を該当月以降の行で書換
2. 同様に **F 列(給与額面)** も必要に応じて書換
3. 設定シートの「現行値」も忘れず更新(備忘録)

```{tip}
随時改定(2 等級以上の昇降給など)で過去のある月から変わる場合、その月の行から末尾までドラッグでコピー上書きすると効率的です。
```

## 通知額との突き合わせ(月次)

毎月、年金事務所から納入告知書が届いたら:

1. 月次計算の **AB 列(通知額)** に告知書の合計額を入力
2. **AC 列(通知額差分)** が `0` であることを確認
3. ズレがあれば原因を調査(料率設定・標準報酬月額・端数処理特約など)

## ドキュメント更新

このドキュメント(`docs/`)の HTML を再生成するには:

```{code-block} bash
uv run --group docs sphinx-build -b html docs docs/_build/html
```

`docs/_build/html/index.html` をブラウザで開くと閲覧できます。

執筆中に変更を即座に反映させたい場合は `sphinx-autobuild` を使うと便利:

```{code-block} bash
uv pip install sphinx-autobuild
uv run --group docs sphinx-autobuild docs docs/_build/html
```

`http://127.0.0.1:8000` でライブプレビューが見られます(`sphinx-autobuild` は本リポジトリの依存に含めていないので、必要時に追加してください)。
