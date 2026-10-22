@echo off
setlocal
set "FRONTEND_DIR=%~dp0CASMS_WebApp"
set "BACKEND_DIR=%~dp0..\CASMS_Backend"

if /i "%~1"=="--backend" goto backend
if /i "%~1"=="--frontend" goto frontend

if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Frontend not found: "%FRONTEND_DIR%"
    goto failed
)
if not exist "%BACKEND_DIR%\pom.xml" (
    echo [ERROR] Backend not found: "%BACKEND_DIR%"
    echo Keep CASMS_Frontend and CASMS_Backend in the same parent folder.
    goto failed
)

for %%T in (node.exe npm.cmd java.exe mvn.cmd) do (
    where %%T >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Missing %%T in PATH.
        echo Install Node.js 24, npm 11, JDK 21 and Maven, then reopen this file.
        goto failed
    )
)

echo [OK] Project folders and required commands found.
echo PostgreSQL must be running with the backend's configured database credentials.
echo Default database: localhost:5432/casms
echo.
if /i "%~1"=="--check" exit /b 0

start "CASMS Backend - 8080" "%ComSpec%" /d /k call "%~f0" --backend
start "CASMS Frontend - 5173" "%ComSpec%" /d /k call "%~f0" --frontend
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8080/api
echo Wait for Spring Boot to finish starting before testing API features.
echo Stop each server with Ctrl+C in its window.
exit /b 0

:backend
title CASMS Backend - 8080
cd /d "%BACKEND_DIR%"
if errorlevel 1 goto failed
call mvn.cmd spring-boot:run
exit /b %errorlevel%

:frontend
title CASMS Frontend - 5173
cd /d "%FRONTEND_DIR%"
if errorlevel 1 goto failed
if exist "node_modules\.bin\vite.cmd" goto frontend_ready
echo Installing frontend dependencies...
call npm.cmd ci
if errorlevel 1 goto failed

:frontend_ready
call npm.cmd run dev -- --port 5173 --strictPort --open
exit /b %errorlevel%

:failed
echo.
echo Startup failed. See the error above.
if /i "%~1"=="--check" exit /b 1
pause
exit /b 1
