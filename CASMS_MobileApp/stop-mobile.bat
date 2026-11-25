@echo off
setlocal
cd /d "%~dp0" || exit /b 1
where node.exe >nul 2>&1 || (echo Node.js is required.& exit /b 2)
node scripts/stop-mobile.mjs
exit /b %errorlevel%
