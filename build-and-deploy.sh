#!/bin/bash
# Build and deploy application to Tomcat (Linux)
# Использование: ./build-and-deploy.sh
#
# Переменные окружения (опционально):
#   TOMCAT_HOME  — каталог Tomcat (по умолчанию /opt/tomcat8)
#   JAVA_HOME    — каталог JDK (по умолчанию $TOMCAT_HOME/java)

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
APP_NAME="xsd_form_builder"
WAR_FILE="$PROJECT_DIR/target/$APP_NAME.war"

echo "========================================"
echo " Build and Deploy $APP_NAME"
echo "========================================"
echo "TOMCAT_HOME=$TOMCAT_HOME"
echo "JAVA_HOME=$JAVA_HOME"
echo ""

# Ensure Node.js 20+ for Vite (optional: load nvm)
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -f .nvmrc ] && nvm use 2>/dev/null || true

# [1/4] Build React app
echo "[1/4] Building React app..."
if ! command -v node &>/dev/null; then
    echo "[ERROR] Node.js not found in PATH. Install Node.js or add it to PATH."
    exit 1
fi
npm run build
echo "[OK] React app built"
echo ""

# [2/4] Check Java
echo "[2/4] Checking Java..."
if [ ! -x "$JAVA_HOME/bin/javac" ]; then
    echo "[ERROR] Java compiler not found: $JAVA_HOME/bin/javac"
    echo "Set JAVA_HOME or install Java in $JAVA_HOME"
    exit 1
fi
echo "[OK] Java found: $JAVA_HOME"
echo ""

# [3/4] Build WAR and deploy
echo "[3/4] Building WAR and deploying..."
echo "[INFO] Using manual build (without Maven)"
echo ""
export TOMCAT_HOME JAVA_HOME
./build-manual.sh
echo "[OK] WAR built and deployed"
echo ""

# [4/4] Check built WAR
echo "[4/4] Checking built WAR..."
if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR file not found: $WAR_FILE"
    exit 1
fi
WAR_SIZE=$(stat -c%s "$WAR_FILE" 2>/dev/null || stat -f%z "$WAR_FILE" 2>/dev/null)
WAR_SIZE_MB=$((WAR_SIZE / 1048576))
echo "[OK] WAR file found: ${WAR_SIZE_MB} MB"

# Check compiled classes
CLASSES_OK=1
for cls in "com/eec/servlet/CountriesOptionsServlet.class" "com/eec/servlet/CountryExistsServlet.class" "com/eec/servlet/SpaServlet.class" "com/eec/util/DatabaseUtil.class"; do
    if [ ! -f "target/$APP_NAME/WEB-INF/classes/$cls" ]; then
        echo "[WARN] $cls not found"
        CLASSES_OK=0
    fi
done
if [ "$CLASSES_OK" -eq 1 ]; then
    echo "[OK] All Java classes compiled"
else
    echo "[ERROR] Not all Java classes compiled!"
fi

if [ -f "target/$APP_NAME/WEB-INF/lib/ojdbc8.jar" ]; then
    echo "[OK] Oracle JDBC found"
else
    echo "[WARN] Oracle JDBC not found - app cannot connect to DB"
fi
echo ""

# Определяем порт Tomcat из server.xml
export TOMCAT_HOME
TOMCAT_PORT=$("$PROJECT_DIR/get-tomcat-port.sh")

echo "========================================"
echo " DEPLOYMENT COMPLETE!"
echo "========================================"
echo ""
echo "Application available at (port $TOMCAT_PORT):"
echo "  http://localhost:$TOMCAT_PORT/$APP_NAME/"
echo ""
echo "API for testing:"
echo "  http://localhost:$TOMCAT_PORT/$APP_NAME/api/countries/options"
echo ""
echo "WAR file: $WAR_FILE"
echo "Size: ${WAR_SIZE_MB} MB"
echo ""
echo "Wait 15-25 seconds for full deployment."
echo "If Tomcat did not start, run: TOMCAT_HOME=$TOMCAT_HOME $PROJECT_DIR/start-tomcat-foreground.sh"
echo "  (or set TOMCAT_HOME to your Tomcat dir, e.g. export TOMCAT_HOME=/home/hlukhau/tomcat8)"
echo "Check logs: $TOMCAT_HOME/logs/catalina.out"
echo ""
echo "Check servlets in logs: CountriesOptionsServlet, CountryExistsServlet, SpaServlet"
echo ""
