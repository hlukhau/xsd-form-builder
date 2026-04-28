#!/bin/bash
# Manual WAR build without Maven (using javac) — Linux
# Использование:
#   ./build-manual.sh              — DPA: frontend из dist/, WAR dpa_card.war
#   ./build-manual.sh pha_card   — PHA: frontend из dist/ (сборка build:pha), WAR pha_card.war
#   ./build-manual.sh ppv_card   — PPV: frontend из dist/ (сборка build:ppv), WAR ppv_card.war
# Переменная DEPLOY=0 — только собрать WAR, не останавливать/разворачивать Tomcat.
# HOT_DEPLOY=1 — скопировать WAR в webapps без остановки/запуска Tomcat (развёртывание подхватит работающий экземпляр).
# Полный рестарт Tomcat как раньше: HOT_DEPLOY=0 (по умолчанию) при DEPLOY=1 — shutdown, удаление, копия WAR, startup.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

APP_NAME="${1:-dpa_card}"
TOMCAT_HOME="${TOMCAT_HOME:-/opt/tomcat8}"
# Сборка WAR через javac: нужен JDK. IDE часто задаёт JAVA_HOME на JRE без javac — тогда игнорируем и ищем JDK.
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
WAR_FILE="$PROJECT_DIR/target/$APP_NAME.war"
WEBAPPS_PATH="$TOMCAT_HOME/webapps"
APP_PATH="$WEBAPPS_PATH/$APP_NAME"
SRC_DIR="$PROJECT_DIR/src/main/java"
CLASS_DIR="$PROJECT_DIR/target/$APP_NAME/WEB-INF/classes"
DEPLOY="${DEPLOY:-1}"
HOT_DEPLOY="${HOT_DEPLOY:-0}"

# Check Java
if [ ! -x "$JAVA_HOME/bin/javac" ]; then
    echo "[ERROR] Java compiler (javac) not found: $JAVA_HOME/bin/javac"
    echo "Install a JDK (not JRE), or set JAVA_HOME to a JDK that contains bin/javac."
    echo "Example: export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64"
    exit 1
fi

# [1/6] Create structure
echo "[1/6] Creating structure..."
OJBC_TEMP=$(mktemp -u).jar
if [ -f "target/$APP_NAME/WEB-INF/lib/ojdbc8.jar" ]; then
    cp "target/$APP_NAME/WEB-INF/lib/ojdbc8.jar" "$OJBC_TEMP"
fi
rm -rf "target/$APP_NAME"
mkdir -p "target/$APP_NAME/WEB-INF/classes"
mkdir -p "target/$APP_NAME/WEB-INF/lib"
if [ -f "$OJBC_TEMP" ]; then
    cp "$OJBC_TEMP" "target/$APP_NAME/WEB-INF/lib/ojdbc8.jar"
    rm -f "$OJBC_TEMP"
fi
echo "[OK] Structure created"
echo ""

# [2/6] Copy frontend
echo "[2/6] Copying frontend..."
if [ ! -d "dist" ]; then
    echo "[ERROR] dist folder not found! Run: npm run build"
    exit 1
