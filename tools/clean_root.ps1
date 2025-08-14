# Moves any non-allowlisted items at repo root into .trash for visual cleanliness in VS Code.
param(
  [string[]]$Keep = @(
    'veildaemon','tools','scripts','tests','docs',
    '.github','.githooks','.vscode',
    'README.md','ARCHITECTURE.md','NAV.md',
    '.gitignore','.gitattributes','.editorconfig'
  )
)

Write-Host "Keeping: $($Keep -join ', ')" -ForegroundColor Cyan

Get-ChildItem -Force . | Where-Object { $_.Name -notin $Keep -and $_.Name -ne '.' -and $_.Name -ne '..' } | ForEach-Object {
  if (-not (Test-Path ./.trash)) { New-Item -ItemType Directory -Path ./.trash | Out-Null }
  Write-Host ("Moving '{0}' -> .trash" -f $_.FullName) -ForegroundColor Yellow
  Move-Item -Force $_.FullName ./.trash
}

Write-Host "Done. Hidden items are now under ./.trash (already git-ignored)." -ForegroundColor Green
