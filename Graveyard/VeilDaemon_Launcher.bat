@echo off
REM 🜏 VeilDaemon Launcher (archived)
cd /d "%~dp0"
powershell -Command "Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass"
call ..\venv311\Scripts\activate.bat
python ..\daemon_shell.py
pause
