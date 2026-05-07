#!/bin/bash
# Копия WAR eec-rights-service в $TOMCAT_HOME/webapps (тот же Tomcat, что и dpa_card / pha_card / ppv_card).
#
#   ./deploy-rights-service-local.sh
#   ./deploy-rights-service-local.sh --build
#   ./deploy-rights-service-local.sh --copy-only   # только копия WAR, без rm развёрнутой папки
#
# Переменные: TOMCAT_HOME (по умолчанию /opt/tomcat8)
# Артефакт: rights-service/target/card_rigths.war  →  webapps/card_rigths.war

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

DO_BUILD=0
COPY_ONLY=0
for a in "$@"; do
  case "$a" in
    --build) DO_BUILD=1 ;;
    --copy-only) COPY_ONLY=1 ;;
  esac
done

if [ "$DO_BUILD" = 1 ]; then
  ./build-rights-service.sh
  echo ""
fi

WAR_FILE="$PROJECT_DIR/rights-service/target/card_rigths.war"
if [ ! -f "$WAR_FILE" ]; then
  echo "[ERROR] WAR not found: $WAR_FILE"
  echo "Run: ./build-rights-service.sh  или  $0 --build"
  exit 1
fi

TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
WEBAPPS="$TOMCAT_HOME/webapps"
DEST_WAR="$WEBAPPS/card_rigths.war"
DEST_DIR="$WEBAPPS/card_rigths"

echo "========================================"
echo " Deploy eec-rights-service (WAR → Tomcat)"
echo "========================================"
echo "TOMCAT_HOME=$TOMCAT_HOME"
echo "WAR: $WAR_FILE"
echo " -> $DEST_WAR"
echo ""

if [ ! -d "$WEBAPPS" ]; then
  echo "[ERROR] Нет каталога webapps: $WEBAPPS (проверьте TOMCAT_HOME)"
  exit 1
fi

if [ "$COPY_ONLY" = 0 ]; then
  echo "Removing old deployment (exploded)..."
  rm -rf "$DEST_DIR"
  rm -f "$DEST_WAR"
  echo "[OK] Старое приложение /card_rigths убрано"
  echo ""
fi

cp -f "$WAR_FILE" "$DEST_WAR"
echo "[OK] Скопировано: $DEST_WAR"
echo ""

TOMCAT_PORT=$("$PROJECT_DIR/get-tomcat-port.sh" 2>/dev/null) || TOMCAT_PORT="8080"
echo "После auto-deploy (или рестарта Tomcat):"
echo "  http://localhost:$TOMCAT_PORT/card_rigths/health"
echo "  http://localhost:$TOMCAT_PORT/card_rigths/api/rights"
echo ""
echo "WAR dpa_card должен смотреть в тот же хост/порт: eec.rights.service.baseUrl ="
echo "  http://127.0.0.1:$TOMCAT_PORT/card_rigths  (в web.xml / env, без / в конце)"
echo "Лог: $TOMCAT_HOME/logs/catalina.out"
echo ""
