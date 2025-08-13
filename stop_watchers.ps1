# Tries to stop common watcher processes started by the workday loop.
Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*\veildaemon\*" } | Stop-Process -Force -ErrorAction SilentlyContinue
