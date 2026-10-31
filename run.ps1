# Industry Grade AI - PowerShell Launcher
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "                INDUSTRY GRADE AI - PLATFORM LAUNCHER" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan

Write-Host "`n[1/3] Starting FastAPI Backend on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn app.main:app --app-dir backend --port 8000 --reload"

Write-Host "[2/3] Starting Modern Frontend on http://localhost:5500 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m http.server 5500 --directory frontend"

Write-Host "`n[3/3] Opening browser..." -ForegroundColor Green
Start-Sleep -Seconds 3
Start-Process "http://localhost:5500"

Write-Host "`n=====================================================================" -ForegroundColor Green
Write-Host "  SUCCESS! Services running at:" -ForegroundColor Green
Write-Host "    - Frontend: http://localhost:5500 (or http://localhost:8000/app)" -ForegroundColor White
Write-Host "    - Swagger Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "=====================================================================" -ForegroundColor Green

