@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Preparando o RPG Fichas pela primeira vez...
  call npm install
  if errorlevel 1 goto :erro
)

echo.
echo ========================================
echo          RPG Fichas - Teste
echo ========================================
echo [1] Abrir com os dados locais
echo [2] Conectar na VPS
echo.
choice /c 12 /n /m "Escolha 1 ou 2: "
if errorlevel 2 goto :online

:local
echo.
echo Abrindo em modo local...
call npm start -- --local
exit /b %errorlevel%

:online
echo.
echo Conectando na VPS...
call npm start
exit /b %errorlevel%

:erro
echo.
echo Nao foi possivel preparar o aplicativo.
pause
exit /b 1
