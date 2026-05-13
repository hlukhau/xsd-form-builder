@echo off
REM Сборка фронта (npm) + WAR через build-manual.bat для карточек DPA/PHA/PPV/DPR.
REM Использование: build-card-war.cmd ^<AppName^> ^<npmScript^> [skipLocalDeploy]
REM   AppName: dpa_card | pha_card | ppv_card | dpr_card
REM   npmScript: build | build:pha | build:ppv | build:dpr
REM   skipLocalDeploy: 1 (по умолчанию) — не трогать локальный Tomcat; 0 — как обычный build-manual.bat

setlocal enabledelayedexpansion
cd /d "%~dp0.."
if "%~2"=="" (
  echo Usage: %~nx0 AppName npmScript [skipLocalDeploy]
  echo Example: %~nx0 dpa_card build 1
  exit /b 1
)
set "APP_NAME=%~1"
set "NPM_SCRIPT=%~2"
set "SKIP_LOCAL_DEPLOY=%~3"
if "!SKIP_LOCAL_DEPLOY!"=="" set "SKIP_LOCAL_DEPLOY=1"

echo [build-card-war] APP_NAME=!APP_NAME! NPM_SCRIPT=!NPM_SCRIPT! SKIP_LOCAL_DEPLOY=!SKIP_LOCAL_DEPLOY!
call npm run !NPM_SCRIPT!
if errorlevel 1 exit /b 1
call build-manual.bat
if errorlevel 1 exit /b 1
echo [build-card-war] OK: target\!APP_NAME!.war
exit /b 0
