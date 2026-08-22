'use strict';
// UI-049: 並べ替えができる図種とできない図種の区別が画面から読めない。
//
// classDiagram では `↑↓` が出るのに erDiagram では出ない。利用者から見ると
// その差は内部事情 (要素の line が宣言行を指すか関係行を指すか) で決まって
// おり、画面からは分からない。**無いものは探しても見つからない**ので、
// 探す時間がそのまま失われる。
//
// 実測 (直す前 / 後):
//   erDiagram のエンティティを選ぶ → `sel-ent-up` が**存在しない**
//                                  → 淡色 (opacity .45 / not-allowed) で出て、
//                                    理由がツールチップに入る
//
// 理由を書いたモジュールだけがこの形になる。書かなければ今までどおり何も
// 出ない — 全パネルを一度に変えると、**まだ測っていない図種まで
// 「できない理由」を名乗る**ことになる。
const path = require('path');
const { test, expect } = require('@playwright/test');
const HTML_URL = 'file:///' + path.resolve(__dirname, '..', '..', 'mermaid-assist.html').split(path.sep).join('/');
const NL = String.fromCharCode(10);

const DOCS = {
  classDiagram: {
    text: ['classDiagram', '    class Animal {', '        +String name', '    }',
      '    class Dog {', '        +bark() void', '    }'].join(NL),
    pick: 'Animal', prefix: 'sel-class',
  },
  erDiagram: {
    text: ['erDiagram', '    CUSTOMER ||--o{ ORDER : places',
      '    CUSTOMER {', '        string name', '    }',
      '    ORDER {', '        int id PK', '    }'].join(NL),
    pick: 'CUSTOMER', prefix: 'sel-ent',
  },
  state: {
    text: ['stateDiagram-v2', '    [*] --> Idle', '    Idle --> Running : start',
      '    Running --> Idle : stop'].join(NL),
    pick: 'Idle', prefix: 'sel-state',
  },
};

async function openAndSelect(page, key) {
  const c = DOCS[key];
  page.on('dialog', (d) => d.accept());
  await page.goto(HTML_URL);
  await page.waitForSelector('#preview-svg svg', { timeout: 20000 });
  await page.waitForTimeout(700);
  await page.evaluate((x) => {
    const e = document.getElementById('editor');
    e.value = x; e.dispatchEvent(new Event('input', { bubbles: true }));
  }, c.text);
  await page.waitForTimeout(2400);
  // ↑↓✕ は選択しないので、選択が起きるボタンだけを押す
  const btns = page.locator('#props-content .ma-list-row button')
    .filter({ hasNotText: /^[↑↓✕×]/ });
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const t = await btns.nth(i).evaluate((e) => e.closest('.ma-list-row').textContent.trim());
    if (t.indexOf(c.pick) === 0) { await btns.nth(i).click(); break; }
  }
  await page.waitForTimeout(800);
  return c.prefix;
}

test.describe('並べ替えができない図種は、理由つきで淡色に出す', () => {
  test('erDiagram: 押せない状態で理由が読める', async ({ page }) => {
    const prefix = await openAndSelect(page, 'erDiagram');
    const r = await page.evaluate((p) => {
      const up = document.getElementById(p + '-up');
      if (!up) return null;
      const cs = getComputedStyle(up);
      return { disabled: up.disabled, title: up.title,
        opacity: parseFloat(cs.opacity), cursor: cs.cursor };
    }, prefix);
    // ボタンが消えていないこと (消えていると探す時間が失われる)
    expect(r).not.toBe(null);
    expect(r.disabled).toBe(true);
    // なぜできないかが読めること
    // 理由は**測った事実**であること。ひな形だけを測った最初の理由は誤りだった。
    expect(r.title).toContain('最初に現れた行');
    // 押せる操作と見分けがつくこと
    expect(r.opacity).toBeLessThan(1);
    expect(r.cursor).toBe('not-allowed');
  });

  test('state: 押せない状態で理由が読める', async ({ page }) => {
    const prefix = await openAndSelect(page, 'state');
    const r = await page.evaluate((p) => {
      const up = document.getElementById(p + '-up');
      return up ? { disabled: up.disabled, title: up.title } : null;
    }, prefix);
    expect(r).not.toBe(null);
    expect(r.disabled).toBe(true);
    // state の理由は「順序が変わらない」ではなく「図が壊れる」。実測で確認済み。
    expect(r.title).toContain('取り込まれて図が壊れます');
  });

  test('classDiagram: できる図種は普通に押せる', async ({ page }) => {
    // 対照。ここが押せないなら、上の2件は「全部押せない」を見ているだけになる
    const prefix = await openAndSelect(page, 'classDiagram');
    const r = await page.evaluate((p) => {
      const up = document.getElementById(p + '-up');
      return up ? { disabled: up.disabled, opacity: parseFloat(getComputedStyle(up).opacity) } : null;
    }, prefix);
    expect(r).not.toBe(null);
    expect(r.disabled).toBe(false);
    expect(r.opacity).toBe(1);
  });

  test('理由を書いていないパネルは今までどおり何も出さない', async ({ page }) => {
    // 全パネルを一度に変えると、まだ測っていない図種まで理由を名乗ることになる。
    // 関連パネル (sel-rel) には理由を書いていないので、ボタンは出ない。
    await openAndSelect(page, 'classDiagram');
    const has = await page.evaluate(() => !!document.getElementById('sel-rel-up'));
    expect(has).toBe(false);
  });
});
