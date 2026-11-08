'use strict';
// 台本 primary 場面 3「レビュー指摘の反映」の 10 件(ID 改名 3・ラベル直し 5・エッジ文言 2)を
// GUI で行う手。手順 5(Fit と部分拡大)と手順 6(保存と差分行数・改行コード)の scenario が
// 「10 件を直した後」の状態を作るために共有する。1 件ごとに G1(押した要素を書いた行だけが、
// 押した欄の字だけ変わる)と G2(mermaid が描ける)を確かめ、描画までの ms と差分行数を返す。
//
// 図は fixtures/primary-flow-review10.mmd(要素 30 以下)。同名ラベル(SpiDrv の「SpiDrv」と
// SpiDrvInit の「SpiDrv 初期化」)と接頭辞を共有する ID(Spi / SpiDrv / SpiDrvInit、Uart / UartTx)を含む。
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');
const H = require('./_helpers');

const CRLF = '\r\n';
const FIXTURE = 'primary-flow-review10.mmd';

// 10 件。kind: rename = ID 欄、label = ノードのラベル欄、edge = エッジのラベル欄。
// removed / added はその 1 件で動く行(改名は参照行の数、それ以外は 1 行)。
const FIXES = [
  { kind: 'rename', id: 'Spi', from: 'Spi', to: 'SpiBus',
    removed: ['    Init --> Spi[SPI 初期化]', '    Spi --> SpiDrv[SpiDrv]'],
    added: ['    Init --> SpiBus[SPI 初期化]', '    SpiBus --> SpiDrv[SpiDrv]'] },
  { kind: 'rename', id: 'Uart', from: 'Uart', to: 'Uart0',
    removed: ['    SpiDrvInit --> Uart[UART 初期化]', '    Uart --> UartTx[UART 送信]'],
    added: ['    SpiDrvInit --> Uart0[UART 初期化]', '    Uart0 --> UartTx[UART 送信]'] },
  { kind: 'rename', id: 'Wait', from: 'Wait', to: 'Retry',
    removed: ['    Check -->|いいえ| Wait[待機]', '    Wait --> Check'],
    added: ['    Check -->|いいえ| Retry[待機]', '    Retry --> Check'] },
  { kind: 'label', id: 'Init', from: '初期化', to: 'ハード初期化',
    removed: ['    Start[開始] --> Init[初期化]'], added: ['    Start[開始] --> Init[ハード初期化]'] },
  { kind: 'label', id: 'SpiDrv', from: 'SpiDrv', to: 'SPI ドライバ',
    removed: ['    SpiBus --> SpiDrv[SpiDrv]'], added: ['    SpiBus --> SpiDrv[SPI ドライバ]'] },
  { kind: 'label', id: 'SpiDrvInit', from: 'SpiDrv 初期化', to: 'SPI ドライバ初期化',
    removed: ['    SpiDrv --> SpiDrvInit[SpiDrv 初期化]'], added: ['    SpiDrv --> SpiDrvInit[SPI ドライバ初期化]'] },
  { kind: 'label', id: 'UartTx', from: 'UART 送信', to: 'UART0 送信',
    removed: ['    Uart0 --> UartTx[UART 送信]'], added: ['    Uart0 --> UartTx[UART0 送信]'] },
  { kind: 'label', id: 'Done', from: '終了', to: '完了',
    removed: ['    Send --> Done[終了]'], added: ['    Send --> Done[完了]'] },
  { kind: 'edge', from: 'はい', to: '可',
    removed: ['    Check -->|はい| Send[送信]'], added: ['    Check -->|可| Send[送信]'] },
  { kind: 'edge', from: 'いいえ', to: '不可',
    removed: ['    Check -->|いいえ| Retry[待機]'], added: ['    Check -->|不可| Retry[待機]'] },
];

// 直した後に図で読めるはずの字(新しいラベル・エッジ文言)と、直した要素の ID。
const EDITED_TEXTS = ['ハード初期化', 'SPI ドライバ', 'SPI ドライバ初期化', 'UART0 送信', '完了', '可', '不可'];
const EDITED_IDS = ['SpiBus', 'Uart0', 'Retry', 'Init', 'SpiDrv', 'SpiDrvInit', 'UartTx', 'Done'];

// fixture を CRLF にして test-results/ に置き、製品で開く。開いた本文(CRLF)を返す。
async function openReviewFixture(page, testInfo) {
  const src = fs.readFileSync(path.join(H.FIXTURES, FIXTURE), 'utf8').replace(/\r?\n/g, CRLF);
  const inPath = testInfo.outputPath(FIXTURE);
  fs.writeFileSync(inPath, src);
  await H.openApp(page);
  await H.openFixture(page, inPath);
  await expect(page.locator('#diagram-type')).toHaveValue('flowchart');
  return src;
}

async function pickField(page, fix) {
  if (fix.kind === 'edge') {
    // Escape で選択を外して一覧に戻り、エッジの行の「編集」で選ぶ
    await page.keyboard.press('Escape');
    const row = page.locator('.ma-list-row', { hasText: '|' + fix.from + '|' });
    await expect(row, fix.from).toHaveCount(1);
    await row.locator('.fc-select-edge').click();
    const field = page.locator('#sel-edge-label');
    await expect(field, fix.from).toHaveValue(fix.from);
    return field;
  }
  await page.locator('#overlay-layer [data-element-id="' + fix.id + '"]').first().click({ force: true });
  await expect(page.locator('#sel-node-id'), fix.id).toHaveValue(fix.id);
  const field = page.locator(fix.kind === 'rename' ? '#sel-node-id' : '#sel-node-label');
  await expect(field, fix.id).toHaveValue(fix.from);
  return field;
}

// 10 件を順に直す。[{ name, ms, lines }] を返す。
async function applyReviewFixes(page, browser) {
  const steps = [];
  for (const fix of FIXES) {
    const name = fix.kind + ' ' + fix.from + ' → ' + fix.to;
    const field = await pickField(page, fix);
    const before = await H.editorText(page);
    const ms = await H.timedRender(page, async () => {
      await field.fill(fix.to);
      await field.press('Enter');
    });
    const after = await H.editorText(page);
    const d = H.lineDiff(before, after);
    // G1: 押した要素を書いた行だけが、押した欄の字だけ変わる
    expect(d.removed, name).toEqual(fix.removed);
    expect(d.added, name).toEqual(fix.added);
    // G2
    expect(ms, name + ': 描画が通らない').not.toBeNull();
    await expect(page.locator('#status-parse')).toHaveText(/OK/);
    const r = await H.renderWithMermaid(browser, after);
    expect(r.render, name + ': mermaid が描けない').toBe('OK');
    steps.push({ name, ms, lines: d.lines });
  }
  // 接頭辞・同名ラベルの巻き込みが無い
  const text = await H.editorText(page);
  expect(text).not.toMatch(/SpiBusDrv|Uart0Tx|SPI ドライバ ドライバ/);
  return steps;
}

module.exports = { CRLF, FIXTURE, FIXES, EDITED_TEXTS, EDITED_IDS, openReviewFixture, applyReviewFixes };
