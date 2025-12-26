@echo off
REM Скрипт для сборки WAR-файла (Windows)
REM Использование: build.bat

echo === Сборка XSD Form Builder для Tomcat ===
echo.

REM Проверка наличия Maven
where mvn >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Ошибка: Maven не установлен. Установите Maven 3.6+
    exit /b 1
)

REM Проверка наличия Java
where java >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Ошибка: Java не установлена. Установите Java 8
    exit /b 1
)

echo Очистка предыдущих сборок...
call mvn clean

echo.
echo Сборка проекта (установка Node.js, npm, сборка React, компиляция Java, упаковка WAR)...
call mvn package

if %ERRORLEVEL% EQU 0 (
    echo.
    echo === Сборка успешно завершена! ===
    echo WAR-файл: target\xsd-form-builder.war
    echo.
    echo Для развертывания скопируйте WAR-файл в папку webapps Tomcat:
    echo   copy target\xsd-form-builder.war %%CATALINA_HOME%%\webapps\
    echo.
    echo Или используйте Tomcat Manager для развертывания.
) else (
    echo.
    echo === Ошибка при сборке ===
    exit /b 1
)






