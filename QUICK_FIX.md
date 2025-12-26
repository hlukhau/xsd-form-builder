# Быстрое решение проблем

## Проблема: API возвращает 404, логи не видны

### Где искать логи:

1. **Основной лог Tomcat:**
   ```
   C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log
   ```
   (дата меняется каждый день)

2. **Лог приложения:**
   ```
   C:\tomcat\win\Tomcat8\logs\localhost.2025-12-26.log
   ```

3. **Лог Spring Boot (создается при запуске):**
   ```
   C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log
   ```

### Быстрая проверка логов:

```powershell
# Последние 100 строк основного лога
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log -Tail 100

# Поиск Spring Boot
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log | Select-String -Pattern "Spring|Application|CountryService"

# Поиск ошибок
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log | Select-String -Pattern "ERROR|Exception"
```

### Проблема: Spring Boot не запускается

**Признаки:**
- В логах нет сообщений "Starting Application"
- API возвращает 404
- Нет лога `xsd-form-builder.log`

**Решение:**

1. **Пересоберите проект с правильными зависимостями:**
   ```powershell
   npm run build
   # Затем соберите через Maven (чтобы включить все зависимости)
   ```

2. **Проверьте структуру WAR:**
   - Должна быть папка `WEB-INF/lib/` с JAR файлами Spring Boot
   - Должны быть скомпилированные классы в `WEB-INF/classes/`

3. **Проверьте, что ServletInitializer включен:**
   - Файл `src/main/java/com/eec/config/ServletInitializer.java` должен быть скомпилирован

### Проверка работы API:

После перезапуска Tomcat проверьте:
```
http://localhost:8080/xsd_form_builder/api/countries/options
```

Должен вернуться JSON со списком стран.

Если возвращается 404 - Spring Boot не запустился. Проверьте логи на ошибки.




