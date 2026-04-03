@echo off
echo STARTING GIT OPS >> push_log.txt
git status >> push_log.txt 2>&1
git add . >> push_log.txt 2>&1
git commit -m "Standardized Master Module UI, Navigation and Categories Form conversion" >> push_log.txt 2>&1
git push origin restore-work-aprile-01:main >> push_log.txt 2>&1
echo FINISHED GIT OPS >> push_log.txt
