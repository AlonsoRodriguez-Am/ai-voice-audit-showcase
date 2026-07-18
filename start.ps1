# ============================================================
#  Call Center QA Tool - Startup Script
#  Run this script every time you want to start the project.
#  Usage: Right-click -> "Run with PowerShell"  OR  just run it in a terminal.
# ============================================================

Write-Host "===== Call Center QA Tool - Starting Up =====" -ForegroundColor Cyan

# --- Step 1: Ensure Ollama is running ---
Write-Host "[1/4] Checking Ollama status..." -ForegroundColor Yellow
$ollamaProcess = Get-Process ollama -ErrorAction SilentlyContinue
if ($ollamaProcess) {
    Write-Host "      Ollama is already running." -ForegroundColor Green
} else {
    Write-Host "      Starting Ollama in the background..." -ForegroundColor Yellow
    $ollamaPath = "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe"
    if (Test-Path $ollamaPath) {
        Start-Process $ollamaPath -ArgumentList "serve" -WindowStyle Hidden
        Start-Sleep -Seconds 3
        Write-Host "      Ollama started." -ForegroundColor Green
    } else {
        Write-Host "      WARNING: Ollama not found. Install it from https://ollama.com/download" -ForegroundColor Red
    }
}

# --- Step 2: Kill any existing Python processes to free up GPU memory ---
$existing = Get-Process python -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[2/4] Stopping existing Python processes to free GPU memory..." -ForegroundColor Yellow
    Stop-Process -Name python -Force
    Start-Sleep -Seconds 2
    Write-Host "      Done." -ForegroundColor Green
}
else {
    Write-Host "[2/4] No existing Python processes found. Good." -ForegroundColor Green
}

# --- Step 3: Start the PostgreSQL database service ---
Write-Host "[3/4] Starting PostgreSQL service..." -ForegroundColor Yellow
$svc = Get-Service postgresql-x64-17 -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -ne 'Running') {
    Start-Service postgresql-x64-17
    Start-Sleep -Seconds 3
    Write-Host "      PostgreSQL started." -ForegroundColor Green
}
elseif ($svc -and $svc.Status -eq 'Running') {
    Write-Host "      PostgreSQL is already running." -ForegroundColor Green
}
else {
    Write-Host "      WARNING: Could not find PostgreSQL service. Make sure it's installed." -ForegroundColor Red
}

# --- Step 4: Start the FastAPI application ---
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Ethernet|Wi-Fi|WLAN' -and $_.IPAddress -notlike '169.*' } | Select-Object -First 1).IPAddress
Write-Host "[4/4] Starting the FastAPI app..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  >>> Local access:    http://localhost:5000" -ForegroundColor Green
if ($localIP) {
    Write-Host "  >>> Network access:  http://${localIP}:5000" -ForegroundColor Cyan
    Write-Host "  (Share this URL with other devices on the same network)" -ForegroundColor DarkGray
}
Write-Host ""
Write-Host "  Press CTRL+C to stop the server." -ForegroundColor DarkGray
Write-Host "=============================================" -ForegroundColor Cyan

Set-Location $PSScriptRoot
uvicorn app.main:app --host 0.0.0.0 --port 5000
