@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Preparando o RPG Fichas pela primeira vez...
  call npm install
  if errorlevel 1 goto :erro
)
call npm start
exit /b %errorlevel%
:erro
echo.
echo Nao foi possivel preparar o aplicativo.
pause
exit /b 1
