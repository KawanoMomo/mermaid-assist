# scripts/test.ps1 - unit tests + render oracle.
#   1. node tests/run-tests.js       (unit, prints "N passed, M failed")
#   2. npm run test:render           (mermaid render oracle: before/after cases must render the same)
# Both always run. Exit code: 0 = both green, 1 = any red.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\test.ps1 [-UnitOnly]
param(
  [switch]$UnitOnly
)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$fail = @()

Write-Output '== unit: node tests/run-tests.js'
& node tests/run-tests.js
if ($LASTEXITCODE -ne 0) { $fail += "unit(exit $LASTEXITCODE)" }

if (-not $UnitOnly) {
  Write-Output '== render: npm run test:render'
  & npm.cmd run --silent test:render
  if ($LASTEXITCODE -ne 0) { $fail += "render(exit $LASTEXITCODE)" }
}

if ($fail.Count -gt 0) {
  Write-Output ('test: RED - ' + ($fail -join ', '))
  exit 1
}
Write-Output 'test: GREEN'
exit 0
