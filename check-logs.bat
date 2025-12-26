@echo off
chcp 65001 >nul
REM Скрипт для проверки логов приложения

set "LOG_DIR=C:\tomcat\win\Tomcat8\logs"

echo ========================================
echo  Проверка логов приложения
echo ========================================
echo.

echo Логи находятся в: %LOG_DIR%
echo.

echo === Последние 50 строк catalina.out ===
if exist "%LOG_DIR%\catalina.out" (
    powershell -Command "Get-Content '%LOG_DIR%\catalina.out' -Tail 50"
) else (
    echo Файл catalina.out не найден!
)
echo.

echo === Поиск ошибок и Spring Boot ===
if exist "%LOG_DIR%\catalina.out" (
    echo.
    echo Ошибки:
    powershell -Command "Select-String -Path '%LOG_DIR%\catalina.out' -Pattern 'ERROR|Exception' | Select-Object -Last 10"
    echo.
    echo Spring Boot:
    powershell -Command "Select-String -Path '%LOG_DIR%\catalina.out' -Pattern 'Spring|Application|CountryService' | Select-Object -Last 10"
) else (
    echo Файл catalina.out не найден!
)
echo.

echo === Лог приложения ===
if exist "%LOG_DIR%\xsd-form-builder.log" (
    echo Последние 30 строк:
    powershell -Command "Get-Content '%LOG_DIR%\xsd-form-builder.log' -Tail 30"
) else (
    echo Файл xsd-form-builder.log не найден (приложение может не запуститься)
)
echo.

pause





