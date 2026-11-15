@echo off
title SecureLearn setup
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed or not on the PATH.
  echo  Install the LTS version from https://nodejs.org, then run this file again.
  echo.
  pause
  exit /b 1
)
node setup.js %*
echo.
pause
