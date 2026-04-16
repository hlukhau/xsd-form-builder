#!/bin/bash
# Сборка и развёртывание приложения PPV (карта сведений о выявленных нарушениях).
# URL: http://localhost:PORT/ppv_card/
# Использование: ./build-and-deploy-ppv.sh
#
# Переменные: TOMCAT_HOME, JAVA_HOME (по умолчанию /opt/tomcat8, $TOMCAT_HOME/java)

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
if [ -n "${JAVA_HOME:-}" ] && [ ! -x "$JAVA_HOME/bin/javac" ]; then
    echo "[WARN] JAVA_HOME has no javac: $JAVA_HOME — picking another JDK" >&2
    unset JAVA_HOME
fi
if [ -z "${JAVA_HOME:-}" ]; then
    _picked=""
    for _cand in \
        "$TOMCAT_HOME/java" \
        "/usr/lib/jvm/java-21-openjdk-amd64" \
        "/usr/lib/jvm/java-21-openjdk" \
        "/usr/lib/jvm/java-17-openjdk-amd64" \
        "/usr/lib/jvm/java-11-openjdk-amd64" \
        "/usr/lib/jvm/java-11-openjdk"
    do
        if [ -x "$_cand/bin/javac" ]; then _picked="$_cand"; break; fi
    done
    if [ -n "$_picked" ]; then
        JAVA_HOME="$_picked"
    elif _jc=$(command -v javac 2>/dev/null) && [ -n "$_jc" ]; then
        JAVA_HOME=$(dirname "$(dirname "$(readlink -f "$_jc" 2>/dev/null || echo "$_jc")")")
    else
        JAVA_HOME="$TOMCAT_HOME/java"
    fi
    unset _picked _jc
fi
APP_NAME="ppv_card"
WAR_FILE="$PROJECT_DIR/target/$APP_NAME.war"

echo "========================================"
echo " Build and Deploy PPV ($APP_NAME)"
echo "========================================"
echo "TOMCAT_HOME=$TOMCAT_HOME"
echo "JAVA_HOME=$JAVA_HOME"
echo ""

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -f .nvmrc ] && nvm use 2>/dev/null || true

echo "[1/4] Building PPV frontend (base: /ppv_card/)..."
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js not found in PATH."
    exit 1
fi
npm run build:ppv
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo "[ERROR] PPV build failed or dist missing"
    exit 1
fi
echo "[OK] PPV frontend built"
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
./build-manual.sh ppv_card
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
echo " PPV DEPLOYMENT COMPLETE"
echo "========================================"
echo ""
echo "  http://localhost:$TOMCAT_PORT/ppv_card/"
echo ""
echo "Wait 15-25 seconds for Tomcat. Logs: $TOMCAT_HOME/logs/catalina.out"
echo ""
