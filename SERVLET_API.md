# API через Java EE сервлеты

## Архитектура

Вместо Spring Boot используются обычные Java EE сервлеты с JDBC для подключения к Oracle.

## Структура

```
src/main/java/com/eec/
├── servlet/
│   ├── CountriesOptionsServlet.java    # GET /api/countries/options
│   └── CountryExistsServlet.java       # GET /api/countries/{code}/exists
└── util/
    └── DatabaseUtil.java               # Утилита для работы с БД
```

## API Endpoints

### 1. Получить список стран для выпадающего списка
```
GET /api/countries/options
```

**Ответ:**
```json
[
  {
    "code": "RU",
    "name": "Российская Федерация"
  },
  {
    "code": "BY",
    "name": "Республика Беларусь"
  }
]
```

### 2. Проверить существование страны
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

## Подключение к БД

Настройки подключения находятся в `DatabaseUtil.java`:
- URL: `jdbc:oracle:thin:@192.168.203.212:1521/ses`
- User: `sesdev`
- Password: `sesdev`

## Регистрация сервлетов

Сервлеты регистрируются через аннотации `@WebServlet`:
- `@WebServlet(name = "CountriesOptionsServlet", urlPatterns = "/api/countries/options")`
- `@WebServlet(name = "CountryExistsServlet", urlPatterns = "/api/countries/*/exists")`

Tomcat 8.5.23 автоматически обнаружит эти сервлеты при развертывании.

## Зависимости

- `ojdbc8` - Oracle JDBC драйвер
- `gson` - для работы с JSON (легче чем Jackson)
- `javax.servlet-api` - Servlet API (provided scope, уже есть в Tomcat)

## Преимущества

1. **Простота** - нет сложных фреймворков
2. **Надежность** - стандартный Java EE, хорошо работает на Tomcat 8.5.23
3. **Легковесность** - минимальные зависимости
4. **Совместимость** - работает с Java 8







