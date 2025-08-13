#requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Ensure stub files exist
$stubFiles = @(
  'streamdaemon/.gitkeep',
  'streamdaemon/pyproject.toml',
  'streamdaemon/plugins/__init__.py',
  'streamdaemon/README.md'
)
foreach ($p in $stubFiles) {
  $dir = Split-Path -Parent $p
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType File -Path $p -Force | Out-Null }
}

$allowedRegex = '^(streamdaemon/pyproject\.toml|streamdaemon/plugins/|streamdaemon/plugins/__init__\.py|streamdaemon/README\.md|streamdaemon/\.gitkeep)$'

# List tracked files under StreamDaemon or streamdaemon

# Force array to avoid property errors under StrictMode
$files = @((& git ls-files) | Where-Object { $_ -match '^(streamdaemon|StreamDaemon)/' })

if (-not $files -or $files.Length -eq 0) {
  Write-Host "No StreamDaemon files tracked. Nothing to sanitize."
  exit 0
}

$removed = 0
foreach ($f in $files) {
  if ($f -notmatch $allowedRegex) {
    Write-Host "Untracking private file: $f"
    & git rm -r --cached -- $f | Out-Null
    $removed++
  }
}

if ($removed -gt 0) {
  Write-Host "Removed $removed private files from git index. Stage and commit the changes."
} else {
  Write-Host "No private files needed removal."
}
