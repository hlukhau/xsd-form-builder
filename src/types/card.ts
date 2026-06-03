// Типы для карты сведений об обнаружении опасной продукции

export interface CardData {
  // Метаинформация (при загрузке по DPAID берутся из VW_DPA)
  country: string
  /** Наименование страны инцидента из БД (COUNTRY.COUNTRYNAME); для интеграций (postMessage all_version). */
  alertCountryName?: string | null
  registrationNumber: string
  version: number
  source: string // напр. "Входящие сведения", "Исходящие сведения", "Данные ЕЭК"
  /** Код типа источника из DPA (DATASOURCEKINDCODE); "2" = исходящие (код 3 — из БД ЕЭК) */
  datasourceKindCode?: string | null
  createdAt: string // ISO 8601
  modifiedAt: string // ISO 8601
  status: string // DPASTATUSNAME для отображения
  /** DPASTATUSID из таблицы DPASTATUS — для логики кнопок по коду */
  statusId?: number | null

  // Электронный документ
  electronicDocument: ElectronicDocument

  // Уведомление
  notification: Notification

  // История статусов
  statusHistory: StatusHistoryItem[]

  // Доступные ЦГЭ
  accessList: AccessItem[]

  // Данные вкладок (по XSD нарушения и документы соответствия только в tsd.batches[].*)
  product?: ProductData
  tsd?: TSDData
  detectionPlace?: DetectionPlaceData
  measures?: MeasuresData

  /** PHA: уведомления, являющиеся причиной данного случая (smcdo:IncidentAlertIdDetails). */
  phaCauseNotifications?: PhaCauseNotificationItem[]

  /**
   * PHA: признак инфекционной болезни (diseasehealthproblem.diseasehealthprobleminfectfl).
   * При версии > 1 определяет допустимые коды вида уведомления: 1 — 3, 5; 0 — 4, 6.
   */
  phaFirstDiseaseInfectiousFlag?: 0 | 1

  /** PHA: сведения о болезни (smcdo:PublicHealthIncidentDetails → DiseaseHealthProblemDetails, EventDate, EndDate, CrossborderSpreadRiskIndicator, PathogenDetails). */
  phaDisease?: PhaDiseaseDetails

  /** PHA: группы пациентов (smcdo:PatientGroupDetails внутри PublicHealthIncidentDetails). */
  phaPatientGroups?: PhaPatientGroupItem[]

  /**
   * PHA: DEPID из PHADEPPERMIS по карте (для проверки пересечения с publicHealthIn:status / publicHealthOut:* в JSON прав).
   * Подставляется из GET /api/pha/metadata/{id}.
   */
  phaAccessibleDepIds?: string[]

  /** PHA: зона распространения (smcdo:SpreadingZoneDetails, LocationDetailsType — как Место обнаружения). */
  spreadingZone?: DetectionPlaceData
  /** PHA: зоны распространения (0..n smcdo:SpreadingZoneDetails). */
  spreadingZones?: DetectionPlaceData[]

  /**
   * PPV: очередь новых кодов стран адресатов (ЕАЭС, не BY), подлежащих дописыванию в PPVACTOR при следующем сохранении.
   * Уже сохранённые адресаты не хранятся здесь — они подгружаются с сервера на вкладке «Адресаты».
   */
  ppvActorCountryCodes?: string[]
  /**
   * PPV: идентификаторы PPVACTOR без EDOCID — при сохранении удаляются из БД (DELETE).
   */
  ppvActorRemovalIds?: number[]

  /**
   * SMD: партии продукции (smcdo:NonCompliantSanitaryProductBatchDetails).
   * Каждая строка — отдельная детализация (вкладки Продукция / ТСД / …).
   */
  smdProductBatches?: SmdProductBatchItem[]
}

/** SMD: одна строка таблицы «Продукция» с данными для детализации. */
export interface SmdProductBatchItem {
  key: string
  /** Краткое наименование для заголовка панели в списке. */
  summaryLabel?: string
  product?: ProductData
  tsd?: TSDData
}

/** PHA: группа пациентов (smcdo:PatientGroupDetails). */
export interface PhaPatientGroupItem {
  /** Количество человек в группе (smsdo:PersonQuantity). */
  personQuantity?: string
  /** Код возрастной группы (smsdo:AgeGroupCode); справочник agegr. */
  ageGroupCode?: string
  /** Код исхода болезни (smsdo:DiseaseOutcomeCode); справочник diseaseoutcome. */
  diseaseOutcomeCode?: string
  /** Наличие лабораторного подтверждения (smsdo:LaboratoryConfirmedIndicator): 0 — Нет, 1 — Да, null — Не указано. */
  laboratoryConfirmedIndicator?: 0 | 1 | null
}

