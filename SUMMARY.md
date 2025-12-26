# Резюме проблем и решений

## Проблемы

1. **API возвращает 404** - Spring Boot не запускается на Tomcat
2. **Логи не видны** - нужно знать где искать

## Решения

### 1. Где искать логи

**Основные логи Tomcat:**
- `C:\tomcat\win\Tomcat8\logs\catalina.YYYY-MM-DD.log` - основной лог
- `C:\tomcat\win\Tomcat8\logs\localhost.YYYY-MM-DD.log` - логи приложений
- `C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log` - лог Spring Boot (создается при запуске)

**Быстрая проверка:**
```powershell
# Последние 100 строк
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log -Tail 100

# Поиск Spring Boot
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log | Select-String -Pattern "Spring|Application|CountryService"

# Или используйте скрипт
.\check-logs.bat
```

### 2. Почему Spring Boot не запускается

**Проблема:** В WAR файле отсутствуют:
- Зависимости Spring Boot (WEB-INF/lib/)
- Скомпилированные Java классы (WEB-INF/classes/)

**Причина:** Maven не включил зависимости и классы в WAR из-за неправильной конфигурации.

**Решение:**
1. Исправлена конфигурация `maven-war-plugin` - убрано ограничение `packagingIncludes`
2. Исправлена конфигурация Spring Boot для внешнего Tomcat:
   - Исключен встроенный Tomcat из `spring-boot-starter-web`
   - Добавлен `spring-boot-starter-tomcat` с scope `provided`

### 3. Что нужно сделать

**Пересобрать проект:**
```powershell
# 1. Собрать фронтенд
npm run build

# 2. Собрать WAR с зависимостями
# Используйте build-and-deploy.bat или Maven напрямую
```

**Проверить структуру WAR:**
После сборки в `target/xsd-form-builder.war` должны быть:
- `WEB-INF/lib/` - все JAR зависимости
- `WEB-INF/classes/` - скомпилированные Java классы
- `WEB-INF/web.xml` - конфигурация
- Статические файлы из `dist/`

**Проверить логи после перезапуска:**
```powershell
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log -Tail 200 | Select-String -Pattern "Spring|Application|CountryService|ERROR"
```

Должны появиться строки:
```
[INFO] Starting Application
[INFO] Инициализация CountryService...
[INFO] Загружено стран в кеш: X
```

### 4. Проверка работы API

После перезапуска Tomcat проверьте:
```
http://localhost:8080/xsd_form_builder/api/countries/options
```

Должен вернуться JSON со списком стран.

Если все еще 404 - проверьте логи на ошибки при старте Spring Boot.




