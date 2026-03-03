#!/bin/bash
# Запуск Tomcat в переднем плане из каталога проекта.
# Удобно, чтобы увидеть причину падения процесса (ошибка в терминале).
# Использование: TOMCAT_HOME=~/tomcat8 ./run-tomcat-foreground.sh

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"

if [ -z "$JAVA_HOME" ]; then
    if [ -x "$TOMCAT_HOME/java/bin/java" ]; then
        JAVA_HOME="$TOMCAT_HOME/java"
    elif [ -x "/usr/lib/jvm/java-11-openjdk-amd64/bin/java" ]; then
        JAVA_HOME="/usr/lib/jvm/java-11-openjdk-amd64"
    else
        JAVA_HOME="$TOMCAT_HOME/java"
    fi
fi

export CATALINA_HOME="$TOMCAT_HOME"
export CATALINA_BASE="$TOMCAT_HOME"
export JAVA_HOME

TOMCAT_PORT=$("$PROJECT_DIR/get-tomcat-port.sh" 2>/dev/null || echo "8083")

echo "TOMCAT_HOME=$TOMCAT_HOME"
echo "Порт: $TOMCAT_PORT. После старта: http://localhost:$TOMCAT_PORT/xsd_form_builder/"
echo "Когда процесс упадёт — в этом окне будет видна ошибка (OOM, Exception и т.д.)."
echo "Остановка вручную: Ctrl+C"
echo ""

exec "$TOMCAT_HOME/bin/catalina.sh" run
