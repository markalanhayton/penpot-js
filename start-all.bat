@echo off
REM ============================================================================
REM start-all.bat - Penpot JS port: shutdown + relaunch client and server
REM Usage: .\start-all.bat
REM ============================================================================

setlocal EnableDelayedExpansion

set ROOT=%~dp0
if %ROOT:~-1%==\ set ROOT=%ROOT:~0,-1%
set SERVER_DIR=%ROOT%\server
set CLIENT_DIR=%ROOT%\client

echo.
echo ============================================================
echo  Penpot JS port - restart client and server
echo  Project root: %ROOT%
echo ============================================================
echo.

echo [1 of 3] Shutting down existing processes on ports 3449 6060 6061...

call :kill_port 3449
call :kill_port 6060
call :kill_port 6061
echo.

echo [2 of 3] Launching backend server in a new terminal on port 6060...
start "Penpot Server" cmd /k "cd /d "%SERVER_DIR%" && echo === Penpot Server http://localhost:6060 === && node src/index.js"

echo [3 of 3] Launching frontend dev server in a new terminal on port 3449...
start "Penpot Client" cmd /k "cd /d "%CLIENT_DIR%" && echo === Penpot Client http://localhost:3449 === && node server.js"

echo.
echo Both terminals launched.
echo   Backend:  http://localhost:6060
echo   Frontend: http://localhost:3449
echo.
echo Close each terminal window to stop the corresponding process.
echo Re-run this script to restart both.
echo.

endlocal
exit /b 0

REM ---------------------------------------------------------------------------
REM :kill_port <port> - kill whatever is listening on the given port
REM ---------------------------------------------------------------------------
:kill_port
for /f "tokens=5" %%P in ('netstat -aon ^| findstr /i LISTENING ^| findstr ":%~1 "') do (
    if not "%%P"=="0" if not "%%P"=="" (
        echo     killing PID %%P on port %~1
        taskkill /F /PID %%P 1>nul 2>nul
    )
)
exit /b 0