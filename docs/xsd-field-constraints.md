# Ограничения полей по XSD (справочник)

Источники: `xsd/EEC_M_SimpleDataObjects_v0.4.12.xsd`, `xsd/EEC_M_SM_SimpleDataObjects_v0.3.9.xsd`.

Таблица типов данных и их ограничений (minLength, maxLength, length, totalDigits, fractionDigits, pattern). Типы с префиксом **csdo:** — общая модель ЕЭК (v0.4.12), **smsdo:** — санитарные меры (v0.3.9).

## Таблица ограничений по типам

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

## Второй шаг: ограничения для полей ввода в форме

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
