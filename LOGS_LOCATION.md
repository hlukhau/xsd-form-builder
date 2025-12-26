# Где искать логи приложения

## Логи Tomcat

### Основные логи
- **catalina.out** - основной лог Tomcat и приложения
  - Путь: `C:\tomcat\win\Tomcat8\logs\catalina.out`
  - Содержит: запуск Tomcat, развертывание приложений, ошибки

- **localhost.log** - логи конкретных приложений
  - Путь: `C:\tomcat\win\Tomcat8\logs\localhost.log`
  - Содержит: ошибки при развертывании и работе приложений

- **xsd-form-builder.log** - логи Spring Boot приложения
  - Путь: `C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log`
  - Содержит: логи Spring Boot, загрузка справочников, API запросы

### Другие логи
- **manager.log** - логи Tomcat Manager
- **host-manager.log** - логи Host Manager

## Как просмотреть логи

### Через командную строку
```powershell
# Последние 50 строк catalina.out
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 50

# Поиск ошибок
Select-String -Path C:\tomcat\win\Tomcat8\logs\catalina.out -Pattern "ERROR|Exception|CountryService"

# Логи приложения
Get-Content C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log -Tail 100
```

### Через текстовый редактор
Откройте файлы в блокноте или любом текстовом редакторе:
- `C:\tomcat\win\Tomcat8\logs\catalina.out`
- `C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log`

## Что искать в логах

### При запуске приложения
```
[INFO] Запуск приложения XSD Form Builder...
[INFO] Инициализация CountryService...
[INFO] Начало загрузки справочника стран из БД...
[INFO] Загружено стран в кеш: X
```

### При ошибках подключения к БД
```
[ERROR] Ошибка при инициализации CountryService
java.sql.SQLException: ...
```

### При запросах к API
```
[INFO] Проверка существования страны: RU
[DEBUG] Страна найдена: RU -> Российская Федерация
```

## Проверка работы Spring Boot

Если API возвращает 404, проверьте в логах:

1. **Запустился ли Spring Boot:**
   ```
   [INFO] Starting Application
   [INFO] Started Application in X seconds
   ```

2. **Загрузились ли контроллеры:**
   ```
   [INFO] Mapped "{[/api/countries]}" onto ...
   ```

3. **Есть ли ошибки при старте:**
   ```
   [ERROR] Application run failed
   ```

## Быстрая проверка

Выполните в PowerShell:
```powershell
# Проверка последних ошибок
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 100 | Select-String -Pattern "ERROR|Exception|CountryService|Application"

# Проверка логов приложения
if (Test-Path "C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log") {
    Get-Content C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log -Tail 50
} else {
    Write-Host "Лог файл приложения не найден. Проверьте catalina.out"
}
```



