@echo off
setlocal
call "%~dp0start-mobile.bat" --android
exit /b %errorlevel%
