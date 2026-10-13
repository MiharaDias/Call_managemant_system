@echo off
rem Starts the Call Manager at http://127.0.0.1:8000  (run from anywhere)
cd /d "%~dp0backend"
"%~dp0.venv\Scripts\python.exe" -m uvicorn app.main:app --port 8000
