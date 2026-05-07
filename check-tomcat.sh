#!/bin/bash
# Проверка: слушает ли Tomcat порт и какой URL открывать.
# Использование: ./check-tomcat.sh

TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOMCAT_PORT=$("$SCRIPT_DIR/get-tomcat-port.sh")

echo "Порт из $TOMCAT_HOME/conf/server.xml: $TOMCAT_PORT"
echo ""

if command -v ss >/dev/null 2>&1; then
    if ss -tlnp 2>/dev/null | grep -q ":$TOMCAT_PORT "; then
        echo "Порт $TOMCAT_PORT слушается. Откройте в браузере:"
        echo "  http://localhost:$TOMCAT_PORT/dpa_card/"
        echo ""
        echo "Форма по GUID (пример):"
        echo "  http://localhost:$TOMCAT_PORT/dpa_card/1/ваш-guid"
        exit 0
    fi
else
    if command -v netstat >/dev/null 2>&1; then
        if netstat -tlnp 2>/dev/null | grep -q ":$TOMCAT_PORT "; then
            echo "Порт $TOMCAT_PORT слушается. Откройте: http://localhost:$TOMCAT_PORT/dpa_card/"
            exit 0
        fi
    fi
fi

echo "Порт $TOMCAT_PORT не слушается. Запустите Tomcat: ./start-tomcat.sh"
echo "Если Tomcat запущен из другого каталога (например /home/hlukhau/tomcat8), задайте: TOMCAT_HOME=/home/hlukhau/tomcat8 ./check-tomcat.sh"
exit 1
