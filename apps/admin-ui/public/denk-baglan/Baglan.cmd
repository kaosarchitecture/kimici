@echo off
setlocal
set "DENK_HUB_URL=https://app.denkmuhasebe.com"
if not defined DENK_MACHINE_ID set "DENK_MACHINE_ID=%COMPUTERNAME%"
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
echo Windows oturumu sorulacak. Bu bilgisayar SQL ve ETA yolunu arar.
echo xAI anahtari yalniz C:\DENK\secrets\xai.env dosyasindan okunur.
node "C:\DENK\agent\agent.mjs"
pause
