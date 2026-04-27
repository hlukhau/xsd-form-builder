# eec-rights-service

Единая in-memory карта `GUID → JSON` (креды БД и права) для WAR `dpa_card` / `pha_card` / `ppv_card`.

**Стек:** Java 8, **сервлеты 3.1**, WAR (тот же подход, что и карты) — **без Spring Boot**.

**Артефакт:** `rights-service/target/card_rigths.war` → в Tomcat контекст **`/card_rigths`**.

## Сборка

Из **корня** репозитория:

```bash
./build-rights-service.sh
```

Вручную: `cd rights-service && mvn -q package`

## Деплой (как карты: копия WAR в `webapps`)

**Локально** (тот же `TOMCAT_HOME`, что и DPA, по умолчанию `/opt/tomcat8`):

```bash
./deploy-rights-service-local.sh
./deploy-rights-service-local.sh --build
./build-and-deploy-rights-service-local.sh
./deploy-rights-service-local.sh --copy-only   # только копия WAR, без rm развёрнутой папки
```

WAR кладётся в `$TOMCAT_HOME/webapps/card_rigths.war`. Health после auto-deploy:  
`http://localhost:<порт-коннектора-Tomcat>/card_rigths/health` (порт см. `get-tomcat-port.sh` или `conf/server.xml`).

**Remote:**

```bash
./deploy-rights-service-to-remote.sh
./deploy-rights-service-to-remote.sh --build
./build-and-deploy-rights-service.sh
```

Переменные: `REMOTE_HOST`, `REMOTE_USER`, `REMOTE_TOMCAT_HOME` (по умолчанию `/opt/tomcat8`), `REMOTE_PASSWORD`.

**VS Code / Cursor** (`.vscode/tasks.json`):
- `EEC-Rights: build (WAR)` — только сборка
- `EEC-Rights: deploy to local Tomcat (WAR)` — копия WAR в `webapps` (уже собранный)
- `EEC-Rights: build and deploy to local Tomcat (WAR)` — сборка + копия
- `EEC-Rights: deploy to remote (scp WAR)` — scp на удалённый Tomcat
- `EEC-Rights: build and deploy to remote (scp WAR)` — сборка + scp

## API (после деплоя на тот же Tomcat, что и карты)

База: `http://<хост>:<порт-tomcat>/card_rigths` (без `/` в конце в `eec.rights.service.baseUrl`).

- `GET /card_rigths/health` — `{ "status": "UP" }`
- `POST /card_rigths/api/rights` — тело: JSON с `guid` / `GUID` (как в `XsdFormBuilderServlet`); при защите — заголовок `X-Api-Key` (см. `web.xml` `app.security.api-key` или env `EEC_RIGHTS_API_KEY` на **Tomcat** / JVM)
- `GET /card_rigths/api/rights/{guid}` — JSON или 404
- `GET /card_rigths/api/rights` — `{"count":N}`

## Подключение WAR карт (xsd-form-builder)

`eec.rights.service.baseUrl` = **тот же хост и порт, что у Tomcat**, путь `/card_rigths`, например:  
`http://127.0.0.1:8083/card_rigths` (порт — как в `server.xml` Tomcat, не отдельный 8091).

`eec.rights.service.apiKey` — совпадает с ожидаемым в фильтре (и при необходимости `EEC_RIGHTS_API_KEY` в среде JVM Tomcat).

## NFR

- In-memory: после **редеплоя** WAR `card_rigths` реестр в памяти **обнуляется**; родителю нужен повторный POST JSON для нужных `guid` (как и при старом отдельном JAR).
- Несколько реплик Tomcat **без** общего store — к данным смысла нет; кластер — вне scope MVP.
