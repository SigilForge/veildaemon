# move obvious assets to sane places
$map = @{
  '\.png$|\.jpg$|\.jpeg$|\.ico$' = 'outputs\artifacts'
  '\.wav$|\.mp3$'                = 'outputs\audio'
  '\.onnx$|\.pt$|\.gguf$|\.bin$' = 'models'
  '\.db$|\.sqlite'               = 'data'
  '\.mp4$'                       = 'outputs\video'
}

Get-ChildItem -Recurse .trash | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
  $rel = $_.FullName.Substring((Resolve-Path ".").Path.Length+1)
  $dest = $null
  foreach ($k in $map.Keys) { if ($rel -match $k) { $dest = $map[$k]; break } }
  if ($dest) {
    $target = Join-Path $dest (Split-Path $rel -Leaf)
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Get-Item $_.FullName | Move-Item -Force -Destination $target
    Write-Host "Moved $rel -> $target"
  } else {
    Write-Host "Delete stale: $rel"
    Remove-Item -Force $_.FullName
  }
}
