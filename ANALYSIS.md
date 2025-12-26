# Анализ XSD схем и предложение стека фронтенд-приложения

## 1. Анализ структуры XSD

### 1.1 Основная структура документа

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

### 1.2 Метаинформация карты (из IncidentAlertIdDetailsType)

- **UnifiedCountryCode** - Страна (государство-член)
- **IncidentId** - Регистрационный номер (RU-95746-44)
- **IncidentKindCode** - Вид уведомления
- **DocCreationDate** - Дата формирования уведомления
- **EndDate** - Дата закрытия (архивации)
- **UnifiedAuthorityDetails** - Уполномоченный орган

### 1.3 Дополнительная метаинформация

Из **ResourceItemStatusDetails**:
- **ValidityPeriodDetails** - период действия записи (StartDate, EndDate)
- **UpdateDateTime** - дата и время обновления записи

Из **EDocHeader**:
- **EDocDateTime** - дата и время создания документа
- **EDocId** - идентификатор документа

### 1.4 Типовые блоки для интерфейса

#### Блок 1: Метаинформация (Header)
- Страна (UnifiedCountryCode)
- Регистрационный номер (IncidentId)
- Версия (из системы, не в XSD)
- Источник (из системы: входящие/исходящие)
- Дата создания (EDocDateTime или DocCreationDate)
- Дата изменения (UpdateDateTime)
- Статус (из системы, не в XSD напрямую)

#### Блок 2: Уведомление (IncidentAlertDetails)
- Страна
- Регистрационный номер
- Вид (IncidentKindCode)
- Дата формирования (DocCreationDate)
- Дата закрытия (EndDate)
- Уполномоченный орган (UnifiedAuthorityDetails)

#### Блок 3: Продукция (NonCompliantSanitaryProductDetails)
- Тип продукции (SanitaryProductTypeCode/Name)
- Детали продукции (ProductDetails)
- Изготовитель (SupplyChainPartyDetails)
- Партии продукции (NonCompliantSanitaryProductBatchDetails)

#### Блок 4: Место обнаружения (DetectionPlaceDetails)
- Организация (OrganizationDetails)
- Пункт пропуска (BorderCheckpointDetails)
- Адрес (ObjectAddressDetails)
- Геокоординаты (GeoCoordinateDetails)
- Описание (DescriptionText)

#### Блок 5: Принятые меры (SanitaryMeasureBaseDetails)
- Код и наименование меры (MeasureCode/Name)
- Документ меры (MeasureDocDetails)
- Дата начала/окончания (StartDate/EndDate)
- Описание (DescriptionText)
- Детали реализации (MeasureImplementationDetails)

#### Блок 6: Документы соответствия
- Различные типы документов (DocContentDetailsType)

#### Блок 7: Нарушения
- Сведения о нарушениях (DiscrepancyOfQualityIndexDetails)

#### Блок 8: ТСД (Техническая документация)
- Различные технические документы

### 1.5 Типы данных

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

## 2. Предложение стека фронтенд-приложения

### 2.1 Рекомендуемый стек

#### Framework
- **React 18+** с TypeScript
  - Популярный, зрелый фреймворк
  - Отличная поддержка TypeScript
  - Большое сообщество и экосистема
  - Хорошая производительность

#### UI библиотека
- **Ant Design (antd)** 5.x
  - Готовая компонентная библиотека с русской локализацией
  - Компоненты: Tabs, Modal, Table, Form, DatePicker, Select и др.
  - Поддержка тем и кастомизации
  - Хорошая документация

#### State Management
- **Zustand** или **Redux Toolkit**
  - Zustand - легковесный, простой в использовании
  - Redux Toolkit - более мощный для сложных сценариев
  - Для управления состоянием карты, модальных окон, истории статусов

#### Формы
- **React Hook Form** + **Zod**
  - React Hook Form - производительная библиотека форм
  - Zod - валидация схем на основе TypeScript типов
  - Можно генерировать схемы из XSD

#### Роутинг
- **React Router v6**
  - Стандартное решение для SPA
  - Поддержка вложенных роутов

#### HTTP клиент
- **Axios** или **Fetch API**
  - Axios - удобные interceptors, автоматическая сериализация
  - Fetch - нативный, но требует обертки

#### Утилиты
- **date-fns** - работа с датами
- **lodash-es** - утилиты для работы с данными
- **clsx** - условные классы

#### Сборка
- **Vite**
  - Быстрая сборка и HMR
  - Отличная поддержка TypeScript
  - Современный инструментарий

#### Стилизация
- **CSS Modules** или **Tailwind CSS**
  - CSS Modules - изоляция стилей
  - Tailwind - utility-first подход

### 2.2 Альтернативные варианты

#### Вариант 2: Vue 3 + TypeScript
- **Vue 3** с Composition API
- **Element Plus** или **Vuetify** - UI библиотеки
- **Pinia** - state management
- **Vue Router** - роутинг

#### Вариант 3: Angular
- **Angular 17+**
- **Angular Material** - UI компоненты
- Встроенный state management и роутинг

### 2.3 Рекомендация

**Выбрать: React 18 + TypeScript + Ant Design + Zustand + React Hook Form + Vite**

Причины:
1. React - наиболее популярный и востребованный
2. Ant Design - отличная поддержка русского языка из коробки
3. Zustand - простой и достаточный для данного проекта
4. Vite - быстрая разработка
5. TypeScript - типобезопасность при работе с XSD структурами

### 2.4 Структура проекта

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

### 2.5 Особенности реализации

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






