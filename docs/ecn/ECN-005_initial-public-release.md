# ECN-005: 初版 GitHub 公開（LICENSE + README）

- **ステータス**: 適用済
- **種別**: プロセス改善
- **バージョン**: v0.4.0 (公開時)
- **対象コミット**: `22f93ee`
- **影響ファイル**: `README.md`, `LICENSE`, `lib/LICENSE.mermaid`

## コンテキスト

v0.4.0 を初版として `KawanoMomo/mermaid-assist` リポジトリで GitHub に公開する。MIT ライセンス + 同梱する mermaid.js v11.13.0 のライセンス取り扱いに留意が必要。`mermaid.min.js` はミニファイ時にライセンスバナーが削除されており、MIT ライセンス遵守のため別ファイルで完全な mermaid ライセンス文を配布する必要があった。

## 対策

- `README.md` を新規作成（特徴・使い方・開発手順・対応構文）
- `LICENSE` を MIT に統一、第三者ライセンスセクションを追加（mermaid.js 帰属）
- `lib/LICENSE.mermaid` を新規作成、mermaid.js v11 (Copyright 2014-2024 Knut Sveidqvist) の MIT 全文を記載
- `.gitignore` で `node_modules/`, `test-results/`, `.superpowers/` を除外確認

公開対象を選定: `mermaid-assist.html`, `lib/`, `tests/`, `docs/`, `package*.json`, `playwright.config.js`, `VERSION`, `CLAUDE.md`。

## 結果

- GitHub 公開: https://github.com/KawanoMomo/mermaid-assist (Public)
- v0.4.0 タグ付与済み
- ライセンス遵守: mermaid.js のライセンス情報が distribution 内に同梱
