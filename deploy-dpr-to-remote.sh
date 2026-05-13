#!/bin/bash
# Копирование WAR DPR на удалённый сервер (Tomcat webapps).
# Использование:
#   ./deploy-dpr-to-remote.sh              — копирует target/dpr_card.war
#   ./deploy-dpr-to-remote.sh --build      — сначала собирает DPR, затем копирует
#
# Переменные: REMOTE_HOST, REMOTE_USER, REMOTE_WEBAPPS, REMOTE_PASSWORD

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
WAR_FILE="$PROJECT_DIR/target/dpr_card.war"

REMOTE_HOST="${REMOTE_HOST:-192.168.203.130}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_WEBAPPS="${REMOTE_WEBAPPS:-/opt/tomcat8/webapps}"
REMOTE_PASSWORD="${REMOTE_PASSWORD:-Ssa101}"

if [ "$1" = "--build" ]; then
    echo "[1/2] Building DPR..."
    if { [[ "${OSTYPE:-}" == msys* ]] || [[ "${OSTYPE:-}" == cygwin* ]]; } && [ -f "$PROJECT_DIR/scripts/build-card-war.cmd" ] && command -v cmd.exe &>/dev/null; then
        WIN_SCRIPT=$(cygpath -w "$PROJECT_DIR/scripts/build-card-war.cmd")
        cmd.exe //C "\"$WIN_SCRIPT\" dpr_card build:dpr" || exit 1
    else
        ./build-and-deploy-dpr.sh || exit 1
    fi
    echo ""
fi

if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR not found: $WAR_FILE"
    echo "Run: $0 --build"
    exit 1
fi

echo "========================================"
echo " Deploy DPR WAR to remote server"
echo "========================================"
echo "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
echo "WAR:    $WAR_FILE"
echo ""

echo "[cleanup] Удаление старых контекстов DPR в $REMOTE_WEBAPPS ..."
remote_rm() {
    if command -v sshpass &>/dev/null && [ -n "${REMOTE_PASSWORD:-}" ]; then
        export SSHPASS="$REMOTE_PASSWORD"
        sshpass -e ssh -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "$1"
        unset SSHPASS
    else
        ssh -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "$1"
    fi
}
remote_rm "cd \"$REMOTE_WEBAPPS\" && rm -rf dpr_card && rm -f dpr_card.war" || true
echo "[OK] Старые WAR/папки (dpr_card*) убраны с сервера"
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
echo "[OK] DPR WAR copied. Tomcat will redeploy."
echo "     http://$REMOTE_HOST:8080/dpr_card/"
echo ""
