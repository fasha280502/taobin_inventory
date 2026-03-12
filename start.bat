@echo off
title Tao Bin Malaysia - Warehouse Inventory System

echo.
echo  ╔═══════════════════════════════════════════════════════╗
echo  ║      TAO BIN MALAYSIA - WAREHOUSE INVENTORY SYSTEM   ║
echo  ╚═══════════════════════════════════════════════════════╝
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo  [ERROR] Node.js is not installed!
    echo  Please install Node.js from: https://nodejs.org/
    echo  Download the LTS version and install it, then run this script again.
    pause
    exit /b 1
)

:: Display Node.js version
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo  Node.js version: %NODE_VER%
echo.

:: Navigate to the script directory
cd /d "%~dp0"

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo  [INFO] Installing dependencies...
    call npm install --production
    if %ERRORLEVEL% neq 0 (
        echo  [ERROR] Failed to install dependencies!
        pause
        exit /b 1
    )
    echo  [INFO] Dependencies installed successfully.
    echo.
)

:: Create data directory if it doesn't exist
if not exist "data" mkdir data

:: Get LAN IP addresses
echo  [INFO] Starting server...
echo.

:: Start the server
node server.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo  [ERROR] Server stopped with an error.
    pause
)
