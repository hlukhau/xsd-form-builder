#!/bin/bash
# Копирование WAR на удалённый сервер (Tomcat webapps).
# Использование:
#   ./deploy-to-remote.sh              — копирует собранный WAR
#   ./deploy-to-remote.sh --build      — сначала собирает проект, затем копирует
#
# Переменные окружения (опционально):
#   REMOTE_PASSWORD — пароль для root (по умолчанию см. ниже; для безопасности лучше задать в env)
#   REMOTE_HOST     — хост (по умолчанию 192.168.203.130)
#   REMOTE_USER     — пользователь (по умолчанию root)
#   REMOTE_WEBAPPS  — каталог webapps на сервере (по умолчанию /opt/tomcat8/webapps)

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_NAME="xsd_form_builder"
WAR_FILE="$PROJECT_DIR/target/$APP_NAME.war"

# Параметры удалённого сервера
REMOTE_HOST="${REMOTE_HOST:-192.168.203.130}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_WEBAPPS="${REMOTE_WEBAPPS:-/opt/tomcat8/webapps}"
# Пароль можно задать через REMOTE_PASSWORD в окружении, чтобы не хранить в скрипте
REMOTE_PASSWORD="${REMOTE_PASSWORD:-Ssa101}"

echo "========================================"
echo " Deploy WAR to remote server"
echo "========================================"
echo "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
echo "WAR:    $WAR_FILE"
echo ""

if [ "$1" = "--build" ]; then
    echo "[1/2] Building project..."
    cd "$PROJECT_DIR"
    ./build-and-deploy.sh
    echo ""
fi

if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR not found: $WAR_FILE"
    echo "Run ./build-and-deploy.sh first or use: $0 --build"
    exit 1
fi

echo "[2/2] Copying WAR to $REMOTE_USER@$REMOTE_HOST ..."
if command -v sshpass &>/dev/null; then
    export SSHPASS="$REMOTE_PASSWORD"
    sshpass -e scp -o StrictHostKeyChecking=accept-new "$WAR_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
    unset SSHPASS
else
    echo "[INFO] sshpass not found — you will be prompted for the password."
    echo "       Install sshpass for non-interactive deploy: sudo apt-get install sshpass"
    scp -o StrictHostKeyChecking=accept-new "$WAR_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
fi

echo ""
echo "[OK] WAR copied. Tomcat will redeploy the application."
echo "     App URL: http://$REMOTE_HOST:8080/$APP_NAME/"
echo ""
