# ADR-023: ADR-018 の「結果」欄の訂正 — 結合方向の記述が事実と逆

- **ステータス**: 承認
- **カテゴリ**: アーキテクチャ (既存 ADR の訂正提案)
- **日付**: 2026-08-19
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: MA ADR-018 (モジュールレジストリの merge 戦略)

## コンテキスト

MA ADR-018 は選択肢 C (inline gantt を廃止し `src/modules/gantt.js` へ完全移行) を
却下した理由として、次のように書いている:

> C) inline gantt を廃止し完全に `src/modules/gantt.js` に移行
> - デメリット: 大規模リファクタ。inline gantt は historic で app.js の内部関数
>   (calibrateScale 等) と密結合、動かすには parseGantt 以外にも多数移動が必要

そして「C (完全移行) は Tier3 完了後のリファクタ候補として残す」と結んでいる。

**この結合方向の記述は事実と逆である。**

実測 (`src/app.js:4-22`):

```javascript
var calibrateScale = window.MA.modules.gantt.calibrateScale;
var pxToDate       = window.MA.modules.gantt.pxToDate;
var dateToPx       = window.MA.modules.gantt.dateToPx;
// … 計 24 個
```

`calibrateScale` を含む 24 個の関数は **`src/modules/gantt.js` から app.js が
import している側**であり、app.js の内部関数ではない。parse / update ロジックは
既に外部モジュールにあり、inline に残っているのは実質 UI レイヤーのみ。

さらに移行スコープの再測定で、次が判明した:

| メンバ | 箇所 | 実態 |
|---|---|---|
| `updateText` | `app.js:741` | **呼び出し元ゼロの死にコード** |
| `exportMmd` | `app.js:748` | **呼び出し元ゼロの死にコード** |
| `type` / `detect` / `parse` / `template` | — | 外部 `gantt.js` に既存 |
| `buildOverlay` | `app.js:99` | 移行対象 |
| `renderProps` | `app.js:191` | 移行対象 |

(`grep -rn "exportMmd\|\.updateText(" src/ mermaid-assist.html tests/` が定義行以外
0 件であることを確認済み)

ドラッグ処理 (`app.js:1240-1420`)・`getCalibration`・`dragState` は inline
`modules.gantt` オブジェクトのメンバではないため、ADR-018 C の対象外である。

**したがって移行の技術的障壁は、ADR 起票時の想定より大幅に低い。実質の移行対象は
`renderProps` と `buildOverlay` の 2 メンバのみ。**

## 併せて訂正すべき点: 移行の原子性

ADR-018 の merge 実装は**プロパティ単位**である (`app.js:81-85`):

```javascript
for (var _prop in _mod) {
  if (Object.prototype.hasOwnProperty.call(_mod, _prop) && !(_prop in modules[_key])) {
    modules[_key][_prop] = _mod[_prop];
  }
}
```

したがって shadowing の不変条件は**モジュール単位ではなくメンバ単位**である。
「inline から該当メンバを削除」と「外部に同メンバを追加」を同一コミットで行う限り、
**メンバごとの段階移行が安全**である。一括 1 コミットである必要はない。

## 決定 (案)

ADR-018 の「結果」欄に訂正を追記する。**決定そのもの (merge 方式の採用) は正しく、
変更しない。** 訂正するのは却下理由に書かれた事実認識のみ。

追記内容:

1. 「app.js の内部関数と密結合」という記述は誤り。結合方向は逆で、app.js が
   `gantt.js` から 24 関数を import している
2. `updateText` / `exportMmd` は死にコードであり移行対象ではない
3. ドラッグ層は inline モジュールオブジェクトのメンバではないため対象外
4. merge がプロパティ単位であることから、段階移行が可能である

## 教訓

1. **ADR に書く「却下理由」も事実確認の対象である。** 決定が正しければ却下理由の
   誤りは見過ごされやすいが、後から「その時の判断」を再利用するときに誤った前提を
   引き継ぐ。本件では実際に、後続の設計判断がこの誤った記述を根拠に組み立てられた
2. **「密結合」のような定性的表現は、依存の向きと本数で裏を取る。** grep 1 回で
   確認できることを推測で書かない
