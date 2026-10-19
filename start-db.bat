@echo off
echo [PostgreSQL] Checking database status...
tasklist /FI "IMAGENAME eq postgres.exe" 2>NUL | find /I /N "postgres.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo [PostgreSQL] Database is already running on port 5432.
    exit /b 0
)

if exist "C:\Users\DELL\Downloads\PostgreSQL\18\data\postmaster.pid" (
    echo [PostgreSQL] Cleaning stale postmaster.pid lock file...
    del /f /q "C:\Users\DELL\Downloads\PostgreSQL\18\data\postmaster.pid" 2>NUL
)

echo [PostgreSQL] Starting database server...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = 'D:\pgsql\bin\postgres.exe -D \"\"\"C:\Users\DELL\Downloads\PostgreSQL\18\data\"\"\"' }" >nul
timeout /t 3 /nobreak >nul
echo [PostgreSQL] Server started successfully on port 5432!
