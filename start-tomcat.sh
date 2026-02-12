#!/bin/bash
# Запуск Tomcat вручную (если после build-and-deploy сервер не поднялся)
# Использование: ./start-tomcat.sh

TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
JAVA_HOME="${JAVA_HOME:-$TOMCAT_HOME/java}"

export CATALINA_HOME="$TOMCAT_HOME"
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
echo "Подождите 10–20 секунд, затем откройте (порт $TOMCAT_PORT):"
echo "  http://localhost:$TOMCAT_PORT/xsd_form_builder/"
echo "Логи: $TOMCAT_HOME/logs/catalina.out"
