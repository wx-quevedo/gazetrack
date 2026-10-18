@echo off
rem gazetrack dashboard - build if needed, serve on localhost, open the browser.
cd /d "%~dp0dashboard"
where php >nul 2>nul && (set "PHP=php") || (set "PHP=C:\xampp\php\php.exe")
if not exist "public\build\manifest.json" (
    echo Building dashboard, first run only...
    call npm run build
)
echo Dashboard at http://127.0.0.1:8000  -  close this window to stop.
start "" /min cmd /c "timeout /t 2 /nobreak >nul & start "" http://127.0.0.1:8000"
"%PHP%" artisan serve --host=127.0.0.1 --port=8000
