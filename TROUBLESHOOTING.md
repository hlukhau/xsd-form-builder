# Решение проблем

## Проблема: В браузере не открывается приложение

### Что проверить

1. **Правильный адрес (обязательно с путём приложения):**
   - ✅ `http://localhost:8080/xsd_form_builder/`
   - ❌ Не открывать только `http://localhost:8080` — там приложения нет.

2. **Быстрый запуск:** дважды откройте файл `open-app.html` в корне проекта — он откроет приложение в браузере.

3. **После деплоя:** скрипт `build-and-deploy.bat` теперь ждёт 15 секунд и сам открывает браузер. Если окно закрыли до этого — откройте вручную по ссылке выше или через `open-app.html`.

4. **Tomcat запущен?** В командной строке:
   ```cmd
   netstat -ano | findstr "8080"
   ```
   Должна быть строка с `LISTENING`. Если нет — запустите Tomcat (или заново выполните `build-and-deploy.bat`).

5. **Брандмауэр/антивирус:** иногда блокируют localhost. Временно отключите или добавьте исключение для Java/Tomcat.

6. **Другой браузер:** попробуйте Chrome, Edge или режим инкогнито.

7. **Ошибки развёртывания:** смотрите логи:
   - `C:\tomcat\win\Tomcat8\logs\catalina.out` — общий лог Tomcat
   - `C:\tomcat\win\Tomcat8\logs\localhost.*.log` — ошибки приложений

## Проблема: API возвращает 404

### Причина
Spring Boot не запускается на Tomcat или зависимости не включены в WAR.

### Решение

1. **Проверьте логи Tomcat:**
   ```powershell
   # Основной лог
   Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 100
   
   # Лог приложения
   Get-Content C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log -Tail 50
   ```

2. **Проверьте, что Spring Boot запустился:**
   В логах должны быть строки:
   ```
   [INFO] Starting Application
   [INFO] Started Application in X seconds
   ```

3. **Проверьте структуру WAR:**
   Убедитесь, что в `WEB-INF/lib/` есть все зависимости Spring Boot:
   ```powershell
   # Распакуйте WAR и проверьте
   Expand-Archive -Path C:\tomcat\win\Tomcat8\webapps\xsd_form_builder.war -DestinationPath C:\temp\war-check -Force
   Get-ChildItem C:\temp\war-check\WEB-INF\lib | Select-Object Name
   ```

4. **Пересоберите проект:**
   ```powershell
   npm run build
   # Затем используйте Maven для сборки WAR с зависимостями
   ```

## Проблема: Логи не видны

### Где искать логи

1. **Основной лог Tomcat:**
   - `C:\tomcat\win\Tomcat8\logs\catalina.out`
   - Содержит все сообщения Tomcat и приложений

2. **Лог приложения:**
   - `C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log`
   - Создается автоматически при запуске Spring Boot

3. **Лог localhost:**
   - `C:\tomcat\win\Tomcat8\logs\localhost.log`
   - Ошибки развертывания конкретных приложений

### Как просмотреть логи

**Через PowerShell:**
```powershell
# Последние 100 строк
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 100

# Поиск ошибок
Select-String -Path C:\tomcat\win\Tomcat8\logs\catalina.out -Pattern "ERROR|Exception"

# Поиск Spring Boot
Select-String -Path C:\tomcat\win\Tomcat8\logs\catalina.out -Pattern "Spring|Application|CountryService"
```

**Через скрипт:**
```powershell
.\check-logs.bat
```

## Проблема: Страна не найдена в справочнике

### Проверка

1. **Проверьте загрузку справочника в логах:**
   ```
   [INFO] Инициализация CountryService...
   [INFO] Загружено стран в кеш: X
   [INFO] Страна BY в справочнике: true/false
   ```

2. **Проверьте API напрямую:**
   ```
   http://localhost:8080/xsd_form_builder/api/countries/options
   ```

3. **Проверьте подключение к БД:**
   В логах не должно быть ошибок подключения к Oracle.

### Решение

Если страна не загружается:
- Проверьте даты в БД (COUNTRYSDATE и COUNTRYEDATE)
- Обновите кеш: `POST /api/countries/refresh`
- Проверьте логи на наличие ошибок SQL

## Проверка работы Spring Boot

### Быстрая проверка

1. **Откройте в браузере:**
   ```
   http://localhost:8080/xsd_form_builder/api/countries/options
   ```
   Должен вернуться JSON со списком стран.

2. **Проверьте логи:**
   ```powershell
   Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 200 | Select-String -Pattern "Spring|Application|CountryService|ERROR"
   ```

3. **Проверьте структуру развернутого приложения:**
   ```powershell
   Get-ChildItem C:\tomcat\win\Tomcat8\webapps\xsd_form_builder\WEB-INF\lib | Select-Object Name -First 20
   ```

## Частые ошибки

### Ошибка: ClassNotFoundException
**Причина:** Зависимости не включены в WAR  
**Решение:** Пересоберите проект через Maven

### Ошибка: Cannot connect to database
**Причина:** Неправильные настройки подключения  
**Решение:** Проверьте `application.properties` и доступность БД

### Ошибка: 404 на все API запросы
**Причина:** Spring Boot не запустился  
**Решение:** Проверьте логи на наличие ошибок при старте