/** PHA: сведения о болезни (smcdo:DiseaseHealthProblemDetails + EventDate, EndDate, CrossborderSpreadRiskIndicator, таблица PathogenDetails). */
export interface PhaDiseaseDetails {
  /** Не используется: в XML не выгружается, в форме отображается «—». */
  diseaseCode?: string
  /** Наименование болезни (smsdo:DiseaseHealthProblemName). Редактирование только для версии = 1. */
  diseaseName?: string
  /** Дата первого случая (csdo:EventDate). */
  firstCaseDate?: string
  /** Дата последнего случая (csdo:EndDate в блоке болезни). */
  lastCaseDate?: string
  /** Риск трансграничного распространения: 0 — Нет, 1 — Да, null/undefined — Не указано (в XML — true/false или элемент отсутствует). */
  crossborderSpreadRiskIndicator?: 0 | 1 | null
  /** Таблица возбудителей (smcdo:PathogenDetails). */
  pathogens?: PhaPathogenDetails[]
}

/** PHA: возбудитель (smcdo:PathogenDetails). */
export interface PhaPathogenDetails {
  /** Тип возбудителя (smsdo:PathogenKindName); справочник pathogenkind. */
  pathogenKindName?: string
  /** Наименование возбудителя (smsdo:PathogenName). */
  pathogenName?: string
}

/** Элемент списка причинных уведомлений PHA (smcdo:IncidentAlertIdDetails): страна, рег. номер, вид, дата формирования. */
export interface PhaCauseNotificationItem {
  country: string
  registrationNumber: string
  type: string // IncidentKindCode, справочник incidentalertkind: 1,2,3,4,7,8,10,11,13,14,16,17,19
  formationDate: string
}

export interface TSDData {
  batches: ProductBatchDetails[]
}

export interface ProductBatchDetails {
  batchId?: string // BatchId
  manufactureDate?: string // ManufactureDate
  productShelfLifeEndDate?: string // ProductShelfLifeEndDate
  commodityMeasure?: MeasureWithUnit // UnifiedCommodityMeasure
  note?: string // NoteText
  consignmentId?: string // ConsignmentId
  batchCommodityMeasure?: MeasureWithUnit // CommodityMeasure
  shippingDocuments: ShippingDocument[]
  /** Документы соответствия в составе данного кортежа партии (smcdo:ConformityDocDetails внутри NonCompliantSanitaryProductBatchDetails) */
  complianceDocuments?: ComplianceDocument[]
  /** Нарушения в составе данного кортежа партии (smcdo:RequirementViolationDetails внутри NonCompliantSanitaryProductBatchDetails). В партии может быть несколько нарушений. */
  violations?: ViolationsData[]
}

export interface MeasureWithUnit {
  value: string
  unitCode?: string
  unitCodeListId?: string
  unitName?: string // Будет определяться из справочника
}

export interface ShippingDocument {
  docKindCode?: string
  docKindName?: string // Из справочника по docKindCode
  docName?: string
  docId?: string
  docCreationDate?: string
  products?: ProductDetails[] // Продукция по документу
  supplyChainParties?: SupplyChainPartyDetails[] // Участники цепи поставки
}

export interface ProductData {
  typeName: string // SanitaryProductTypeName
  typeCode: string // SanitaryProductTypeCode
  productDetails: ProductDetails
  manufacturer: SupplyChainPartyDetails
}

export interface ProductDetails {
  productId?: string // ProductId (штрихкод)
  productName?: string // ProductName
  /** Одно значение (устаревшее, при парсинге заполняется из tradeNames[0]) */
  tradeName?: string // ProductTradeName
  /** Название продукции (smsdo:ProductTradeName) — может быть несколько значений */
  tradeNames?: string[]
  description?: string // DescriptionText
  commodityCode?: string // CommodityCode (Код ТН ВЭД ЕАЭС)
  productPurpose?: string // ProductPurposeText
  applicationMethod?: string // ProductApplicationMethodText
  releaseForm?: string // ReleaseFormText
  storageCondition?: string // StorageConditionText
  labelText?: string // ProductLabelText
  technicalDocs?: TechnicalDocument[]
}

