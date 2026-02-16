#!/bin/bash
# Делает так, чтобы Tomcat слушал на всех интерфейсах (0.0.0.0),
# а не только на 127.0.0.1 — тогда будет открываться и localhost, и по IP.
# Использование: TOMCAT_HOME=/home/hlukhau/tomcat8 ./fix-tomcat-connector.sh

TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
SERVER_XML="$TOMCAT_HOME/conf/server.xml"

if [ ! -f "$SERVER_XML" ]; then
    echo "Не найден: $SERVER_XML"
    exit 1
fi

if grep -q '<Connector[^>]*address="127.0.0.1"' "$SERVER_XML"; then
    echo "Найден Connector с address=\"127.0.0.1\". Меняю на 0.0.0.0..."
    cp -a "$SERVER_XML" "$SERVER_XML.bak.$(date +%Y%m%d%H%M%S)"
    sed -i 's/address="127.0.0.1"/address="0.0.0.0"/' "$SERVER_XML"
    echo "Готово. Бэкап: $SERVER_XML.bak.*"
    echo "Перезапустите Tomcat."
elif grep -q '<Connector[^>]*address="0.0.0.0"' "$SERVER_XML"; then
    echo "Connector уже слушает на 0.0.0.0. Менять не нужно."
else
    echo "В Connector нет address=\"127.0.0.1\" — Tomcat уже слушает на всех интерфейсах."
    echo "Если localhost:PORT не открывается, проверьте: firewall (ufw allow 8083), что запущен нужный Tomcat (TOMCAT_HOME)."
fi
