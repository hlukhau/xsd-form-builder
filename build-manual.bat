@echo off
REM Manual WAR build without Maven (using javac)

setlocal enabledelayedexpansion

set "PROJECT_DIR=%~dp0"
if not defined TOMCAT_HOME set "TOMCAT_HOME=C:\tomcat\win\Tomcat8"
if not defined JAVA_HOME set "JAVA_HOME=C:\tomcat\win\Tomcat8\java"
if not defined APP_NAME set "APP_NAME=dpa_card"
set "WAR_FILE=%PROJECT_DIR%target\%APP_NAME%.war"
set "WEBAPPS_PATH=%TOMCAT_HOME%\webapps"
set "APP_PATH=%WEBAPPS_PATH%\%APP_NAME%"

REM Check Java
if not exist "%JAVA_HOME%\bin\javac.exe" (
    echo [ERROR] Java compiler not found: %JAVA_HOME%\bin\javac.exe
    pause
    exit /b 1
)

REM Create structure
echo [1/6] Creating structure...
REM Save ojdbc8.jar if it exists before deleting directory
set "OJBC_TEMP=%TEMP%\ojdbc8.jar"
if exist "target\%APP_NAME%\WEB-INF\lib\ojdbc8.jar" (
    copy /Y "target\%APP_NAME%\WEB-INF\lib\ojdbc8.jar" "%OJBC_TEMP%" >nul
)
if exist "target\%APP_NAME%" rmdir /s /q "target\%APP_NAME%"
mkdir "target\%APP_NAME%" 2>nul
mkdir "target\%APP_NAME%\WEB-INF" 2>nul
mkdir "target\%APP_NAME%\WEB-INF\classes" 2>nul
mkdir "target\%APP_NAME%\WEB-INF\lib" 2>nul
REM Restore ojdbc8.jar if it was saved
if exist "%OJBC_TEMP%" (
    copy /Y "%OJBC_TEMP%" "target\%APP_NAME%\WEB-INF\lib\ojdbc8.jar" >nul
    del "%OJBC_TEMP%" 2>nul
)
echo [OK] Structure created
echo.

REM Copy frontend
echo [2/6] Copying frontend...
if not exist "dist" (
    echo [ERROR] dist folder not found! Run: npm run build
    exit /b 1
)
xcopy /E /I /Y "dist\*" "target\%APP_NAME%\" >nul
if not exist "target\%APP_NAME%\index.html" (
    echo [ERROR] index.html not copied!
    exit /b 1
)
copy /Y "src\main\webapp\WEB-INF\web.xml" "target\%APP_NAME%\WEB-INF\web.xml" >nul
if not exist "target\%APP_NAME%\WEB-INF\web.xml" (
    echo [ERROR] web.xml not copied!
    exit /b 1
)
echo [OK] Frontend copied
echo.

REM Copy dependencies (only Oracle JDBC for DB)
echo [3/6] Copying dependencies...
set "DEPS_FOUND=0"

REM Create lib directory if it doesn't exist
if not exist "target\%APP_NAME%\WEB-INF\lib" mkdir "target\%APP_NAME%\WEB-INF\lib" 2>nul

REM First check if ojdbc8.jar already exists in target directory
if exist "target\%APP_NAME%\WEB-INF\lib\ojdbc8.jar" (
    echo [OK] Oracle JDBC already exists in target directory
    set "DEPS_FOUND=1"
    goto :ojdbc_done
)

REM Search for Oracle JDBC in local Maven repository
if exist "%USERPROFILE%\.m2\repository\com\oracle\database\jdbc\ojdbc8" (
    for /r "%USERPROFILE%\.m2\repository\com\oracle\database\jdbc\ojdbc8" %%f in (ojdbc8-*.jar) do (
        copy /Y "%%f" "target\%APP_NAME%\WEB-INF\lib\ojdbc8.jar" >nul
        echo [OK] Oracle JDBC copied from Maven repository
        set "DEPS_FOUND=1"
        goto :ojdbc_done
    )
)
:ojdbc_done

