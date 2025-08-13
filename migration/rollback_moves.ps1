#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
$planPath = Join-Path $repoRoot 'migration/move_plan.json'
$plan = Get-Content -Raw -Path $planPath | ConvertFrom-Json
# reverse order to avoid conflicts
for ($i = $plan.Count - 1; $i -ge 0; $i--) {
  $m = $plan[$i]
  $srcDir = Split-Path -Parent $m.src
  if (-not (Test-Path -LiteralPath $srcDir)) {
    New-Item -ItemType Directory -Path $srcDir -Force | Out-Null
  }
  Write-Host "-- $($m.dst) -> $($m.src)"
  git mv -v -- $m.dst $m.src
}
Write-Host "Rollback applied. Review changes with 'git status'."
