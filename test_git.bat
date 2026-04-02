@echo off
echo Running git status > git_output.txt
git status >> git_output.txt 2>&1
echo Done >> git_output.txt
