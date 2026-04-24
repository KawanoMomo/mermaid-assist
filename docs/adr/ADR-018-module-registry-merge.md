# ADR-018: モジュールレジストリの merge 戦略 (skip ではなく欠落メソッド補完)

- **ステータス**: 承認
- **カテゴリ**: アーキテクチャ
- **日付**: 2026-04-17
- **対象プロジェクト**: MermaidAssist
- **関連ADR**: ADR-011 (JS外部分割), ADR-012 (DiagramModule v2)
- **関連ECN**: ECN-014 (Requirement, v1.3.0 で顕在化)

## コンテキスト

`src/app.js` には Gantt モジュールが inline で定義されており、`modules.gantt = { ... }` として早期登録される (historic reasons)。一方、Tier1 以降の他図形 (Sequence/Flowchart/State/Class/ER 他) は `src/modules/*.js` で `window.MA.modules.*` に自身を登録する。app.js は初期化時に `_registerWindowModules()` で window 側から modules dict に転送する。

初期実装の `_registerWindowModules`:

```javascript
function _registerWindowModules() {
  var mm = window.MA.modules || {};
  var keys = Object.keys(mm);
  for (var _i = 0; _i < keys.length; _i++) {
    var _mod = mm[keys[_i]];
    var _key = (_mod && _mod.type) ? _mod.type : keys[_i];
    if (!modules[_key]) modules[_key] = _mod;  // ← skip if exists
  }
}
```

この `if (!modules[_key])` は inline gantt の上書きを防ぐ意図だが、`src/modules/gantt.js` が後から提供する `template()` メソッド等が inline 側にない場合、外部モジュールが完全に無視されてしまう。

Tier2 Phase 1 (Requirement) の visual sweep で初めて顕在化: `diagram-type select` で `gantt` に戻すと `TypeError: mod.template is not a function` 発生。原因は inline modules.gantt が `template` を持たず、外部 `window.MA.modules.gantt.template` が skip されたため。

## 検討した選択肢

### A) inline gantt に `template()` を追加

- 概要: `src/app.js` の inline gantt 定義に template を直接書く
- メリット: 修正箇所1箇所
- デメリット: 他モジュールで同様の欠落が出るたび app.js に追記が必要。inline/外部の2重メンテになる

### B) Registry を merge 方式に変更

- 概要: 既存スロットがある場合でも、外部モジュールから欠落プロパティだけ補完する
- メリット: 一般解。今後新しいメソッド (例: `onExport`, `onImport`) を DiagramModule v2 に追加したとき inline gantt に無くても外部から供給可
- デメリット: merge ロジックがやや複雑

### C) inline gantt を廃止し完全に `src/modules/gantt.js` に移行

- 概要: app.js から inline gantt を削除
- メリット: 2重管理の根絶
- デメリット: 大規模リファクタ。inline gantt は historic で app.js の内部関数 (calibrateScale 等) と密結合、動かすには parseGantt 以外にも多数移動が必要

## 決定

**B) Registry merge 方式** を採用。

```javascript
function _registerWindowModules() {
  var mm = window.MA.modules || {};
  var keys = Object.keys(mm);
  for (var _i = 0; _i < keys.length; _i++) {
    var _mod = mm[keys[_i]];
    var _key = (_mod && _mod.type) ? _mod.type : keys[_i];
    if (!modules[_key]) {
      modules[_key] = _mod;
    } else {
      // Fill in any methods missing on the inline definition from the external module
      for (var _prop in _mod) {
        if (Object.prototype.hasOwnProperty.call(_mod, _prop) && !(_prop in modules[_key])) {
          modules[_key][_prop] = _mod[_prop];
        }
      }
    }
  }
}
```

YAGNI の観点からは B が過剰に見えるが、DiagramModule v2 のインターフェースは時間とともに拡張される前提で、「inline 側の unknown fallback を許容する」のは将来の diagram-type 切替で同類 bug を未然防止する価値がある。

C (完全移行) は Tier3 完了後のリファクタ候補として残す。

## 結果

- Phase 1 の visual sweep 再 run で console error 0 達成
- 以降の Tier2/Tier3 全 Phase (5 + 10 図形) で gantt 切替時の template 問題 0
- inline gantt と外部 gantt.js の重複は解消されていないが、機能面では支障なし

## 教訓

1. **"守り" の skip より "埋め合わせ" の merge**: 既存を上書きから守る意図が逆に機能欠落を招く。上書きではなく merge (unknown fields のみ補完) が一般的にロバスト。
2. **レジストリパターンは拡張性を考慮せよ**: Inline 登録と外部登録が混在する構造は、インターフェース拡張に対して脆弱。将来は完全統一を目指す。
3. **Visual sweep による diagram-type 切替テストは必須**: 単体テスト単位では絶対に検出できない種類の bug が cross-switch で顕在化する。ADR-014 の visual gate が機能した好例。
