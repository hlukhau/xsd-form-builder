# П. 2.2 Состав технологического ПО

Материалы для актуализации раздела **«Состав технологического ПО»** по подсистеме веб-карт сведений ЕЭК (репозиторий `xsd-form-builder`).

Документ отражает фактический стек реализации на дату подготовки. Версии ПО приведены по файлам `package.json`, `pom.xml`, `README.md`.

---

## 1. Назначение подсистемы

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

## 2. Текст для включения в п. 2.2 (готовый фрагмент)

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

## 3. Детализация по уровням

### 3.1. Клиентская часть (SPA)

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

### 3.2. Серверная часть

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

### 3.3. СУБД и языки доступа к данным

| Аспект | Технология |
|--------|------------|
| СУБД | Oracle Database |
| Подключение | `jdbc:oracle:thin:...` (параметры из JSON прав по GUID) |
| Запросы из приложения | SQL (ANSI SQL-92), JDBC `PreparedStatement` |
| Логика на стороне БД | PL/SQL (объекты Oracle; схемы в т.ч. SESINT, SESDEV) |

### 3.4. Стандарты и схемы данных

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

### 3.5. Средства сборки и разработки

| Компонент | Версия | Назначение |
|-----------|--------|------------|
| Node.js | 18.17+ | Сборка frontend |
| npm | 9.6+ | Зависимости frontend |
| Apache Maven | 3.6+ | Компиляция Java, упаковка WAR |
| Vite | 5.0 | Сборка SPA |

Скрипты сборки и развёртывания: `build-manual.sh`, `build-and-deploy-*.sh`, `build-all-cards.sh`.

---

## 4. Соотношение с прежним содержанием п. 2.2

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

## 5. Требования к среде эксплуатации (кратко)

| Компонент | Требование |
|-----------|------------|
| JDK | 1.8 |
| Apache Tomcat | 8.5.23 (или совместимая ветка 8.5.x) |
| Oracle Database | с поддержкой JDBC Thin |
| Node.js | 18+ (только для сборки, не для runtime) |

---

## 6. Ссылки на исходные материалы в репозитории

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
