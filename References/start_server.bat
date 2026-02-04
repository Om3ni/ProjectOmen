@echo off
cd /d "%~dp0"
echo ================================================
echo  Z_Parser 2.0 Server
echo  Directory: %cd%
echo  URL: http://localhost:8000/index.html
echo ================================================
echo.
echo IMPORTANT: Press Ctrl+Shift+R in browser to force refresh!
echo (This clears cached version)
echo.
if not exist "index.html" (
    echo ERROR: index.html not found!
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
start http://localhost:8000/index.html
py -3 -m http.server 8000 --bind 127.0.0.1
