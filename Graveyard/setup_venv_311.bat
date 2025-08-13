@echo off
REM 🜏 VeilDaemon Python 3.11 Setup Script (archived)
SET PY311="C:\Users\Knoxm\AppData\Local\Programs\Python\Python311\python.exe"
IF NOT EXIST %PY311% (
    echo ❌ Python 3.11 not found at %PY311%
    echo Please install it from https://www.python.org/downloads/release/python-3110/
    pause
    exit /b
)
%PY311% -m venv ..\venv311
call ..\venv311\Scripts\activate
pip install --upgrade pip
pip install pyqt5 llama-cpp-python cryptography
