// Типы для карты сведений об обнаружении опасной продукции

export interface CardData {
  // Метаинформация (при загрузке по DPAID берутся из VW_DPA)
  country: string
  registrationNumber: string
  version: number
  source: string // напр. "Входящие сведения", "Исходящие сведения", "Данные ЕЭК"
  createdAt: string // ISO 8601
  modifiedAt: string // ISO 8601
  status: string

  // Электронный документ
  electronicDocument: ElectronicDocument

  // Уведомление
  notification: Notification

  // История статусов
  statusHistory: StatusHistoryItem[]

  // Доступные ЦГЭ
  accessList: AccessItem[]

  // Данные вкладок
  product?: ProductData
  tsd?: TSDData
  complianceDocuments?: ComplianceDocumentsData
  violations?: ViolationsData
  detectionPlace?: DetectionPlaceData
  measures?: MeasuresData
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
  tradeName?: string // ProductTradeName
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
  organizationalForm?: string
  businessEntityTypeCode?: string
  subjectIdentifier?: string
  identificationMethod?: string
  customsNumber?: string
  taxpayerId?: string
  taxRegistrationReasonCode?: string
  registrationAddress?: AddressDetails
  actualAddress?: AddressDetails
  mailingAddress?: AddressDetails
  contacts?: ContactDetails[]
  supplyChainPartyKindCode?: string
}

export interface AddressDetails {
  addressKindCode?: string
  country?: string
  regionName?: string
  districtName?: string
  cityName?: string
  streetName?: string
  buildingNumberId?: string
  roomNumberId?: string
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
  laboratory?: LaboratoryDetails
}

export interface LaboratoryDetails {
  subjectId?: string
  identificationMethod?: string
  organizationalForm?: string
  businessEntityName?: string
  registrationAddress?: AddressDetails
  actualAddress?: AddressDetails
  mailingAddress?: AddressDetails
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
  technicalRegulationId?: string // TechnicalRegulationId
  technicalRegulationName?: string // DocName
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
  geoCoordinates?: GeoCoordinateDetails // GeoCoordinateDetails
  description?: string // DescriptionText
}

export interface BusinessEntityDetails {
  country?: string // UnifiedCountryCode
  businessEntityName?: string // BusinessEntityName
  businessEntityBriefName?: string // BusinessEntityBriefName
  businessEntityTypeName?: string // BusinessEntityTypeName
  businessEntityId?: string // BusinessEntityId
  identificationMethod?: string // из атрибута kindId
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
    mediaTypeCode?: string // mediaTypeCode атрибут
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
  authority?: UnifiedAuthorityDetails // UnifiedAuthorityDetails
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

