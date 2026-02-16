#!/bin/bash
# Диагностика: почему Tomcat не запускается.
# Использование: ./diagnose-tomcat.sh

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
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Диагностика Tomcat ==="
echo ""

# 1. Существует ли каталог Tomcat
if [ ! -d "$TOMCAT_HOME" ]; then
    echo "[ОШИБКА] Каталог Tomcat не найден: $TOMCAT_HOME"
    echo "  Задайте правильный путь: export TOMCAT_HOME=/путь/к/tomcat8"
    echo "  Например: export TOMCAT_HOME=/home/hlukhau/tomcat8"
    exit 1
fi
echo "[OK] TOMCAT_HOME: $TOMCAT_HOME"

# 2. Есть ли startup.sh
if [ ! -x "$TOMCAT_HOME/bin/startup.sh" ]; then
    echo "[ОШИБКА] Не найден или не исполняемый: $TOMCAT_HOME/bin/startup.sh"
    exit 1
fi
echo "[OK] startup.sh найден"

# 3. Java
if [ ! -x "$JAVA_HOME/bin/java" ]; then
    echo "[ОШИБКА] Java не найдена: $JAVA_HOME/bin/java"
    echo "  Укажите JAVA_HOME, например: export JAVA_HOME=/usr/lib/jvm/java-11-openjdk"
    exit 1
fi
echo "[OK] JAVA_HOME: $JAVA_HOME"
"$JAVA_HOME/bin/java" -version 2>&1 | head -1

# 4. Порт из server.xml
TOMCAT_PORT=$("$SCRIPT_DIR/get-tomcat-port.sh")
echo "[OK] Порт из server.xml: $TOMCAT_PORT"

# 5. Порт и адрес прослушивания
if command -v ss >/dev/null 2>&1; then
    if ss -tlnp 2>/dev/null | grep -q ":$TOMCAT_PORT "; then
        echo "[INFO] Порт $TOMCAT_PORT занят (слушается):"
        ss -tlnp 2>/dev/null | grep ":$TOMCAT_PORT "
        LISTEN_ADDR=$(ss -tlnp 2>/dev/null | grep ":$TOMCAT_PORT " | awk '{print $4}')
        if echo "$LISTEN_ADDR" | grep -q "127.0.0.1"; then
            echo "    Слушается только 127.0.0.1 — в браузере используйте http://127.0.0.1:$TOMCAT_PORT/"
        elif echo "$LISTEN_ADDR" | grep -q "0.0.0.0\|:::"; then
            echo "    Слушается на всех интерфейсах — можно открыть http://localhost:$TOMCAT_PORT/"
        fi
    else
        echo "[INFO] Порт $TOMCAT_PORT свободен (Tomcat не запущен)."
    fi
fi

# 5b. Проверка Connector в server.xml (адрес привязки)
SERVER_XML="$TOMCAT_HOME/conf/server.xml"
if [ -f "$SERVER_XML" ]; then
    CONN_LINE=$(grep -E '<Connector[^>]*port="' "$SERVER_XML" | head -1)
    if echo "$CONN_LINE" | grep -q 'address="127.0.0.1"'; then
        echo "[!] В server.xml Connector привязан к 127.0.0.1 — доступ только по http://127.0.0.1:$TOMCAT_PORT/"
    fi
    if echo "$CONN_LINE" | grep -q 'address='; then
        echo "[INFO] Текущий Connector: $CONN_LINE"
    fi
fi

# 6. Последние строки лога
LOG="$TOMCAT_HOME/logs/catalina.out"
if [ -f "$LOG" ]; then
    echo ""
    echo "=== Последние 25 строк $LOG ==="
    tail -25 "$LOG"
    # Если в логе виден другой CATALINA_BASE (например /home/.../tomcat8) — подсказать
    if grep -q '/home/[^/]*/tomcat8' "$LOG" 2>/dev/null && [ "$TOMCAT_HOME" = "/opt/tomcat8" ]; then
        echo ""
        echo "[!] В логе развёртывание идёт из /home/.../tomcat8. Запускайте тот экземпляр:"
        echo "    TOMCAT_HOME=/home/hlukhau/tomcat8 ./start-tomcat-foreground.sh"
    fi
else
    echo ""
    echo "[INFO] Лог ещё не создан: $LOG (Tomcat ни разу не запускался из этого каталога)."
fi

# 7. Проверка доступности по HTTP (если порт занят)
if command -v curl >/dev/null 2>&1 && ss -tlnp 2>/dev/null | grep -q ":$TOMCAT_PORT "; then
    echo ""
    echo "=== Проверка HTTP ==="
    if curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:$TOMCAT_PORT/" 2>/dev/null | grep -q '[0-9]'; then
        CODE=$(curl -sS -o /dev/null -w "%{http_code}" --connect-timeout 2 "http://127.0.0.1:$TOMCAT_PORT/" 2>/dev/null)
        echo "[OK] Ответ сервера: HTTP $CODE — откройте в браузере: http://127.0.0.1:$TOMCAT_PORT/"
        echo "     Приложение: http://127.0.0.1:$TOMCAT_PORT/xsd_form_builder/"
    else
        echo "[!] curl к http://127.0.0.1:$TOMCAT_PORT/ не удался (таймаут или отказ)."
        echo "    Проверьте: ./fix-tomcat-connector.sh (чтобы слушать 0.0.0.0), firewall (ufw allow $TOMCAT_PORT)."
    fi
fi

echo ""
echo "=== Рекомендации ==="
if ! ss -tlnp 2>/dev/null | grep -q ":$TOMCAT_PORT "; then
    echo "Порт $TOMCAT_PORT свободен — Tomcat не запущен. Запустите:"
    echo "  ./start-tomcat-foreground.sh   # с выводом в терминал"
    echo "  или: ./start-tomcat.sh         # в фоне"
fi
echo "1. Запуск в терминале (видеть ошибки): ./start-tomcat-foreground.sh"
echo "2. В фоне: ./start-tomcat.sh , затем: tail -f $LOG"
echo "3. Если приложение в /home/hlukhau/tomcat8: TOMCAT_HOME=/home/hlukhau/tomcat8 ./start-tomcat-foreground.sh"
echo "4. Если localhost:8083 не открывается: откройте http://127.0.0.1:$TOMCAT_PORT/ или выполните: ./fix-tomcat-connector.sh"
