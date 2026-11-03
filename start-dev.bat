@echo off
setlocal
if /i "%~1"=="--booking" goto booking
if /i "%~1"=="--admin" goto admin
echo Choose an independent application:
echo   start-dev.bat --booking   http://localhost:5173
echo   start-dev.bat --admin     http://localhost:5174
echo Install dependencies manually with npm ci inside the chosen app first.
echo The backend is managed separately. CASMS_WebApp is legacy only.
exit /b 0

:booking
set "CASMS_WEB_TARGET=%~dp0CASMS_WebBooking"
goto run

:admin
set "CASMS_WEB_TARGET=%~dp0CASMS_WebAdmin"

:run
cd /d "%CASMS_WEB_TARGET%"
if not exist "node_modules\.bin\vite.cmd" (
  echo Dependencies are missing. Run npm ci in "%CASMS_WEB_TARGET%" first.
  exit /b 1
)
call npm.cmd run dev
exit /b %errorlevel%
