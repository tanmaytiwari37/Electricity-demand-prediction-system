# Start the API and the dashboard in two windows (Windows PowerShell).
#   .\scripts\dev.ps1
$root = Split-Path -Parent $PSScriptRoot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root'; python -m uvicorn backend.main:app --reload --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"
Write-Host "API:       http://localhost:8000/docs"
Write-Host "Dashboard: http://localhost:5173"
