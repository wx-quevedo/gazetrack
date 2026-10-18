@echo off
rem gazetrack recorder - double-click to start behavior logging in the tray.
rem Extra flags pass through, e.g.  gazetrack.bat --no-titles --snapshots
cd /d "%~dp0"
".venv\Scripts\python.exe" main.py record --background %*