export interface TechnicalDocument {
  docKindCode?: string
  docKindName?: string
  docName?: string
  docId?: string
  docCreationDate?: string
  docStartDate?: string
}

export interface SupplyChainPartyDetails {
  country: string
  businessEntityName?: string
  shortName?: string
  /** Наименование организационно-правовой формы (свободный текст или из справочника по code+codeListId) */
  organizationalForm?: string
  /** Код организационно-правовой формы (справочник sesint.legalform, codeListId=2049) */
  businessEntityTypeCode?: string
  /** Идентификатор справочника (2049 для организационно-правовых форм) */
  businessEntityTypeCodeListId?: string
  subjectIdentifier?: string
  identificationMethod?: string
  customsNumber?: string
  taxpayerId?: string
  taxRegistrationReasonCode?: string
  /** Список адресов (при редактировании — единый список с добавлением; при отсутствии используется регистрационный/фактический/почтовый). */
  addresses?: AddressDetails[]
  registrationAddress?: AddressDetails
  actualAddress?: AddressDetails
  mailingAddress?: AddressDetails
  contacts?: ContactDetails[]
  supplyChainPartyKindCode?: string
}

export interface AddressDetails {
  addressKindCode?: string
  country?: string
  territoryCode?: string
  regionName?: string
  districtName?: string
  cityName?: string
  settlementName?: string
  streetName?: string
  buildingNumberId?: string
  roomNumberId?: string
  postOfficeBoxId?: string
  postCode?: string
  fullAddress?: string
}

export interface ContactDetails {
  contactKind?: string
  contactValue?: string
  communicationChannelCode?: string
  communicationChannelName?: string
  communicationChannelId?: string
}

export interface ElectronicDocument {
  messageCode: string
  documentCode: string
  documentId: string
  documentDate: string
  language: string
  sourceDocumentId: string
  validityPeriod: {
    start: string
    end: string
  }
  updateDateTime: string
}

export interface Notification {
  country: string
  registrationNumber: string
  type: string
  formationDate: string
  endDate: string | null
  authorizedBody: {
    country: string
    identifier: string
    name: string
    shortName: string
  }
}

export interface StatusHistoryItem {
  status: string
  dateTime: string
  employee: string | null
}

export interface AccessItem {
  id: string
  name: string
  /** Код вида подразделения из TB_DEPKIND (dep0601, dep0602 — для добавления/удаления в перечне ЦГЭ) */
  depKindCode?: string
}

// Документы соответствия
export interface ComplianceDocumentsData {
  documents: ComplianceDocument[]
}

export interface ComplianceDocument {
  docKindCode?: string
  docKindName?: string
  docName?: string
  docId?: string
  docCreationDate?: string
  docStartDate?: string
  authority?: UnifiedAuthorityDetails
  registrationCertificateId?: string // для запроса протоколов
}

export interface UnifiedAuthorityDetails {
  country?: string
  authorityName?: string
  authorityBriefName?: string
  authorityId?: string
}

// Протоколы лабораторных исследований
export interface LaboratoryProtocolsData {
  product?: ProductDetails
  protocols: LaboratoryProtocol[]
}

export interface LaboratoryProtocol {
  docKindCode?: string
  docKindName?: string
  docName?: string
  docId?: string
  docCreationDate?: string
  /** Документ в бинарном виде на уровне протокола (smcdo:ComplianceDocDetails → csdo:DocBinaryText) */
  docBinaryText?: { content?: string; mediaTypeCode?: string }
  laboratory?: LaboratoryDetails
}

export interface LaboratoryDetails {
  subjectId?: string
  identificationMethod?: string
  /** Наименование организационно-правовой формы (свободный текст или из справочника) */
  organizationalForm?: string
  /** Код организационно-правовой формы (справочник legalform, codeListId=2049) — для отображения по справочнику */
  businessEntityTypeCode?: string
  businessEntityTypeCodeListId?: string
  businessEntityName?: string
  /** Адреса лаборатории (ccdo:SubjectAddressDetails) — массив для отображения списком */
  addresses?: AddressDetails[]
  registrationAddress?: AddressDetails
  actualAddress?: AddressDetails
  mailingAddress?: AddressDetails
  /** Аттестаты аккредитации — может быть несколько экземпляров */
  accreditationCertificates?: AccreditationCertificateDetails[]
  /** @deprecated используйте accreditationCertificates[0] */
  accreditationCertificate?: AccreditationCertificateDetails
}

