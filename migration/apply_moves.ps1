#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot
$planPath = Join-Path $repoRoot 'migration/move_plan.json'
$plan = Get-Content -Raw -Path $planPath | ConvertFrom-Json
foreach ($m in $plan) {
  $dstDir = Split-Path -Parent $m.dst
  if (-not (Test-Path -LiteralPath $dstDir)) {
    New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
  }
  Write-Host "-- $($m.src) -> $($m.dst)"
  git mv -v -- $m.src $m.dst
}
Write-Host "Move plan applied. Review changes with 'git status'."
