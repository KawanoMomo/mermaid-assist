# scripts/build.ps1 - MermaidAssist has no build step (single HTML).
# This entry point only prepares and checks the tree:
#   1. npm ci when node_modules is missing (or -Force)
#   2. node scripts/check-syntax.js (src/**/*.js and mermaid-assist.html compile, referenced files exist)
# Exit code: 0 = ready, non-zero = not ready.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build.ps1 [-Force]
param(
  [switch]$Force
)
$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

if ($Force -or -not (Test-Path -LiteralPath (Join-Path $root 'node_modules\@playwright\test'))) {
  Write-Output 'build: npm ci'
  & npm.cmd ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { Write-Output "build: npm ci failed (exit $LASTEXITCODE)"; exit 1 }
} else {
  Write-Output 'build: node_modules present (skip npm ci)'
}

& node scripts/check-syntax.js
if ($LASTEXITCODE -ne 0) { Write-Output 'build: syntax check failed'; exit 1 }

Write-Output 'build: OK'
exit 0
