#!/bin/bash
# Сборка и развёртывание приложения PHA (карта обнаружения болезней).
# URL: http://localhost:PORT/xsd_form_builder_57/
# Использование: ./build-and-deploy-pha.sh
#
# Переменные: TOMCAT_HOME, JAVA_HOME (по умолчанию /opt/tomcat8, $TOMCAT_HOME/java)

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

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
APP_NAME="xsd_form_builder_57"
WAR_FILE="$PROJECT_DIR/target/$APP_NAME.war"

echo "========================================"
echo " Build and Deploy PHA ($APP_NAME)"
echo "========================================"
echo "TOMCAT_HOME=$TOMCAT_HOME"
echo "JAVA_HOME=$JAVA_HOME"
echo ""

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -f .nvmrc ] && nvm use 2>/dev/null || true

echo "[1/4] Building PHA frontend (base: /xsd_form_builder_57/)..."
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js not found in PATH."
    exit 1
fi
npm run build:pha
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "[ERROR] PHA build failed or dist missing"
    exit 1
fi
echo "[OK] PHA frontend built"
echo ""

echo "[2/4] Checking Java..."
if [ ! -x "$JAVA_HOME/bin/javac" ]; then
    echo "[ERROR] Java compiler not found: $JAVA_HOME/bin/javac"
    exit 1
fi
echo "[OK] Java found"
echo ""

echo "[3/4] Building WAR and deploying..."
export TOMCAT_HOME JAVA_HOME
./build-manual.sh xsd_form_builder_57
echo "[OK] WAR built and deployed"
echo ""

echo "[4/4] Checking WAR..."
if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR not found: $WAR_FILE"
    exit 1
fi
WAR_SIZE_MB=$(($(stat -c%s "$WAR_FILE" 2>/dev/null || stat -f%z "$WAR_FILE" 2>/dev/null) / 1048576))
echo "[OK] WAR: $WAR_FILE (${WAR_SIZE_MB} MB)"
echo ""

TOMCAT_PORT=$("$PROJECT_DIR/get-tomcat-port.sh" 2>/dev/null) || TOMCAT_PORT="8080"
echo "========================================"
echo " PHA DEPLOYMENT COMPLETE"
echo "========================================"
echo ""
echo "  http://localhost:$TOMCAT_PORT/xsd_form_builder_57/"
echo ""
echo "Wait 15-25 seconds for Tomcat. Logs: $TOMCAT_HOME/logs/catalina.out"
echo ""
