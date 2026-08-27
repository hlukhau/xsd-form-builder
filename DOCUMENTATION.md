# Документация xsd-form-builder (единый файл)

Сводная документация по подсистеме веб-карт сведений ЕЭК: обзор, **сборка и деплой**, EEC-rights, стек, API, диагностика, XSD.

**Важно:** сервис **EEC-rights** (`card_rigths`) должен быть залит и стартовать **первым**; карты — после проверки `/card_rigths/health`. См. раздел «Сборка и деплой всех форм».

Собрано из исходных `.md` репозитория. Пересборка: `python3 scripts/assemble-documentation.py`.

## Оглавление

1. [Обзор проекта](#обзор-проекта) — `README.md`
2. [Сборка и деплой всех форм (актуально)](#сборка-и-деплой-всех-форм-актуально) — `docs/BUILD_AND_DEPLOY.md`
3. [EEC-rights (card_rigths)](#eec-rights-card_rigths) — `rights-service/README.md`
4. [Состав технологического ПО (п. 2.2)](#состав-технологического-по-п-2-2) — `docs/tech-stack-2.2.md`
5. [Развёртывание на Tomcat (историческое, DPA)](#развёртывание-на-tomcat-историческое-dpa) — `DEPLOYMENT.md`
6. [Backend setup](#backend-setup) — `BACKEND_SETUP.md`
7. [API documentation](#api-documentation) — `API_DOCUMENTATION.md`
8. [Servlet API](#servlet-api) — `SERVLET_API.md`
9. [Troubleshooting](#troubleshooting) — `TROUBLESHOOTING.md`
10. [Расположение логов](#расположение-логов) — `LOGS_LOCATION.md`
11. [Quick fix](#quick-fix) — `QUICK_FIX.md`
12. [Deploy fix](#deploy-fix) — `DEPLOY_FIX.md`
13. [Rebuild required](#rebuild-required) — `REBUILD_REQUIRED.md`
14. [Загрузка зависимостей](#загрузка-зависимостей) — `download-deps.md`
15. [Ограничения полей XSD](#ограничения-полей-xsd) — `docs/xsd-field-constraints.md`
16. [Анализ XSD](#анализ-xsd) — `ANALYSIS.md`
17. [Открытие всех версий](#открытие-всех-версий) — `docs/OPEN_ALL_VERSIONS_OPTIONS.md`
18. [План: партии и вкладки](#план-партии-и-вкладки) — `docs/plan-batches-tabs.md`
19. [Карты (src/cards)](#карты-src-cards) — `src/cards/README.md`
20. [Summary](#summary) — `SUMMARY.md`

---

## Обзор проекта

<!-- source: README.md -->

### XSD Form Builder - Карта сведений об обнаружении опасной продукции

Фронтенд-приложение для визуализации карты сведений об обнаружении опасной продукции на основе XSD схем.


Актуально только про деплой: [docs/BUILD_AND_DEPLOY.md](./docs/BUILD_AND_DEPLOY.md).

#### Технологический стек

##### Frontend
- **React 18** + **TypeScript**
- **Ant Design 5** - UI компоненты
- **Vite** - сборщик
- **Zustand** - управление состоянием (планируется)
- **React Hook Form** - формы (планируется)
- **date-fns** - работа с датами

##### Backend/Deployment
- **Java 8** - для сервлетов
- **Apache Maven** - система сборки
- **Apache Tomcat 8.5.23** - сервер приложений
- **WAR** - формат развертывания

#### Структура проекта

```
xsd-form-builder/
├── src/
│   ├── components/
│   │   ├── card/              # Компоненты карты
│   │   ├── modals/            # Модальные окна
│   │   └── tabs/              # Вкладки
│   ├── types/                 # TypeScript типы
│   └── App.tsx                # Главный компонент
├── xsd/                       # XSD схемы
└── ANALYSIS.md                # Анализ XSD и предложение стека
```

#### Установка и запуск

##### Разработка (локально)

```bash
### Установка зависимостей
npm install

### Запуск dev сервера
npm run dev
### Приложение будет доступно на http://localhost:3000
```

##### Развертывание на Apache Tomcat 8.5.23

**EEC-rights (`card_rigths`) должен быть залит и стартовать первым** — без него карты не получают GUID/права/креды БД.

Актуальная инструкция по сборке и деплою **всех форм** (DPA, PPV, PHA, DPR, SMD, SMR, SMA) и EEC-rights:

→ **[docs/BUILD_AND_DEPLOY.md](./docs/BUILD_AND_DEPLOY.md)**

Кратко (локально):

```bash
npm install
./build-and-deploy-rights-service-local.sh   # первым
./build-and-deploy-all-local.sh              # все карты
```

Историческая инструкция (в основном DPA): [DEPLOYMENT.md](./DEPLOYMENT.md). Сервис прав: [rights-service/README.md](./rights-service/README.md).

#### Функциональность

##### Реализовано

1. ✅ Базовая структура карты с метаинформацией
2. ✅ Загрузка XML файлов из папки `public/xml` или через загрузку файла
3. ✅ Парсинг XML документов и преобразование в структуру карты
4. ✅ Просмотр истории смены статусов (модальное окно)
5. ✅ Просмотр сведений об электронном документе (модальное окно)
6. ✅ Управление доступом к просмотру карты (модальное окно)
7. ✅ Вкладка "Уведомление"
8. ✅ Заготовки для остальных вкладок

##### В разработке

- Наполнение вкладок: Продукция, ТСД, Документы соответствия, Нарушения, Место обнаружения, Принятые меры
- Интеграция с бэкенд API
- Валидация форм
- Управление правами доступа

#### Загрузка XML файлов

Приложение поддерживает загрузку XML файлов двумя способами:

1. **Из папки `public/xml`** - выберите файл из выпадающего списка и нажмите "Загрузить из папки"
2. **Через загрузку файла** - нажмите "Загрузить файл" и выберите XML файл с вашего компьютера

XML файлы должны соответствовать схеме `EEC_R_SM_SS_08_DangerousProductAlert_v1.0.0.xsd`.

#### Анализ XSD

Подробный анализ структуры XSD схем и типовых блоков см. в файле [ANALYSIS.md](./ANALYSIS.md).

#### Развертывание

- **Все формы + EEC-rights (актуально):** [docs/BUILD_AND_DEPLOY.md](./docs/BUILD_AND_DEPLOY.md)
- Историческая инструкция (DPA / Tomcat): [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Сборка и деплой всех форм (актуально)

<!-- source: docs/BUILD_AND_DEPLOY.md -->

### Сборка и деплой веб-карт ЕЭК (xsd-form-builder)

Документ описывает полный цикл сборки и развёртывания **всех форм** подсистемы и сервиса прав **EEC-rights** (`card_rigths`) на Apache Tomcat.

---

#### 1. Критично: EEC-rights — первым

Все WAR карт (`dpa_card`, `ppv_card`, `pha_card`, `dpr_card`, `smd_card`, `smr_card`, `sma_card`) при старте обращаются к сервису прав **EEC-rights** за картой `GUID → JSON` (параметры БД и права доступа).

| Параметр | Значение |
|----------|----------|
| Модуль | `rights-service/` (eec-rights-service) |
| Артефакт | `rights-service/target/card_rigths.war` |
| Контекст Tomcat | **`/card_rigths`** |
| Health | `GET http://<host>:<port>/card_rigths/health` → `{"status":"UP"}` |

**Порядок развёртывания и запуска:**

1. Собрать и залить **`card_rigths.war`**
2. Дождаться старта контекста `/card_rigths` (проверка health)
3. Только после этого собирать/заливать WAR карт

Если EEC-rights отсутствует, не поднялся или недоступен по URL из конфигурации карт, операции с GUID/БД/правами на картах **не работают** (реестр прав не инициализируется).

После **редеплоя** `card_rigths` in-memory реестр **обнуляется** — родительская система должна снова передать JSON по GUID (`POST /card_rigths/api/rights`).

Подробнее по API: [rights-service/README.md](../rights-service/README.md).

---

#### 2. Состав приложений

| Контекст Tomcat | Назначение | Скрипт сборки+локальный деплой |
|-----------------|------------|--------------------------------|
| **`card_rigths`** | EEC-rights: GUID → JSON прав и БД | `./build-and-deploy-rights-service-local.sh` |
| `dpa_card` | Опасная продукция (DPA) | `./build-and-deploy-dpa.sh` |
| `ppv_card` | Выявленные нарушения (PPV) | `./build-and-deploy-ppv.sh` |
| `pha_card` | Болезни / PHA | `./build-and-deploy-pha.sh` |
| `dpr_card` | Результат рассмотрения нарушения (DPR) | `./build-and-deploy-dpr.sh` |
| `smd_card` | Временная санитарная мера (SMD) | `./build-and-deploy-smd.sh` |
| `smr_card` | Результат рассмотрения меры (SMR) | `./build-and-deploy-smr.sh` |
| `sma_card` | Запрос / ответ доп. сведений (SMAQ/SMAR) | `./build-and-deploy-sma.sh` |

URL карты (пример): `http://localhost:<port>/<контекст>/`

---

#### 3. Требования

- **JDK 8+** (для компиляции сервлетов; предпочтительно JDK, совместимый с Tomcat 8)
- **Apache Maven 3.6+**
- **Node.js 18+** / npm
- **Apache Tomcat 8.5.x** (`TOMCAT_HOME`, по умолчанию `/opt/tomcat8`)

Параметры окружения задаются в локальном файле **`deploy.env`** (не в git). Подключается через `load-deploy-env.sh`:

| Переменная | Назначение |
|------------|------------|
| `TOMCAT_HOME` | Локальный Tomcat |
| `JAVA_HOME` | JDK для сборки |
| `HOT_DEPLOY` | `1` — подмена WAR без полного рестарта Tomcat (по умолчанию в скриптах карт) |
| `REMOTE_HOST` / `REMOTE_USER` / `REMOTE_PASSWORD` | Удалённый сервер |
| `REMOTE_WEBAPPS` / `REMOTE_TOMCAT_HOME` | Пути на удалённом Tomcat |
| `REMOTE_PORT` | HTTP-порт Tomcat на remote |

---

#### 4. Конфигурация связи карт → EEC-rights

В `src/main/webapp/WEB-INF/web.xml` карт:

```xml
<param-name>eec.rights.service.baseUrl</param-name>
<param-value>http://127.0.0.1:8083/card_rigths</param-value>
```

Порт должен совпадать с HTTP-коннектором **того же** Tomcat, где развёрнут `card_rigths` (часто `8080` или `8083` — см. `conf/server.xml` или `./get-tomcat-port.sh`).

Переопределение без пересборки WAR (приоритет выше `web.xml`):

- env: `EEC_RIGHTS_SERVICE_BASE_URL`
- JVM: `-Deec.rights.service.baseUrl=...`
- при необходимости ключ: `EEC_RIGHTS_SERVICE_API_KEY` / `eec.rights.service.apiKey`

---

#### 5. Локальная сборка и деплой

##### 5.1. Рекомендуемый порядок (полный стенд)

```bash
### 0. Зависимости frontend (один раз / при смене package-lock)
npm install

### 1. ПЕРВЫМ — EEC-rights
./build-and-deploy-rights-service-local.sh

### 2. Проверка
curl -s "http://localhost:$(./get-tomcat-port.sh)/card_rigths/health"
### ожидается: {"status":"UP"}

### 3. Все карты
./build-and-deploy-all-local.sh
```

`build-and-deploy-all-local.sh` последовательно: DPA → PPV → PHA → DPR → SMD → SMR → SMA.

##### 5.2. Одна карта

```bash
./build-and-deploy-dpa.sh   # и аналогично -ppv, -pha, -dpr, -smd, -smr, -sma
```

Полный рестарт Tomcat вместо hot-deploy:

```bash
HOT_DEPLOY=0 ./build-and-deploy-smd.sh
```

##### 5.3. Только сборка WAR (без копирования в Tomcat)

```bash
./build-rights-service.sh          # → rights-service/target/card_rigths.war
./build-all-cards.sh               # → target/*_card.war (все формы)
```

Отдельная карта вручную:

```bash
npm run build:smd                  # frontend с base /smd_card/
DEPLOY=0 ./build-manual.sh smd_card
```

Скрипты npm:

| npm | WAR |
|-----|-----|
| `npm run build` / `build:dpa` | `dpa_card` |
| `npm run build:ppv` | `ppv_card` |
| `npm run build:pha` | `pha_card` |
| `npm run build:dpr` | `dpr_card` |
| `npm run build:smd` | `smd_card` |
| `npm run build:smr` | `smr_card` |
| `npm run build:sma` | `sma_card` |

---

#### 6. Удалённый деплой (scp на Tomcat)

Параметры — в `deploy.env` (`REMOTE_*`).

```bash
### 1. ПЕРВЫМ — EEC-rights
./build-and-deploy-rights-service.sh
### или: ./deploy-rights-service-to-remote.sh [--build]

### 2. Проверка health на remote (порт REMOTE_PORT)
curl -s "http://${REMOTE_HOST}:${REMOTE_PORT}/card_rigths/health"

### 3. Все карты
./deploy-all-cards-to-remote.sh --build
### или без пересборки, если WAR уже в target/:
./deploy-all-cards-to-remote.sh
```

По одной карте: `./deploy-dpa-to-remote.sh`, `./deploy-smd-to-remote.sh`, … (опция `--build` у rights и при необходимости предварительный `./build-all-cards.sh`).

---

#### 7. Чеклист после деплоя

1. **`/card_rigths/health`** отвечает `UP`
2. В логах Tomcat контекст `card_rigths` стартовал **до** или без ошибок к моменту обращения карт
3. Открывается UI карты, например `/smd_card/`, `/dpa_card/`
4. После передачи GUID от родителя карта получает права/креды БД (без 404/ошибок реестра)

---

#### 8. Типичные ошибки

| Симптом | Причина / действие |
|---------|-------------------|
| Карты не видят права / БД | Не залит или не стартовал `card_rigths`; сначала деплой EEC-rights |
| Health 404 | Неверный порт или WAR не развернулся в `webapps/card_rigths.war` |
| Связь с rights после смены порта Tomcat | Обновить `eec.rights.service.baseUrl` / `EEC_RIGHTS_SERVICE_BASE_URL` |
| Пустой реестр после редеплоя rights | Повторный `POST` GUID→JSON от родительской системы |
| Неверный base path UI | Пересобрать frontend нужным `npm run build:<форма>` перед упаковкой WAR |

---

#### 9. Связанные материалы

- [rights-service/README.md](../rights-service/README.md) — API EEC-rights
- [DEPLOYMENT.md](../DEPLOYMENT.md) — историческая инструкция (в основном DPA / Maven)
- [docs/tech-stack-2.2.md](./tech-stack-2.2.md) — состав технологического ПО

---

## EEC-rights (card_rigths)

<!-- source: rights-service/README.md -->

### eec-rights-service

Единая in-memory карта `GUID → JSON` (креды БД и права) для всех WAR карт (`dpa_card`, `ppv_card`, `pha_card`, `dpr_card`, `smd_card`, `smr_card`, `sma_card`).

**Порядок деплоя:** этот сервис **заливается и стартует первым**; карты — только после успешного `/card_rigths/health`. См. [docs/BUILD_AND_DEPLOY.md](../docs/BUILD_AND_DEPLOY.md).

**Стек:** Java 8, **сервлеты 3.1**, WAR (тот же подход, что и карты) — **без Spring Boot**.

**Артефакт:** `rights-service/target/card_rigths.war` → в Tomcat контекст **`/card_rigths`**.

#### Сборка

Из **корня** репозитория:

```bash
./build-rights-service.sh
```

Вручную: `cd rights-service && mvn -q package`

#### Деплой (как карты: копия WAR в `webapps`)

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

#### API (после деплоя на тот же Tomcat, что и карты)

База: `http://<хост>:<порт-tomcat>/card_rigths` (без `/` в конце в `eec.rights.service.baseUrl`).

- `GET /card_rigths/health` — `{ "status": "UP" }`
- `POST /card_rigths/api/rights` — тело: JSON с `guid` / `GUID` (как в `XsdFormBuilderServlet`); при защите — заголовок `X-Api-Key` (см. `web.xml` `app.security.api-key` или env `EEC_RIGHTS_API_KEY` на **Tomcat** / JVM)
- `GET /card_rigths/api/rights/{guid}` — JSON или 404
- `GET /card_rigths/api/rights` — `{"count":N}`

#### Подключение WAR карт (xsd-form-builder)

`eec.rights.service.baseUrl` = **тот же хост и порт, что у Tomcat**, путь `/card_rigths`, например:  
`http://127.0.0.1:8083/card_rigths` (порт — как в `server.xml` Tomcat, не отдельный 8091).

`eec.rights.service.apiKey` — совпадает с ожидаемым в фильтре (и при необходимости `EEC_RIGHTS_API_KEY` в среде JVM Tomcat).

#### NFR

- In-memory: после **редеплоя** WAR `card_rigths` реестр в памяти **обнуляется**; родителю нужен повторный POST JSON для нужных `guid` (как и при старом отдельном JAR).
- Несколько реплик Tomcat **без** общего store — к данным смысла нет; кластер — вне scope MVP.

---

## Состав технологического ПО (п. 2.2)

<!-- source: docs/tech-stack-2.2.md -->

### П. 2.2 Состав технологического ПО

Материалы для актуализации раздела **«Состав технологического ПО»** по подсистеме веб-карт сведений ЕЭК (репозиторий `xsd-form-builder`).

Документ отражает фактический стек реализации на дату подготовки. Версии ПО приведены по файлам `package.json`, `pom.xml`, `README.md`.

---

#### 1. Назначение подсистемы

Подсистема обеспечивает ввод, просмотр, редактирование и валидацию карт сведений в соответствии с XSD ЕЭК (регламенты SS.08, SS.09):

| WAR / контекст Tomcat | Карта | Код регламента (примеры XSD) |
|----------------------|-------|------------------------------|
| `dpa_card` | Сведения об опасной продукции (DPA) | SS.08 Dangerous Product Alert |
| `pha_card` | Сведения об обнаружении болезней (PHA) | SS.08 Public Health Alert |
| `ppv_card` | Сведения о выявленных нарушениях (PPV) | SS.08 (входящие) |
| `dpr_card` | Результаты рассмотрения выявленных нарушений (DPR) | SS.08 Dangerous Product Alert Response |
| `smd_card` | Временная санитарная мера (SMD) | SS.09 Sanitary Measure Details |
| `smr_card` | Результаты рассмотрения санитарной меры (SMR) | SS.09 Sanitary Measure Consideration |
| `sma_card` | Запрос / ответ дополнительных сведений (SMAQ / SMAR) | SS.09 Additional Info / Processing Result |
| `card_rigths` | EEC-rights: реестр GUID → JSON прав и параметров БД (**деплоить и стартовать первым**) | — |

Общий Java-код и `WEB-INF/web.xml`; различие карточек — base path при сборке frontend (`npm run build:dpa`, `build:pha`, …) и пакеты сервлетов (`com.eec.servlet.dpa.*`, `pha.*`, `ppv.*`, `dpr.*`, `smd.*`, `smr.*`, `sma.*`). Деплой и порядок запуска (EEC-rights первым): [BUILD_AND_DEPLOY.md](./BUILD_AND_DEPLOY.md).

---

#### 2. Текст для включения в п. 2.2 (готовый фрагмент)

> **Подсистема веб-карт сведений (модуль xsd-form-builder)**
>
> Для реализации пользовательского интерфейса карт сведений используется одностраничное приложение (SPA) на базе **React 18** и **TypeScript 5** с библиотекой компонентов **Ant Design 5**; сборка клиентской части выполняется средством **Vite 5**.
>
> Серверная часть реализована на **Java 8** в виде **Java Servlet API 3.1** и развёртывается на **Apache Tomcat 8.5.23** в формате **WAR**. Доступ к данным в **Oracle Database** осуществляется через **JDBC** (драйвер **Oracle ojdbc8**).
>
> Для описания, изменения и извлечения данных, хранимых в базе данных, используется язык **SQL** в рамках стандарта **ANSI SQL-92** (выполнение запросов из прикладного кода Java). Для реализации бизнес-логики на стороне сервера БД используется процедурный язык **PL/SQL** (объекты Oracle).
>
> Структура электронных документов и валидация XML обеспечиваются схемами **XML Schema (XSD)** ЕЭК (в т.ч. регламенты SS.08, SS.09); проверка по XSD выполняется средствами **JAXP** (`javax.xml.validation`).
>
> Сборка программного обеспечения: **Apache Maven 3.6+** (backend), **Node.js 18+** / **npm** (frontend).

---

#### 3. Детализация по уровням

##### 3.1. Клиентская часть (SPA)

| Компонент | Технология | Версия |
|-----------|------------|--------|
| UI-фреймворк | React | 18.2 |
| Язык разработки | TypeScript | 5.2 |
| Библиотека компонентов | Ant Design | 5.11 |
| Сборщик / dev-сервер | Vite | 5.0 |
| Маршрутизация | React Router DOM | 6.20 |
| HTTP-клиент | Axios | 1.6 |
| Работа с датами | dayjs, date-fns | 1.11 / 2.30 |
| Валидация форм | Zod, React Hook Form | 3.22 / 7.48 |
| Управление состоянием | Zustand | 4.4 |
| Статический анализ | ESLint, TypeScript ESLint | 8.54 / 6.13 |

Формат поставки: статические ресурсы SPA (`dist/`), встраиваемые в WAR при сборке.

##### 3.2. Серверная часть

| Компонент | Технология | Версия |
|-----------|------------|--------|
| Язык / платформа | Java SE | 8 (1.8) |
| API веб-приложения | Java Servlet API (Java EE 7) | 3.1.0 |
| Сервер приложений | Apache Tomcat | 8.5.23 |
| Формат развёртывания | WAR | — |
| Система сборки | Apache Maven | 3.6+ |
| Драйвер СУБД | Oracle JDBC (ojdbc8) | 21.9.0.0 |
| Доступ к данным | JDBC (`PreparedStatement`), без ORM | — |
| Обмен с клиентом | HTTP; JSON и XML | — |
| Валидация XML | JAXP (`javax.xml.validation`, XSD 1.0) | входит в JDK 8 |
| Кеш справочников | in-memory (JVM), ленивая загрузка | — |

Архитектура: **Java EE сервлеты + JDBC** (см. `SERVLET_API.md`). REST-подобные endpoints реализованы сервлетами; сериализация JSON — средствами Java без отдельного JSON-фреймворка в `pom.xml`.

Ключевые сервлеты:

- справочники: `CountriesOptionsServlet`, `AuthorityOptionsServlet` и др.;
- карты: `DpaSaveServlet`, `PhaMetadataServlet`, `PpvStatusChangeServlet`, `DprStatusChangeServlet`, `SmdSaveServlet`, `SmrSaveServlet` и др.;
- валидация XSD: `XmlSchemaValidateServlet` (`POST /api/xml/validate-schema`);
- инициализация справочников: `DictionaryInitializerListener`.

##### 3.3. СУБД и языки доступа к данным

| Аспект | Технология |
|--------|------------|
| СУБД | Oracle Database |
| Подключение | `jdbc:oracle:thin:...` (параметры из JSON прав по GUID) |
| Запросы из приложения | SQL (ANSI SQL-92), JDBC `PreparedStatement` |
| Логика на стороне БД | PL/SQL (объекты Oracle; схемы в т.ч. SESINT, SESDEV) |

##### 3.4. Стандарты и схемы данных

Каталог `xsd/`:

| Файл XSD | Назначение |
|----------|------------|
| `EEC_R_SM_SS_08_DangerousProductAlert_v1.0.0.xsd` | DPA, PPV (исходящие) |
| `EEC_R_SM_SS_08_PublicHealthAlert_v1.0.0.xsd` | PHA |
| `EEC_R_SM_SS_08_DangerousProductAlertResponse_v1.0.0.xsd` | DPR |
| `EEC_R_SM_SS_09_SanitaryMeasureDetails_v1.0.0.xsd` | SMD |
| `EEC_R_SM_SS_09_SanitaryMeasureConsideration_v1.0.0.xsd` | SMR |
| `EEC_M_*_v0.4.12.xsd`, `EEC_M_SM_*_v0.3.9.xsd` | Базовые и отраслевые типы данных ЕЭК |

На клиенте: парсинг и формирование XML в TypeScript (`xmlParser.ts`, `*XmlExporter.ts`, `*XmlParser.ts`). На сервере: структурный контроль через `XmlSchemaValidateServlet`.

##### 3.5. Средства сборки и разработки

| Компонент | Версия | Назначение |
|-----------|--------|------------|
| Node.js | 18.17+ | Сборка frontend |
| npm | 9.6+ | Зависимости frontend |
| Apache Maven | 3.6+ | Компиляция Java, упаковка WAR |
| Vite | 5.0 | Сборка SPA |

Скрипты сборки и развёртывания: `build-manual.sh`, `build-and-deploy-*.sh`, `build-all-cards.sh`.

---

#### 4. Соотношение с прежним содержанием п. 2.2

В текущей редакции п. 2.2 могут быть указаны технологии, **не применяемые** в данной подсистеме:

| Технология из прежнего п. 2.2 | Применение в xsd-form-builder |
|------------------------------|----------------------------|
| Oracle Application Development Framework (ADF) Essentials 2.1.4 | **Не используется** |
| Hazelcast Open Source 3.7+ | **Не используется** (кеш в памяти JVM) |
| TIBCO Jaspersoft Studio 6.3.1 | **Не используется** (отчёты jrxml — иная подсистема, если применимо) |
| ANSI SQL-92 | **Используется** (JDBC) |
| PL/SQL | **Используется** на стороне Oracle DB |

**Рекомендация по структуре документации:**

- **п. 2.2.1** — наследуемые/общесистемные компоненты (ADF, Hazelcast, Jasper и т.п.), если они остаются в других модулях;
- **п. 2.2.2** — подсистема веб-карт (настоящий документ).

Либо заменить устаревшие пункты, если перечисленные технологии в проекте больше нигде не применяются.

---

#### 5. Требования к среде эксплуатации (кратко)

| Компонент | Требование |
|-----------|------------|
| JDK | 1.8 |
| Apache Tomcat | 8.5.23 (или совместимая ветка 8.5.x) |
| Oracle Database | с поддержкой JDBC Thin |
| Node.js | 18+ (только для сборки, не для runtime) |

---

#### 6. Ссылки на исходные материалы в репозитории

| Файл | Содержание |
|------|------------|
| `README.md` | Обзор стека, Tomcat, Java 8 |
| `pom.xml` | Версии Java, Servlet API, ojdbc8, Tomcat |
| `package.json` | Версии React, Ant Design, Vite и др. |
| `src/cards/README.md` | Перечень карт, URL, API |
| `SERVLET_API.md` | Архитектура сервлетов |
| `DEPLOYMENT.md` | Развёртывание WAR на Tomcat |
| `rights-service/pom.xml` | WAR `card_rigths` |
| `xsd/*.xsd` | Схемы ЕЭК |

---

*Документ подготовлен для актуализации технической документации (п. 2.2). При изменении версий зависимостей обновлять таблицы по `package.json` и `pom.xml`.*

---

## Развёртывание на Tomcat (историческое, DPA)

<!-- source: DEPLOYMENT.md -->

### Инструкция по развертыванию на Apache Tomcat 8.5.23

> **Актуально для всех форм и EEC-rights:** см. **[docs/BUILD_AND_DEPLOY.md](./docs/BUILD_AND_DEPLOY.md)**.  
> Ниже — историческая инструкция с акцентом на DPA / Maven.  
> **Важно:** WAR `card_rigths` (EEC-rights) должен быть развёрнут и доступен **до** старта/использования карт.

#### Требования

- **Java 8** (JDK 1.8)
- **Apache Maven 3.6+**
- **Apache Tomcat 8.5.23**
- **Node.js 18+** (устанавливается автоматически через Maven, если не установлен)

#### Структура проекта после миграции

```
dpa_card/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/eec/servlet/
│   │   │       └── SpaServlet.java          # Сервлет для SPA маршрутизации
│   │   └── webapp/
│   │       └── WEB-INF/
│   │           └── web.xml                  # Конфигурация веб-приложения
│   └── components/                           # React компоненты (без изменений)
├── public/
│   └── xml/                                  # XML файлы (копируются в dist при сборке)
├── dist/                                     # Результат сборки Vite (создается автоматически)
├── pom.xml                                   # Maven конфигурация
├── vite.config.ts                            # Vite конфигурация (обновлена)
└── package.json                              # npm зависимости (без изменений)
```

#### Сборка WAR-файла

##### Вариант 1: Полная сборка через Maven (рекомендуется)

Maven автоматически:
1. Установит Node.js и npm (если не установлены)
2. Установит npm зависимости
3. Соберет React приложение через Vite
4. Скомпилирует Java сервлет
5. Упакует все в WAR-файл

```bash
### Очистка и сборка
mvn clean package

### Результат: target/dpa_card.war
```

##### Вариант 2: Ручная сборка (для отладки)

```bash
### 1. Установка npm зависимостей
npm install

### 2. Сборка React приложения
npm run build

### 3. Сборка WAR через Maven (без сборки фронтенда)
mvn clean package -Dskip.npm
```

#### Развертывание на Tomcat

##### Способ 1: Через Manager приложение Tomcat

1. Откройте Tomcat Manager: `http://localhost:8080/manager/html`
2. Войдите с правами администратора
3. В разделе "Deploy" выберите файл `target/dpa_card.war`
4. Нажмите "Deploy"

##### Способ 2: Ручное копирование

1. Скопируйте `target/dpa_card.war` в папку `$CATALINA_HOME/webapps/`
2. Перезапустите Tomcat (или дождитесь автоматического развертывания)
3. Приложение будет доступно по адресу: `http://localhost:8080/dpa_card/`

##### Способ 3: Развертывание в корневой контекст

Если нужно развернуть приложение в корневой контекст (`http://localhost:8080/`):

1. Переименуйте `dpa_card.war` в `ROOT.war`
2. Удалите существующую папку `ROOT` из `webapps/` (если есть)
3. Скопируйте `ROOT.war` в `webapps/`
4. Перезапустите Tomcat

**Важно:** При развертывании в корневой контекст убедитесь, что в `vite.config.ts` установлен `base: '/'`.

#### Проверка развертывания

После развертывания откройте в браузере:
- `http://localhost:8080/dpa_card/` (или `http://localhost:8080/` если в корне)
- Приложение должно загрузиться и отобразить интерфейс выбора XML файла

#### Настройка контекстного пути

Если приложение развернуто не в корне, обновите `base` в `vite.config.ts`:

```typescript
// Для /dpa_card/
base: '/dpa_card/',

// Для корня
base: '/',
```

После изменения пересоберите приложение:
```bash
npm run build
mvn clean package
```

#### Решение проблем

##### Проблема: 404 при прямом переходе на URL

**Решение:** Убедитесь, что `SpaServlet` правильно настроен в `web.xml` и скомпилирован.

##### Проблема: Статические ресурсы не загружаются

**Решение:** 
1. Проверьте, что файлы из `public/` скопированы в `dist/` после сборки
2. Проверьте `base` путь в `vite.config.ts`
3. Убедитесь, что MIME типы настроены в `web.xml`

##### Проблема: XML файлы не загружаются

**Решение:**
1. Проверьте, что XML файлы находятся в `public/xml/`
2. После сборки они должны быть в `dist/xml/`
3. В коде используются относительные пути `/xml/...`, которые должны работать

##### Проблема: Ошибка компиляции Java

**Решение:**
1. Убедитесь, что используется Java 8
2. Проверьте, что `javax.servlet-api` добавлена в `pom.xml` с `scope=provided`

##### Проблема: Maven не находит Node.js

**Решение:**
1. Установите Node.js вручную и добавьте в PATH
2. Или позвольте Maven установить его автоматически (займет время при первой сборке)

#### Разработка

Для разработки продолжайте использовать Vite dev server:

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`

#### Production сборка

Для production сборки используйте:

```bash
### Сборка с оптимизацией
mvn clean package -Pproduction

### Или вручную
npm run build
mvn clean package
```

#### Структура WAR-файла

После сборки WAR-файл содержит:

```
dpa_card.war
├── WEB-INF/
│   ├── web.xml
│   ├── classes/
│   │   └── com/eec/servlet/
│   │       └── SpaServlet.class
│   └── lib/ (если есть зависимости)
├── index.html
├── assets/ (JS, CSS файлы)
├── xml/ (XML файлы из public/xml)
└── ... (другие статические ресурсы)
```

#### Дополнительные настройки Tomcat

##### Настройка кодировки

В `conf/server.xml` убедитесь, что установлена кодировка UTF-8:

```xml
<Connector port="8080" protocol="HTTP/1.1"
           connectionTimeout="20000"
           redirectPort="8443"
           URIEncoding="UTF-8" />
```

##### Настройка памяти

Для больших XML файлов может потребоваться увеличить память:

```bash
export CATALINA_OPTS="-Xms512m -Xmx1024m"
```

#### Контакты и поддержка

При возникновении проблем проверьте логи Tomcat в `$CATALINA_HOME/logs/`.

---

## Backend setup

<!-- source: BACKEND_SETUP.md -->

### Настройка бэкенда

#### Структура

Бэкенд реализован на Spring Boot 2.7.18 с использованием:
- Spring Data JPA для работы с БД
- Oracle JDBC для подключения к Oracle
- Spring Cache для кеширования справочников
- REST API для доступа к справочникам

#### Конфигурация базы данных

Настройки подключения к Oracle находятся в `src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:oracle:thin:@192.168.203.212:1521/ses
spring.datasource.username=sesdev
spring.datasource.password=sesdev
```

#### Справочник стран

##### Структура таблицы
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

##### Кеширование
Справочник стран загружается в память при старте приложения через `@PostConstruct` в `CountryService`.

##### API Endpoints

- `GET /api/countries` - все активные страны
- `GET /api/countries/options` - опции для выпадающего списка
- `GET /api/countries/{code}` - страна по коду
- `GET /api/countries/{code}/exists` - проверка существования
- `POST /api/countries/refresh` - обновление кеша

#### Интеграция с фронтендом

##### Валидация при загрузке данных
При отображении данных в режиме просмотра (`NotificationTab`):
- Проверяется наличие страны в справочнике
- Если страна не найдена - отображается красный тег "Не найдено в справочнике"

##### Выбор из справочника в режиме редактирования
В режиме редактирования (`NotificationTabEdit`):
- Поля "Страна" заменены на выпадающие списки (Select)
- Список загружается из API `/api/countries/options`
- Поиск по коду и названию
- Формат отображения: "RU - Российская Федерация"

#### Сборка и развертывание

1. Соберите фронтенд: `npm run build`
2. Соберите WAR: используйте `build-and-deploy.bat` или Maven
3. Разверните на Tomcat

Приложение автоматически подключится к Oracle и загрузит справочники при старте.

#### Логирование

Логи Spring Boot доступны в:
- Консоль Tomcat
- `$CATALINA_HOME/logs/catalina.out`
- `$CATALINA_HOME/logs/localhost.log`

Уровни логирования настраиваются в `application.properties`.

---

## API documentation

<!-- source: API_DOCUMENTATION.md -->

### API Документация

#### Справочник стран

##### Получить все активные страны
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

##### Получить опции для выпадающего списка
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

##### Получить страну по коду
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

##### Проверить существование страны
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

##### Обновить кеш справочника
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

#### Конфигурация

##### База данных Oracle
Настройки подключения находятся в `src/main/resources/application.properties`:

```properties
spring.datasource.url=jdbc:oracle:thin:@192.168.203.212:1521:ses
spring.datasource.username=sesdev
spring.datasource.password=sesdev
spring.datasource.driver-class-name=oracle.jdbc.OracleDriver
```

##### Кеширование
Справочники кешируются при старте приложения в памяти. Для обновления кеша используйте endpoint `/api/countries/refresh`.

---

## Servlet API

<!-- source: SERVLET_API.md -->

### API через Java EE сервлеты

#### Архитектура

Вместо Spring Boot используются обычные Java EE сервлеты с JDBC для подключения к Oracle.

#### Структура

```
src/main/java/com/eec/
├── servlet/
│   ├── CountriesOptionsServlet.java    # GET /api/countries/options
│   └── CountryExistsServlet.java       # GET /api/countries/{code}/exists
└── util/
    └── DatabaseUtil.java               # Утилита для работы с БД
```

#### API Endpoints

##### 1. Получить список стран для выпадающего списка
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

##### 2. Проверить существование страны
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

#### Подключение к БД

Настройки подключения находятся в `DatabaseUtil.java`:
- URL: `jdbc:oracle:thin:@192.168.203.212:1521/ses`
- User: `sesdev`
- Password: `sesdev`

#### Регистрация сервлетов

Сервлеты регистрируются через аннотации `@WebServlet`:
- `@WebServlet(name = "CountriesOptionsServlet", urlPatterns = "/api/countries/options")`
- `@WebServlet(name = "CountryExistsServlet", urlPatterns = "/api/countries/*/exists")`

Tomcat 8.5.23 автоматически обнаружит эти сервлеты при развертывании.

#### Зависимости

- `ojdbc8` - Oracle JDBC драйвер
- `gson` - для работы с JSON (легче чем Jackson)
- `javax.servlet-api` - Servlet API (provided scope, уже есть в Tomcat)

#### Преимущества

1. **Простота** - нет сложных фреймворков
2. **Надежность** - стандартный Java EE, хорошо работает на Tomcat 8.5.23
3. **Легковесность** - минимальные зависимости
4. **Совместимость** - работает с Java 8

---

## Troubleshooting

<!-- source: TROUBLESHOOTING.md -->

### Решение проблем

#### Проблема: В браузере не открывается приложение

##### Что проверить

1. **Правильный адрес (обязательно с путём приложения):**
   - ✅ `http://localhost:8080/dpa_card/`
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

#### Проблема: API возвращает 404

##### Причина
Spring Boot не запускается на Tomcat или зависимости не включены в WAR.

##### Решение

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
   Expand-Archive -Path C:\tomcat\win\Tomcat8\webapps\dpa_card.war -DestinationPath C:\temp\war-check -Force
   Get-ChildItem C:\temp\war-check\WEB-INF\lib | Select-Object Name
   ```

4. **Пересоберите проект:**
   ```powershell
   npm run build
   # Затем используйте Maven для сборки WAR с зависимостями
   ```

#### Проблема: Логи не видны

##### Где искать логи

1. **Основной лог Tomcat:**
   - `C:\tomcat\win\Tomcat8\logs\catalina.out`
   - Содержит все сообщения Tomcat и приложений

2. **Лог приложения:**
   - `C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log`
   - Создается автоматически при запуске Spring Boot

3. **Лог localhost:**
   - `C:\tomcat\win\Tomcat8\logs\localhost.log`
   - Ошибки развертывания конкретных приложений

##### Как просмотреть логи

**Через PowerShell:**
```powershell
### Последние 100 строк
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 100

### Поиск ошибок
Select-String -Path C:\tomcat\win\Tomcat8\logs\catalina.out -Pattern "ERROR|Exception"

### Поиск Spring Boot
Select-String -Path C:\tomcat\win\Tomcat8\logs\catalina.out -Pattern "Spring|Application|CountryService"
```

**Через скрипт:**
```powershell
.\check-logs.bat
```

#### Проблема: Страна не найдена в справочнике

##### Проверка

1. **Проверьте загрузку справочника в логах:**
   ```
   [INFO] Инициализация CountryService...
   [INFO] Загружено стран в кеш: X
   [INFO] Страна BY в справочнике: true/false
   ```

2. **Проверьте API напрямую:**
   ```
   http://localhost:8080/dpa_card/api/countries/options
   ```

3. **Проверьте подключение к БД:**
   В логах не должно быть ошибок подключения к Oracle.

##### Решение

Если страна не загружается:
- Проверьте даты в БД (COUNTRYSDATE и COUNTRYEDATE)
- Обновите кеш: `POST /api/countries/refresh`
- Проверьте логи на наличие ошибок SQL

#### Проверка работы Spring Boot

##### Быстрая проверка

1. **Откройте в браузере:**
   ```
   http://localhost:8080/dpa_card/api/countries/options
   ```
   Должен вернуться JSON со списком стран.

2. **Проверьте логи:**
   ```powershell
   Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 200 | Select-String -Pattern "Spring|Application|CountryService|ERROR"
   ```

3. **Проверьте структуру развернутого приложения:**
   ```powershell
   Get-ChildItem C:\tomcat\win\Tomcat8\webapps\dpa_card\WEB-INF\lib | Select-Object Name -First 20
   ```

#### Частые ошибки

##### Ошибка: ClassNotFoundException
**Причина:** Зависимости не включены в WAR  
**Решение:** Пересоберите проект через Maven

##### Ошибка: Cannot connect to database
**Причина:** Неправильные настройки подключения  
**Решение:** Проверьте `application.properties` и доступность БД

##### Ошибка: 404 на все API запросы
**Причина:** Spring Boot не запустился  
**Решение:** Проверьте логи на наличие ошибок при старте

---

## Расположение логов

<!-- source: LOGS_LOCATION.md -->

### Где искать логи приложения

#### Логи Tomcat

##### Основные логи
- **catalina.out** - основной лог Tomcat и приложения
  - Путь: `C:\tomcat\win\Tomcat8\logs\catalina.out`
  - Содержит: запуск Tomcat, развертывание приложений, ошибки

- **localhost.log** - логи конкретных приложений
  - Путь: `C:\tomcat\win\Tomcat8\logs\localhost.log`
  - Содержит: ошибки при развертывании и работе приложений

- **xsd-form-builder.log** - логи Spring Boot приложения
  - Путь: `C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log`
  - Содержит: логи Spring Boot, загрузка справочников, API запросы

##### Другие логи
- **manager.log** - логи Tomcat Manager
- **host-manager.log** - логи Host Manager

#### Как просмотреть логи

##### Через командную строку
```powershell
### Последние 50 строк catalina.out
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 50

### Поиск ошибок
Select-String -Path C:\tomcat\win\Tomcat8\logs\catalina.out -Pattern "ERROR|Exception|CountryService"

### Логи приложения
Get-Content C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log -Tail 100
```

##### Через текстовый редактор
Откройте файлы в блокноте или любом текстовом редакторе:
- `C:\tomcat\win\Tomcat8\logs\catalina.out`
- `C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log`

#### Что искать в логах

##### При запуске приложения
```
[INFO] Запуск приложения XSD Form Builder...
[INFO] Инициализация CountryService...
[INFO] Начало загрузки справочника стран из БД...
[INFO] Загружено стран в кеш: X
```

##### При ошибках подключения к БД
```
[ERROR] Ошибка при инициализации CountryService
java.sql.SQLException: ...
```

##### При запросах к API
```
[INFO] Проверка существования страны: RU
[DEBUG] Страна найдена: RU -> Российская Федерация
```

#### Проверка работы Spring Boot

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

#### Быстрая проверка

Выполните в PowerShell:
```powershell
### Проверка последних ошибок
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.out -Tail 100 | Select-String -Pattern "ERROR|Exception|CountryService|Application"

### Проверка логов приложения
if (Test-Path "C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log") {
    Get-Content C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log -Tail 50
} else {
    Write-Host "Лог файл приложения не найден. Проверьте catalina.out"
}
```

---

## Quick fix

<!-- source: QUICK_FIX.md -->

### Быстрое решение проблем

#### Проблема: API возвращает 404, логи не видны

##### Где искать логи:

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

##### Быстрая проверка логов:

```powershell
### Последние 100 строк основного лога
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log -Tail 100

### Поиск Spring Boot
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log | Select-String -Pattern "Spring|Application|CountryService"

### Поиск ошибок
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log | Select-String -Pattern "ERROR|Exception"
```

##### Проблема: Spring Boot не запускается

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

##### Проверка работы API:

После перезапуска Tomcat проверьте:
```
http://localhost:8080/dpa_card/api/countries/options
```

Должен вернуться JSON со списком стран.

Если возвращается 404 - Spring Boot не запустился. Проверьте логи на ошибки.

---

## Deploy fix

<!-- source: DEPLOY_FIX.md -->

### Решение проблемы "файл используется другим процессом"

#### Проблема
При развертывании WAR-файла на Tomcat возникает ошибка:
```
файл используется другим процессом
java.io.FileNotFoundException
```

#### Причина
Папка развертывания `dpa_card` уже существует и заблокирована процессом Tomcat.

#### Решение

##### Вариант 1: Остановка Tomcat через сервис Windows

1. Откройте **Службы** (Services):
   - Нажмите `Win + R`
   - Введите `services.msc`
   - Нажмите Enter

2. Найдите службу **Apache Tomcat 8.5** или **Tomcat8**

3. Остановите службу (правый клик → Остановить)

4. Удалите старую папку развертывания:
   ```powershell
   Remove-Item -Path "C:\tomcat\win\Tomcat8\webapps\dpa_card" -Recurse -Force
   Remove-Item -Path "C:\tomcat\win\Tomcat8\webapps\dpa_card.war" -Force
   ```

5. Скопируйте новый WAR-файл:
   ```powershell
   Copy-Item -Path "target\dpa_card.war" -Destination "C:\tomcat\win\Tomcat8\webapps\dpa_card.war"
   ```

6. Запустите службу Tomcat снова

##### Вариант 2: Остановка через командную строку с правами администратора

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
   Remove-Item -Path "C:\tomcat\win\Tomcat8\webapps\dpa_card" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item -Path "C:\tomcat\win\Tomcat8\webapps\dpa_card.war" -Force -ErrorAction SilentlyContinue
   ```

5. Скопируйте новый WAR:
   ```powershell
   Copy-Item -Path "C:\projects\IdeaProjects\xsd-form-builder\target\dpa_card.war" -Destination "C:\tomcat\win\Tomcat8\webapps\dpa_card.war"
   ```

6. Запустите Tomcat:
   ```powershell
   $env:CATALINA_HOME = "C:\tomcat\win\Tomcat8"
   $env:JAVA_HOME = "C:\tomcat\win\Tomcat8\java"
   cd "C:\tomcat\win\Tomcat8\bin"
   .\startup.bat
   ```

##### Вариант 3: Использование Tomcat Manager

Если Tomcat Manager доступен:

1. Откройте `http://localhost:8080/manager/html`

2. Найдите приложение **dpa_card** в списке

3. Нажмите **Undeploy** для удаления

4. Подождите завершения операции

5. Загрузите новый WAR через **Deploy** → **Select WAR file to upload**

##### Проверка развертывания

После развертывания проверьте:

1. Папка создана:
   ```powershell
   Test-Path "C:\tomcat\win\Tomcat8\webapps\dpa_card"
   ```

2. Приложение доступно:
   - Откройте браузер
   - Перейдите на `http://localhost:8080/dpa_card/`

3. Проверьте логи:
   - `C:\tomcat\win\Tomcat8\logs\catalina.out`
   - `C:\tomcat\win\Tomcat8\logs\localhost.log`

##### Альтернативное решение: Развертывание в другой контекст

Если проблема повторяется, можно развернуть приложение под другим именем:

1. Переименуйте WAR:
   ```powershell
   Copy-Item -Path "target\dpa_card.war" -Destination "C:\tomcat\win\Tomcat8\webapps\app.war"
   ```

2. Приложение будет доступно по адресу: `http://localhost:8080/app/`

##### Предотвращение проблемы в будущем

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
   Remove-Item -Path "$env:CATALINA_HOME\webapps\dpa_card" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item -Path "$env:CATALINA_HOME\webapps\dpa_card.war" -Force -ErrorAction SilentlyContinue
   
   Write-Host "Копирую новый WAR..."
   Copy-Item -Path "target\dpa_card.war" -Destination "$env:CATALINA_HOME\webapps\dpa_card.war"
   
   Write-Host "Запускаю Tomcat..."
   .\startup.bat
   
   Write-Host "Готово! Приложение доступно на http://localhost:8080/dpa_card/"
   ```

---

## Rebuild required

<!-- source: REBUILD_REQUIRED.md -->

### ⚠️ ТРЕБУЕТСЯ ПЕРЕСБОРКА ПРОЕКТА

#### Проблема

Сервлеты созданы, но проект **НЕ ПЕРЕСОБРАН**. 

Текущий WAR файл (0.41 MB) не содержит:
- ❌ Скомпилированных Java классов (сервлетов)
- ❌ Зависимостей (ojdbc8, gson)
- ❌ Обновленного web.xml

#### Решение

**Обязательно пересоберите проект:**

```powershell
.\build-and-deploy.bat
```

#### Что произойдет после пересборки

1. Maven скомпилирует Java классы:
   - `CountriesOptionsServlet.class`
   - `CountryExistsServlet.class`
   - `DatabaseUtil.class`

2. Maven включит зависимости в WAR:
   - `ojdbc8.jar` (Oracle JDBC)
   - `gson.jar` (JSON)
   - `jackson-databind.jar` (если используется)

3. WAR файл будет ~5-10 MB (вместо 0.41 MB)

4. В логах Tomcat появятся сообщения:
   ```
   INFO ... Loading servlet CountriesOptionsServlet
   INFO ... Loading servlet CountryExistsServlet
   ```

5. API заработает:
   - `http://localhost:8080/dpa_card/api/countries/options`
   - `http://localhost:8080/dpa_card/api/countries/RU/exists`

#### Проверка после пересборки

```powershell
### Проверка размера WAR
Get-Item target\dpa_card.war | Select-Object Length, LastWriteTime

### Проверка классов в развернутом приложении
Get-ChildItem C:\tomcat\win\Tomcat8\webapps\dpa_card\WEB-INF\classes\com\eec\servlet\*.class

### Проверка зависимостей
Get-ChildItem C:\tomcat\win\Tomcat8\webapps\dpa_card\WEB-INF\lib\*.jar | Select-Object Name
```

#### Текущее состояние

- ❌ WAR: 0.41 MB (слишком маленький)
- ❌ Сервлеты: не найдены в развернутом приложении
- ❌ API: возвращает 404
- ✅ Код сервлетов: создан и готов к компиляции

**Запустите `.\build-and-deploy.bat` для исправления!**

---

## Загрузка зависимостей

<!-- source: download-deps.md -->

### Скачивание зависимостей вручную

Если зависимости не найдены в локальном Maven репозитории, скачайте их вручную:

#### Gson 2.10.1

1. Скачайте: https://repo1.maven.org/maven2/com/google/code/gson/gson/2.10.1/gson-2.10.1.jar
2. Поместите в: `target/dpa_card/WEB-INF/lib/gson.jar`

#### Oracle JDBC 21.9.0.0

1. Скачайте: https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/21.9.0.0/ojdbc8-21.9.0.0.jar
2. Поместите в: `target/dpa_card/WEB-INF/lib/ojdbc8.jar`

#### Альтернатива: через curl (если доступен)

```powershell
### Создать папку для зависимостей
New-Item -ItemType Directory -Path "target\dpa_card\WEB-INF\lib" -Force

### Скачать Gson
curl -L -o "target\dpa_card\WEB-INF\lib\gson.jar" "https://repo1.maven.org/maven2/com/google/code/gson/gson/2.10.1/gson-2.10.1.jar"

### Скачать Oracle JDBC
curl -L -o "target\dpa_card\WEB-INF\lib\ojdbc8.jar" "https://repo1.maven.org/maven2/com/oracle/database/jdbc/ojdbc8/21.9.0.0/ojdbc8-21.9.0.0.jar"
```

После скачивания зависимостей запустите сборку снова.

---

## Ограничения полей XSD

<!-- source: docs/xsd-field-constraints.md -->

### Ограничения полей по XSD (справочник)

Источники: `xsd/EEC_M_SimpleDataObjects_v0.4.12.xsd`, `xsd/EEC_M_SM_SimpleDataObjects_v0.3.9.xsd`.

Таблица типов данных и их ограничений (minLength, maxLength, length, totalDigits, fractionDigits, pattern). Типы с префиксом **csdo:** — общая модель ЕЭК (v0.4.12), **smsdo:** — санитарные меры (v0.3.9).

#### Таблица ограничений по типам

| Тип                                                  | minLength  | maxLength  |  length  |  totalDigits  |  fractionDigits  | pattern / примечание                               |
|:----------------------------------------------------|:---------:|:---------:|:------:|:-----------:|:--------------:|--------------------------------------------------|
| **Строковые (коды, имена, идентификаторы)**           |            |            |         |               |                |                        |
| csdo:AbbreviationNameType                            |     —      |     —      |    —     |       —       |        —         | `[А-Яа-я]{1,120}` → по сути до 120 символов        |
| csdo:AddressKindCodeType                             |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:AdministrativeDivisionCodeType                  |     1      |     24     |    —     |       —       |        —         |                                                    |
| csdo:BankAccountIdType                               |     1      |     34     |    —     |       —       |        —         |                                                    |
| csdo:BankAccountKindCodeType                         |     1      |     10     |    —     |       —       |        —         |                                                    |
| csdo:BankIdType                                      |     —      |     —      |    —     |       —       |        —         | 9 цифр ИЛИ 6 букв+2 ИЛИ 6 букв+5 (БИК/СВИФТ)       |
| csdo:BorderCheckpointCodeType                        |     1      |     18     |    —     |       —       |        —         |                                                    |
| csdo:Code1Type                                       |     —      |     —      |    1     |       —       |        —         | ровно 1 символ                                     |
| csdo:Code1to2Type                                    |     1      |     2      |    —     |       —       |        —         |                                                    |
| csdo:Code1to3Type                                    |     1      |     3      |    —     |       —       |        —         |                                                    |
| csdo:Code2Type                                       |     —      |     —      |    2     |       —       |        —         | ровно 2 символа                                    |
| csdo:Code3Type                                       |     —      |     —      |    3     |       —       |        —         | ровно 3 символа                                    |
| csdo:Code6Type                                       |     —      |     —      |    6     |       —       |        —         | ровно 6 символов                                   |
| csdo:Code10Type                                      |     1      |     10     |    —     |       —       |        —         |                                                    |
| csdo:Code20Type                                      |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:CommodityCodeType                               |     —      |     —      |    —     |       —       |        —         | ТН ВЭД: 2, 4, 6 или 8–10 цифр                      |
| csdo:CommunicationChannelCodeV2Type                  |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:CommunicationChannelIdType                      |     1      |    1000    |    —     |       —       |        —         | телефон/email и т.д.                               |
| csdo:CountryCodeType                                 |     —      |     —      |    —     |       —       |        —         | `[A-Z]{2}` → 2 буквы                               |
| csdo:CurrencyCodeType / CurrencyCodeV3Type           |     —      |     —      |    —     |       —       |        —         | `[A-Z]{3}` → 3 буквы                               |
| csdo:CurrencyN3CodeType / V3                         |     —      |     —      |    —     |       —       |        —         | `[0-9]{3}` → 3 цифры                               |
| csdo:CustomsDocumentIdType                           |     5      |     7      |    —     |       —       |        —         |                                                    |
| csdo:CustomsOfficeCodeType                           |     —      |     —      |    —     |       —       |        —         | 2, 5 или 8 цифр                                    |
| csdo:DocKindCodeType                                 |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:EAEUDocIssuerIdType                             |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:EAEUDocKindCodeType                             |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:EAEUScopeCodeType                               |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:EDocErrorCodeType                               |     1      |     30     |    —     |       —       |        —         |                                                    |
| csdo:Id10Type                                        |     1      |     10     |    —     |       —       |        —         |                                                    |
| csdo:Id20Type                                        |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:Id25Type                                        |     1      |     25     |    —     |       —       |        —         |                                                    |
| csdo:Id40Type                                        |     1      |     40     |    —     |       —       |        —         |                                                    |
| csdo:Id50Type                                        |     1      |     50     |    —     |       —       |        —         |                                                    |
| csdo:MediaTypeCodeType                               |     1      |    255     |    —     |       —       |        —         | MIME и т.п.                                        |
| csdo:Name20Type                                      |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:Name40Type                                      |     1      |     40     |    —     |       —       |        —         |                                                    |
| csdo:Name50Type                                      |     1      |     50     |    —     |       —       |        —         |                                                    |
| csdo:Name120Type                                     |     1      |    120     |    —     |       —       |        —         |                                                    |
| csdo:Name250Type                                     |     1      |    250     |    —     |       —       |        —         |                                                    |
| csdo:Name300Type                                     |     1      |    300     |    —     |       —       |        —         |                                                    |
| csdo:Name500Type                                     |     1      |    500     |    —     |       —       |        —         |                                                    |
| csdo:Name1000Type                                    |     1      |    1000    |    —     |       —       |        —         |                                                    |
| csdo:Name4000Type                                    |     1      |    4000    |    —     |       —       |        —         |                                                    |
| csdo:OrganizationCodeType                            |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:OrganizationIdType                              |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:ReferenceDataIdType                             |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:ReferenceDataItemCodeType                       |     1      |     50     |    —     |       —       |        —         |                                                    |
| csdo:ReportKindCodeType                              |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:ResourceIdType                                  |     1      |    2048    |    —     |       —       |        —         |                                                    |
| csdo:SexCodeType                                     |     1      |     5      |    —     |       —       |        —         |                                                    |
| csdo:StatusCodeType                                  |     1      |     3      |    —     |       —       |        —         |                                                    |
| csdo:TaxpayerIdType                                  |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:TerritoryCodeType                               |     1      |     17     |    —     |       —       |        —         |                                                    |
| csdo:Text100Type                                     |     1      |    100     |    —     |       —       |        —         |                                                    |
| csdo:Text250Type                                     |     1      |    250     |    —     |       —       |        —         |                                                    |
| csdo:Text1000Type                                    |     1      |    1000    |    —     |       —       |        —         |                                                    |
| csdo:Text4000Type                                    |     1      |    4000    |    —     |       —       |        —         |                                                    |
| csdo:UnifiedCode20Type                               |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:UnifiedId20Type                                 |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:UnifiedIdentityDocKindCodeType                  |     1      |     10     |    —     |       —       |        —         |                                                    |
| csdo:UnifiedOrganizationCodeType                     |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:UnifiedOrganizationIdType                       |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:UnifiedTaxpayerIdType                           |     1      |     20     |    —     |       —       |        —         |                                                    |
| csdo:UnifiedTerritoryCodeType                        |     1      |     17     |    —     |       —       |        —         |                                                    |
| csdo:UniqueCustomsNumberIdType                       |     1      |     17     |    —     |       —       |        —         |                                                    |
| csdo:Value100Type                                    |     1      |    100     |    —     |       —       |        —         |                                                    |
| csdo:VehicleCategoryCodeType                         |     1      |     3      |    —     |       —       |        —         |                                                    |
| csdo:VehicleIdType                                   |     1      |     17     |    —     |       —       |        —         |                                                    |
| csdo:VehicleEcoClassCodeType                         |     —      |     —      |    —     |       —       |        —         | `\d{2}` → 2 цифры                                  |
| csdo:VehicleMakeCodeType                             |     —      |     —      |    —     |       —       |        —         | `\d{3}` → 3 цифры                                  |
| csdo:VehicleMassKindCodeType                         |     —      |     —      |    —     |       —       |        —         | `\d{2}` → 2 цифры                                  |
| **Числовые (decimal/integer)**                        |            |            |         |               |                |                        |
| csdo:AccountingAmountType                            |     —      |     —      |    —     |       19      |        4         | денежная сумма                                     |
| csdo:AccountingAmountV3Type                          |     —      |     —      |    —     |       24      |        4         |                                                    |
| csdo:FractionNumber10MeasureType                     |     —      |     —      |    —     |       10      |        1         |                                                    |
| csdo:FractionNumber9MeasureType                      |     —      |     —      |    —     |       9       |        3         |                                                    |
| csdo:GeoCoordinateMeasureType                        |     —      |     —      |    —     |       11      |        8         |                                                    |
| csdo:Number2Type                                     |     —      |     —      |    —     |       2       |        0         | целое 2 цифры                                      |
| csdo:Ordinal3Type                                    |     —      |     —      |    —     |       3       |        —         | целое до 3 цифр                                    |
| csdo:Ordinal8Type                                    |     —      |     —      |    —     |       8       |        —         | целое до 8 цифр                                    |
| csdo:PhysicalMeasureType                             |     —      |     —      |    —     |       24      |        6         | величина измерения                                 |
| csdo:Quantity4Type                                   |     —      |     —      |    —     |       4       |        —         | целое                                              |
| csdo:Quantity5Type                                   |     —      |     —      |    —     |       5       |        —         | целое                                              |
| csdo:Quantity6Type                                   |     —      |     —      |    —     |       6       |        —         | целое                                              |
| csdo:Quantity8Type                                   |     —      |     —      |    —     |       8       |        —         | целое                                              |
| csdo:Rate204Type                                     |     —      |     —      |    —     |       24      |        4         | коэффициент                                        |
| csdo:UnifiedAccountingAmountType                     |     —      |     —      |    —     |       24      |        4         |                                                    |
| csdo:UnifiedPhysicalMeasureType                      |     —      |     —      |    —     |       24      |        6         |                                                    |
| **Только pattern (фиксированная длина по шаблону)**   |            |            |         |               |                |                        |
| csdo:ClassificationLevelCodeType                     |     —      |     —      |    —     |       —       |        —         | `\d` → 1 цифра                                     |
| csdo:ClassificationMethodCodeType                    |     —      |     —      |    —     |       —       |        —         | `\d{2}` → 2 цифры                                  |
| csdo:CodeListConductMethodCodeType                   |     —      |     —      |    —     |       —       |        —         | `\d{2}`                                            |
| csdo:CodeListEventCodeType                           |     —      |     —      |    —     |       —       |        —         | `\d{2}`                                            |
| csdo:CodeListKindCodeType                            |     —      |     —      |    —     |       —       |        —         | `\d` → 1 цифра                                     |
| csdo:CodeListProvideMethodCodeType                   |     —      |     —      |    —     |       —       |        —         | `\d{2}`                                            |
| csdo:ConfidentialityDegreeCodeType                   |     —      |     —      |    —     |       —       |        —         | `\d` → 1 цифра                                     |
| csdo:EducationLevelCodeType                          |     —      |     —      |    —     |       —       |        —         | 1–3 цифры                                          |
| csdo:LanguageCodeType                                |     —      |     —      |    —     |       —       |        —         | `[a-z]{2}` → 2 буквы                               |
| csdo:MeasurementUnitCodeType                         |     —      |     —      |    —     |       —       |        —         | 2–3 буквы/цифры или 3–4 цифры                      |
| csdo:PackageKindCodeType                             |     —      |     —      |    —     |       —       |        —         | `[A-Z0-9]{2}` → 2 символа                          |
| csdo:PaymentBudgetCodeType                           |     —      |     —      |    —     |       —       |        —         | 1–20 цифр                                          |
| csdo:ReferenceDataKindCodeType                       |     —      |     —      |    —     |       —       |        —         | 1–20 цифр                                          |
| csdo:TaxRegistrationReasonCodeType                   |     —      |     —      |    —     |       —       |        —         | `\d{9}` → 9 цифр                                   |
| csdo:TransportModeCodeType                           |     —      |     —      |    —     |       —       |        —         | `\d{2}`                                            |
| csdo:UnifiedCountryCodeType / UnqualifiedCountryCodeType |     —      |     —      |    —     |       —       |        —         | `[A-Z]{2}`                                         |
| csdo:UnifiedCurrencyCodeType                         |     —      |     —      |    —     |       —       |        —         | `[A-Z]{3}`                                         |
| csdo:UnifiedCurrencyN3CodeType                       |     —      |     —      |    —     |       —       |        —         | `[0-9]{3}`                                         |
| csdo:UnifiedMeasurementUnitCodeType                  |     —      |     —      |    —     |       —       |        —         | как MeasurementUnitCodeType                        |
| csdo:UnifiedPackageKindCodeType                      |     —      |     —      |    —     |       —       |        —         | `[A-Z0-9]{2}`                                      |
| csdo:UnifiedPaymentBudgetCodeType                    |     —      |     —      |    —     |       —       |        —         | 1–20 цифр                                          |
| csdo:UnifiedTransportModeCodeType                    |     —      |     —      |    —     |       —       |        —         | 1–2 цифры                                          |
| csdo:UniversallyUniqueIdType                         |     —      |     —      |    —     |       —       |        —         | UUID                                               |
| csdo:VehicleEPassportIdType                          |     —      |     —      |    —     |       —       |        —         | шаблон СТС/ОТТС                                    |
| **Бинарные / размер в байтах**                        |            |            |         |               |                |                        |
| csdo:Picture1MbType                                  |     1      |  1048576   |    —     |       —       |        —         | до 1 МБ                                            |
| csdo:Picture1536KbType                               |     1      |  1572864   |    —     |       —       |        —         | до 1,5 МБ                                          |
| csdo:Picture10MbType                                 |     1      |  10485760  |    —     |       —       |        —         | до 10 МБ                                           |
| **Типы SM (smsdo:)**                                  |            |            |         |               |                |                        |
| smsdo:ActiveIngredientCodeType                       |     —      |     —      |    —     |       —       |        —         | `[0-9]{5}` → 5 цифр                                |
| smsdo:AgriculturalOrganizationCodeType               |     1      |     20     |    —     |       —       |        —         |                                                    |
| smsdo:AnimalIdKindCodeType                           |     —      |     —      |    —     |       —       |        —         | `[0-9]{2}`                                         |
| smsdo:AnimalTraceabilityInformationKindCodeType      |     1      |     2      |    —     |       —       |        —         |                                                    |
| smsdo:AnimalTurnoverParticipanKindCodeType           |     1      |     2      |    —     |       —       |        —         |                                                    |
| smsdo:CompartmentCodeType                            |     1      |     1      |    —     |       —       |        —         | ровно 1 символ                                     |
| smsdo:InternationalNonProprietaryNameCodeType        |     1      |     5      |    —     |       —       |        —         |                                                    |
| smsdo:MeasureGoalCodeType                            |     1      |     20     |    —     |       —       |        —         |                                                    |
| smsdo:MeasureKindCodeType                            |     1      |     5      |    —     |       —       |        —         |                                                    |
| smsdo:RegistrationFileCodeType                       |     1      |     10     |    —     |       —       |        —         |                                                    |
| smsdo:TemperatureMeasureType                         |     —      |     —      |    —     |       3       |        1         | температура                                        |
| smsdo:VeterinaryDrugPackageKindCodeType              |     1      |     5      |    —     |       —       |        —         |                                                    |
| smsdo:VeterinaryDrugToolCodeType                     |     1      |     20     |    —     |       —       |        —         |                                                    |
| smsdo:ZoneTypeCodeType                               |     1      |     5      |    —     |       —       |        —         |                                                    |
| smsdo:AnimalMovementEventKindCodeType                |     —      |     —      |    —     |       —       |        —         | `[0-9]{3}`                                         |
| smsdo:AnimalVeterinaryEventKindCodeType              |     —      |     —      |    —     |       —       |        —         | `[0-9]{3}`                                         |
| smsdo:ClinicPharmacologicalGroupCodeType             |     —      |     —      |    —     |       —       |        —         | `[0-9]{3}`                                         |
| smsdo:DrugSubstanceCodeType                          |     —      |     —      |    —     |       —       |        —         | `[0-9]{3}`                                         |
| smsdo:SanitaryProductKindCodeType                    |     —      |     —      |    —     |       —       |        —         | `[0-9]{3}`                                         |
| smsdo:SanitaryProductTypeCodeType                    |     —      |     —      |    —     |       —       |        —         | `[0-9]{3}`                                         |
| smsdo:TechnicalRegulationIdType                      |     —      |     —      |    —     |       —       |        —         | «ТР ТС 001/2011» и т.п.                            |
| smsdo:VeterinaryCertificateIdType                    |     —      |     —      |    —     |       —       |        —         | 2 буквы + 10 цифр                                  |
| smsdo:VeterinaryProductReleaseFormCodeType           |     —      |     —      |    —     |       —       |        —         | `[0-9]{5}`                                         |
| smsdo:VeterinaryProductCodeType                      |     —      |     —      |    —     |       —       |        —         | `\d{5}`                                            |
| smsdo:OKPCodeType                                    |     —      |     —      |    —     |       —       |        —         | `\d{6}`                                            |

Полный машинный вывод по всем типам (в т.ч. только pattern) можно перегенерировать скриптом в корне проекта (см. вывод команды с `python3` и `xsd/`).

---

#### Второй шаг: ограничения для полей ввода в форме

План:

1. **Сопоставить поля формы с типами XSD**  
   По схеме карточки (DangerousProductAlert → SM Complex/Simple) для каждого поля ввода определить тип элемента (csdo:.../smsdo:...).

2. **Задать ограничения в UI**  
   - Для типов с **minLength/maxLength** или **length**:  
     - `maxLength` на `<Input>`, `<Input.TextArea>`, ограничение при валидации.  
     - При необходимости `minLength` в правилах (например, обязательное поле с минимумом 1 символ уже покрыто `required`).  
   - Для типов с **totalDigits/fractionDigits**:  
     - ограничение на числовое поле (целая часть, дробная часть), при необходимости `min`/`max` по смыслу.  
   - Для типов с **pattern**:  
     - либо `maxLength` по длине шаблона (например, 2 для `[A-Z]{2}`),  
     - либо валидация по regex при сабмите / onBlur (и при желании подсказка в placeholder или под полем).

3. **Где хранить маппинг**  
   - Вариант А: один конфиг/мапа «имя поля (или path в XML) → тип» и общий хелпер, возвращающий `{ maxLength, pattern, … }` по типу.  
   - Вариант Б: в описании полей формы (если есть единый источник правды для полей) добавить атрибуты `xsdType`, `maxLength`, `pattern` и использовать их в компонентах ввода и в валидации.

4. **Валидация**  
   - При сохранении/отправке проверять длину и pattern по этой таблице, сообщения об ошибках формулировать по типам (например: «Код страны — 2 латинские буквы», «Наименование — до 300 символов»).

Когда будете готовы ввести ограничения в полях ввода, можно пройти по формам и для каждого поля подставить соответствующие значения из этой таблицы (и при необходимости вынести маппинг полей к типам в отдельный модуль).

---

## Анализ XSD

<!-- source: ANALYSIS.md -->

### Анализ XSD схем и предложение стека фронтенд-приложения

#### 1. Анализ структуры XSD

##### 1.1 Основная структура документа

Документ `DangerousProductAlertDetails` (R.SM.SS.08.002) состоит из:

1. **EDocHeader** (ccdo:EDocHeaderType) - заголовок электронного документа
   - InfEnvelopeCode - код информационного конверта
   - EDocCode - код электронного документа (R.SM.SS.08.002)
   - EDocId - идентификатор электронного документа
   - EDocRefId - ссылка на исходный документ
   - EDocDateTime - дата и время документа
   - LanguageCode - код языка

2. **DangerousProductAlertDetails** (smcdo:DangerousProductAlertDetailsType) - основное содержимое
   - Расширяет IncidentAlertDetailsType
   - Содержит:
     - NonCompliantSanitaryProductDetails - сведения о продукции
     - DetectionPlaceDetails - место обнаружения
     - SanitaryMeasureBaseDetails - принятые меры
     - ResourceItemStatusDetails - статус записи

##### 1.2 Метаинформация карты (из IncidentAlertIdDetailsType)

- **UnifiedCountryCode** - Страна (государство-член)
- **IncidentId** - Регистрационный номер (RU-95746-44)
- **IncidentKindCode** - Вид уведомления
- **DocCreationDate** - Дата формирования уведомления
- **EndDate** - Дата закрытия (архивации)
- **UnifiedAuthorityDetails** - Уполномоченный орган

##### 1.3 Дополнительная метаинформация

Из **ResourceItemStatusDetails**:
- **ValidityPeriodDetails** - период действия записи (StartDate, EndDate)
- **UpdateDateTime** - дата и время обновления записи

Из **EDocHeader**:
- **EDocDateTime** - дата и время создания документа
- **EDocId** - идентификатор документа

##### 1.4 Типовые блоки для интерфейса

###### Блок 1: Метаинформация (Header)
- Страна (UnifiedCountryCode)
- Регистрационный номер (IncidentId)
- Версия (из системы, не в XSD)
- Источник (из системы: входящие/исходящие)
- Дата создания (EDocDateTime или DocCreationDate)
- Дата изменения (UpdateDateTime)
- Статус (из системы, не в XSD напрямую)

###### Блок 2: Уведомление (IncidentAlertDetails)
- Страна
- Регистрационный номер
- Вид (IncidentKindCode)
- Дата формирования (DocCreationDate)
- Дата закрытия (EndDate)
- Уполномоченный орган (UnifiedAuthorityDetails)

###### Блок 3: Продукция (NonCompliantSanitaryProductDetails)
- Тип продукции (SanitaryProductTypeCode/Name)
- Детали продукции (ProductDetails)
- Изготовитель (SupplyChainPartyDetails)
- Партии продукции (NonCompliantSanitaryProductBatchDetails)

###### Блок 4: Место обнаружения (DetectionPlaceDetails)
- Организация (OrganizationDetails)
- Пункт пропуска (BorderCheckpointDetails)
- Адрес (ObjectAddressDetails)
- Геокоординаты (GeoCoordinateDetails)
- Описание (DescriptionText)

###### Блок 5: Принятые меры (SanitaryMeasureBaseDetails)
- Код и наименование меры (MeasureCode/Name)
- Документ меры (MeasureDocDetails)
- Дата начала/окончания (StartDate/EndDate)
- Описание (DescriptionText)
- Детали реализации (MeasureImplementationDetails)

###### Блок 6: Документы соответствия
- Различные типы документов (DocContentDetailsType)

###### Блок 7: Нарушения
- Сведения о нарушениях (DiscrepancyOfQualityIndexDetails)

###### Блок 8: ТСД (Техническая документация)
- Различные технические документы

##### 1.5 Типы данных

Базовые типы (BaseDataTypes):
- **TextType** - текст
- **CodeType** - код
- **DateType** - дата
- **DateTimeType** - дата и время
- **IdentifierType** - идентификатор
- **NameType** - наименование
- **IndicatorType** - индикатор (boolean)
- **QuantityType** - количество
- **AmountType** - денежная сумма

#### 2. Предложение стека фронтенд-приложения

##### 2.1 Рекомендуемый стек

###### Framework
- **React 18+** с TypeScript
  - Популярный, зрелый фреймворк
  - Отличная поддержка TypeScript
  - Большое сообщество и экосистема
  - Хорошая производительность

###### UI библиотека
- **Ant Design (antd)** 5.x
  - Готовая компонентная библиотека с русской локализацией
  - Компоненты: Tabs, Modal, Table, Form, DatePicker, Select и др.
  - Поддержка тем и кастомизации
  - Хорошая документация

###### State Management
- **Zustand** или **Redux Toolkit**
  - Zustand - легковесный, простой в использовании
  - Redux Toolkit - более мощный для сложных сценариев
  - Для управления состоянием карты, модальных окон, истории статусов

###### Формы
- **React Hook Form** + **Zod**
  - React Hook Form - производительная библиотека форм
  - Zod - валидация схем на основе TypeScript типов
  - Можно генерировать схемы из XSD

###### Роутинг
- **React Router v6**
  - Стандартное решение для SPA
  - Поддержка вложенных роутов

###### HTTP клиент
- **Axios** или **Fetch API**
  - Axios - удобные interceptors, автоматическая сериализация
  - Fetch - нативный, но требует обертки

###### Утилиты
- **date-fns** - работа с датами
- **lodash-es** - утилиты для работы с данными
- **clsx** - условные классы

###### Сборка
- **Vite**
  - Быстрая сборка и HMR
  - Отличная поддержка TypeScript
  - Современный инструментарий

###### Стилизация
- **CSS Modules** или **Tailwind CSS**
  - CSS Modules - изоляция стилей
  - Tailwind - utility-first подход

##### 2.2 Альтернативные варианты

###### Вариант 2: Vue 3 + TypeScript
- **Vue 3** с Composition API
- **Element Plus** или **Vuetify** - UI библиотеки
- **Pinia** - state management
- **Vue Router** - роутинг

###### Вариант 3: Angular
- **Angular 17+**
- **Angular Material** - UI компоненты
- Встроенный state management и роутинг

##### 2.3 Рекомендация

**Выбрать: React 18 + TypeScript + Ant Design + Zustand + React Hook Form + Vite**

Причины:
1. React - наиболее популярный и востребованный
2. Ant Design - отличная поддержка русского языка из коробки
3. Zustand - простой и достаточный для данного проекта
4. Vite - быстрая разработка
5. TypeScript - типобезопасность при работе с XSD структурами

##### 2.4 Структура проекта

```
xsd-form-builder/
├── src/
│   ├── components/
│   │   ├── common/          # Общие компоненты
│   │   ├── card/            # Компоненты карты
│   │   │   ├── CardHeader.tsx
│   │   │   ├── CardActions.tsx
│   │   │   └── CardTabs.tsx
│   │   ├── modals/          # Модальные окна
│   │   │   ├── StatusHistoryModal.tsx
│   │   │   ├── ElectronicDocumentModal.tsx
│   │   │   └── AccessModal.tsx
│   │   └── tabs/            # Вкладки
│   │       ├── NotificationTab.tsx
│   │       ├── ProductTab.tsx
│   │       ├── TSDTab.tsx
│   │       ├── ComplianceDocumentsTab.tsx
│   │       ├── ViolationsTab.tsx
│   │       ├── DetectionPlaceTab.tsx
│   │       └── MeasuresTab.tsx
│   ├── types/               # TypeScript типы
│   │   ├── xsd.ts           # Типы из XSD
│   │   └── card.ts          # Типы карты
│   ├── stores/              # Zustand stores
│   │   ├── cardStore.ts
│   │   └── modalStore.ts
│   ├── utils/               # Утилиты
│   │   ├── dateUtils.ts
│   │   └── formatters.ts
│   ├── hooks/               # Custom hooks
│   ├── services/            # API сервисы
│   │   └── api.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

##### 2.5 Особенности реализации

1. **Генерация типов из XSD**
   - Использовать инструменты типа `xsd2ts` или `jsonix` для генерации TypeScript типов
   - Или создать типы вручную на основе анализа XSD

2. **Валидация данных**
   - Использовать Zod схемы для валидации форм
   - Синхронизация с XSD ограничениями

3. **Локализация**
   - Ant Design имеет встроенную русскую локализацию
   - Для кастомных текстов использовать i18n библиотеку (react-i18next)

4. **Обработка дат**
   - Все даты в формате ISO 8601
   - Отображение в формате DD.MM.YYYY HH:mm:ss

5. **Управление состоянием**
   - Карта сведений - центральный store
   - Модальные окна - отдельный store или локальное состояние
   - История статусов - кеширование в store

---

## Открытие всех версий

<!-- source: docs/OPEN_ALL_VERSIONS_OPTIONS.md -->

### Варианты реализации «Открыть все версии»

Цель: по кнопке «Открыть все версии» открыть в легаси-приложении реестр сведений об опасной продукции с фильтром по **Регистрационный номер** и **Страна**, передав туда управление.

Данные из карточки: `data.registrationNumber`, `data.country`.

---

#### Вариант 1. Переход по URL в новой вкладке (рекомендуется)

Легаси принимает параметры в query:  
`https://legacy-host/register?country=RU&registrationNumber=RU-95746-44`

**Реализация:**
- В конфиге (env) задаётся базовый URL легаси, например `VITE_LEGACY_REGISTER_URL=https://legacy.example/register`.
- По клику строится URL с `country` и `registrationNumber`, вызывается `window.open(url, '_blank')`.

**Плюсы:** просто, пользователь остаётся в текущей карточке, реестр открыт в отдельной вкладке.  
**Минусы:** легаси должен уметь читать GET-параметры и применять фильтр.

---

#### Вариант 2. Редирект в текущем окне

Тот же URL, но `window.location.href = url` (переход в текущей вкладке).

**Плюсы:** не нужна вторая вкладка.  
**Минусы:** пользователь уходит из нового UI; чтобы вернуться к карточке, нужна кнопка «Назад» или ссылка из легаси.

---

#### Вариант 3. POST в новую вкладку

Если легаси принимает только POST (форма с полями `country`, `registrationNumber`):

- Создать скрытую форму: `action=legacyUrl`, `method=POST`, `target="_blank"`.
- Добавить `<input name="country">`, `<input name="registrationNumber">`.
- По клику подставить значения и вызвать `form.submit()`.

**Плюсы:** подходит, когда реестр открывается только по POST.  
**Минусы:** имена полей и URL должны совпадать с ожиданиями легаси.

---

#### Вариант 4. Отдельный путь легаси для «всех версий»

Легаси предоставляет специальный endpoint, например:  
`https://legacy-host/register/all-versions?country=RU&registrationNumber=RU-95746-44`  
и сам открывает нужную вкладку реестра с фильтром.

**Плюсы:** гибкость на стороне легаси (можно подставить свою вкладку, доп. параметры).  
**Минусы:** нужно доработать легаси.

---

#### Рекомендация

Оптимально начать с **варианта 1** (новая вкладка + GET-параметры), с вынесением базового URL в конфиг (например `.env`):

- `VITE_LEGACY_REGISTER_URL` — полный URL страницы реестра без параметров, например `https://legacy.example/register`.
- Параметры: `country`, `registrationNumber` (или имена, которые ожидает легаси: `regNumber`, `incidentId` и т.д.).

Если легаси использует другие имена параметров или только POST — реализовать **вариант 3** с формой.

Имена параметров и путь (в т.ч. вкладка) нужно уточнить по документации или коду легаси.

---

#### Реализация (вариант 1)

В проекте добавлено:

- **`src/utils/legacyRegisterUrl.ts`** — сборка URL и открытие в новой вкладке.
- В **DangerousProductCard** по кнопке «Открыть все версии» вызывается `openLegacyRegisterAllVersions(country, registrationNumber)`.

**Настройка:** в корне проекта создайте `.env` (или задайте переменные при сборке):

```env
### URL страницы реестра в легаси (без параметров)
VITE_LEGACY_REGISTER_URL=https://legacy.example/register

### Опционально: имена параметров, если в легаси не country и registrationNumber
### VITE_LEGACY_REGISTER_PARAM_COUNTRY=country
### VITE_LEGACY_REGISTER_PARAM_REG=registrationNumber
```

Если `VITE_LEGACY_REGISTER_URL` не задан, по клику показывается предупреждение. После задания URL пересоберите фронт (`npm run build`).

---

## План: партии и вкладки

<!-- source: docs/plan-batches-tabs.md -->

### План: кортежи партий (множественность) на вкладках ТСД, Документы соответствия, Нарушения

#### Текущее состояние (AS IS)

- **Модель данных:** `tsd.batches[]` — массив партий; каждая партия (`ProductBatchDetails`) содержит сведения о серии/партии и `shippingDocuments`. Документы соответствия и нарушения хранятся на уровне карты: `complianceDocuments`, `violations` (один общий список).
- **XML:** в XSD каждый `NonCompliantSanitaryProductBatchDetails` содержит: `BatchDetails`, `ConsignmentId`, `CommodityMeasure`, `ShippingDocumentDetails[]`, `ConformityDocDetails[]`, `RequirementViolationDetails[]`. Парсер сейчас собирает ТСД по партиям, а документы соответствия и нарушения — из всего документа (без привязки к партии).
- **Вкладка ТСД:** отображается только первая партия (`data.batches[0]`).
- **Вкладки «Документы соответствия» и «Нарушения»:** работают с «плоскими» данными карты, не привязаны к партиям.

#### Целевое состояние (TO BE)

- Один массив кортежей (партий). Каждый кортеж: сведения о серии/партии + ТСД + документы соответствия + нарушения.
- Вкладки ТСД, Документы соответствия, Нарушения: постраничный просмотр (или аккордеон/список партий) по всем кортежам; внутри выбранного кортежа — свои данные вкладки.
- Экспорт XML и сравнение XML — с учётом структуры «всё внутри каждого NonCompliantSanitaryProductBatchDetails».

---

#### 1. Модель данных (types/card.ts)

- Расширить **ProductBatchDetails** (или ввести тип «кортеж партии»):
  - оставить: сведения о серии/партии, `shippingDocuments`;
  - добавить: `complianceDocuments?: ComplianceDocument[]`, `violations?: ViolationsData`.
- Решение по верхнему уровню:
  - **Вариант A:** единственный источник правды — `tsd.batches[]`; в каждой партии есть и ТСД, и документы соответствия, и нарушения. Поля `cardData.complianceDocuments` и `cardData.violations` удалить или оставить только как «склейку» всех партий для обратной совместиости (если где-то используются).
  - **Вариант B (рекомендуется):** оставить `cardData.complianceDocuments` и `cardData.violations` для обратной совместиости; при загрузке из XML заполнять их объединением по всем партиям; при сохранении/экспорте — собирать только из `tsd.batches[].complianceDocuments` и `tsd.batches[].violations`.

Итог: в типах у каждой партии явно есть `complianceDocuments` и `violations`; при необходимости сохраняем плоские поля на карте как производные.

---

#### 2. Парсер XML (xmlParser.ts)

- При разборе каждой партии (`parseBatchDetails` или аналог) для элемента `NonCompliantSanitaryProductBatchDetails`:
  - как сейчас: читать `BatchDetails`, `ShippingDocumentDetails` → сведения о партии и ТСД;
  - дополнительно: искать **внутри этого элемента партии** все `ConformityDocDetails` → вызывать существующий `parseComplianceDocument` по каждому → записывать в `batch.complianceDocuments`;
  - дополнительно: искать **внутри этого элемента партии** все `RequirementViolationDetails` → вызывать существующую логику разбора нарушений (требования + показатели) → записывать в `batch.violations`.
- После разбора всех партий: при необходимости заполнять `cardData.complianceDocuments` и `cardData.violations` объединением по всем партиям (если оставляем плоскую модель для совместимости).
- Убедиться, что партии без документов соответствия/нарушений в XML получают пустые массивы/пустой объект, а не `undefined`, чтобы вкладки могли единообразно итерировать по партиям.

---

#### 3. Вкладка «ТСД» (TSDTab.tsx)

- Убрать использование только первой партии (`data.batches[0]`).
- Реализовать просмотр по всем партиям:
  - **Пагинация:** список партий (например, таблица или карточки) с пагинацией Ant Design; на каждой странице — одна или несколько партий; для выбранной партии выводить блок «сведения о серии/партии» + таблица ТСД (как сейчас для одной партии).
  - Альтернатива: аккордеон (Collapse) — каждая панель = одна партия, внутри — сведения о партии + ТСД.
  - Альтернатива: выпадающий список «Партия 1, Партия 2, …» + под ним блок сведений о выбранной партии и её ТСД.
- В блоке партии показывать краткий идентификатор (например, номер партии, дата изготовления, BatchId), чтобы пользователь отличал кортежи.

---

#### 4. Вкладка «Документы соответствия» (ComplianceDocumentsTab.tsx)

- Перейти на данные по партиям: источник — `tsd.batches` (или единый массив кортежей), для каждой партии — `batch.complianceDocuments`.
- Реализовать ту же схему навигации, что и на вкладке ТСД: пагинация по партиям (или аккордеон, или выбор партии из списка). Для выбранной партии отображать:
  - сведения о серии/партии (краткий блок);
  - таблицу/список документов соответствия этой партии.
- Если в данных остаётся плоский `cardData.complianceDocuments`, можно показывать его только при отсутствии партий (обратная совместиость) или не использовать вовсе — по решению по п. 1.

---

#### 5. Вкладка «Нарушения» (ViolationsTab.tsx)

- Аналогично: данные по партиям из `tsd.batches[].violations`.
- Навигация по кортежам (пагинация/аккордеон/список партий); для выбранной партии:
  - сведения о серии/партии;
  - сведения о нарушениях (многократные нарушения внутри одной партии — как сейчас: таблицы требований и показателей).
- Учесть, что нарушения внутри одной партии могут быть многократными — отображение всех записей по выбранной партии.

---

#### 6. Редактирование (Edit-вкладки)

- **TSDTabEdit, ComplianceDocumentsTabEdit, ViolationsTabEdit:** перевести на работу с массивом партий: добавление/удаление/редактирование партий и внутри каждой партии — ТСД, документов соответствия, нарушений.
- Форма редактирования одной партии: сведения о партии + вложенные списки ТСД / документов соответствия / нарушений; при множественности партий — список партий с возможностью выбора и переключения (и пагинация при необходимости).

---

#### 7. Экспорт XML (xmlExporter / логика сборки XML)

- При формировании XML для каждого элемента `NonCompliantSanitaryProductBatchDetails` выводить:
  - сведения о серии/партии (BatchDetails, ConsignmentId, CommodityMeasure и т.д.);
  - все `ShippingDocumentDetails` этой партии;
  - все `ConformityDocDetails` этой партии;
  - все `RequirementViolationDetails` этой партии.
- Не дублировать документы соответствия и нарушения на уровень выше партий; единственный источник при экспорте — поля внутри соответствующей партии в `tsd.batches`.

---

#### 8. Сравнение XML (cardDataComparator, XMLComparisonModal)

- Сравнивать карты с учётом структуры по партиям: сопоставление партий (по индексу или по ключу, например BatchId + даты), затем внутри каждой пары партий — сравнение ТСД, документов соответствия, нарушений.
- При отображении расхождений показывать, к какой партии (кортежу) относится различие (например, «Партия 2: документы соответствия»).

---

#### 9. Валидация (cardValidation.ts)

- Валидация уже завязана на `tsd.batches`, документы соответствия и нарушения. После переноса данных в партии:
  - проверки по ТСД — по каждой партии (как сейчас по первой);
  - проверки «при наличии партий должен быть хотя бы один документ соответствия» и т.п. — пересмотреть и применять к каждой партии или к объединённому списку в зависимости от правил;
  - при необходимости добавить проверки «в каждой партии с ТСД должны быть документы соответствия» и т.д.

---

#### 10. Порядок внедрения

1. **Типы и парсер:** расширить `ProductBatchDetails`, парсить документы соответствия и нарушения внутри каждого элемента партии в XML, заполнять `batch.complianceDocuments` и `batch.violations`; при необходимости заполнять плоские поля с карты.
2. **Вкладка ТСД:** пагинация/навигация по партиям + отображение сведений о партии и ТСД для выбранной партии.
3. **Вкладка «Документы соответствия»:** та же навигация по партиям, отображение сведений о партии и документов соответствия по выбранной партии.
4. **Вкладка «Нарушения»:** то же для нарушений.
5. **Редактирование:** TSDTabEdit, ComplianceDocumentsTabEdit, ViolationsTabEdit перевести на работу с массивом партий и вложенными данными.
6. **Экспорт XML:** формировать один блок NonCompliantSanitaryProductBatchDetails на партию со всеми вложенными элементами.
7. **Сравнение и валидация:** скорректировать под новую структуру.

После выполнения плана данные всех кортежей будут доступны на каждой из трёх вкладок с единым подходом (пагинация или альтернативный UX), а экспорт и сравнение XML будут соответствовать схеме XSD.

---

## Карты (src/cards)

<!-- source: src/cards/README.md -->

### Структура карт приложения

Разделение по типам карт: **одна карта** — все её файлы в одной зоне, **вторая карта** — в другой, **общее** — явно вынесено.

#### Папки

| Папка | Назначение |
|-------|------------|
| **`dpa/`** | Карта сведений об **опасной продукции** (DPA). Компонент, точка входа, перечень зависимостей (вкладки, API, типы). |
| **`pha/`** | Карта сведений об **обнаружении болезней** (PHA). Компонент, API-клиент, в будущем — свои вкладки и справочники. |
| **`smd/`** | Карта сведений о **временной санитарной мере** (SMD). Компонент, API, вкладки. |
| **`shared/`** | Общие компоненты карт: заголовок (CardHeader), панель действий (CardActions). Используются и в DPA, и в PHA. |

#### DPA (карта опасной продукции)

- **Путь приложения:** `http://localhost:8083/dpa_card/{DPAID}/{GUID}`
- **Компонент:** `cards/dpa` → `DangerousProductCard` (реализация в `components/card/DangerousProductCard.tsx`).
- **Вкладки:** `components/tabs/dpa/*` (Уведомление, Продукция, ТСД, Документы соответствия, Нарушения, Место обнаружения, Меры).
- **API:** `/api/dpa/xml`, `/api/dpa/metadata`, `/api/dpa/save`, `/api/dpa/delete` и др.
- **Бэкенд:** сервлеты `Dpa*` в `com.eec.servlet.dpa`, таблицы DPA, DPAXML.

#### PHA (карта обнаружения болезней)

- **Путь приложения:** `http://localhost:8083/pha_card/{PHAID}/{GUID}`
- **Компонент:** `cards/pha` → `PhaCard`.
- **API:** `/api/pha/xml`, `/api/pha/metadata` (собственные сервлеты).
- **Бэкенд:** сервлеты `Pha*` в `com.eec.servlet.pha`, таблицы PHA, PHAXML.

#### SMD (карта сведений о временной санитарной мере)

- **Путь приложения:** `http://localhost:8083/smd_card/{SMDID}/{GUID}`
- **Компонент:** `cards/smd` → `SmdCard`
- **API:** `/api/smd/xml`, `/api/smd/metadata`, `/api/smd/status-history`, `/api/smd/access`
- **Бэкенд:** сервлеты `Smd*` в `com.eec.servlet.smd`, права `sanitaryMeasureIn`, `sanitaryMeasureOut`, `sanitaryMeasureDB`
- **XSD:** `EEC_R_SM_SS_09_SanitaryMeasureDetails_v1.0.0.xsd`

Тип приложения (DPA/PHA/PPV/DPR/SMD) задаётся в `cards/config.ts` по `BASE_URL` (он берётся из base path при сборке).

#### Как загрузить вторую карту (PHA)

##### Локальная разработка

Запуск с базой PHA (приложение откроется как «карта PHA»):

```bash
npm run dev -- --base=/pha_card/
```

Откройте в браузере: `http://localhost:3000/pha_card/` (или `.../pha_card/123/guid` для карты по PHAID). Контент — PhaCard, запросы уходят на `/pha_card/api/pha/...` (при прокси или развёрнутом бэкенде под тем же путём).

##### Сборка под PHA

Собрать фронтенд с base path для PHA:

```bash
npm run build:pha
```

Или вручную:

```bash
VITE_APP_BASE=/pha_card/ npm run build
```

В `dist/` будет сборка, рассчитанная на развёртывание по пути `/pha_card/`.

##### Развёртывание нескольких карт на одном Tomcat

Приложения на одном сервере (примеры порта):
- **DPA:** `http://localhost:8083/dpa_card/`
- **PHA:** `http://localhost:8083/pha_card/`
- **PPV:** `http://localhost:8083/ppv_card/`
- **DPR:** `http://localhost:8083/dpr_card/`
- **SMD:** `http://localhost:8083/smd_card/`

Соберите и разверните каждое приложение отдельно (в любом порядке):

```bash
./build-and-deploy-dpa.sh    # DPA → http://localhost:PORT/dpa_card/
./build-and-deploy-pha.sh    # PHA → http://localhost:PORT/pha_card/
./build-and-deploy-ppv.sh    # PPV → http://localhost:PORT/ppv_card/
./build-and-deploy-dpr.sh    # DPR → http://localhost:PORT/dpr_card/
./build-and-deploy-smd.sh    # SMD → http://localhost:PORT/smd_card/
```

WAR попадают в `webapps`; Tomcat поднимает контексты. Удалённо: `./deploy-dpa-to-remote.sh`, `./deploy-pha-to-remote.sh`, `./deploy-ppv-to-remote.sh`, `./deploy-dpr-to-remote.sh`, `./deploy-smd-to-remote.sh` (опция `--build` при необходимости). В Cursor: **Terminal → Run Task…** — задачи сборки/деплоя DPA, PHA, PPV, DPR, SMD.

```bash
npm run build:smd
### или dev:
npm run dev -- --base=/smd_card/
```

#### Общие ресурсы (CSS и др.)

- **Стили:** общие стили приложения — `src/index.css`. Специфичные классы карт: `.card-header-descriptions`, `.card-actions-row`, `.pha-card` — при необходимости дополнять в `index.css` или в общих компонентах.
- **Модалки:** `components/modals/dpa/*` — модалки карты DPA (история статусов, доступ, эл. документы, сравнение XML, результат валидации); `components/modals/pha/` — зарезервировано под модалки PHA. Общие компоненты: `components/common/*`.
- **Типы, утилиты:** `types/card.ts`, `utils/*` — по мере появления отличий PHA можно ввести `types/phaCard.ts`, `cards/pha/utils`.
- **Вкладки по картам:** `components/tabs/dpa/` — вкладки карты DPA; `components/tabs/pha/` — зарезервировано под вкладки PHA.
- **Хуки по назначению:** `hooks/shared/` — общие хуки справочников (options), используемые DPA, PHA и общими компонентами; `hooks/dpa/`, `hooks/pha/` — зарезервировано под специфичные хуки карт.

#### Что осталось без разделения по DPA/PHA

- **`components/card/`** — компонент `DangerousProductCard.tsx` (карта DPA); `CardHeader.tsx` и `CardActions.tsx` дублируют `cards/shared` (используются экспорты из `cards/shared`). При желании можно перенести только DPA-карту в `components/card/dpa/`.
- **`utils/`** — `referenceDataApi.ts` смешивает общие справочники и DPA-API (fetchDpaXml, saveDpaCard и т.д.); PHA-API вынесен в `cards/pha/phaApi.ts`. При росте можно выделить `utils/dpa/` и `utils/pha/`.
- **`types/card.ts`** — общий тип `CardData` для обеих карт; при отличиях PHA — завести `types/phaCard.ts`.
- **Точка входа** `App.tsx` — общая, выбор карты по `isPhaApp()`.
- **Сервлеты-справочники** (CountriesOptionsServlet, BorderCheckpointOptionsServlet и т.д.) — общие, остаются в `com.eec.servlet` без подпакетов dpa/pha.

---

## Summary

<!-- source: SUMMARY.md -->

### Резюме проблем и решений

#### Проблемы

1. **API возвращает 404** - Spring Boot не запускается на Tomcat
2. **Логи не видны** - нужно знать где искать

#### Решения

##### 1. Где искать логи

**Основные логи Tomcat:**
- `C:\tomcat\win\Tomcat8\logs\catalina.YYYY-MM-DD.log` - основной лог
- `C:\tomcat\win\Tomcat8\logs\localhost.YYYY-MM-DD.log` - логи приложений
- `C:\tomcat\win\Tomcat8\logs\xsd-form-builder.log` - лог Spring Boot (создается при запуске)

**Быстрая проверка:**
```powershell
### Последние 100 строк
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log -Tail 100

### Поиск Spring Boot
Get-Content C:\tomcat\win\Tomcat8\logs\catalina.2025-12-26.log | Select-String -Pattern "Spring|Application|CountryService"

### Или используйте скрипт
.\check-logs.bat
```

##### 2. Почему Spring Boot не запускается

**Проблема:** В WAR файле отсутствуют:
- Зависимости Spring Boot (WEB-INF/lib/)
- Скомпилированные Java классы (WEB-INF/classes/)

**Причина:** Maven не включил зависимости и классы в WAR из-за неправильной конфигурации.

**Решение:**
1. Исправлена конфигурация `maven-war-plugin` - убрано ограничение `packagingIncludes`
2. Исправлена конфигурация Spring Boot для внешнего Tomcat:
   - Исключен встроенный Tomcat из `spring-boot-starter-web`
   - Добавлен `spring-boot-starter-tomcat` с scope `provided`

##### 3. Что нужно сделать

**Пересобрать проект:**
```powershell
### 1. Собрать фронтенд
npm run build

### 2. Собрать WAR с зависимостями
### Используйте build-and-deploy.bat или Maven напрямую
```

**Проверить структуру WAR:**
После сборки в `target/dpa_card.war` должны быть:
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

##### 4. Проверка работы API

После перезапуска Tomcat проверьте:
```
http://localhost:8080/dpa_card/api/countries/options
```

Должен вернуться JSON со списком стран.

Если все еще 404 - проверьте логи на ошибки при старте Spring Boot.
