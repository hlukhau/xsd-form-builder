#!/bin/bash
# Определяет порт HTTP Connector из conf/server.xml Tomcat.
# Вывод: только номер порта (по умолчанию 8080).
# Использование: PORT=$(./get-tomcat-port.sh) или source get-tomcat-port.sh (не подходит для вывода)

TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
SERVER_XML="$TOMCAT_HOME/conf/server.xml"

if [ -f "$SERVER_XML" ]; then
    # Порт HTTP Connector из строки <Connector port="8080" ...>
    PORT=$(grep '<Connector' "$SERVER_XML" | head -1 | sed -n 's/.*port="\([0-9]*\)".*/\1/p')
    [ -n "$PORT" ] && echo "$PORT" && exit 0
fi

echo "8080"