fi
cp -r dist/* "target/$APP_NAME/"
if [ ! -f "target/$APP_NAME/index.html" ]; then
    echo "[ERROR] index.html not copied!"
    exit 1
fi
cp "src/main/webapp/WEB-INF/web.xml" "target/$APP_NAME/WEB-INF/web.xml"
if [ ! -f "target/$APP_NAME/WEB-INF/web.xml" ]; then
    echo "[ERROR] web.xml not copied!"
    exit 1
fi
echo "[OK] Frontend copied"
echo ""

# [3/6] Copy dependencies (Oracle JDBC)
echo "[3/6] Copying dependencies..."
DEPS_FOUND=0

if [ -f "target/$APP_NAME/WEB-INF/lib/ojdbc8.jar" ]; then
    echo "[OK] Oracle JDBC already exists in target directory"
    DEPS_FOUND=1
fi

if [ "$DEPS_FOUND" -eq 0 ] && [ -d "$HOME/.m2/repository/com/oracle/database/jdbc/ojdbc8" ]; then
    OJAR=$(find "$HOME/.m2/repository/com/oracle/database/jdbc/ojdbc8" -name "ojdbc8-*.jar" | head -1)
    if [ -n "$OJAR" ]; then
        cp "$OJAR" "target/$APP_NAME/WEB-INF/lib/ojdbc8.jar"
        echo "[OK] Oracle JDBC copied from Maven repository"
        DEPS_FOUND=1
    fi
fi

if [ "$DEPS_FOUND" -eq 0 ]; then
    echo "[WARN] Oracle JDBC not found in local repository"
    echo "[INFO] Trying to download ojdbc8.jar from Maven Central..."
    OJURL="https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/21.9.0.0/ojdbc8-21.9.0.0.jar"
    if command -v curl &>/dev/null; then
        if curl -fsSL -o "target/$APP_NAME/WEB-INF/lib/ojdbc8.jar" "$OJURL"; then
            echo "[OK] Oracle JDBC downloaded"
            DEPS_FOUND=1
        fi
    elif command -v wget &>/dev/null; then
        if wget -q -O "target/$APP_NAME/WEB-INF/lib/ojdbc8.jar" "$OJURL"; then
            echo "[OK] Oracle JDBC downloaded"
            DEPS_FOUND=1
        fi
    fi
    if [ "$DEPS_FOUND" -eq 0 ]; then
        echo "[WARN] Download failed. App cannot connect to DB without ojdbc8.jar"
        echo "[INFO] Place ojdbc8.jar manually in target/$APP_NAME/WEB-INF/lib/"
    fi
fi
echo "[OK] Dependencies processed"
echo ""

# [4/6] Compile Java classes
echo "[4/6] Compiling Java classes..."
SERVLET_API="$TOMCAT_HOME/lib/servlet-api.jar"
if [ ! -f "$SERVLET_API" ]; then
    echo "[ERROR] servlet-api.jar not found: $SERVLET_API"
    exit 1
fi

# Build classpath: servlet-api + WEB-INF/lib/*.jar
CLASSPATH="$SERVLET_API"
for j in "target/$APP_NAME/WEB-INF/lib"/*.jar; do
    [ -f "$j" ] && CLASSPATH="$CLASSPATH:$j"
done

# Create package dirs
find "$SRC_DIR" -name "*.java" | while IFS= read -r f; do
    rel="${f#$SRC_DIR/}"
    dir="$CLASS_DIR/$(dirname "$rel")"
    mkdir -p "$dir"
done

TMPLIST=$(mktemp)
find "$SRC_DIR" -name "*.java" > "$TMPLIST"
if [ ! -s "$TMPLIST" ]; then
    echo "[ERROR] No Java files found in $SRC_DIR"
    rm -f "$TMPLIST"
    exit 1
fi

# Compile (use @file to avoid command line length limit)
if ! "$JAVA_HOME/bin/javac" -encoding UTF-8 -sourcepath "$SRC_DIR" -d "$CLASS_DIR" -cp "$CLASSPATH" @"$TMPLIST" 2>"$PROJECT_DIR/compile-all.log"; then
    echo "[ERROR] Compilation errors:"
    cat "$PROJECT_DIR/compile-all.log"
    rm -f "$PROJECT_DIR/compile-all.log" "$TMPLIST"
    exit 1
fi
rm -f "$PROJECT_DIR/compile-all.log" "$TMPLIST"

CLASS_COUNT=$(find "$CLASS_DIR" -name "*.class" 2>/dev/null | wc -l)
if [ "$CLASS_COUNT" -eq 0 ]; then
    echo "[ERROR] No compiled classes found!"
    exit 1
fi
echo "[OK] Java classes compiled ($CLASS_COUNT classes)"
echo ""

# [4b/6] XSD ЕЭК в classpath (XmlSchemaValidateServlet: getResource("eec-xsd/…"))
echo "[4b/6] Copying EEC XSD into WEB-INF/classes/eec-xsd/..."
XSD_SRC="$PROJECT_DIR/xsd"
XSD_DST="target/$APP_NAME/WEB-INF/classes/eec-xsd"
if [ -d "$XSD_SRC" ]; then
    mkdir -p "$XSD_DST"
    shopt -s nullglob
    XSD_FILES=("$XSD_SRC"/*.xsd)
    shopt -u nullglob
    if [ ${#XSD_FILES[@]} -eq 0 ]; then
        echo "[WARN] No *.xsd in $XSD_SRC — проверка по XSD на сервере не заработает"
    else
        cp -f "${XSD_FILES[@]}" "$XSD_DST/"
        echo "[OK] Copied ${#XSD_FILES[@]} schema file(s) to eec-xsd/"
    fi
else
    echo "[WARN] Directory xsd/ not found — XSD validation servlet will fail at init"
fi
echo ""

# [5/6] Create WAR
echo "[5/6] Creating WAR file..."
rm -f "$WAR_FILE"
(cd "target/$APP_NAME" && "$JAVA_HOME/bin/jar" cf "../$APP_NAME.war" .)
if [ ! -f "$WAR_FILE" ]; then
    echo "[ERROR] WAR file not created!"
    exit 1
fi
WAR_SIZE=$(stat -c%s "$WAR_FILE" 2>/dev/null || stat -f%z "$WAR_FILE" 2>/dev/null)
echo "[OK] WAR file created: $WAR_FILE ($(($WAR_SIZE / 1048576)) MB)"
echo ""

# [6/6] Deploy to webapps (пропускается при DEPLOY=0)
if [ "$DEPLOY" != "1" ]; then
    echo "[6/6] Skipping deploy (DEPLOY=$DEPLOY). WAR: $WAR_FILE"
    exit 0
fi
# Tomcat scripts expect CATALINA_HOME, CATALINA_BASE and JAVA_HOME
export CATALINA_HOME="$TOMCAT_HOME"
export CATALINA_BASE="${CATALINA_BASE:-$TOMCAT_HOME}"
export JAVA_HOME

remove_old_deployment_and_copy_war() {
    echo "Removing old deployment..."
    rm -rf "$APP_PATH"
    rm -f "$WEBAPPS_PATH/$APP_NAME.war"
    if [ "$APP_NAME" = "dpa_card" ]; then
        rm -rf "$WEBAPPS_PATH/xsd_form_builder" "$WEBAPPS_PATH/xsd-form-builder"
        rm -f "$WEBAPPS_PATH/xsd_form_builder.war" "$WEBAPPS_PATH/xsd-form-builder.war"
    elif [ "$APP_NAME" = "pha_card" ]; then
        rm -rf "$WEBAPPS_PATH/xsd_form_builder_57"
        rm -f "$WEBAPPS_PATH/xsd_form_builder_57.war"
    fi
    echo "[OK] Old deployment removed"
    echo ""
    echo "Deploying WAR..."
    cp "$WAR_FILE" "$WEBAPPS_PATH/$APP_NAME.war"
    if [ $? -ne 0 ]; then
        echo "[ERROR] Failed to copy WAR to $WEBAPPS_PATH"
        exit 1
    fi
    echo "[OK] Application WAR installed: $WEBAPPS_PATH/$APP_NAME.war"
    echo ""
}

if [ "$HOT_DEPLOY" = "1" ]; then
    echo "[6/6] Hot deploy — подмена WAR без остановки Tomcat (HOT_DEPLOY=1)..."
    remove_old_deployment_and_copy_war
    if pgrep -f "catalina" >/dev/null 2>&1; then
        echo "Tomcat запущен: подождите 10–30 с, пока подтянется новое развёртывание."
    else
        echo "Tomcat не запущен: выполните таск «Tomcat: start (local)» или: ./start-tomcat.sh"
    fi
    echo "  Лог: $TOMCAT_HOME/logs/catalina.out"
    echo ""
    exit 0
fi

echo "[6/6] Stopping Tomcat (полный рестарт; для только WAR задайте HOT_DEPLOY=1)..."
# Проверяем, запущен ли Tomcat
if pgrep -f "catalina" >/dev/null 2>&1; then
    echo "  Tomcat is running, stopping..."
    if [ -x "$TOMCAT_HOME/bin/shutdown.sh" ]; then
        cd "$TOMCAT_HOME/bin"
        ./shutdown.sh
        SHUTDOWN_EXIT_CODE=$?
        cd "$PROJECT_DIR"
        
        if [ $SHUTDOWN_EXIT_CODE -ne 0 ]; then
            echo "  [WARN] shutdown.sh exited with code $SHUTDOWN_EXIT_CODE"
        fi
        
        # Ждем остановки процесса
        echo "  Waiting for Tomcat to stop..."
        MAX_WAIT=15
        WAITED=0
        while pgrep -f "catalina" >/dev/null 2>&1 && [ $WAITED -lt $MAX_WAIT ]; do
            sleep 1
            WAITED=$((WAITED + 1))
            echo -n "."
        done
        echo ""
        
        # Принудительная остановка, если процесс все еще работает
        if pgrep -f "catalina" >/dev/null 2>&1; then
            echo "  [WARN] Tomcat still running, forcing shutdown..."
            pkill -f "catalina" 2>/dev/null || true
            sleep 2
            if pgrep -f "catalina" >/dev/null 2>&1; then
                echo "  [WARN] Force kill may have failed, but continuing..."
            else
                echo "  [OK] Tomcat forcefully stopped"
            fi
        else
            echo "  [OK] Tomcat stopped gracefully"
        fi
    else
        echo "  [WARN] shutdown.sh not found, trying to kill processes..."
        pkill -f "catalina" 2>/dev/null || true
        sleep 2
    fi
else
    echo "  [INFO] Tomcat is not running"
fi
echo ""

remove_old_deployment_and_copy_war
echo "Starting Tomcat..."
if [ ! -x "$TOMCAT_HOME/bin/startup.sh" ]; then
    echo "[ERROR] startup.sh not found at $TOMCAT_HOME/bin/startup.sh"
    echo "  Start Tomcat manually:"
    echo "    export CATALINA_HOME=$TOMCAT_HOME"
    echo "    export JAVA_HOME=$JAVA_HOME"
    echo "    \$CATALINA_HOME/bin/startup.sh"
    exit 1
fi

# Проверяем переменные окружения перед запуском
if [ -z "$CATALINA_HOME" ]; then
    echo "[ERROR] CATALINA_HOME is not set"
    exit 1
fi

if [ -z "$JAVA_HOME" ]; then
    echo "[ERROR] JAVA_HOME is not set"
    exit 1
fi

echo "  CATALINA_HOME: $CATALINA_HOME"
echo "  JAVA_HOME: $JAVA_HOME"

# Запускаем Tomcat через nohup и disown, чтобы Java-процесс не завершался по SIGHUP при выходе скрипта
cd "$TOMCAT_HOME/bin"
nohup ./startup.sh >> "$TOMCAT_HOME/logs/startup.log" 2>&1 &
disown -h 2>/dev/null || true
cd "$PROJECT_DIR"

echo "[OK] Tomcat startup script executed"
echo "  Waiting 15 s for Tomcat to start..."
sleep 15

# Проверяем, запустился ли Tomcat
if pgrep -f "catalina" >/dev/null 2>&1; then
    echo "[OK] Tomcat process is running"
else
    echo "[WARN] Tomcat process not found after startup (процесс завершился)"
    if [ -f "$TOMCAT_HOME/logs/catalina.out" ]; then
        echo "  Last 30 lines of $TOMCAT_HOME/logs/catalina.out:"
        tail -30 "$TOMCAT_HOME/logs/catalina.out" | sed 's/^/    /'
    fi
    echo ""
    echo "  Чтобы увидеть причину падения, запустите в переднем плане:"
    echo "    TOMCAT_HOME=$TOMCAT_HOME $PROJECT_DIR/run-tomcat-foreground.sh"
    echo "  Частые причины: OutOfMemoryError (увеличьте -Xmx в bin/setenv.sh),"
    echo "  ошибка при загрузке приложения (смотрите Exception в логе выше)."
fi

echo "  Logs: $TOMCAT_HOME/logs/catalina.out"
echo ""

exit 0