if !DEPS_FOUND! EQU 0 (
    echo [WARN] Oracle JDBC not found in local repository
    echo [INFO] Trying to download ojdbc8.jar from Maven Central...
    
    REM Download using PowerShell
    powershell -Command "$ErrorActionPreference = 'Stop'; $url = 'https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/21.9.0.0/ojdbc8-21.9.0.0.jar'; $output = 'target\%APP_NAME%\WEB-INF\lib\ojdbc8.jar'; New-Item -ItemType Directory -Force -Path (Split-Path $output) | Out-Null; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing -TimeoutSec 60; Write-Output 'Downloaded successfully' } catch { Write-Output \"Download failed: $_\"; exit 1 }" 2>download-error.log
    if exist "target\%APP_NAME%\WEB-INF\lib\ojdbc8.jar" (
        echo [OK] Oracle JDBC downloaded from Maven Central
        set "DEPS_FOUND=1"
        del download-error.log 2>nul
    ) else (
        echo [WARN] Download failed, check download-error.log
        type download-error.log 2>nul
        echo [WARN] App cannot connect to DB without ojdbc8.jar
        echo [INFO] Please download ojdbc8.jar manually and place in target\%APP_NAME%\WEB-INF\lib\
    )
)
echo [OK] Dependencies processed
echo.

REM Compile Java classes
echo [4/6] Compiling Java classes...
set "SRC_DIR=src\main\java"
set "CLASS_DIR=target\%APP_NAME%\WEB-INF\classes"
REM servlet-api.jar for javac (javax.servlet)
set "SERVLET_JAR="
if defined SERVLET_API_JAR if exist "!SERVLET_API_JAR!" set "SERVLET_JAR=!SERVLET_API_JAR!"
if not defined SERVLET_JAR if exist "%TOMCAT_HOME%\lib\servlet-api.jar" set "SERVLET_JAR=%TOMCAT_HOME%\lib\servlet-api.jar"
if not defined SERVLET_JAR if defined CATALINA_HOME if exist "!CATALINA_HOME!\lib\servlet-api.jar" set "SERVLET_JAR=!CATALINA_HOME!\lib\servlet-api.jar"
if not defined SERVLET_JAR if exist "G:\Tomcat8\lib\servlet-api.jar" set "SERVLET_JAR=G:\Tomcat8\lib\servlet-api.jar"
if not defined SERVLET_JAR (
    for /d %%D in ("%ProgramFiles%\Apache Software Foundation\Tomcat *") do (
        if exist "%%~D\lib\servlet-api.jar" (
            set "SERVLET_JAR=%%~D\lib\servlet-api.jar"
            goto :servlet_done
        )
    )
)
if not defined SERVLET_JAR (
    for /d %%D in ("%ProgramFiles(x86)%\Apache Software Foundation\Tomcat *") do (
        if exist "%%~D\lib\servlet-api.jar" (
            set "SERVLET_JAR=%%~D\lib\servlet-api.jar"
            goto :servlet_done
        )
    )
)
:servlet_done
if not defined SERVLET_JAR (
    echo [ERROR] servlet-api.jar not found.
    echo [INFO] Set SERVLET_API_JAR to the full path, e.g.  set SERVLET_API_JAR=G:\Tomcat8\lib\servlet-api.jar
    echo [INFO] Or set CATALINA_HOME / TOMCAT_HOME to a Tomcat installation that contains lib\servlet-api.jar
    exit /b 1
)
set "CLASSPATH=!SERVLET_JAR!"
echo [INFO] servlet-api: !CLASSPATH!

REM Create package structure (создаем все необходимые директории)
for /r "%SRC_DIR%" %%d in (.) do (
    set "REL_PATH=%%d"
    setlocal enabledelayedexpansion
    set "REL_PATH=!REL_PATH:%SRC_DIR%\=!"
    if not "!REL_PATH!"=="" (
        if not exist "%CLASS_DIR%\!REL_PATH!" mkdir "%CLASS_DIR%\!REL_PATH!" 2>nul
    )
    endlocal
)

REM Компилируем все Java файлы автоматически
set "COMPILE_ERROR=0"
set "TEMP_LIST=%TEMP%\javafiles_%RANDOM%.txt"

echo Collecting Java files...

REM Создаем список файлов через простой цикл
for /r "%SRC_DIR%" %%f in (*.java) do (
    echo %%f >> "%TEMP_LIST%"
)

REM Проверяем, создался ли файл и не пустой ли он
if not exist "%TEMP_LIST%" (
    echo [ERROR] No Java files found in %SRC_DIR%
    set "COMPILE_ERROR=1"
) else (
    echo Compiling all Java files...
    
    REM Компилируем все файлы одной командой через @file
    "%JAVA_HOME%\bin\javac.exe" -encoding UTF-8 -sourcepath "%SRC_DIR%" -d "%CLASS_DIR%" -cp "%CLASSPATH%" @"%TEMP_LIST%" 2>compile-all.log
    
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Compilation errors found
        echo.
        echo Compilation errors:
        type compile-all.log 2>nul
        set "COMPILE_ERROR=1"
    ) else (
        echo [OK] All Java files compiled successfully
        del compile-all.log 2>nul
    )
    
    del "%TEMP_LIST%" 2>nul
)

