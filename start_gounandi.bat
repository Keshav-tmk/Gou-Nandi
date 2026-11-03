@echo off
title GouNandi Dairy Farm AI Launcher
echo ============================================================
echo         GouNandi Dairy Farm - Startup Launcher
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting FastAPI Backend on http://0.0.0.0:8000 ...
start "GouNandi Backend (Port 8000)" cmd /k ".\venv\Scripts\python.exe -m uvicorn src.10_api:app --host 0.0.0.0 --port 8000 --reload"

echo [2/3] Starting Vite React Frontend on http://localhost:5173 ...
start "GouNandi Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

echo Opening GouNandi Dashboard in default browser...
start http://localhost:5173/

echo.
echo ============================================================
echo All servers launched!
echo - React Dashboard : http://localhost:5173/
echo - Backend API Docs: http://localhost:8000/docs
echo ============================================================
echo.
pause
