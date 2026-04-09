# Структура карт приложения

Разделение по типам карт: **одна карта** — все её файлы в одной зоне, **вторая карта** — в другой, **общее** — явно вынесено.

## Папки

| Папка | Назначение |
|-------|------------|
| **`dpa/`** | Карта сведений об **опасной продукции** (DPA). Компонент, точка входа, перечень зависимостей (вкладки, API, типы). |
| **`pha/`** | Карта сведений об **обнаружении болезней** (PHA). Компонент, API-клиент, в будущем — свои вкладки и справочники. |
| **`shared/`** | Общие компоненты карт: заголовок (CardHeader), панель действий (CardActions). Используются и в DPA, и в PHA. |

## DPA (карта опасной продукции)

- **Путь приложения:** `http://localhost:8083/dpa_card/{DPAID}/{GUID}`
- **Компонент:** `cards/dpa` → `DangerousProductCard` (реализация в `components/card/DangerousProductCard.tsx`).
- **Вкладки:** `components/tabs/dpa/*` (Уведомление, Продукция, ТСД, Документы соответствия, Нарушения, Место обнаружения, Меры).
- **API:** `/api/dpa/xml`, `/api/dpa/metadata`, `/api/dpa/save`, `/api/dpa/delete` и др.
- **Бэкенд:** сервлеты `Dpa*` в `com.eec.servlet.dpa`, таблицы DPA, DPAXML.

## PHA (карта обнаружения болезней)

- **Путь приложения:** `http://localhost:8083/pha_card/{PHAID}/{GUID}`
- **Компонент:** `cards/pha` → `PhaCard`.
- **API:** `/api/pha/xml`, `/api/pha/metadata` (собственные сервлеты).
- **Бэкенд:** сервлеты `Pha*` в `com.eec.servlet.pha`, таблицы PHA, PHAXML.

Тип приложения (DPA/PHA) задаётся в `cards/config.ts` по `BASE_URL` (он берётся из base path при сборке).

## Как загрузить вторую карту (PHA)

### Локальная разработка

Запуск с базой PHA (приложение откроется как «карта PHA»):

```bash
npm run dev -- --base=/pha_card/
```

Откройте в браузере: `http://localhost:3000/pha_card/` (или `.../pha_card/123/guid` для карты по PHAID). Контент — PhaCard, запросы уходят на `/pha_card/api/pha/...` (при прокси или развёрнутом бэкенде под тем же путём).

### Сборка под PHA

Собрать фронтенд с base path для PHA:

```bash
npm run build:pha
```

Или вручную:

```bash
VITE_APP_BASE=/pha_card/ npm run build
```

В `dist/` будет сборка, рассчитанная на развёртывание по пути `/pha_card/`.

### Развёртывание обеих карт одновременно на одном Tomcat

Оба приложения на одном сервере:
- **DPA:** `http://localhost:8083/dpa_card/`
- **PHA:** `http://localhost:8083/pha_card/`

Соберите и разверните каждое приложение отдельно (в любом порядке):

```bash
./build-and-deploy-dpa.sh    # DPA → http://localhost:PORT/dpa_card/
./build-and-deploy-pha.sh    # PHA → http://localhost:PORT/pha_card/
```

Оба WAR попадают в webapps; Tomcat поднимает оба контекста. Для удалённого сервера: `./deploy-dpa-to-remote.sh` и `./deploy-pha-to-remote.sh` (с опцией `--build` при необходимости).

## Общие ресурсы (CSS и др.)

- **Стили:** общие стили приложения — `src/index.css`. Специфичные классы карт: `.card-header-descriptions`, `.card-actions-row`, `.pha-card` — при необходимости дополнять в `index.css` или в общих компонентах.
- **Модалки:** `components/modals/dpa/*` — модалки карты DPA (история статусов, доступ, эл. документы, сравнение XML, результат валидации); `components/modals/pha/` — зарезервировано под модалки PHA. Общие компоненты: `components/common/*`.
- **Типы, утилиты:** `types/card.ts`, `utils/*` — по мере появления отличий PHA можно ввести `types/phaCard.ts`, `cards/pha/utils`.
- **Вкладки по картам:** `components/tabs/dpa/` — вкладки карты DPA; `components/tabs/pha/` — зарезервировано под вкладки PHA.
- **Хуки по назначению:** `hooks/shared/` — общие хуки справочников (options), используемые DPA, PHA и общими компонентами; `hooks/dpa/`, `hooks/pha/` — зарезервировано под специфичные хуки карт.

## Что осталось без разделения по DPA/PHA

- **`components/card/`** — компонент `DangerousProductCard.tsx` (карта DPA); `CardHeader.tsx` и `CardActions.tsx` дублируют `cards/shared` (используются экспорты из `cards/shared`). При желании можно перенести только DPA-карту в `components/card/dpa/`.
- **`utils/`** — `referenceDataApi.ts` смешивает общие справочники и DPA-API (fetchDpaXml, saveDpaCard и т.д.); PHA-API вынесен в `cards/pha/phaApi.ts`. При росте можно выделить `utils/dpa/` и `utils/pha/`.
- **`types/card.ts`** — общий тип `CardData` для обеих карт; при отличиях PHA — завести `types/phaCard.ts`.
- **Точка входа** `App.tsx` — общая, выбор карты по `isPhaApp()`.
- **Сервлеты-справочники** (CountriesOptionsServlet, BorderCheckpointOptionsServlet и т.д.) — общие, остаются в `com.eec.servlet` без подпакетов dpa/pha.
