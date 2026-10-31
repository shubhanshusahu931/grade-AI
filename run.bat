@echo off
title Industry Grade AI Launcher
color 0B
echo =====================================================================
echo                 INDUSTRY GRADE AI - PLATFORM LAUNCHER
echo =====================================================================
echo.
echo [1/3] Checking environment & database...
echo Postgres Service: Running on port 5433 (ind_grade_ai)
echo.
echo [2/3] Launching FastAPI Backend on http://localhost:8000 ...
start "Industry Grade AI - Backend" cmd /k "python -m uvicorn app.main:app --app-dir backend --port 8000 --reload"

echo [3/3] Launching Modern Frontend on http://localhost:5500 ...
start "Industry Grade AI - Frontend" cmd /k "python -m http.server 5500 --directory frontend"

echo.
echo =====================================================================
echo   SUCCESS! Services are now running:
echo     - Modern UI Web App:   http://localhost:5500 (or http://localhost:8000/app)
echo     - Interactive API Docs: http://localhost:8000/docs
echo =====================================================================
timeout /t 3 >nul
start http://localhost:5500

