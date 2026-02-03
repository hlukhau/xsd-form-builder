# Скрипт для развертывания WAR-файла на Tomcat
# Использование: .\deploy.ps1

$env:CATALINA_HOME = "C:\tomcat\win\Tomcat8"
$env:JAVA_HOME = "C:\tomcat\win\Tomcat8\java"
$projectPath = "C:\projects\IdeaProjects\xsd-form-builder"
$warFile = "$projectPath\target\xsd-form-builder.war"

Write-Host "=== Развертывание xsd-form-builder на Tomcat ===" -ForegroundColor Cyan
Write-Host ""

# Проверка существования WAR-файла
if (-not (Test-Path $warFile)) {
    Write-Host "Ошибка: WAR-файл не найден: $warFile" -ForegroundColor Red
    Write-Host "Сначала выполните сборку: npm run build" -ForegroundColor Yellow
    exit 1
}

Write-Host "WAR-файл найден: $warFile" -ForegroundColor Green
Write-Host ""

# Остановка Tomcat
Write-Host "Останавливаю Tomcat..." -ForegroundColor Yellow
$tomcatBin = "$env:CATALINA_HOME\bin"
if (Test-Path "$tomcatBin\shutdown.bat") {
    Push-Location $tomcatBin
    & .\shutdown.bat
    Pop-Location
    Write-Host "Ожидание завершения процессов..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    
    # Принудительная остановка процессов Java, если они еще работают
    $javaProcesses = Get-Process -Name "java" -ErrorAction SilentlyContinue
    if ($javaProcesses) {
        Write-Host "Принудительная остановка процессов Java..." -ForegroundColor Yellow
        $javaProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "Предупреждение: shutdown.bat не найден, пытаюсь остановить процессы Java..." -ForegroundColor Yellow
    $javaProcesses = Get-Process -Name "java" -ErrorAction SilentlyContinue
    if ($javaProcesses) {
        $javaProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

Write-Host "Tomcat остановлен" -ForegroundColor Green
Write-Host ""

# Удаление старого развертывания
Write-Host "Удаляю старое развертывание..." -ForegroundColor Yellow
$webappsPath = "$env:CATALINA_HOME\webapps"
$appPath = "$webappsPath\xsd-form-builder"
$warPath = "$webappsPath\xsd-form-builder.war"

if (Test-Path $appPath) {
    Remove-Item -Path $appPath -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Папка развертывания удалена" -ForegroundColor Green
}

if (Test-Path $warPath) {
    Remove-Item -Path $warPath -Force -ErrorAction SilentlyContinue
    Write-Host "Старый WAR удален" -ForegroundColor Green
}

Write-Host ""

# Копирование нового WAR
Write-Host "Копирую новый WAR-файл..." -ForegroundColor Yellow
Copy-Item -Path $warFile -Destination $warPath -Force
Write-Host "WAR-файл скопирован: $warPath" -ForegroundColor Green
Write-Host ""

# Запуск Tomcat
Write-Host "Запускаю Tomcat..." -ForegroundColor Yellow
if (Test-Path "$tomcatBin\startup.bat") {
    Push-Location $tomcatBin
    Start-Process -FilePath ".\startup.bat" -WindowStyle Hidden
    Pop-Location
    Write-Host "Ожидание запуска Tomcat..." -ForegroundColor Yellow
    Start-Sleep -Seconds 5
    Write-Host "Tomcat запущен" -ForegroundColor Green
} else {
    Write-Host "Предупреждение: startup.bat не найден" -ForegroundColor Yellow
    Write-Host "Запустите Tomcat вручную" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Развертывание завершено! ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Приложение доступно по адресу:" -ForegroundColor Green
Write-Host "  http://localhost:8080/xsd-form-builder/" -ForegroundColor White
Write-Host ""
Write-Host "Проверьте логи в случае проблем:" -ForegroundColor Yellow
Write-Host "  $env:CATALINA_HOME\logs\catalina.out" -ForegroundColor Gray
Write-Host "  $env:CATALINA_HOME\logs\localhost.log" -ForegroundColor Gray







