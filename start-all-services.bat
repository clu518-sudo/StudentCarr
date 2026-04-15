@echo off
setlocal

set "ROOT=%~dp0"

echo Starting App, Backend, and AIServices...

start "App" cmd /k "cd /d "%ROOT%App" && npm run dev"
start "Backend" cmd /k "cd /d "%ROOT%Backend" && npm run dev"
start "AIServices" cmd /k "cd /d "%ROOT%AIServices" && npm run dev"

echo All services launched in separate terminals.
endlocal
