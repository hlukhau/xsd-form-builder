@echo off
REM Manual WAR build without Maven (using javac)

setlocal enabledelayedexpansion

set "PROJECT_DIR=%~dp0"
set "TOMCAT_HOME=C:\tomcat\win\Tomcat8"
set "JAVA_HOME=C:\tomcat\win\Tomcat8\java"
set "APP_NAME=xsd_form_builder"
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
set "CLASSPATH=%TOMCAT_HOME%\lib\servlet-api.jar"

REM Create package structure
mkdir "%CLASS_DIR%\com" 2>nul
mkdir "%CLASS_DIR%\com\eec" 2>nul
mkdir "%CLASS_DIR%\com\eec\servlet" 2>nul
mkdir "%CLASS_DIR%\com\eec\util" 2>nul

REM Compile each Java file separately
set "COMPILE_ERROR=0"

REM First compile DatabaseUtil (needed by servlets)
if exist "%SRC_DIR%\com\eec\util\DatabaseUtil.java" (
    echo Compiling DatabaseUtil.java...
    "%JAVA_HOME%\bin\javac.exe" -encoding UTF-8 -sourcepath "%SRC_DIR%" -d "%CLASS_DIR%" -cp "%CLASSPATH%" "%SRC_DIR%\com\eec\util\DatabaseUtil.java" 2>compile-util.log
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Compilation error DatabaseUtil.java
        type compile-util.log 2>nul
        set "COMPILE_ERROR=1"
    ) else (
        del compile-util.log 2>nul
    )
) else (
    echo [ERROR] File DatabaseUtil.java not found!
    set "COMPILE_ERROR=1"
)

REM Update CLASSPATH for servlets (add compiled DatabaseUtil)
set "CLASSPATH=%CLASSPATH%;%CLASS_DIR%"

REM Compile servlets
REM First compile TestServlet (simple test servlet)
if exist "%SRC_DIR%\com\eec\servlet\TestServlet.java" (
    echo Compiling TestServlet.java...
    "%JAVA_HOME%\bin\javac.exe" -encoding UTF-8 -sourcepath "%SRC_DIR%" -d "%CLASS_DIR%" -cp "%CLASSPATH%" "%SRC_DIR%\com\eec\servlet\TestServlet.java" 2>compile-test.log
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Compilation error TestServlet.java
        type compile-test.log 2>nul
        set "COMPILE_ERROR=1"
    ) else (
        del compile-test.log 2>nul
    )
) else (
    echo [WARN] File TestServlet.java not found!
)

if exist "%SRC_DIR%\com\eec\servlet\CountriesOptionsServlet.java" (
    echo Compiling CountriesOptionsServlet.java...
    "%JAVA_HOME%\bin\javac.exe" -encoding UTF-8 -sourcepath "%SRC_DIR%" -d "%CLASS_DIR%" -cp "%CLASSPATH%" "%SRC_DIR%\com\eec\servlet\CountriesOptionsServlet.java" 2>compile-options.log
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Compilation error CountriesOptionsServlet.java
        type compile-options.log 2>nul
        set "COMPILE_ERROR=1"
    ) else (
        del compile-options.log 2>nul
    )
) else (
    echo [ERROR] File CountriesOptionsServlet.java not found!
    set "COMPILE_ERROR=1"
)

if exist "%SRC_DIR%\com\eec\servlet\CountryExistsServlet.java" (
    echo Compiling CountryExistsServlet.java...
    "%JAVA_HOME%\bin\javac.exe" -encoding UTF-8 -sourcepath "%SRC_DIR%" -d "%CLASS_DIR%" -cp "%CLASSPATH%" "%SRC_DIR%\com\eec\servlet\CountryExistsServlet.java" 2>compile-exists.log
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Compilation error CountryExistsServlet.java
        type compile-exists.log 2>nul
        set "COMPILE_ERROR=1"
    ) else (
        del compile-exists.log 2>nul
    )
) else (
    echo [ERROR] File CountryExistsServlet.java not found!
    set "COMPILE_ERROR=1"
)

if exist "%SRC_DIR%\com\eec\servlet\SpaServlet.java" (
    echo Compiling SpaServlet.java...
    "%JAVA_HOME%\bin\javac.exe" -encoding UTF-8 -sourcepath "%SRC_DIR%" -d "%CLASS_DIR%" -cp "%CLASSPATH%" "%SRC_DIR%\com\eec\servlet\SpaServlet.java" 2>compile-spa.log
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Compilation error SpaServlet.java
        type compile-spa.log 2>nul
        set "COMPILE_ERROR=1"
    ) else (
        del compile-spa.log 2>nul
    )
) else (
    echo [ERROR] File SpaServlet.java not found!
    set "COMPILE_ERROR=1"
)

if exist "%SRC_DIR%\com\eec\servlet\DictionaryInitializerListener.java" (
    echo   Compiling DictionaryInitializerListener.java...
    "%JAVA_HOME%\bin\javac.exe" -encoding UTF-8 -sourcepath "%SRC_DIR%" -d "%CLASS_DIR%" -cp "%CLASSPATH%" "%SRC_DIR%\com\eec\servlet\DictionaryInitializerListener.java" 2>compile-listener.log
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Compilation error DictionaryInitializerListener.java
        type compile-listener.log 2>nul
        set "COMPILE_ERROR=1"
    ) else (
        del compile-listener.log 2>nul
    )
) else (
    echo [WARN] File DictionaryInitializerListener.java not found - dictionary loading on startup will not work
)

if !COMPILE_ERROR! EQU 0 (
    echo [OK] Java classes compiled
    REM Check compiled classes
    if exist "%CLASS_DIR%\com\eec\servlet\CountriesOptionsServlet.class" (
        echo [OK] CountriesOptionsServlet.class found
    ) else (
        echo [ERROR] CountriesOptionsServlet.class not found after compilation!
        set "COMPILE_ERROR=1"
    )
    if exist "%CLASS_DIR%\com\eec\servlet\CountryExistsServlet.class" (
        echo [OK] CountryExistsServlet.class found
    ) else (
        echo [ERROR] CountryExistsServlet.class not found after compilation!
        set "COMPILE_ERROR=1"
    )
    if exist "%CLASS_DIR%\com\eec\servlet\SpaServlet.class" (
        echo [OK] SpaServlet.class found
    ) else (
        echo [ERROR] SpaServlet.class not found after compilation!
        set "COMPILE_ERROR=1"
    )
    if exist "%CLASS_DIR%\com\eec\util\DatabaseUtil.class" (
        echo [OK] DatabaseUtil.class found
    ) else (
        echo [ERROR] DatabaseUtil.class not found after compilation!
        set "COMPILE_ERROR=1"
    )
    if exist "%CLASS_DIR%\com\eec\servlet\DictionaryInitializerListener.class" (
        echo [OK] DictionaryInitializerListener.class found
    ) else (
        echo [WARN] DictionaryInitializerListener.class not found
    )
) else (
    echo [ERROR] Java compilation errors
    exit /b 1
)

if !COMPILE_ERROR! NEQ 0 (
    echo [ERROR] Not all classes compiled!
    exit /b 1
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
