@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem ---------------------------------------------------------------------------
rem StudentCarr local development launcher (Windows, no Docker required)
rem
rem Normal use:    start-all-services.bat
rem Diagnostics:   start-all-services.bat --check
rem
rem The parent process validates and prepares the local environment, then opens
rem one terminal per service. Child terminals call this same file with --run so
rem paths containing spaces are handled safely and service commands stay in one
rem maintainable place.
rem ---------------------------------------------------------------------------

set "ROOT=%~dp0"
set "APP_PORT=10003"
set "BACKEND_PORT=10001"
set "AI_PORT=10002"
set "MCP_PORT=10004"

if /I "%~1"=="--run" goto run_service
if /I "%~1"=="--check" goto check_only
if not "%~1"=="" goto usage

title StudentCarr Local Launcher
cd /d "%ROOT%" || goto root_error

echo.
echo ============================================================
echo   StudentCarr local development environment
echo ============================================================
echo   Docker is not used by this launcher.
echo.

call :check_node || goto failed
call :check_project_files || goto failed
call :warn_missing_env

echo [1/5] Checking Node.js dependencies...
call :ensure_npm_dependencies "App" "node_modules\.bin\vite.cmd" || goto failed
call :ensure_npm_dependencies "Backend" "node_modules\.bin\nodemon.cmd" || goto failed
call :ensure_npm_dependencies "AIServices" "node_modules\.bin\tsx.cmd" || goto failed
call :ensure_npm_dependencies "mcp-server" "node_modules\@modelcontextprotocol\sdk\package.json" || goto failed

echo.
echo [2/5] Preparing the local SQLite database...
call :url_ready "http://127.0.0.1:%BACKEND_PORT%/health"
if not errorlevel 1 (
  echo   [SKIP] Backend is already healthy; database preparation is already complete.
) else (
  pushd "%ROOT%Backend" || goto failed
  call npx.cmd --no-install prisma generate
  if errorlevel 1 (
    popd
    echo ERROR: Prisma client generation failed.
    goto failed
  )
  call npx.cmd --no-install prisma migrate deploy
  if errorlevel 1 (
    popd
    echo ERROR: Prisma migrations failed.
    goto failed
  )
  popd
)

echo.
echo [3/5] Starting Backend and MCP services...
call :start_or_reuse "Backend" "%BACKEND_PORT%" "http://127.0.0.1:%BACKEND_PORT%/health" "backend" || goto failed
call :start_or_reuse "MCP Server" "%MCP_PORT%" "http://127.0.0.1:%MCP_PORT%/health" "mcp" || goto failed

echo.
echo [4/5] Starting AI Services...
call :start_or_reuse "AI Services" "%AI_PORT%" "http://127.0.0.1:%AI_PORT%/health" "ai" || goto failed

echo.
echo [5/5] Starting the frontend...
call :start_or_reuse "Frontend" "%APP_PORT%" "http://127.0.0.1:%APP_PORT%/" "app" || goto failed

echo.
echo ============================================================
echo   StudentCarr is ready
echo ============================================================
echo   Frontend:  http://127.0.0.1:%APP_PORT%
echo   Backend:   http://127.0.0.1:%BACKEND_PORT%
echo   AI:        http://127.0.0.1:%AI_PORT%
echo   MCP:       http://127.0.0.1:%MCP_PORT%
echo.
echo Close the individual service windows, or press Ctrl+C in each one,
echo to stop the local environment.
echo.
exit /b 0

:check_only
title StudentCarr Local Check
cd /d "%ROOT%" || goto root_error
echo.
echo StudentCarr local environment check
echo ------------------------------------
call :check_node || goto failed
call :check_project_files || goto failed
call :warn_missing_env
call :report_dependency "App" "node_modules\.bin\vite.cmd"
call :report_dependency "Backend" "node_modules\.bin\nodemon.cmd"
call :report_dependency "AIServices" "node_modules\.bin\tsx.cmd"
call :report_dependency "mcp-server" "node_modules\@modelcontextprotocol\sdk\package.json"
call :report_all_ports
echo.
echo Check complete. Run start-all-services.bat to start the stack.
exit /b 0

