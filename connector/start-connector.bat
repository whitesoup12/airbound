@echo off
title Airbound MSFS 2024 / 2020 Connector
color 0b

echo ===================================================================
echo     AIRBOUND • MSFS Local Telemetry Bridge Launcher
echo ===================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0c
    echo [ERROR] Node.js is not found in your system PATH!
    echo Please install Node.js from https://nodejs.org and try again.
    echo.
    pause
    exit /b 1
)

if not exist node_modules (
    echo [INFO] First time launch: Installing connector dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        color 0c
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo [INFO] Installation complete!
    echo.
)

echo Starting Airbound Connector...
node index.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [INFO] Connector process stopped with code %ERRORLEVEL%.
    pause
)
