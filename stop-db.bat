@echo off
echo [PostgreSQL] Stopping database server...
"D:\pgsql\bin\pg_ctl.exe" stop -D "C:\Users\DELL\Downloads\PostgreSQL\18\data" -m fast 2>NUL
if exist "C:\Users\DELL\Downloads\PostgreSQL\18\data\postmaster.pid" (
    del /f /q "C:\Users\DELL\Downloads\PostgreSQL\18\data\postmaster.pid" 2>NUL
)
echo [PostgreSQL] Database server stopped.
