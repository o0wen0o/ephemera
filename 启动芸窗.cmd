@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "EPHEMERA_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "EPHEMERA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "node_modules\vite\bin\vite.js" (
  echo 请先在这个目录运行 pnpm install，再打开芸窗。
  pause
  exit /b 1
)
echo 芸窗正在打开。关闭此窗口会停止预览服务。
start "" "http://localhost:5173/prototype?variant=A"
"%EPHEMERA_NODE%" "node_modules\vite\bin\vite.js" --host 0.0.0.0
