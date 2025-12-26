# Настройка бэкенда

## Структура

Бэкенд реализован на Spring Boot 2.7.18 с использованием:
- Spring Data JPA для работы с БД
- Oracle JDBC для подключения к Oracle
- Spring Cache для кеширования справочников
- REST API для доступа к справочникам

## Конфигурация базы данных

Настройки подключения к Oracle находятся в `src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:oracle:thin:@192.168.203.212:1521/ses
spring.datasource.username=sesdev
spring.datasource.password=sesdev
```

## Справочник стран

### Структура таблицы
```sql
CREATE TABLE "SESINT"."COUNTRY" 
   (	"COUNTRYID" NUMBER(*,0) NOT NULL ENABLE, 
	"COUNTRYCODE" VARCHAR2(2 CHAR) NOT NULL ENABLE, 
	"COUNTRYSDATE" DATE NOT NULL ENABLE, 
	"COUNTRYEDATE" DATE NOT NULL ENABLE, 
	"COUNTRYNAME" VARCHAR2(1024 CHAR) NOT NULL ENABLE, 
	"EAEUGUID" VARCHAR2(36 CHAR), 
	"SEQNUM" NUMBER(*,0), 
	"CDATE" DATE DEFAULT SYSDATE NOT NULL ENABLE
)
```

### Кеширование
Справочник стран загружается в память при старте приложения через `@PostConstruct` в `CountryService`.

### API Endpoints

- `GET /api/countries` - все активные страны
- `GET /api/countries/options` - опции для выпадающего списка
- `GET /api/countries/{code}` - страна по коду
- `GET /api/countries/{code}/exists` - проверка существования
- `POST /api/countries/refresh` - обновление кеша

## Интеграция с фронтендом

### Валидация при загрузке данных
При отображении данных в режиме просмотра (`NotificationTab`):
- Проверяется наличие страны в справочнике
- Если страна не найдена - отображается красный тег "Не найдено в справочнике"

### Выбор из справочника в режиме редактирования
В режиме редактирования (`NotificationTabEdit`):
- Поля "Страна" заменены на выпадающие списки (Select)
- Список загружается из API `/api/countries/options`
- Поиск по коду и названию
- Формат отображения: "RU - Российская Федерация"

## Сборка и развертывание

1. Соберите фронтенд: `npm run build`
2. Соберите WAR: используйте `build-and-deploy.bat` или Maven
3. Разверните на Tomcat

Приложение автоматически подключится к Oracle и загрузит справочники при старте.

## Логирование

Логи Spring Boot доступны в:
- Консоль Tomcat
- `$CATALINA_HOME/logs/catalina.out`
- `$CATALINA_HOME/logs/localhost.log`

Уровни логирования настраиваются в `application.properties`.





