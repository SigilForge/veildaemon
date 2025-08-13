@echo off
setlocal
REM Start the unattended workday loop with defaults.
REM This will activate .venv if present and run auto_train_loop.py.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0workday_runner.ps1"
