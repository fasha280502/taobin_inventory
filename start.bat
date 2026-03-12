@echo off
title Tao Bin Inventory System
echo ============================================
echo   Tao Bin Malaysia Warehouse Inventory
echo   LAN Server for Windows 11
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: Navigate to project directory
cd /d "%~dp0"

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
    echo.
)

:: Copy .env if not exists
if not exist ".env" (
    copy ".env.example" ".env"
    echo Created .env file from template. Please update JWT_SECRET.
    echo.
)

:: Display LAN IP address
echo Your LAN IP addresses:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    echo   %%a
)
echo.
echo Starting server...
echo Access the system at http://localhost:3000
echo Other devices on LAN can access via your IP address above on port 3000
echo.
echo Press Ctrl+C to stop the server.
echo.

node server.js
pause
