#!/bin/bash
# Запуск Tomcat в режиме переднего плана — все сообщения и ошибки в терминале.
# Остановка: Ctrl+C.
# Использование: ./start-tomcat-foreground.sh

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

export CATALINA_HOME="$TOMCAT_HOME"
export CATALINA_BASE="$TOMCAT_HOME"
export JAVA_HOME

if [ ! -x "$TOMCAT_HOME/bin/catalina.sh" ]; then
    echo "Ошибка: не найден $TOMCAT_HOME/bin/catalina.sh"
    echo "Задайте TOMCAT_HOME (и при необходимости JAVA_HOME)."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOMCAT_PORT=$("$SCRIPT_DIR/get-tomcat-port.sh")

echo "Запуск Tomcat в режиме переднего плана: $TOMCAT_HOME"
echo "Порт: $TOMCAT_PORT. После старта откройте: http://localhost:$TOMCAT_PORT/dpa_card/"
echo "Остановка: Ctrl+C"
echo ""

cd "$TOMCAT_HOME/bin" && ./catalina.sh run
