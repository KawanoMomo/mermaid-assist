// @ts-check
// ペルソナ台本の scenario(tests/scenarios/{persona}-{手順}.spec.js)用の設定。
// 既存の e2e(playwright.config.js、testDir: tests/e2e)はそのまま残し、ここで testDir を足す。
// 通常は scripts/verify.ps1 から呼ぶ。直接回すなら:
//   npx playwright test --config playwright.scenarios.config.js
const { defineConfig } = require('@playwright/test');
const base = require('./playwright.config.js');

module.exports = defineConfig({
  ...base,
  testDir: './tests/scenarios',
  outputDir: './test-results/scenarios',
  timeout: 60000,
});
