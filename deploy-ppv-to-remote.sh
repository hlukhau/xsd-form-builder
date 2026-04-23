#!/bin/bash
# Копирование WAR PPV на удалённый сервер (Tomcat webapps).
# Использование:
#   ./deploy-ppv-to-remote.sh              — копирует target/ppv_card.war
#   ./deploy-ppv-to-remote.sh --build      — сначала собирает PPV, затем копирует
#
# Переменные: REMOTE_HOST, REMOTE_USER, REMOTE_WEBAPPS, REMOTE_PASSWORD

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
WAR_FILE="$PROJECT_DIR/target/ppv_card.war"

REMOTE_HOST="${REMOTE_HOST:-192.168.203.130}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_WEBAPPS="${REMOTE_WEBAPPS:-/opt/tomcat8/webapps}"
REMOTE_PASSWORD="${REMOTE_PASSWORD:-Ssa101}"

if [ "$1" = "--build" ]; then
    echo "[1/2] Building PPV..."
    ./build-and-deploy-ppv.sh
    echo ""
fi

if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR not found: $WAR_FILE"
    echo "Run: $0 --build"
    exit 1
fi

echo "========================================"
echo " Deploy PPV WAR to remote server"
echo "========================================"
echo "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
echo "WAR:    $WAR_FILE"
echo ""

echo "[cleanup] Удаление старых контекстов PPV в $REMOTE_WEBAPPS ..."
remote_rm() {
    if command -v sshpass &>/dev/null && [ -n "${REMOTE_PASSWORD:-}" ]; then
        export SSHPASS="$REMOTE_PASSWORD"
        sshpass -e ssh -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "$1"
        unset SSHPASS
    else
        ssh -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "$1"
    fi
}
remote_rm "cd \"$REMOTE_WEBAPPS\" && rm -rf ppv_card && rm -f ppv_card.war" || true
echo "[OK] Старые WAR/папки (ppv_card*) убраны с сервера"
echo ""

if command -v sshpass &>/dev/null; then
    export SSHPASS="$REMOTE_PASSWORD"
    sshpass -e scp -o StrictHostKeyChecking=accept-new "$WAR_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
    unset SSHPASS
else
    echo "[INFO] sshpass not found — you will be prompted for the password."
    scp -o StrictHostKeyChecking=accept-new "$WAR_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
fi

echo ""
echo "[OK] PPV WAR copied. Tomcat will redeploy."
echo "     http://$REMOTE_HOST:8080/ppv_card/"
echo ""
