#!/bin/bash
# Запуск Tomcat вручную (если после build-and-deploy сервер не поднялся)
# Использование: ./start-tomcat.sh

TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
if [ -z "$JAVA_HOME" ]; then
    if [ -x "$TOMCAT_HOME/java/bin/java" ]; then
        JAVA_HOME="$TOMCAT_HOME/java"
    elif [ -x "/usr/lib/jvm/java-11-openjdk-amd64/bin/java" ]; then
        JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"
    elif [ -x "/usr/lib/jvm/java-11-openjdk/bin/java" ]; then
        JAVA_HOME="/usr/lib/jvm/java-11-openjdk"
    else
        JAVA_HOME="$TOMCAT_HOME/java"
    fi
fi

# Используем тот же каталог для BASE, чтобы не путать с другим экземпляром
export CATALINA_HOME="$TOMCAT_HOME"
export CATALINA_BASE="$TOMCAT_HOME"
export JAVA_HOME

if [ ! -x "$TOMCAT_HOME/bin/startup.sh" ]; then
    echo "Ошибка: не найден $TOMCAT_HOME/bin/startup.sh"
    echo "Задайте TOMCAT_HOME и при необходимости JAVA_HOME."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOMCAT_PORT=$("$SCRIPT_DIR/get-tomcat-port.sh")

echo "Запуск Tomcat: $TOMCAT_HOME"
cd "$TOMCAT_HOME/bin" && ./startup.sh
echo ""
echo "Подождите 15–30 секунд (загрузка словарей из БД может занять время)."
echo ""
echo "Откройте в браузере (порт $TOMCAT_PORT):"
echo "  http://localhost:$TOMCAT_PORT/xsd_form_builder/"
echo ""
echo "Если не открывается:"
echo "  1. Проверьте, что порт слушается: ss -tlnp | grep $TOMCAT_PORT"
echo "  2. Логи: $TOMCAT_HOME/logs/catalina.out"
echo "  3. При недоступности БД Oracle приложение может долго стартовать или падать — проверьте подключение к 192.168.203.212:1521"
