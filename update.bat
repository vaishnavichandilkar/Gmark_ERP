@echo off
echo Running git add > update_log.txt
git add . >> update_log.txt 2>&1
echo Running git commit >> update_log.txt
git commit -m "Standardize Mobile Master UI and resolve conflicts" >> update_log.txt 2>&1

echo Checkout dev >> update_log.txt
git checkout dev >> update_log.txt 2>&1
echo Pull dev >> update_log.txt
git pull origin dev >> update_log.txt 2>&1

echo Setup backend >> update_log.txt
cd backend
call npm install >> ../update_log.txt 2>&1
call npx prisma generate >> ../update_log.txt 2>&1
call npx prisma db push --skip-generate >> ../update_log.txt 2>&1

echo Setup frontend >> ../update_log.txt
cd ../frontend
call npm install --legacy-peer-deps >> ../update_log.txt 2>&1

echo Finished >> ../update_log.txt
