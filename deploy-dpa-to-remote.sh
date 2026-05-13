#!/bin/bash
# Копирование WAR DPA на удалённый сервер (Tomcat webapps).
# Использование:
#   ./deploy-dpa-to-remote.sh              — копирует target/dpa_card.war
#   ./deploy-dpa-to-remote.sh --build       — сначала собирает DPA, затем копирует
#
# Переменные: REMOTE_HOST (192.168.203.130), REMOTE_USER (root), REMOTE_WEBAPPS (/opt/tomcat8/webapps), REMOTE_PASSWORD

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"
WAR_FILE="$PROJECT_DIR/target/dpa_card.war"

REMOTE_HOST="${REMOTE_HOST:-192.168.203.130}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_WEBAPPS="${REMOTE_WEBAPPS:-/opt/tomcat8/webapps}"
REMOTE_PASSWORD="${REMOTE_PASSWORD:-Ssa101}"

if [ "$1" = "--build" ]; then
    echo "[1/2] Building DPA..."
    if { [[ "${OSTYPE:-}" == msys* ]] || [[ "${OSTYPE:-}" == cygwin* ]]; } && [ -f "$PROJECT_DIR/scripts/build-card-war.cmd" ] && command -v cmd.exe &>/dev/null; then
        WIN_SCRIPT=$(cygpath -w "$PROJECT_DIR/scripts/build-card-war.cmd")
        cmd.exe //C "\"$WIN_SCRIPT\" dpa_card build" || exit 1
    else
        ./build-and-deploy-dpa.sh || exit 1
    fi
    echo ""
fi

if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR not found: $WAR_FILE"
    echo "Run: $0 --build"
    exit 1
fi

echo "========================================"
echo " Deploy DPA WAR to remote server"
echo "========================================"
echo "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/"
echo "WAR:    $WAR_FILE"
echo ""

echo "[cleanup] Удаление старых контекстов DPA в $REMOTE_WEBAPPS ..."
remote_rm() {
    if command -v sshpass &>/dev/null && [ -n "${REMOTE_PASSWORD:-}" ]; then
        export SSHPASS="$REMOTE_PASSWORD"
        sshpass -e ssh -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "$1"
        unset SSHPASS
    else
        ssh -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "$1"
    fi
}
remote_rm "cd \"$REMOTE_WEBAPPS\" && rm -rf xsd_form_builder xsd-form-builder && rm -f xsd_form_builder.war xsd-form-builder.war" || true
echo "[OK] Старые WAR/папки (xsd_form_builder*) убраны с сервера"
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
echo "[OK] DPA WAR copied. Tomcat will redeploy."
echo "     http://$REMOTE_HOST:8080/dpa_card/"
echo ""
