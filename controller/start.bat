@echo off
rem Usage: start.bat [screen_number]   (1 = primary; try 2 for the projector)
cd /d "%~dp0"
set SCREEN=%1
if "%SCREEN%"=="" set SCREEN=1
if "%VLC_PASSWORD%"=="" set VLC_PASSWORD=farewell
if "%VLC_PORT%"=="" set VLC_PORT=8080
set VLC_EXE=C:\Program Files\VideoLAN\VLC\vlc.exe
if not exist "%VLC_EXE%" set VLC_EXE=C:\Program Files (x86)\VideoLAN\VLC\vlc.exe
if not exist "%VLC_EXE%" (echo VLC not found & exit /b 1)
start "" "%VLC_EXE%" --extraintf http --http-host 127.0.0.1 --http-port %VLC_PORT% --http-password %VLC_PASSWORD% --fullscreen --no-video-title-show --no-osd --play-and-pause --no-playlist-autostart --no-qt-video-autoresize --qt-fullscreen-screennumber=%SCREEN%
timeout /t 3 >nul
node server.js
taskkill /im vlc.exe >nul 2>&1
