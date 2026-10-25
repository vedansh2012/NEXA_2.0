@echo off
setlocal
title Stop NEXA 2.0
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /PID %%P /F >nul 2>nul
echo NEXA processes using port 3000 have been stopped.
pause
