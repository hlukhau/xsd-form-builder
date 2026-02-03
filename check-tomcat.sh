#!/bin/bash
# Проверка: запущен ли Tomcat, слушается ли порт.
# Использование: ./check-tomcat.sh

TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=$("$SCRIPT_DIR/get-tomcat-port.sh")

echo "=== Проверка Tomcat ==="
echo "  TOMCAT_HOME: $TOMCAT_HOME"
echo "  Порт из server.xml: $PORT"
echo ""

# Кто слушает порт
if command -v ss &>/dev/null; then
    LISTEN=$(ss -tlnp 2>/dev/null | grep ":$PORT ")
elif command -v netstat &>/dev/null; then
    LISTEN=$(netstat -tlnp 2>/dev/null | grep ":$PORT ")
else
    LISTEN=""
fi

if [ -n "$LISTEN" ]; then
    echo "[OK] Порт $PORT слушается:"
    echo "  $LISTEN"
else
    echo "[!] Порт $PORT не слушается — Tomcat, скорее всего, не запущен."
    echo ""
    echo "Запустите Tomcat:"
    echo "  ./start-tomcat.sh"
    echo ""
    echo "Или вручную:"
    echo "  export CATALINA_HOME=$TOMCAT_HOME"
    echo "  export JAVA_HOME=\${JAVA_HOME:-$TOMCAT_HOME/java}"
    echo "  \$CATALINA_HOME/bin/startup.sh"
    echo ""
    echo "После запуска подождите 10–20 сек и откройте:"
fi

echo ""
echo "  Приложение (не корень!): http://localhost:$PORT/xsd_form_builder/"
echo "  Корень Tomcat:            http://localhost:$PORT/"
echo ""

# Процесс Java (catalina)
if pgrep -f "catalina" >/dev/null 2>&1; then
    echo "[OK] Процесс Tomcat (catalina) запущен."
else
    echo "[!] Процесс Tomcat не найден (pgrep -f catalina)."
fi

echo ""
echo "Логи: $TOMCAT_HOME/logs/catalina.out"
if [ -f "$TOMCAT_HOME/logs/catalina.out" ]; then
    echo "Последние 5 строк:"
    tail -5 "$TOMCAT_HOME/logs/catalina.out" | sed 's/^/  /'
fi
