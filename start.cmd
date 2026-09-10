@echo off
setlocal
cd /d "%~dp0"
set "EPHEMERA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%EPHEMERA_NODE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo ERROR: Node.js was not found. Install Node.js 22.12 or newer.
    pause
    exit /b 1
  )
  set "EPHEMERA_NODE=node"
)
if not exist "node_modules\vite\bin\vite.js" (
  echo ERROR: Project dependencies are missing.
  echo Please restore the dependencies before starting Ephemera.
  pause
  exit /b 1
)
echo Starting Ephemera. Keep this window open while using the app.
echo App: http://localhost:5173/
"%EPHEMERA_NODE%" "node_modules\vite\bin\vite.js" --host 0.0.0.0 --open /
set "EPHEMERA_EXIT=%ERRORLEVEL%"
if not "%EPHEMERA_EXIT%"=="0" (
  echo.
  echo Startup failed. The error message is shown above.
  echo If port 5173 is in use, open the existing preview address above.
  pause
)
exit /b %EPHEMERA_EXIT%