export interface AccreditationCertificateDetails {
  docKindName?: string
  docId?: string
  eventDate?: string
  docStartDate?: string
  docValidityDate?: string
  docBinaryText?: {
    content?: string
    mediaTypeCode?: string
  }
  xmlDocument?: string
}

// Нарушения
export interface ViolationsData {
  generalDescription?: string // Описание нарушения на уровне RequirementViolationDetails
  violatedRequirements: ViolatedRequirement[]
  violatedIndicators: ViolatedIndicator[]
}

export interface ViolatedRequirement {
  technicalRegulationId?: string // TechnicalRegulationId (smsdo) — TECHREGULREGNUM или ввод вручную
  technicalRegulationName?: string // DocName (csdo) — TECHREGULNAME или ввод вручную
  /** Если задано — номер и наименование взяты из справочника TECHREGUL (value = TECHREGULCODE). Не сериализуется в XML. */
  techRegulDictionaryCode?: string
  registrationNumber?: string // DocId
  structuralElements?: DocStructuralElement[] // DocStructuralElementDetails
  approvingDocument?: {
    docName?: string // DocReferenceDetails → DocName
    docId?: string // DocReferenceDetails → DocId
    docCreationDate?: string // DocReferenceDetails → DocCreationDate
    docStartDate?: string // DocReferenceDetails → DocStartDate
  }
  description?: string // DescriptionText внутри RequirementsDocDetails
  requirementLevelDescription?: string // DescriptionText на уровне RequirementViolationDetails (после RequirementsDocDetails)
}

export interface DocStructuralElement {
  elementName?: string // DocStructuralElementName
  elementId?: string // DocStructuralElementId
}

export interface ViolatedIndicator {
  isNormative?: boolean // normativeDiscrepancyOfQualityIndexIndicator (1 = true, 0 = false)
  indicatorCode?: string // DiscrepancyOfQualityIndexCode
  indicatorName?: string // DiscrepancyOfQualityIndexName
  indicatorValue?: string // DiscrepancyOfQualityIndexValue
  unitCode?: string // measurementUnitCode
  unitCodeListId?: string // measurementUnitCodeListId
  unitName?: string // из справочника
  note?: string // NoteText
}

// Место обнаружения
export interface DetectionPlaceData {
  organization?: BusinessEntityDetails // OrganizationDetails (UnifiedAuthorityDetails или BusinessEntityDetailsType)
  borderCheckpoint?: BorderCheckpointDetails // BorderCheckpointDetails
  address?: AddressDetails // ObjectAddressDetails
  /** Несколько географических координат (GeoCoordinateDetails). */
  geoCoordinates?: GeoCoordinateDetails[]
  description?: string // DescriptionText
}

export interface BusinessEntityDetails {
  country?: string // UnifiedCountryCode
  businessEntityName?: string // BusinessEntityName
  businessEntityBriefName?: string // BusinessEntityBriefName (или SubjectBriefName в SubjectDetails)
  businessEntityTypeCode?: string // BusinessEntityTypeCode
  businessEntityTypeCodeListId?: string // codeListId атрибут
  businessEntityTypeName?: string // BusinessEntityTypeName
  businessEntityId?: string // BusinessEntityId
  identificationMethod?: string // из атрибута kindId
  customsNumber?: string // UniqueCustomsNumberId / CustomsNumber (таможенный номер)
  /** Код причины постановки на налоговый учёт (csdo:TaxRegistrationReasonCode), 9 цифр. */
  taxRegistrationReasonCode?: string
  taxpayerId?: string // TaxpayerId
  addresses?: AddressDetails[] // SubjectAddressDetails (может быть несколько)
  contacts?: ContactDetails[] // CommunicationDetails
}

export interface BorderCheckpointDetails {
  checkpointCode?: string // BorderCheckpointCode
  checkpointName?: string // BorderCheckpointName
}

export interface GeoCoordinateDetails {
  longitude?: string // LongitudeMeasure
  latitude?: string // LatitudeMeasure
}

// Принятые меры
export interface MeasuresData {
  measures: SanitaryMeasure[]
}

