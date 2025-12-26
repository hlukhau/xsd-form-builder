#!/bin/bash

# Скрипт для сборки WAR-файла
# Использование: ./build.sh

echo "=== Сборка XSD Form Builder для Tomcat ==="
echo ""

# Проверка наличия Maven
if ! command -v mvn &> /dev/null; then
    echo "Ошибка: Maven не установлен. Установите Maven 3.6+"
    exit 1
fi

# Проверка наличия Java
if ! command -v java &> /dev/null; then
    echo "Ошибка: Java не установлена. Установите Java 8"
    exit 1
fi

# Проверка версии Java
JAVA_VERSION=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d'.' -f1-2)
if [ "$JAVA_VERSION" != "1.8" ]; then
    echo "Предупреждение: Требуется Java 8, обнаружена версия: $JAVA_VERSION"
    echo "Продолжить? (y/n)"
    read -r response
    if [ "$response" != "y" ]; then
        exit 1
    fi
fi

echo "Очистка предыдущих сборок..."
mvn clean

echo ""
echo "Сборка проекта (установка Node.js, npm, сборка React, компиляция Java, упаковка WAR)..."
mvn package

if [ $? -eq 0 ]; then
    echo ""
    echo "=== Сборка успешно завершена! ==="
    echo "WAR-файл: target/xsd-form-builder.war"
    echo ""
    echo "Для развертывания скопируйте WAR-файл в папку webapps Tomcat:"
    echo "  cp target/xsd-form-builder.war \$CATALINA_HOME/webapps/"
    echo ""
    echo "Или используйте Tomcat Manager для развертывания."
else
    echo ""
    echo "=== Ошибка при сборке ==="
    exit 1
fi