:run_service
if /I "%~2"=="backend" goto run_backend
if /I "%~2"=="mcp" goto run_mcp
if /I "%~2"=="ai" goto run_ai
if /I "%~2"=="app" goto run_app
echo ERROR: Unknown service "%~2".
exit /b 1

:run_backend
title StudentCarr - Backend
cd /d "%ROOT%Backend" || goto service_path_error
set "NODE_ENV=development"
set "PORT=%BACKEND_PORT%"
set "APP_BASE_URL=http://127.0.0.1:%APP_PORT%"
set "CORS_ORIGIN=http://localhost:%APP_PORT%,http://127.0.0.1:%APP_PORT%"
set "PROGRESS_TRACKING_SERVICE_BASE_URL=http://127.0.0.1:%AI_PORT%"
call npm.cmd run dev
goto service_stopped

:run_mcp
title StudentCarr - MCP Server
cd /d "%ROOT%mcp-server" || goto service_path_error
set "MCP_HOST=127.0.0.1"
set "MCP_PORT=%MCP_PORT%"
set "STUDENTCARR_API_URL=http://127.0.0.1:%BACKEND_PORT%"
call npm.cmd run dev
goto service_stopped

:run_ai
title StudentCarr - AI Services
cd /d "%ROOT%AIServices" || goto service_path_error
set "LANGGRAPH_HOST=127.0.0.1"
set "LANGGRAPH_PORT=%AI_PORT%"
set "MCP_SERVER_URL=http://127.0.0.1:%MCP_PORT%"
call npm.cmd run dev
goto service_stopped

:run_app
title StudentCarr - Frontend
cd /d "%ROOT%App" || goto service_path_error
set "VITE_API_BASE_URL=http://127.0.0.1:%BACKEND_PORT%/api"
call npm.cmd run dev -- --host 127.0.0.1 --port %APP_PORT% --strictPort
goto service_stopped

:service_stopped
set "SERVICE_EXIT=%ERRORLEVEL%"
echo.
echo The service stopped with exit code %SERVICE_EXIT%.
echo Review the output above before closing this window.
exit /b %SERVICE_EXIT%

:service_path_error
echo ERROR: Could not open the service directory.
exit /b 1

:check_node
where node.exe >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js was not found. Install Node.js 20 or newer and try again.
  exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm was not found. Reinstall Node.js with npm enabled.
  exit /b 1
)
set "NODE_MAJOR="
for /f "usebackq delims=" %%V in (`node -p "process.versions.node.split('.')[0]" 2^>nul`) do set "NODE_MAJOR=%%V"
if not defined NODE_MAJOR (
  echo ERROR: Could not determine the installed Node.js version.
  exit /b 1
)
if %NODE_MAJOR% LSS 20 (
  echo ERROR: Node.js 20 or newer is required. Found:
  node --version
  exit /b 1
)
for /f "usebackq delims=" %%V in (`node --version`) do echo [OK] Node.js %%V
exit /b 0

:check_project_files
for %%D in (App Backend AIServices mcp-server) do (
  if not exist "%ROOT%%%D\package.json" (
    echo ERROR: Missing "%ROOT%%%D\package.json".
    exit /b 1
  )
)
if not exist "%ROOT%Backend\prisma\schema.prisma" (
  echo ERROR: Missing Backend\prisma\schema.prisma.
  exit /b 1
)
echo [OK] Project structure found at "%ROOT%"
exit /b 0

:warn_missing_env
if not exist "%ROOT%Backend\.env" echo [WARN] Backend\.env is missing; development defaults will be used.
if not exist "%ROOT%AIServices\.env" echo [WARN] AIServices\.env is missing; AI features need provider credentials.
if not exist "%ROOT%App\.env" echo [INFO] App\.env is missing; the launcher will supply the local API URL.
exit /b 0

