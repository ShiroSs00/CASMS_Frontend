@echo off
setlocal
call "%~dp0start-mobile.bat" --web
exit /b %errorlevel%
