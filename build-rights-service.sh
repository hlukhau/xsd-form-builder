#!/bin/bash
# Сборка eec-rights-service: Java 8, сервлеты, WAR (как dpa_card / pha_card / ppv_card).
# Использование: ./build-rights-service.sh
# Артефакт: rights-service/target/card_rigths.war  → контекст Tomcat /card_rigths

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR/rights-service"

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
export JAVA_HOME

echo "========================================"
echo " Build eec-rights-service (WAR)"
echo "========================================"
echo "JAVA_HOME=$JAVA_HOME"
echo ""

if ! command -v mvn &>/dev/null; then
    echo "[ERROR] Maven (mvn) not found in PATH"
    exit 1
fi

mvn -q -DskipTests package

WAR_FILE="$PROJECT_DIR/rights-service/target/card_rigths.war"
if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR not found: $WAR_FILE"
    exit 1
fi

echo ""
echo "[OK] $WAR_FILE"
echo "     Копия в Tomcat: ./deploy-rights-service-local.sh  (TOMCAT_HOME → webapps/card_rigths.war)"
echo "     (контекст: /card_rigths, см. rights-service/README.md)"
echo ""
