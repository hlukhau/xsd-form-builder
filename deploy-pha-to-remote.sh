#!/bin/bash
# Копирование WAR PHA на удалённый сервер (Tomcat webapps).
# Использование:
#   ./deploy-pha-to-remote.sh              — копирует target/xsd_form_builder_57.war
#   ./deploy-pha-to-remote.sh --build       — сначала собирает PHA, затем копирует
#
# Переменные: REMOTE_HOST, REMOTE_USER, REMOTE_WEBAPPS, REMOTE_PASSWORD

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
WAR_FILE="$PROJECT_DIR/target/xsd_form_builder_57.war"

REMOTE_HOST="${REMOTE_HOST:-192.168.203.130}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_WEBAPPS="${REMOTE_WEBAPPS:-/opt/tomcat8/webapps}"
REMOTE_PASSWORD="${REMOTE_PASSWORD:-Ssa101}"

if [ "$1" = "--build" ]; then
    echo "[1/2] Building PHA..."
    ./build-and-deploy-pha.sh
    echo ""
fi

if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR not found: $WAR_FILE"
    echo "Run: $0 --build"
    exit 1
fi

echo "========================================"
echo " Deploy PHA WAR to remote server"
echo "========================================"
echo "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
echo "WAR:    $WAR_FILE"
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
echo "[OK] PHA WAR copied. Tomcat will redeploy."
echo "     http://$REMOTE_HOST:8080/xsd_form_builder_57/"
echo ""
