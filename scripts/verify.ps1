# scripts/verify.ps1 - Playwright: persona scenarios (tests/scenarios) and the e2e suite (tests/e2e).
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify.ps1 -Scenarios <dir|files> -Out <absolute dir>
#     -Scenarios  directories and/or *.spec.js files under tests/scenarios. Several may be given as
#                 an array or as one comma-separated string. Omitted = tests\scenarios.
#                 A directory means "the whole set": tests/e2e runs too (unless -NoE2E).
#                 Only files: just those scenarios run (add -E2E to run tests/e2e as well).
#     -Out        directory for summary.json, the raw Playwright reports and the artifacts
#                 (screenshots, saved .mmd). Default: test-results\verify. Relative paths resolve
#                 against the current directory.
#     -E2E / -NoE2E   force tests/e2e on / off.
#     -Workers N  Playwright workers (default: Playwright's own default).
#     -Grep  re   only scenarios whose title matches (passed to --grep; not applied to e2e).
#
# Output: <Out>\summary.json (see scripts/verify-summary.js for the fields:
#   passed / failed / total, per-scenario status, renderMs = operation-to-render ms,
#   diffLines = Mermaid text lines changed by one operation).
# Exit code: 0 = everything passed, 1 = something failed, 2 = bad arguments.
param(
  [string[]]$Scenarios = @(),
  [string]$Out = '',
  [switch]$E2E,
  [switch]$NoE2E,
  [int]$Workers = 0,
  [string]$Grep = ''
)
$ErrorActionPreference = 'Continue'
$callerDir = (Get-Location).Path
$root = Split-Path -Parent $PSScriptRoot
$scenarioDir = Join-Path $root 'tests\scenarios'
$cli = Join-Path $root 'node_modules\@playwright\test\cli.js'

if (-not (Test-Path -LiteralPath $cli)) {
  Write-Output 'verify: node_modules missing - run scripts\build.ps1 first'
  exit 2
}

function Resolve-Arg([string]$p) {
  if ([IO.Path]::IsPathRooted($p)) { return [IO.Path]::GetFullPath($p) }
  $c = Join-Path $callerDir $p
  if (Test-Path -LiteralPath $c) { return [IO.Path]::GetFullPath($c) }
  return [IO.Path]::GetFullPath((Join-Path $root $p))
}

# --- output directory
if (-not $Out) { $Out = Join-Path $root 'test-results\verify' }
$Out = Resolve-Arg $Out
New-Item -ItemType Directory -Force -Path $Out | Out-Null

# --- scenario selection
$items = @()
foreach ($s in $Scenarios) { foreach ($x in ($s -split ',')) { if ($x.Trim()) { $items += $x.Trim() } } }
if ($items.Count -eq 0) { $items = @($scenarioDir) }

$runAll = $false
$files = @()
$scenarioFull = [IO.Path]::GetFullPath($scenarioDir).TrimEnd('\')
foreach ($it in $items) {
  $full = Resolve-Arg $it
  if (-not (Test-Path -LiteralPath $full)) { Write-Output "verify: not found: $it"; exit 2 }
  $isDir = (Get-Item -LiteralPath $full).PSIsContainer
  $normalized = $full.TrimEnd('\')
  if (-not ($normalized -eq $scenarioFull -or $normalized.StartsWith($scenarioFull + '\', [StringComparison]::OrdinalIgnoreCase))) {
    Write-Output "verify: scenarios must live under tests\scenarios: $it"
    exit 2
  }
  if ($isDir) {
    $runAll = $true
    if ($normalized -ne $scenarioFull) { $files += ($normalized.Substring($root.Length + 1) -replace '\\', '/') + '/' }
  } else {
    $files += ($normalized.Substring($root.Length + 1) -replace '\\', '/')
  }
}
# a directory equal to tests\scenarios means every scenario: no file filter at all
if ($runAll -and ($items | ForEach-Object { (Resolve-Arg $_).TrimEnd('\') }) -contains $scenarioFull) { $files = @() }

$withE2E = ($runAll -or $E2E) -and -not $NoE2E

Set-Location -LiteralPath $root
$common = @()
if ($Workers -gt 0) { $common += "--workers=$Workers" }

# --- scenarios
$scReport = Join-Path $Out 'scenarios.report.json'
if (Test-Path -LiteralPath $scReport) { Remove-Item -LiteralPath $scReport -Force }
$env:PLAYWRIGHT_JSON_OUTPUT_NAME = $scReport
$scArgs = @($cli, 'test', '--config', 'playwright.scenarios.config.js', '--reporter=list,json', '--output', (Join-Path $Out 'artifacts\scenarios')) + $common
if ($Grep) { $scArgs += @('--grep', $Grep) }
$scArgs += $files
Write-Output ('verify: scenarios ' + $(if ($files.Count) { $files -join ' ' } else { 'tests/scenarios (all)' }))
& node @scArgs
$summaryArgs = @("scenarios=$scReport")

# --- e2e
if ($withE2E) {
  $e2eReport = Join-Path $Out 'e2e.report.json'
  if (Test-Path -LiteralPath $e2eReport) { Remove-Item -LiteralPath $e2eReport -Force }
  $env:PLAYWRIGHT_JSON_OUTPUT_NAME = $e2eReport
  Write-Output 'verify: e2e tests/e2e (playwright.config.js)'
  $e2eArgs = @($cli, 'test', '--config', 'playwright.config.js', '--reporter=dot,json', '--output', (Join-Path $Out 'artifacts\e2e')) + $common
  & node @e2eArgs
  $summaryArgs += "e2e=$e2eReport"
}
Remove-Item Env:\PLAYWRIGHT_JSON_OUTPUT_NAME -ErrorAction SilentlyContinue

& node (Join-Path $root 'scripts\verify-summary.js') $Out @summaryArgs
$code = $LASTEXITCODE
Write-Output "verify: summary $Out\summary.json"
exit $code
