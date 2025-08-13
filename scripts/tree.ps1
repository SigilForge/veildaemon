param(
  [string]$Path = "."
)
Get-ChildItem -Recurse -Force $Path | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
  $_.FullName.Replace((Resolve-Path $Path), '.').TrimStart('.')
}
