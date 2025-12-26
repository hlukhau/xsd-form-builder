@echo off
REM Script for building and deploying application to Tomcat
REM Использование: build-and-deploy.bat

setlocal enabledelayedexpansion

REM Настройка путей
set "PROJECT_DIR=%~dp0"
set "TOMCAT_HOME=C:\tomcat\win\Tomcat8"
set "JAVA_HOME=C:\tomcat\win\Tomcat8\java"
set "MAVEN_HOME=C:\tomcat\apache-maven-3.9.12-bin\apache-maven-3.9.12"
set "APP_NAME=xsd_form_builder"
set "WAR_FILE=%PROJECT_DIR%target\%APP_NAME%.war"
set "WEBAPPS_PATH=%TOMCAT_HOME%\webapps"
set "APP_PATH=%WEBAPPS_PATH%\%APP_NAME%"

echo ========================================
echo  Build and Deploy %APP_NAME%
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found in PATH
    echo Install Node.js or add it to PATH
    pause
    exit /b 1
)

REM Step 1: Build React app
echo [1/4] Building React app...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] React build failed
    pause
    exit /b 1
)
echo [OK] React app built
echo.

REM Step 2: Check Java
echo [2/4] Checking Java...
if not exist "%JAVA_HOME%\bin\javac.exe" (
    echo [ERROR] Java compiler not found: %JAVA_HOME%\bin\javac.exe
    pause
    exit /b 1
)
echo [OK] Java found: %JAVA_HOME%
echo.

REM Step 3: Build WAR (manual build without Maven due to SSL issues)
echo [3/4] Building WAR and deploying...
echo [INFO] Using manual build (without Maven) due to SSL issues
echo.
call build-manual.bat
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] WAR build failed
    pause
    exit /b 1
)
echo [OK] WAR built and deployed
echo.

REM Step 4: Check built WAR
echo [4/4] Checking built WAR...
if not exist "%WAR_FILE%" (
    echo [ERROR] WAR file not found: %WAR_FILE%
    pause
    exit /b 1
)
for %%A in ("%WAR_FILE%") do set "WAR_SIZE=%%~zA"
set /a "WAR_SIZE_MB=!WAR_SIZE! / 1048576"
echo [OK] WAR file found: %WAR_SIZE_MB% MB

REM Check compiled classes
set "CLASSES_OK=1"
if not exist "target\%APP_NAME%\WEB-INF\classes\com\eec\servlet\CountriesOptionsServlet.class" (
    echo [WARN] CountriesOptionsServlet.class not found
    set "CLASSES_OK=0"
)
if not exist "target\%APP_NAME%\WEB-INF\classes\com\eec\servlet\CountryExistsServlet.class" (
    echo [WARN] CountryExistsServlet.class not found
    set "CLASSES_OK=0"
)
if not exist "target\%APP_NAME%\WEB-INF\classes\com\eec\servlet\SpaServlet.class" (
    echo [WARN] SpaServlet.class not found
    set "CLASSES_OK=0"
)
if not exist "target\%APP_NAME%\WEB-INF\classes\com\eec\util\DatabaseUtil.class" (
    echo [WARN] DatabaseUtil.class not found
    set "CLASSES_OK=0"
)
if !CLASSES_OK! EQU 1 (
    echo [OK] All Java classes compiled
) else (
    echo [ERROR] Not all Java classes compiled!
)

REM Check dependencies
if exist "target\%APP_NAME%\WEB-INF\lib\ojdbc8.jar" (
    echo [OK] Oracle JDBC found
) else (
    echo [WARN] Oracle JDBC not found - app cannot connect to DB
)
echo.

REM Final info
echo ========================================
echo  DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Application available at:
echo   http://localhost:8080/%APP_NAME%
echo.
echo API for testing:
echo   http://localhost:8080/%APP_NAME%/api/countries/options
echo.
echo WAR file: %WAR_FILE%
echo Size: %WAR_SIZE_MB% MB
echo.
echo Wait 10-20 seconds for full deployment
echo Check logs in: %TOMCAT_HOME%\logs\catalina.*.log
echo.
echo Check servlets in logs:
echo   - CountriesOptionsServlet
echo   - CountryExistsServlet
echo   - SpaServlet
echo.
pause
