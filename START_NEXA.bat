@echo off
setlocal
cd /d "%~dp0"
title NEXA 2.0

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install Node.js 20+ and run this file again.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installing NEXA dependencies...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

if not exist ".env" (
  echo.
  echo NEXA needs your OpenRouter API key.
  echo The key is stored only in this local .env file and is NOT uploaded by this script.
  echo.
  set /p "OR_KEY=Paste your OpenRouter API key (input will be visible): "
  if not defined OR_KEY (
    echo No key entered. NEXA cannot start AI chat without it.
    pause
    exit /b 1
  )
  >".env" echo OPENROUTER_API_KEY=%OR_KEY%
  >>".env" echo OPENROUTER_MODEL=openrouter/free
  >>".env" echo PORT=3000
  set "OR_KEY="
)

echo.
echo Starting NEXA 2.0...
echo Open http://localhost:3000 in your browser.
echo Keep this window open while using NEXA.
echo.
start "" http://localhost:3000
call npm.cmd start
pause
