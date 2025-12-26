# Решение проблемы "файл используется другим процессом"

## Проблема
При развертывании WAR-файла на Tomcat возникает ошибка:
```
файл используется другим процессом
java.io.FileNotFoundException
```

## Причина
Папка развертывания `xsd-form-builder` уже существует и заблокирована процессом Tomcat.

## Решение

### Вариант 1: Остановка Tomcat через сервис Windows

1. Откройте **Службы** (Services):
   - Нажмите `Win + R`
   - Введите `services.msc`
   - Нажмите Enter

2. Найдите службу **Apache Tomcat 8.5** или **Tomcat8**

3. Остановите службу (правый клик → Остановить)

4. Удалите старую папку развертывания:
   ```powershell
   Remove-Item -Path "C:\tomcat\win\Tomcat8\webapps\xsd-form-builder" -Recurse -Force
   Remove-Item -Path "C:\tomcat\win\Tomcat8\webapps\xsd-form-builder.war" -Force
   ```

5. Скопируйте новый WAR-файл:
   ```powershell
   Copy-Item -Path "target\xsd-form-builder.war" -Destination "C:\tomcat\win\Tomcat8\webapps\xsd-form-builder.war"
   ```

6. Запустите службу Tomcat снова

### Вариант 2: Остановка через командную строку с правами администратора

1. Откройте PowerShell **от имени администратора**

2. Остановите Tomcat:
   ```powershell
   $env:CATALINA_HOME = "C:\tomcat\win\Tomcat8"
   cd "C:\tomcat\win\Tomcat8\bin"
   .\shutdown.bat
   ```

3. Подождите 5-10 секунд, пока процесс завершится

4. Удалите старую папку и WAR:
   ```powershell
   Remove-Item -Path "C:\tomcat\win\Tomcat8\webapps\xsd-form-builder" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item -Path "C:\tomcat\win\Tomcat8\webapps\xsd-form-builder.war" -Force -ErrorAction SilentlyContinue
   ```

5. Скопируйте новый WAR:
   ```powershell
   Copy-Item -Path "C:\projects\IdeaProjects\xsd-form-builder\target\xsd-form-builder.war" -Destination "C:\tomcat\win\Tomcat8\webapps\xsd-form-builder.war"
   ```

6. Запустите Tomcat:
   ```powershell
   $env:CATALINA_HOME = "C:\tomcat\win\Tomcat8"
   $env:JAVA_HOME = "C:\tomcat\win\Tomcat8\java"
   cd "C:\tomcat\win\Tomcat8\bin"
   .\startup.bat
   ```

### Вариант 3: Использование Tomcat Manager

Если Tomcat Manager доступен:

1. Откройте `http://localhost:8080/manager/html`

2. Найдите приложение **xsd-form-builder** в списке

3. Нажмите **Undeploy** для удаления

4. Подождите завершения операции

5. Загрузите новый WAR через **Deploy** → **Select WAR file to upload**

### Проверка развертывания

После развертывания проверьте:

1. Папка создана:
   ```powershell
   Test-Path "C:\tomcat\win\Tomcat8\webapps\xsd-form-builder"
   ```

2. Приложение доступно:
   - Откройте браузер
   - Перейдите на `http://localhost:8080/xsd-form-builder/`

3. Проверьте логи:
   - `C:\tomcat\win\Tomcat8\logs\catalina.out`
   - `C:\tomcat\win\Tomcat8\logs\localhost.log`

### Альтернативное решение: Развертывание в другой контекст

Если проблема повторяется, можно развернуть приложение под другим именем:

1. Переименуйте WAR:
   ```powershell
   Copy-Item -Path "target\xsd-form-builder.war" -Destination "C:\tomcat\win\Tomcat8\webapps\app.war"
   ```

2. Приложение будет доступно по адресу: `http://localhost:8080/app/`

### Предотвращение проблемы в будущем

1. Всегда останавливайте Tomcat перед заменой WAR-файла

2. Используйте скрипт для автоматического развертывания:
   ```powershell
   # deploy.ps1
   $env:CATALINA_HOME = "C:\tomcat\win\Tomcat8"
   $env:JAVA_HOME = "C:\tomcat\win\Tomcat8\java"
   
   Write-Host "Останавливаю Tomcat..."
   cd "$env:CATALINA_HOME\bin"
   .\shutdown.bat
   Start-Sleep -Seconds 5
   
   Write-Host "Удаляю старое развертывание..."
   Remove-Item -Path "$env:CATALINA_HOME\webapps\xsd-form-builder" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item -Path "$env:CATALINA_HOME\webapps\xsd-form-builder.war" -Force -ErrorAction SilentlyContinue
   
   Write-Host "Копирую новый WAR..."
   Copy-Item -Path "target\xsd-form-builder.war" -Destination "$env:CATALINA_HOME\webapps\xsd-form-builder.war"
   
   Write-Host "Запускаю Tomcat..."
   .\startup.bat
   
   Write-Host "Готово! Приложение доступно на http://localhost:8080/xsd-form-builder/"
   ```




