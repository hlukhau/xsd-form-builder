# API Документация

## Справочник стран

### Получить все активные страны
```
GET /api/countries
```

**Ответ:**
```json
[
  {
    "countryId": 1,
    "countryCode": "RU",
    "countrySDate": "2020-01-01",
    "countryEDate": "2099-12-31",
    "countryName": "Российская Федерация",
    "eaeuGuid": "...",
    "seqNum": 1,
    "cDate": "2020-01-01"
  }
]
```

### Получить опции для выпадающего списка
```
GET /api/countries/options
```

**Ответ:**
```json
[
  {
    "code": "RU",
    "name": "Российская Федерация"
  }
]
```

### Получить страну по коду
```
GET /api/countries/{code}
```

**Пример:**
```
GET /api/countries/RU
```

**Ответ (200 OK):**
```json
{
  "countryId": 1,
  "countryCode": "RU",
  "countryName": "Российская Федерация",
  ...
}
```

**Ответ (404 Not Found):** если страна не найдена

### Проверить существование страны
```
GET /api/countries/{code}/exists
```

**Пример:**
```
GET /api/countries/RU/exists
```

**Ответ:**
```json
{
  "exists": true,
  "code": "RU",
  "name": "Российская Федерация"
}
```

### Обновить кеш справочника
```
POST /api/countries/refresh
```

**Ответ:**
```json
{
  "status": "success",
  "message": "Справочник стран обновлен"
}
```

## Конфигурация

### База данных Oracle
Настройки подключения находятся в `src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:oracle:thin:@192.168.203.212:1521:ses
spring.datasource.username=sesdev
spring.datasource.password=sesdev
spring.datasource.driver-class-name=oracle.jdbc.OracleDriver
```

### Кеширование
Справочники кешируются при старте приложения в памяти. Для обновления кеша используйте endpoint `/api/countries/refresh`.




