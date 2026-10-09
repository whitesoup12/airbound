@echo off
title Airbound - MSFS 2024 Career Tracker
echo ========================================================
echo   AIRBOUND - MSFS 2024 Career & Logbook Tracker
echo   Desktop Standalone Mode
echo ========================================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo [ERROR] Node.js is not installed or not in your PATH.
  echo Please download and install Node.js (LTS version) from:
  echo   https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: Install dependencies if node_modules is missing
if not exist "node_modules\" (
  echo [Setup] First time launch detected. Installing project dependencies...
  call npm install
  if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

:: Launch Airbound Desktop (embedded persistent DB, direct SimConnect, browser auto-launch)
echo [Airbound] Launching Airbound Desktop on http://localhost:3001...
call npm start

pause
