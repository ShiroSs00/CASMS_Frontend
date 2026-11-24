@echo off
setlocal
cd /d "%~dp0" || exit /b 1
where node.exe >nul 2>&1 || (echo Node.js 22.18 or newer is required.& exit /b 2)
where npm.cmd >nul 2>&1 || (echo npm.cmd is required.& exit /b 2)
if not exist package.json (echo CASMS_MobileApp was not found.& exit /b 2)
if /i "%~1"=="--qa" (
  call npm.cmd run test:qa
) else if "%~1"=="" (
  call npm.cmd run typecheck && call npm.cmd run lint && call npm.cmd test
) else (
  echo Usage: run-mobile-tests.bat [--qa]
  exit /b 2
)
exit /b %errorlevel%
