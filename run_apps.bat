@echo off
echo Starting Backend...
cd backend
start "Backend" /B npm run start:dev
echo Starting Frontend...
cd ../frontend
start "Frontend" /B npm run dev
echo Servers started in background.
