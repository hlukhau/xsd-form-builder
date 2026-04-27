#!/bin/bash
# Копирование WAR eec-rights-service в webapps Tomcat на удалённом хосте.
# Использование:
#   ./deploy-rights-service-to-remote.sh              — scp собранного WAR
#   ./deploy-rights-service-to-remote.sh --build    — сначала ./build-rights-service.sh, затем scp
#
# Переменные: REMOTE_HOST, REMOTE_USER, REMOTE_PASSWORD, REMOTE_TOMCAT_HOME (по умолчанию /opt/tomcat8)

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

REMOTE_HOST="${REMOTE_HOST:-192.168.203.130}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_TOMCAT_HOME="${REMOTE_TOMCAT_HOME:-/opt/tomcat8}"
REMOTE_PASSWORD="${REMOTE_PASSWORD:-Ssa101}"

if [ "$1" = "--build" ]; then
    echo "[1/2] Building eec-rights-service (WAR)..."
    ./build-rights-service.sh
    echo ""
fi

WAR_FILE="$PROJECT_DIR/rights-service/target/card_rigths.war"
if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR not found: $WAR_FILE"
    echo "Run: $0 --build  или  ./build-rights-service.sh"
    exit 1
fi

REMOTE_WEBAPPS="$REMOTE_TOMCAT_HOME/webapps"

echo "========================================"
echo " Deploy eec-rights-service WAR (remote Tomcat)"
echo "========================================"
echo "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/card_rigths.war"
echo "WAR:    $WAR_FILE"
echo ""

remote_scp() {
    if command -v sshpass &>/dev/null && [ -n "${REMOTE_PASSWORD:-}" ]; then
        export SSHPASS="$REMOTE_PASSWORD"
        sshpass -e scp -o StrictHostKeyChecking=accept-new "$1" "$2"
        unset SSHPASS
    else
        echo "[INFO] sshpass not found — you may be prompted for password."
        scp -o StrictHostKeyChecking=accept-new "$1" "$2"
    fi
}
remote_ssh() {
    if command -v sshpass &>/dev/null && [ -n "${REMOTE_PASSWORD:-}" ]; then
        export SSHPASS="$REMOTE_PASSWORD"
        sshpass -e ssh -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "$1"
        unset SSHPASS
    else
        ssh -o StrictHostKeyChecking=accept-new "$REMOTE_USER@$REMOTE_HOST" "$1"
    fi
}

echo "[1/3] Каталоги на сервере..."
remote_ssh "mkdir -p \"$REMOTE_WEBAPPS\""

echo "[2/3] Удаление старого /card_rigths (exploded)..."
remote_ssh "rm -rf '$REMOTE_WEBAPPS/card_rigths' && rm -f '$REMOTE_WEBAPPS/card_rigths.war' || true"

echo "[3/3] Копия WAR..."
remote_scp "$WAR_FILE" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_WEBAPPS/card_rigths.war"

echo ""
echo "[OK] $REMOTE_WEBAPPS/card_rigths.war"
echo "     Health (после auto-deploy Tomcat): http://$REMOTE_HOST:<порт-коннектора>/card_rigths/health"
echo "     dpa_card: eec.rights.service.baseUrl = http://$REMOTE_HOST:<порт>/card_rigths"
echo ""
