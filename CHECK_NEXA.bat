@echo off
setlocal
cd /d "%~dp0"
title NEXA 2.0 - Check
where node >nul 2>nul || (echo Node.js is missing.&pause&exit /b 1)
node --check server.js || (echo server.js has a syntax error.&pause&exit /b 1)
if exist public\js\app.js node --check public\js\app.js || (echo app.js has a syntax error.&pause&exit /b 1)
echo.
echo Syntax checks passed.
echo Checking server status if it is already running...
node -e "fetch('http://localhost:3000/api/status').then(async r=>console.log('HTTP:',r.status,await r.text())).catch(()=>console.log('Server is not currently running.'))"
echo.
pause
