@echo off
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3.11 -m venv .venv 2>nul || py -3.10 -m venv .venv 2>nul || py -3 -m venv .venv
) else (
  python -m venv .venv
)

call .venv\Scripts\activate.bat
pip install -r requirements.txt
python app.py
pause
