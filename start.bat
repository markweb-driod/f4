@echo off
title SecureLearn server
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed. Install it from https://nodejs.org and run setup.bat first.
  pause
  exit /b 1
)
if not exist "server\.env" (
  echo  SecureLearn has not been set up yet. Run setup.bat first.
  pause
  exit /b 1
)
if not exist "client\dist\index.html" (
  echo  The web interface has not been built yet. Run setup.bat first.
  pause
  exit /b 1
)
echo  Starting SecureLearn. Keep this window open while you use the system.
echo  Close this window (or press Ctrl+C) to stop the server.
echo.
node server\src\server.js
echo.
pause
