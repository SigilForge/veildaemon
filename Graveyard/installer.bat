@echo off
setlocal enabledelayedexpansion

:: Set base directory
set BASE_DIR=D:\VeilDaemon-Clean

:: Set path to Python executable
set PYTHON_EXE=%BASE_DIR%\venv311\Scripts\python.exe

:: Display menu
:MENU
cls
echo =======================================
echo         VeilDaemon Setup Menu
echo =======================================
echo.
echo 1. Install Python 3.11 Environment
echo 2. Launch VeilDaemon
echo 3. Exit
echo.
set /p choice=Choose an option (1-3): 

if "%choice%"=="1" goto INSTALL
if "%choice%"=="2" goto LAUNCH
if "%choice%"=="3" exit
goto MENU

:INSTALL
echo Installing Python 3.11 environment...
call "%BASE_DIR%\setup_venv_311.bat"
pause
goto MENU

:LAUNCH
echo Launching VeilDaemon...
if exist "%PYTHON_EXE%" (
    cd /d "%BASE_DIR%"
    call "%PYTHON_EXE%" veil_daemon_final_patch.py
) else (
    echo [ERROR] Python not found at expected path: %PYTHON_EXE%
    echo Please run installation first.
)
pause
goto MENU
