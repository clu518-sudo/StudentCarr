@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ---------------------------------------------------------------------------
rem Stops the four services started by start-all-services.bat.
rem
rem Normal use:    stop-all-services.bat
rem Diagnostics:   stop-all-services.bat --check
rem
rem The launcher windows are stopped first so their complete npm/node process
rem trees close together. Port-owner cleanup handles services that were started
rem manually or whose terminal title changed.
rem ---------------------------------------------------------------------------

set "APP_PORT=10003"
set "BACKEND_PORT=10001"
set "AI_PORT=10002"
set "MCP_PORT=10004"

if /I "%~1"=="--check" goto check_only
if not "%~1"=="" goto usage

title StudentCarr Local Stop
echo.
echo ============================================================
echo   Stopping StudentCarr local services
echo ============================================================
echo   Only the StudentCarr service windows and ports are targeted.
echo.

rem Stop launcher-owned process trees, including their npm and Node children.
call :stop_window "StudentCarr - Frontend*"
call :stop_window "StudentCarr - AI Services*"
call :stop_window "StudentCarr - MCP Server*"
call :stop_window "StudentCarr - Backend*"

rem Give Windows a moment to release sockets before checking for leftovers.
ping.exe -n 2 127.0.0.1 >nul

set "STOP_FAILED=0"
call :stop_port "%APP_PORT%" "Frontend" || set "STOP_FAILED=1"
call :stop_port "%AI_PORT%" "AI Services" || set "STOP_FAILED=1"
call :stop_port "%MCP_PORT%" "MCP Server" || set "STOP_FAILED=1"
call :stop_port "%BACKEND_PORT%" "Backend" || set "STOP_FAILED=1"

if "%STOP_FAILED%"=="1" goto failed

echo.
echo ============================================================
echo   All StudentCarr local services are stopped
echo ============================================================
echo.
exit /b 0

:check_only
title StudentCarr Local Stop Check
echo.
echo StudentCarr local service status
echo --------------------------------
call :report_port "%BACKEND_PORT%" "Backend"
call :report_port "%MCP_PORT%" "MCP Server"
call :report_port "%AI_PORT%" "AI Services"
call :report_port "%APP_PORT%" "Frontend"
echo.
echo Check complete. Run stop-all-services.bat to stop the local stack.
exit /b 0

:stop_window
taskkill.exe /FI "WINDOWTITLE eq %~1" /T /F >nul 2>&1
exit /b 0

:stop_port
set "STOP_PORT=%~1"
set "STOP_NAME=%~2"
call :find_listener_pid "%STOP_PORT%"
if not defined LISTENER_PID (
  echo   [STOPPED] %STOP_NAME% - port %STOP_PORT% is free.
  exit /b 0
)

echo   [STOP] %STOP_NAME% - closing process !LISTENER_PID! on port %STOP_PORT%...
taskkill.exe /PID !LISTENER_PID! /T /F >nul 2>&1
if errorlevel 1 (
  echo ERROR: Could not stop %STOP_NAME% process !LISTENER_PID! on port %STOP_PORT%.
  exit /b 1
)

set /a "WAIT_COUNT=0"
:wait_for_port
call :find_listener_pid "%STOP_PORT%"
if not defined LISTENER_PID (
  echo   [STOPPED] %STOP_NAME% - port %STOP_PORT% is free.
  exit /b 0
)
set /a "WAIT_COUNT+=1"
if !WAIT_COUNT! GEQ 10 (
  echo ERROR: %STOP_NAME% did not release port %STOP_PORT% within 10 seconds.
  exit /b 1
)
ping.exe -n 2 127.0.0.1 >nul
goto wait_for_port

:find_listener_pid
set "LISTENER_PID="
for /f "tokens=5" %%P in ('netstat.exe -ano -p tcp 2^>nul ^| findstr.exe /I "LISTENING" ^| findstr.exe /C:":%~1 "') do (
  if not "%%P"=="0" set "LISTENER_PID=%%P"
)
exit /b 0

:report_port
call :find_listener_pid "%~1"
if defined LISTENER_PID (
  echo [RUNNING] %~2 on port %~1 ^(PID !LISTENER_PID!^)
) else (
  echo [STOPPED] %~2 - port %~1 is free.
)
exit /b 0

:usage
echo Usage: %~nx0 [--check]
echo.
echo Run without arguments to stop all StudentCarr local services.
echo Use --check to inspect their ports without stopping anything.
exit /b 2

:failed
echo.
echo One or more StudentCarr services could not be stopped.
echo Close its service window manually or run this file as Administrator.
exit /b 1
