# Скачивание зависимостей вручную

Если зависимости не найдены в локальном Maven репозитории, скачайте их вручную:

## Gson 2.10.1

1. Скачайте: https://repo1.maven.org/maven2/com/google/code/gson/gson/2.10.1/gson-2.10.1.jar
2. Поместите в: `target/xsd_form_builder/WEB-INF/lib/gson.jar`

## Oracle JDBC 21.9.0.0

1. Скачайте: https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/21.9.0.0/ojdbc8-21.9.0.0.jar
2. Поместите в: `target/xsd_form_builder/WEB-INF/lib/ojdbc8.jar`

## Альтернатива: через curl (если доступен)

```powershell
# Создать папку для зависимостей
New-Item -ItemType Directory -Path "target\xsd_form_builder\WEB-INF\lib" -Force

# Скачать Gson
curl -L -o "target\xsd_form_builder\WEB-INF\lib\gson.jar" "https://repo1.maven.org/maven2/com/google/code/gson/gson/2.10.1/gson-2.10.1.jar"

# Скачать Oracle JDBC
curl -L -o "target\xsd_form_builder\WEB-INF\lib\ojdbc8.jar" "https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/21.9.0.0/ojdbc8-21.9.0.0.jar"
```

После скачивания зависимостей запустите сборку снова.




