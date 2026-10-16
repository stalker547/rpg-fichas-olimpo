@echo off
setlocal
cd /d "%~dp0"
echo Atualizando dependencias locais...
call npm install
if errorlevel 1 goto :erro
echo.
echo Testando arquivos principais...
call npm test
if errorlevel 1 goto :erro
echo.
echo Gerando executavel portatil...
call npm run build
if errorlevel 1 goto :erro
echo.
echo Pronto: dist\RPG Fichas.exe
pause
exit /b 0
:erro
echo.
echo A atualizacao falhou. O executavel anterior nao foi apagado.
pause
exit /b 1
