@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=6321
set URL=http://localhost:%PORT%/

echo ==========================================
echo  Vitaminum - Local Server
echo ==========================================

:: Cek apakah port sudah dipakai
netstat -aon | findstr ":%PORT% " | findstr LISTENING >nul
if %errorlevel%==0 (
  echo [OK] Server sudah jalan di %URL%
  echo Membuka browser...
  start "" "%URL%"
  pause
  exit /b 0
)

:: Cek python
python --version >nul 2>&1
if %errorlevel% neq 0 (
  echo [ERROR] Python tidak ditemukan. Install Python 3 lalu coba lagi.
  pause
  exit /b 1
)

echo [..] Menjalankan server di %URL%
echo [..] Root: %CD%
echo [..] Untuk berhenti: jalankan stop.bat atau tutup jendela "vitaminum-server"
echo.

:: Jalankan server di jendela terpisah agar .bat ini tidak terkunci
start "vitaminum-server" /min python -m http.server %PORT% --bind 127.0.0.1

:: Tunggu server siap
timeout /t 2 /nobreak >nul

:: Verifikasi + buka browser
netstat -aon | findstr ":%PORT% " | findstr LISTENING >nul
if %errorlevel%==0 (
  echo [OK] Server jalan di %URL%
  start "" "%URL%"
) else (
  echo [ERROR] Gagal menjalankan server. Cek apakah port %PORT% diblokir.
)

pause
