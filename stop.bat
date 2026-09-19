@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=6321

echo ==========================================
echo  Vitaminum - Stop Server (port %PORT%)
echo ==========================================

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT% " ^| findstr LISTENING') do (
  echo Menghentikan PID %%a ...
  taskkill /F /PID %%a
  set FOUND=1
)
if "%FOUND%"=="0" (
  echo [INFO] Tidak ada proses di port %PORT%. Mungkin server belum jalan.
  echo Coba tutup manual jendela berjudul "vitaminum-server" jika masih ada.
)

netstat -aon | findstr ":%PORT% " | findstr LISTENING >nul
if %errorlevel%==0 (
  echo [WARN] Port %PORT% masih dipakai. Coba tutup manual jendela "vitaminum-server".
) else (
  echo [OK] Server berhenti. Port %PORT% sudah bebas.
)

pause
