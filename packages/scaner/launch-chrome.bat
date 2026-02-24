@echo off
setlocal enabledelayedexpansion

set DOWNLOAD_DIR=D:\Downloads
set PROFILE_DIR=%LOCALAPPDATA%\Google\Chrome\User Data\DebugProfile

echo Launching Chrome with download directory: %DOWNLOAD_DIR%
echo Profile directory: %PROFILE_DIR%

set CHROME_PATH=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe

if not exist "%CHROME_PATH%" (
    echo Chrome not found at %CHROME_PATH%, searching...

    if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
        set "CHROME_PATH=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
        echo Found at ProgramFiles
        goto LaunchChrome
    )

    if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
        set "CHROME_PATH=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
        echo Found at ProgramFiles(x86)
        goto LaunchChrome
    )

    for /f "delims=" %%i in ('where chrome.exe 2^>nul') do (
        set "CHROME_PATH=%%i"
        echo Found at: %%i
        goto LaunchChrome
    )

    echo Chrome not found on this system
    pause
    exit /b 1
)

echo Using Chrome at: %CHROME_PATH%

:LaunchChrome
echo Starting Chrome...
start "ChromeDebug" /B "%CHROME_PATH%" --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 --new-window --download-directory="%DOWNLOAD_DIR%" --user-data-dir="%PROFILE_DIR%" --lang=zh-CN --no-first-run --no-default-browser-check about:blank

echo Waiting for Chrome to start...
timeout /t 5 /nobreak >nul

netstat -an | findstr 9222
if errorlevel 1 (
    echo Chrome may not have started correctly with remote debugging
) else (
    echo Chrome is listening on port 9222
)

pause