if !COMPILE_ERROR! EQU 0 (
    echo.
    echo [OK] Java classes compiled
    echo Checking compiled classes...
    
    REM Подсчитываем скомпилированные классы
    set "CLASS_COUNT=0"
    for /r "%CLASS_DIR%" %%c in (*.class) do (
        set /a CLASS_COUNT+=1
    )
    
    if !CLASS_COUNT! GTR 0 (
        echo [OK] Found !CLASS_COUNT! compiled class^(es^)
    ) else (
        echo [ERROR] No compiled classes found!
        set "COMPILE_ERROR=1"
    )
)

REM Проверяем финальный статус
if !COMPILE_ERROR! NEQ 0 (
    echo [ERROR] Java compilation errors
    exit /b 1
)
echo.

REM [4b/6] EEC XSD in classpath for XmlSchemaValidateServlet
echo [4b/6] Copying EEC XSD into WEB-INF/classes/eec-xsd/...
set "XSD_SRC=xsd"
set "XSD_DST=target\%APP_NAME%\WEB-INF\classes\eec-xsd"
if exist "%XSD_SRC%\" (
    if not exist "%XSD_DST%" mkdir "%XSD_DST%" 2>nul
    set "XSD_COUNT=0"
    for %%f in ("%XSD_SRC%\*.xsd") do (
        if exist "%%~f" (
            copy /Y "%%~f" "%XSD_DST%\" >nul
            set /a XSD_COUNT+=1
        )
    )
    if !XSD_COUNT! EQU 0 (
        echo [WARN] No *.xsd in %XSD_SRC% - XSD validation on server will not work
    ) else (
        echo [OK] Copied !XSD_COUNT! schema file^(s^) to eec-xsd/
    )
) else (
    echo [WARN] Directory xsd/ not found - XSD validation servlet will fail at init
)
echo.

REM Create WAR
echo [5/6] Creating WAR file...
REM Delete old WAR
if exist "%WAR_FILE%" del /F /Q "%WAR_FILE%"
REM Use jar to create WAR (more reliable)
cd "target\%APP_NAME%"
"%JAVA_HOME%\bin\jar.exe" cf "..\%APP_NAME%.war" *
cd ..\..
if exist "target\%APP_NAME%.war" (
    echo [OK] WAR file created: %WAR_FILE%
    for %%A in ("%WAR_FILE%") do (
        set "WAR_SIZE=%%~zA"
        set /a "WAR_SIZE_KB=!WAR_SIZE! / 1024"
        if !WAR_SIZE_KB! GTR 1024 (
            set /a "WAR_SIZE_MB=!WAR_SIZE! / 1048576"
            echo [INFO] WAR size: !WAR_SIZE_MB! MB
        ) else (
            echo [INFO] WAR size: !WAR_SIZE_KB! KB
        )
    )
) else (
    echo [ERROR] WAR file not created!
    exit /b 1
)
echo.

if "%SKIP_LOCAL_DEPLOY%"=="1" (
    echo [INFO] SKIP_LOCAL_DEPLOY=1 - local Tomcat stop/deploy/start skipped
    exit /b 0
)

REM Stop Tomcat
echo [6/6] Stopping Tomcat...
tasklist /FI "IMAGENAME eq java.exe" 2>nul | find /I "java.exe" >nul
if %ERRORLEVEL% EQU 0 (
    taskkill /F /IM java.exe >nul 2>nul
    timeout /t 3 /nobreak >nul
)
echo [OK] Tomcat stopped
echo.

REM Remove old deployment
if exist "%APP_PATH%" rmdir /s /q "%APP_PATH%" 2>nul
if exist "%WEBAPPS_PATH%\%APP_NAME%.war" del /F /Q "%WEBAPPS_PATH%\%APP_NAME%.war" 2>nul

REM Deploy
copy /Y "%WAR_FILE%" "%WEBAPPS_PATH%\%APP_NAME%.war" >nul
if !ERRORLEVEL! NEQ 0 (
    echo [WARN] Failed to copy WAR file, trying again...
    timeout /t 2 /nobreak >nul
    copy /Y "%WAR_FILE%" "%WEBAPPS_PATH%\%APP_NAME%.war"
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Failed to deploy WAR file!
        exit /b 1
    )
)
echo [OK] Application deployed
echo.

REM Start Tomcat
cd "%TOMCAT_HOME%\bin"
start /B "" "startup.bat"
cd "%PROJECT_DIR%"
timeout /t 5 /nobreak >nul
echo [OK] Tomcat started
echo.

REM Exit with success code
exit /b 0
