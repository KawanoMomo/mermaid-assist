# MermaidAssist 自律開発ループ 設計書(2026-11-08)

## 1. 製品の一言
Mermaid 記法のテキストを正本に、GUI(ドラッグ・プロパティパネル・一覧)で図を編集できる単一 HTML のデスクトップツール。
21 図種(gantt / sequence / flowchart / state / class / er / requirement / block / timeline / mindmap / gitgraph / pie / journey / quadrant / xychart / sankey / c4 / packet / architecture / kanban / radar)。
価値は「GUI の 1 操作が、名指しした要素だけを 1 行の差分として Mermaid 本文に書き戻すこと」(docs/quality-gate.md の G1)。

## 2. 出発点
- 人間の作業リポジトリ `E:\00_Git\05_MermaidAssist`(2026-08-22 で停止、タグ v1.9.0、471 unit + 269 e2e + render-oracle)。ループは `E:\10_Loop_MermaidAssist\01_MermaidAssist` に clone した **master**(このリポジトリの既定ブランチ。main は無い)を正本とし、`E:\00_Git\05_MermaidAssist` には触れない
- 作者の棚卸し `docs/backlog.md` は「D. 残: 現在なし」。つまり**作者の目では完成**。ループの役目は、利用者の実体験(ペルソナ)で見つかる不足と退行を拾うこと(03 StableBlock と同じ型)
- 知識の正本: `docs/adr/`(ADR-008 オーバーレイ、ADR-011 名前空間、ADR-012 DiagramModule v2、ADR-027 更新関数の署名)、`docs/ecn/`(ECN-001〜031)、`docs/quality-gate.md`(G1〜G9)。同じ領域を直す前に該当 ECN を読む(ワークスペース規約 `E:\00_Git\CLAUDE.md`)

## 3. 成果物と確かめ方
- 成果物: `mermaid-assist.html` + `src/` + `lib/`(ビルド無し。ブラウザで開くだけ)
- 確かめる手段(言語非依存の入口を基盤づくりで足す):
  - `scripts/build.ps1` = `npm ci`(node_modules が無いときだけ)+ `node -e` で html と src の構文確認
  - `scripts/test.ps1` = `node tests/run-tests.js`(unit)+ `npm run test:render`(render-oracle)
  - `scripts/verify.ps1` = `npx playwright test`(e2e。`--grep` で台本ぶんの scenario を選べる)
  - ペルソナの台本は Playwright の spec(`tests/scenarios/{persona}-*.spec.js`)として残す。スクリーンショットは `persona-data/{name}/shots/`
- 合格の底: quality-gate.md の G1(押した対象だけが変わる)・G2(mermaid が実際に描ける)。これを破る変更は退行

## 4. v1.0 の範囲(基盤 → 利用者の最初の一巡)
1. **基盤(bootstrap)**: scripts/build|test|verify.ps1、`tests/scenarios/` の置き場、ペルソナ 3 人ぶんの最初の scenario(各 1 本)。既存 unit / e2e / render が全部緑のまま
2. 作者が「要検討・未着手」で残した 2 件を判断して処分する(直す or wontfix を理由付きで):
   - E13: 版表示にコミットハッシュが無い(`#status-version` は VERSION と一致するが、同じ版でも中身が違い得る)
   - E8: 契約の識別子 `opts.id` が 21 図種で効かない(行番号がずれた状態で契約経路を呼ぶと id で正しい要素を指せない)。ADR-012 と矛盾
3. VERSION(1.2.0)・package.json(1.0.0)・git tag(v1.9.0)・`#status-version` の版のずれを揃える(以後 releaser がタグのたびに揃える)
4. ペルソナ全員が最初の台本を完走する(= v1.0 の門)

## 5. 以後(design/README.md の順。人間を待たない)
- 削除リスト H の項目は**復活条件が満たされたときだけ**戻す(G3 複写・G5 欄名の日英・G7 黙って消える行・G8 端点の select)。ループが勝手に復活させない
- 利用者の実体験から出る BLK(friction / blocked / wish)を owner が features.md と principles.md に照らして採否
- 書き出し(SVG / PNG / .mmd)の決定性(README「Git に置くのは .mmd を推奨」)は壊さない

## 6. ペルソナ(利用者。読む人ではなく使う人)
- **junior**(新人 PM): gantt で 2 週間の計画を作り、ドラッグで日付を動かし、.mmd を保存して Git 差分を見る。焦点は画面だけで操作が分かるか
- **primary**(設計者、3〜5 年目): flowchart / state / class / sequence で設計書の図を 10 枚以上管理。ID 改名の伝播、接続モード、Undo の粒度、CRLF 文書への挿入。差分が 1 行で説明できることを最重視
- **reviewer**(レビュー担当): 書き出した SVG / PNG と .mmd の差分を読み、見た目(線が見えるか・切れていないか・暗いテーマ)と G1/G2 の破れを指摘する。primary の出力を読む
- 計測するもの: 1 操作あたりの Mermaid 本文の差分行数、操作から描画までの待ち、台本の完走率

## 7. 制約と禁止
- `git push` 禁止(メジャー時の `release/v{major}.0` ブランチ・タグ・PR だけ例外。main への push は禁止。origin = `https://github.com/KawanoMomo/mermaid-assist.git`、PR のマージは人間。人間の件はメジャーの条件に入れない)
- `E:\00_Git\05_MermaidAssist` と `E:\00_Git\CLAUDE.md` は読むだけ
- 外部送信なし(mermaid.js は同梱、ネット不要)。`.eval/` と `test-results/` はコミットしない
- 体のモデル: builder / owner = opus、releaser / primary / reviewer / curator = sonnet、junior / curator-light = haiku(08 と同じ)。GPU は使わない(Playwright のみ)。ペルソナの並列は 1 tick に 1 体

## 8. 人間の元の言葉
「まだトークンが余っているので、過去でここで管理しているプロジェクトを軽く調査してループで改善できるものがあればプロジェクトを作成してください」(2026-11-08)。
選定理由: 単一 HTML + Playwright で 03 の型が使える、テスト基盤が厚い(緑の底がある)、GPU を使わない(04 と干渉しない)、作者の棚卸しが「残なし」で止まっている = 利用者視点の発見がいちばん効く段階。
次の候補: 10_NotebookOllama(638 commits、Python + Svelte + Qdrant、GPU 要)、04_MeetingTranscriber(pyannote、GPU 要)。
