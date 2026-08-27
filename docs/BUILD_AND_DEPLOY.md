# Сборка и деплой веб-карт ЕЭК (xsd-form-builder)

Документ описывает полный цикл сборки и развёртывания **всех форм** подсистемы и сервиса прав **EEC-rights** (`card_rigths`) на Apache Tomcat.

---

## 1. Критично: EEC-rights — первым

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

## 2. Состав приложений

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

## 3. Требования

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

## 4. Конфигурация связи карт → EEC-rights

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

## 5. Локальная сборка и деплой

### 5.1. Рекомендуемый порядок (полный стенд)

```bash
# 0. Зависимости frontend (один раз / при смене package-lock)
npm install

# 1. ПЕРВЫМ — EEC-rights
./build-and-deploy-rights-service-local.sh

# 2. Проверка
curl -s "http://localhost:$(./get-tomcat-port.sh)/card_rigths/health"
# ожидается: {"status":"UP"}

# 3. Все карты
./build-and-deploy-all-local.sh
```

`build-and-deploy-all-local.sh` последовательно: DPA → PPV → PHA → DPR → SMD → SMR → SMA.

### 5.2. Одна карта

```bash
./build-and-deploy-dpa.sh   # и аналогично -ppv, -pha, -dpr, -smd, -smr, -sma
```

Полный рестарт Tomcat вместо hot-deploy:

```bash
HOT_DEPLOY=0 ./build-and-deploy-smd.sh
```

### 5.3. Только сборка WAR (без копирования в Tomcat)

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

## 6. Удалённый деплой (scp на Tomcat)

Параметры — в `deploy.env` (`REMOTE_*`).

```bash
# 1. ПЕРВЫМ — EEC-rights
./build-and-deploy-rights-service.sh
# или: ./deploy-rights-service-to-remote.sh [--build]

# 2. Проверка health на remote (порт REMOTE_PORT)
curl -s "http://${REMOTE_HOST}:${REMOTE_PORT}/card_rigths/health"

# 3. Все карты
./deploy-all-cards-to-remote.sh --build
# или без пересборки, если WAR уже в target/:
./deploy-all-cards-to-remote.sh
```

По одной карте: `./deploy-dpa-to-remote.sh`, `./deploy-smd-to-remote.sh`, … (опция `--build` у rights и при необходимости предварительный `./build-all-cards.sh`).

---

## 7. Чеклист после деплоя

1. **`/card_rigths/health`** отвечает `UP`
2. В логах Tomcat контекст `card_rigths` стартовал **до** или без ошибок к моменту обращения карт
3. Открывается UI карты, например `/smd_card/`, `/dpa_card/`
4. После передачи GUID от родителя карта получает права/креды БД (без 404/ошибок реестра)

---

## 8. Типичные ошибки

| Симптом | Причина / действие |
|---------|-------------------|
| Карты не видят права / БД | Не залит или не стартовал `card_rigths`; сначала деплой EEC-rights |
| Health 404 | Неверный порт или WAR не развернулся в `webapps/card_rigths.war` |
| Связь с rights после смены порта Tomcat | Обновить `eec.rights.service.baseUrl` / `EEC_RIGHTS_SERVICE_BASE_URL` |
| Пустой реестр после редеплоя rights | Повторный `POST` GUID→JSON от родительской системы |
| Неверный base path UI | Пересобрать frontend нужным `npm run build:<форма>` перед упаковкой WAR |

---

## 9. Связанные материалы

- [rights-service/README.md](../rights-service/README.md) — API EEC-rights
- [DEPLOYMENT.md](../DEPLOYMENT.md) — историческая инструкция (в основном DPA / Maven)
- [docs/tech-stack-2.2.md](./tech-stack-2.2.md) — состав технологического ПО
