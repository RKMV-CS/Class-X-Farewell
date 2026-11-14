@echo off
REM Download and go: installs dependencies, downloads the finished clips, checks them, starts the show software.
REM Needs: Node.js 18+, VLC, GitHub CLI (gh) logged in with access to the private clips repo. See docs/getting-started.md.
cd /d "%~dp0controller"
node setup.js %*
if errorlevel 1 (
  echo.
  echo Setup did not finish. Read the message above, fix it, then double-click setup.bat again.
  pause
  exit /b 1
)
node launch.js
pause
