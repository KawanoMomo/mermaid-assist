# ADR ドラフト: 版の正本は VERSION、同じ版の中身の違いはコードの指紋で示す

- 状態: ドラフト(採番は人間)
- 日付: 2026-11-08
- 起点: TICKET-human-20261108-1500-2(backlog E13 / UI-059、作者の「要検討・未着手」)

## 文脈
版が 4 箇所でずれていた: `VERSION` 1.2.0 / `package.json` 1.0.0 / `package-lock.json` 1.0.0 / git の最新タグ v1.17.0。
画面の `#status-version` は VERSION と一致するよう unit で固定済み(B30)だったが、残りは誰も見ていなかった。
さらに、版が同じでもコミットは違い得る(作者の実測: 74 コミット遅れていた間も画面は 1.2.0)。
ビルド工程の無い単一 HTML なので、コミットハッシュを自動で埋め込む手段が無い(E13 が未着手だった理由)。

## 決定
1. **版の正本は `VERSION`**。`package.json`・`package-lock.json`(先頭と `packages[""]`)・`#status-version` は
   `node scripts/version.js set x.y.z`(または `sync`)で導く。`node scripts/version.js`(= `npm run version:check`)がずれを名指しして exit 1。
   unit(`tests/version-sync.test.js`)が 4 箇所の一致を固定する。リリース(タグ)の手順は `set` → コミット → `git tag v{x.y.z}`。
   現在値はタグに合わせて 1.17.0 にした(次は releaser が v1.18 で 1.18.0)
2. **同じ版の中身の違いは「コードの指紋」で示す**。`src/core/build-id.js`(src の最後に読む)が、読み込まれた `window.MA` 配下の
   関数のソース(`Function.prototype.toString`)と `<style>` の中身から FNV-1a で 12 桁の指紋を取り、ステータス行の版の隣
   (`#status-build`)に `#xxxxxxxxxxxx` と出す。`node scripts/version.js fingerprint` が同じ値を実ブラウザで取る

## 退けた案
- コミットハッシュの埋め込み: ビルド工程が要る。手で書けば「人が 2 箇所を揃える」失敗形(B30)に戻る
- git の `ident`(`$Id$` の展開): 展開されるのはそのファイルの blob id だけで、src/ の他のファイルの変更を表さない。
  さらに展開は checkout 時だけなので、手元で直したファイルでは古い値が残る
- `.mmd` 保存時のコメント: 本文を正本とする前提(G1: 1 操作 1 行の差分)を汚す

## 結果
- 利用者の報告に「v1.17.0 #8e74432ac770」があれば、タグを checkout して `fingerprint` を取り、一致すればそのリリースそのもの、
  違えばそのリリースから先の別の中身と分かる。指紋からコミットは逆引きできない(リリースごとの指紋を記録しておくのが前提)
- 指紋に入らないもの: HTML のマークアップ、配列・数値などの定数(関数の外にあるもの)、lib/mermaid.min.js。
  これらだけを変えた版は同じ指紋になる