:ensure_npm_dependencies
set "SERVICE_DIR=%~1"
set "DEPENDENCY_MARKER=%~2"
if exist "%ROOT%!SERVICE_DIR!\!DEPENDENCY_MARKER!" (
  echo   [OK] !SERVICE_DIR!
  exit /b 0
)
echo   [SETUP] Installing !SERVICE_DIR! dependencies with npm ci...
pushd "%ROOT%!SERVICE_DIR!" || exit /b 1
call npm.cmd ci
set "INSTALL_RESULT=!ERRORLEVEL!"
popd
if not "!INSTALL_RESULT!"=="0" (
  echo ERROR: npm ci failed in !SERVICE_DIR!.
  exit /b 1
)
if not exist "%ROOT%!SERVICE_DIR!\!DEPENDENCY_MARKER!" (
  echo ERROR: !SERVICE_DIR! dependencies are still incomplete after npm ci.
  exit /b 1
)
echo   [OK] !SERVICE_DIR!
exit /b 0

:start_or_reuse
set "SERVICE_NAME=%~1"
set "SERVICE_PORT=%~2"
set "HEALTH_URL=%~3"
set "SERVICE_KEY=%~4"
call :url_ready "!HEALTH_URL!"
if not errorlevel 1 (
  echo   [READY] !SERVICE_NAME! is already running on port !SERVICE_PORT!.
  exit /b 0
)
call :port_open "!SERVICE_PORT!"
if not errorlevel 1 (
  echo ERROR: Port !SERVICE_PORT! is already used by something other than a healthy !SERVICE_NAME! service.
  exit /b 1
)
rem A free port intentionally leaves ERRORLEVEL set to 1. Clear it before START,
rem because START may preserve the previous code even when the window opens.
call :clear_errorlevel
start "StudentCarr - !SERVICE_NAME!" cmd.exe /d /k call "%~f0" --run "!SERVICE_KEY!"
if errorlevel 1 (
  echo ERROR: Could not open the !SERVICE_NAME! terminal.
  exit /b 1
)
call :wait_for_url "!HEALTH_URL!" "!SERVICE_NAME!" 60
exit /b !ERRORLEVEL!

:clear_errorlevel
exit /b 0

:wait_for_url
set "WAIT_URL=%~1"
set "WAIT_NAME=%~2"
set /a "WAIT_LIMIT=%~3"
set /a "WAIT_COUNT=0"
:wait_for_url_loop
call :url_ready "%WAIT_URL%"
if not errorlevel 1 (
  echo   [READY] %WAIT_NAME%
  exit /b 0
)
set /a WAIT_COUNT+=1
if !WAIT_COUNT! GEQ !WAIT_LIMIT! (
  echo ERROR: !WAIT_NAME! did not become ready within !WAIT_LIMIT! seconds.
  echo        Review the "StudentCarr - !WAIT_NAME!" window for details.
  exit /b 1
)
rem TIMEOUT fails when this launcher is run by a terminal that redirects stdin.
rem Two localhost pings provide the same one-second pause without reading input.
ping.exe -n 2 127.0.0.1 >nul
goto wait_for_url_loop

:url_ready
node -e "fetch(process.argv[1],{signal:AbortSignal.timeout(2000)}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" "%~1" >nul 2>&1
exit /b %ERRORLEVEL%

:port_open
node -e "const net=require('node:net');const s=net.connect(Number(process.argv[1]),'127.0.0.1');s.setTimeout(700);s.once('connect',()=>{s.destroy();process.exit(0)});s.once('error',()=>process.exit(1));s.once('timeout',()=>{s.destroy();process.exit(1)})" "%~1" >nul 2>&1
exit /b %ERRORLEVEL%

:report_dependency
if exist "%ROOT%%~1\%~2" (
  echo [OK] %~1 dependencies
) else (
  echo [SETUP] %~1 dependencies will be installed on first start.
)
exit /b 0

:report_all_ports
for %%P in (%BACKEND_PORT% %MCP_PORT% %AI_PORT% %APP_PORT%) do (
  call :port_open "%%P"
  if errorlevel 1 (
    echo [FREE] Port %%P
  ) else (
    echo [IN USE] Port %%P
  )
)
exit /b 0

:usage
echo Usage: %~nx0 [--check]
echo.
echo Run without arguments to prepare and start all local services.
echo Use --check to inspect prerequisites without installing or starting anything.
exit /b 2

:root_error
echo ERROR: Could not open the project root "%ROOT%".
exit /b 1

:failed
echo.
echo StudentCarr did not finish starting. Fix the error above and run this file again.
exit /b 1