export interface SanitaryMeasure {
  languageCode?: string // LanguageCode
  measureCode?: string // MeasureCode
  measureCodeListId?: string // codeListId атрибут
  measureName?: string // MeasureName
  measureAffectedObjectKindCode?: string // MeasureAffectedObjectKindCode
  startDate?: string // StartDate
  endDate?: string // EndDate
  measureJustificationText?: string // MeasureJustificationText
  description?: string // DescriptionText
  measureDocDetails?: MeasureDocDetails // MeasureDocDetails
  initialMeasureDocDetails?: MeasureDocDetails // InitialMeasureDocDetails
  measureInitiationBasisDetails?: MeasureInitiationBasisItem[] // MeasureInitiationBasisDetails (массив)
  measureImplementationDetails?: MeasureImplementationItem[] // MeasureImplementationDetails (массив)
}

export interface MeasureDocDetails {
  country?: string // UnifiedCountryCode
  languageCode?: string // LanguageCode
  docKindCode?: string // DocKindCode
  docKindCodeListId?: string // codeListId атрибут
  docKindName?: string // DocKindName
  docName?: string // DocName
  docSeriesId?: string // DocSeriesId
  docId?: string // DocId
  docCreationDate?: string // DocCreationDate
  docStartDate?: string // DocStartDate
  docValidityDate?: string // DocValidityDate
  docValidityDuration?: string // DocValidityDuration
  authorityId?: string // AuthorityId
  authorityName?: string // AuthorityName
  description?: string // DescriptionText
  pageQuantity?: string // PageQuantity
  docBinaryText?: {
    content?: string // DocBinaryText
    /** В XML атрибут mediaTypeCode: значение MEDIATYPENAME (MIME). MEDIATYPECODE (расширение) — только в справочнике, на фронте через getCodeByName(MIME) */
    mediaTypeCode?: string
  }
  xmlDocument?: string // AnyDetails
}

export interface MeasureInitiationBasisItem {
  docKindName?: string // DocKindName
  docName?: string // DocName
  docId?: string // DocId
  docCreationDate?: string // DocCreationDate
}

export interface MeasureImplementationItem {
  country?: string // UnifiedCountryCode
  startDate?: string // StartDate
  endDate?: string // EndDate
  description?: string // DescriptionText
  measureAffectedObjectKindCode?: string // MeasureAffectedObjectKindCode
  /** Множественные исполнители: в одном мероприятии может быть несколько УО. */
  authorities?: UnifiedAuthorityDetails[]
  /** Множественные исполнители: в одном мероприятии может быть несколько субъектов. */
  subjectDetailsList?: SubjectDetails[]
  /** @deprecated: оставлено для обратной совместимости (первый УО). */
  authority?: UnifiedAuthorityDetails // UnifiedAuthorityDetails
  /** @deprecated: оставлено для обратной совместимости (первый субъект). */
  subjectDetails?: SubjectDetails // SubjectDetails (может быть юрлицо/ИП или физлицо)
  documentDetails?: DocumentReferenceDetails // DocReferenceDetails
  placeDetails?: MeasurePlaceDetails // Место проведения мероприятия
}

export interface SubjectDetails {
  // Для юрлица/ИП - используем BusinessEntityDetails
  businessEntity?: BusinessEntityDetails
  // Для физлица
  country?: string // UnifiedCountryCode
  subjectName?: string // SubjectName
  identityDoc?: IdentityDocDetails // IdentityDocV3Details
  addresses?: AddressDetails[] // все SubjectAddressDetails
  registrationAddress?: AddressDetails // AddressKindCode = 1
  actualAddress?: AddressDetails // AddressKindCode = 2
  mailingAddress?: AddressDetails // AddressKindCode = 3
  contacts?: ContactDetails[] // CommunicationDetails
}

export interface IdentityDocDetails {
  country?: string // UnifiedCountryCode
  docKindCode?: string // IdentityDocKindCode
  docKindCodeListId?: string // codeListId атрибут
  docKindName?: string // DocKindName
  docSeriesId?: string // DocSeriesId
  docId?: string // DocId
  docCreationDate?: string // DocCreationDate
  docValidityDate?: string // DocValidityDate
  authorityId?: string // AuthorityId
  authorityName?: string // AuthorityName
}

export interface DocumentReferenceDetails {
  docKindCode?: string // DocKindCode
  docKindCodeListId?: string // codeListId атрибут
  docKindName?: string // DocKindName (если вид документа задан текстом, а не кодом shipdockind)
  docName?: string // DocName
  docId?: string // DocId
  docCreationDate?: string // DocCreationDate
  docStartDate?: string // DocStartDate
}

export interface MeasurePlaceDetails {
  regionName?: string // RegionName
  borderCheckpointCode?: string // BorderCheckpointCode
  borderCheckpointName?: string // BorderCheckpointName
}

