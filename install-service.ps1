# Tao Bin Inventory – Service Installer for Windows 11
# Run this script as Administrator to install the app as a Windows Service
# Requires: nssm (Non-Sucking Service Manager)

param(
    [string]$Action = "install",
    [string]$ServiceName = "TaoBinInventory",
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║      TAO BIN MALAYSIA - WAREHOUSE INVENTORY SYSTEM   ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

if ($Action -eq "install") {
    # Check if Node.js is installed
    if (-not $NodePath) {
        Write-Host "  [ERROR] Node.js is not installed. Please install from https://nodejs.org/" -ForegroundColor Red
        exit 1
    }
    Write-Host "  [INFO] Node.js found: $NodePath" -ForegroundColor Green

    # Install npm dependencies
    Write-Host "  [INFO] Installing npm dependencies..." -ForegroundColor Yellow
    Push-Location $ScriptDir
    npm install --production
    Pop-Location

    # Check if nssm is available
    $nssmPath = (Get-Command nssm -ErrorAction SilentlyContinue)
    $nssmPath = if ($nssmPath) { $nssmPath.Source } else { $null }
    if (-not $nssmPath) {
        Write-Host "  [INFO] nssm not found. Downloading..." -ForegroundColor Yellow
        $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
        $nssmZip = "$env:TEMP\nssm.zip"
        $nssmDir = "$env:TEMP\nssm"
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
        Expand-Archive -Path $nssmZip -DestinationPath $nssmDir -Force
        $nssmPath = "$nssmDir\nssm-2.24\win64\nssm.exe"
    }

    # Install as Windows Service
    Write-Host "  [INFO] Installing Windows Service: $ServiceName" -ForegroundColor Yellow
    & $nssmPath install $ServiceName $NodePath "$ScriptDir\server.js"
    & $nssmPath set $ServiceName AppDirectory $ScriptDir
    & $nssmPath set $ServiceName AppEnvironmentExtra "PORT=$Port"
    & $nssmPath set $ServiceName DisplayName "Tao Bin Inventory System"
    & $nssmPath set $ServiceName Description "LAN Warehouse Inventory System for Tao Bin Malaysia"
    & $nssmPath set $ServiceName Start SERVICE_AUTO_START
    & $nssmPath set $ServiceName AppStdout "$ScriptDir\logs\service.log"
    & $nssmPath set $ServiceName AppStderr "$ScriptDir\logs\service-error.log"

    # Create logs directory
    New-Item -ItemType Directory -Force -Path "$ScriptDir\logs" | Out-Null

    # Start the service
    & $nssmPath start $ServiceName
    Write-Host "  [SUCCESS] Service installed and started!" -ForegroundColor Green
    Write-Host "  [INFO] Access at: http://localhost:$Port" -ForegroundColor Cyan

} elseif ($Action -eq "uninstall") {
    Write-Host "  [INFO] Removing service: $ServiceName" -ForegroundColor Yellow
    $nssmCmd = Get-Command nssm -ErrorAction SilentlyContinue
    if ($nssmCmd) {
        & $nssmCmd.Source stop $ServiceName
        & $nssmCmd.Source remove $ServiceName confirm
    } else {
        sc.exe delete $ServiceName
    }
    Write-Host "  [SUCCESS] Service removed!" -ForegroundColor Green

} elseif ($Action -eq "start") {
    Start-Service -Name $ServiceName
    Write-Host "  [SUCCESS] Service started!" -ForegroundColor Green

} elseif ($Action -eq "stop") {
    Stop-Service -Name $ServiceName
    Write-Host "  [SUCCESS] Service stopped!" -ForegroundColor Green

} else {
    Write-Host "  Usage: .\install-service.ps1 -Action [install|uninstall|start|stop]" -ForegroundColor Yellow
}
