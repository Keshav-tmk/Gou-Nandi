# ==============================================================================
# Smart Livestock Monitoring System - Backend Startup Script
# ==============================================================================
[CmdletBinding()]
param (
    [string]$HostAddress = "0.0.0.0",
    [int]$Port = 8000,
    [switch]$Reload,
    [switch]$KillExisting
)

$ErrorActionPreference = "Stop"

# 1. Resolve Project Root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."
Set-Location $ProjectRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Starting Smart Livestock Monitoring Backend Server" -ForegroundColor Cyan
Write-Host "Project Root: $ProjectRoot" -ForegroundColor DarkGray
Write-Host "============================================================" -ForegroundColor Cyan

# 2. Locate Python Virtual Environment
$PythonExe = "$ProjectRoot\.venv312\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "$ProjectRoot\.venv\Scripts\python.exe"
}

if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Neither .venv312 nor .venv was found at $ProjectRoot." -ForegroundColor Red
    Write-Host "Please create the virtual environment using Python 3.12:" -ForegroundColor Yellow
    Write-Host "  py -3.12 -m venv .venv312" -ForegroundColor Yellow
    Write-Host "  .\.venv312\Scripts\python.exe -m pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Using Python: $PythonExe" -ForegroundColor Green
$PyVer = & $PythonExe --version 2>&1
Write-Host "[INFO] Python Version: $PyVer" -ForegroundColor DarkGray

# 3. Check Port Availability
$PortOccupied = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($PortOccupied) {
    $OccupiedPid = $PortOccupied[0].OwningProcess
    $ProcName = (Get-Process -Id $OccupiedPid -ErrorAction SilentlyContinue).ProcessName
    if ($KillExisting) {
        Write-Host "[INFO] Terminating conflicting process $OccupiedPid ($ProcName) on port $Port..." -ForegroundColor Yellow
        Stop-Process -Id $OccupiedPid -Force
        Start-Sleep -Seconds 1
    } else {
        Write-Host "[ERROR] Port $Port is already in use by process ID $OccupiedPid ($ProcName)." -ForegroundColor Red
        Write-Host "To automatically stop the conflicting process, run:" -ForegroundColor Yellow
        Write-Host "  .\scripts\start_backend.ps1 -KillExisting" -ForegroundColor Yellow
        Write-Host "Or specify a different port:" -ForegroundColor Yellow
        Write-Host "  .\scripts\start_backend.ps1 -Port 8001" -ForegroundColor Yellow
        exit 1
    }
}

# 4. Verify Model Files
$ModelsDir = "$ProjectRoot\models"
$ReqModels = @(
    "$ModelsDir\cow_behaviour_random_forest.joblib",
    "$ModelsDir\cow_activity_isolation_forest.joblib"
)
foreach ($m in $ReqModels) {
    if (-not (Test-Path $m)) {
        Write-Host "[ERROR] Required model file missing: $m" -ForegroundColor Red
        exit 1
    }
}
Write-Host "[INFO] Core models verified in $ModelsDir" -ForegroundColor Green

# 5. Pre-flight Import Check
Write-Host "[INFO] Performing pre-flight import check..." -ForegroundColor DarkGray
$Preflight = & $PythonExe -c "import importlib; api = importlib.import_module('src.10_api'); print('App verified:', api.app.title)" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Pre-flight import failed:" -ForegroundColor Red
    Write-Host $Preflight -ForegroundColor Red
    exit $LASTEXITCODE
}
Write-Host "[INFO] Pre-flight checks passed." -ForegroundColor Green

# 6. Launch Uvicorn Server
Write-Host "[INFO] Starting Uvicorn on http://$HostAddress`:$Port" -ForegroundColor Cyan
Write-Host "[INFO] Press Ctrl+C to stop the server.`n" -ForegroundColor DarkGray

$UvicornArgs = @("-m", "uvicorn", "src.10_api:app", "--host", $HostAddress, "--port", "$Port")
if ($Reload) {
    $UvicornArgs += "--reload"
}

& $PythonExe $UvicornArgs
exit $LASTEXITCODE
