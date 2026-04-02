@echo off
echo Running git fetch > setup_log.txt
git stash >> setup_log.txt 2>&1
git fetch origin >> setup_log.txt 2>&1
echo Running git checkout dev >> setup_log.txt
git checkout dev >> setup_log.txt 2>&1
echo Running git pull origin dev >> setup_log.txt
git pull origin dev >> setup_log.txt 2>&1

echo Moving to backend >> setup_log.txt
cd backend
echo Running npm install backend >> ../setup_log.txt
call npm install >> ../setup_log.txt 2>&1
echo Running prisma generate >> ../setup_log.txt
call npx prisma generate >> ../setup_log.txt 2>&1
echo Running prisma db push >> ../setup_log.txt
call npx prisma db push --skip-generate >> ../setup_log.txt 2>&1

echo Moving to frontend >> ../setup_log.txt
cd ../frontend
echo Running npm install frontend >> ../setup_log.txt
call npm install --legacy-peer-deps >> ../setup_log.txt 2>&1

echo Setup Finished >> ../setup_log.txt
