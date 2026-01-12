@echo off
echo Starting CampusAI...

REM ==== START BACKEND ====
start cmd /k "cd backend && node src/server.js"

REM ==== WAIT 2 SECONDS ====
timeout 2 > nul

REM ==== START FRONTEND ====
start cmd /k "cd frontend && npx serve ."

echo Both frontend and backend are running.
pause
