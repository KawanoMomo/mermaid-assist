# v1.4.0 ECU HW Configuration Scenario Report

## 概要
- 実施日: 2026-04-17
- 対象: Tier2 Phase 2 Block Diagram / ECU ハードウェア構成シナリオ
- 最終判定: PASS

## 環境
- dev_server_url: http://127.0.0.1:8765/mermaid-assist.html
- CDP Network.clearBrowserCache 実施

## シナリオ

ECU のハードウェア構成 (3 sensor + MCU group + 3 output + 6 link) を property panel UI のみで構築。

## 検証結果

| 項目 | 結果 | 証拠 |
|---|---|---|
| 9 block 全部生成 | PASS | final-editor.txt |
| 1 group (block:mcu) 生成 | PASS | final-editor.txt |
| 6 link 生成 | PASS | final-editor.txt |
| SVG render 成功 | PASS | final-svg.png |
| console error | 0 | (favicon除く) |

## UX Gap (後続 sprint で修正済み)

Link From/To プルダウンに groups が含まれないため、group を endpoint とするリンク追加が UI 単独では不能だった。commit `851ba98` で解決。

## 結論
PASS. Target Mermaid と等価な editor 生成、SVG render 成功、console error 0。
