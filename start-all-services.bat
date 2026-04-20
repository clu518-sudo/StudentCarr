@echo off
setlocal

set "ROOT=%~dp0"

echo Starting App, Backend, and AIServices...

start "App" cmd /k "cd /d "%ROOT%App" && npm run dev -- --host 127.0.0.1 --port 10003 --strictPort"
start "Backend" cmd /k "cd /d "%ROOT%Backend" && set PORT=10001 && npm run dev"
start "AIServices" cmd /k "cd /d "%ROOT%AIServices" && set LANGGRAPH_PORT=10002 && npm run dev"

echo All services launched in separate terminals.
endlocal
