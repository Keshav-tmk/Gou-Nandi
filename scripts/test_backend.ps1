# ==============================================================================
# Smart Livestock Monitoring System - Automated Test Script
# ==============================================================================
[CmdletBinding()]
param (
    [switch]$LiveServer
)

$ErrorActionPreference = "Stop"

# 1. Resolve Project Root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."
Set-Location $ProjectRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Smart Livestock Monitoring - Automated Test Runner" -ForegroundColor Cyan
Write-Host "Project Root: $ProjectRoot" -ForegroundColor DarkGray
Write-Host "============================================================" -ForegroundColor Cyan

# 2. Locate Python Virtual Environment
$PythonExe = "$ProjectRoot\.venv312\Scripts\python.exe"
if (-not (Test-Path $PythonExe)) {
    $PythonExe = "$ProjectRoot\.venv\Scripts\python.exe"
}

if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Virtual environment not found at $ProjectRoot." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Using Python: $PythonExe" -ForegroundColor Green

# 3. Run Pytest Automated Suite
Write-Host "`n[PHASE 1] Running Pytest Unit & Integration Tests..." -ForegroundColor Cyan
$PytestExe = "$ProjectRoot\.venv312\Scripts\pytest.exe"
if (-not (Test-Path $PytestExe)) {
    $PytestExe = "$ProjectRoot\.venv\Scripts\pytest.exe"
}

& $PytestExe tests\ -v
$PytestExit = $LASTEXITCODE

if ($PytestExit -ne 0) {
    Write-Host "`n[FAIL] Automated Pytest suite failed with code $PytestExit." -ForegroundColor Red
    exit $PytestExit
}
Write-Host "`n[PASS] All Pytest automated test cases passed successfully." -ForegroundColor Green

# 4. Optional Live Server Tests
if ($LiveServer) {
    Write-Host "`n[PHASE 2] Running Live HTTP Client Verification (test_api.py)..." -ForegroundColor Cyan
    & $PythonExe test_api.py
    $LiveExit = $LASTEXITCODE
    if ($LiveExit -ne 0) {
        Write-Host "`n[FAIL] Live server test failed." -ForegroundColor Red
        exit $LiveExit
    }
    Write-Host "`n[PASS] Live server tests passed." -ForegroundColor Green
} else {
    Write-Host "`n[NOTE] To run live HTTP requests against a running server, start the server in another window:" -ForegroundColor DarkGray
    Write-Host "  .\scripts\start_backend.ps1" -ForegroundColor DarkGray
    Write-Host "Then execute:" -ForegroundColor DarkGray
    Write-Host "  .\scripts\test_backend.ps1 -LiveServer" -ForegroundColor DarkGray
}

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "TEST SUITE COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
