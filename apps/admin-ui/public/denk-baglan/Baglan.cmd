@echo off
setlocal
set "DENK_HUB_URL=https://app.denkmuhasebe.com"
if not defined DENK_LOCAL set "DENK_LOCAL=C:\DENK\inbox"
if not defined DENK_MACHINE_ID set "DENK_MACHINE_ID=%COMPUTERNAME%"
if not exist "%DENK_LOCAL%" mkdir "%DENK_LOCAL%"
if not exist "C:\DENK\agent" mkdir "C:\DENK\agent"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js 20 yok. https://nodejs.org adresinden kurup bu dosyayi yeniden calistirin.
  pause
  exit /b 1
)
curl.exe -fsSL -o "C:\DENK\agent\agent.mjs" "%DENK_HUB_URL%/denk-baglan/agent.mjs"
if errorlevel 1 (
  echo Ajan indirilemedi.
  pause
  exit /b 1
)
echo %COMPUTERNAME% baglaniyor. Kayit klasoru: %DENK_LOCAL%
node "C:\DENK\agent\agent.mjs" connect
pause
