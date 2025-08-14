# Lists items at root that are not part of the tiny, boring allowlist (without moving anything).
param(
  [string[]]$Keep = @(
    'veildaemon','tools','scripts','tests','docs',
    '.github','.githooks','.vscode',
    'README.md','ARCHITECTURE.md','NAV.md',
    '.gitignore','.gitattributes','.editorconfig'
  )
)

Get-ChildItem -Force . | Where-Object { $_.Name -notin $Keep -and $_.Name -ne '.' -and $_.Name -ne '..' } | Select-Object Name, FullName

Write-Host "If anything was listed above, consider moving it to scripts/ or .trash/." -ForegroundColor Cyan
