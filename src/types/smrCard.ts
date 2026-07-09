import type { ElectronicDocument, MeasureDocDetails, MeasureImplementationItem } from '@/types/card'

/** Метаданные шапки SMR (VW_SMR + связь с SMD). */
export interface SmrMetadataView {
  linkedSmdid: number
  docId: string | null
  docCountryCode?: string | null
  docCreationDate?: string | null
  responseCountryName: string | null
  responseCountryCode?: string | null
  /** UID выбранного УО из SMR.AUTHORITYID → AUTHORITY.AUTHORITYUID */
  authorityUid?: string | null
  datasourceKindCode: string | null
  datasourceKindName: string | null
  smrStatusName: string | null
  creationDateTime: string | null
  modificationDateTime: string | null
  smrStatusId?: number | null
  smrStatusCode?: string | null
  smrVersion?: number | null
  /** Сервер: редактирование исходящей SMR (sanitaryMeasureIn:status ∩ SMDDEPPERMIS) */
  canEdit?: boolean
  /** Сервер: удаление черновика исходящей SMR */
  canDeleteDraft?: boolean
  /** Сервер: принудительная проверка карты (sanitaryMeasureOut:view ∩ SMDDEPPERMIS, исходящая) */
  canValidateOutgoingCard?: boolean
  /** Сервер: смена статуса исходящей SMR (sanitaryMeasureIn:status ∩ SMDDEPPERMIS, DSC=2) */
  canChangeOutgoingStatus?: boolean
  /** Сервер: направление исходящей SMR в ОП 58 */
  canSendOutgoing?: boolean
  /** Сервер: завершение обработки входящей SMR (sanitaryMeasureOut:status ∩ SMDDEPPERMIS) */
  canCompleteIncomingProcessing?: boolean
}

/** Строка резолюции SMR (GET /api/smr/resolutions). */
export interface SmrResolutionRow {
  depKindId?: number
  depKindCode: string
  depKindName: string
}

/** Контекст создания SMR (внутри ответа smd-incoming-actions при canPrepareReviewResult). */
export interface SmrPrepareContext {
  smdid: number
  docId: string | null
  docCountryCode: string | null
  messageCode: string | null
  docCreationDate: string | null
  responseCountryId: number
  responseCountryCode: string | null
  responseCountryName: string | null
  draftSmrStatusId: number
  draftSmrStatusName: string | null
}

/** GET /api/smr/smd-incoming-actions/{SMDID} — кнопки «Открыть результат» и «Подготовить результат». */
export interface SmrSmdIncomingActionsResponse {
  canOpenLinkedSmr: boolean
  openLinkedSmrReason: string | null
  linkedSmrId: number | null
  canPrepareReviewResult: boolean
  prepareReviewResultReason: string | null
  prepareContext: SmrPrepareContext | null
}

/** Ответ GET /api/smr/create-eligibility/{SMDID} — возможность создать SMR по входящей SMD. */
export interface SmrCreateEligibilityResponse {
  allowed: boolean
  reason?: string
  smdid?: number
  docId?: string | null
  docCountryCode?: string | null
  messageCode?: string | null
  docCreationDate?: string | null
  responseCountryId?: number
  responseCountryCode?: string | null
  responseCountryName?: string | null
  draftSmrStatusId?: number
  draftSmrStatusName?: string | null
}

/** Тело POST /api/smr/create-save */
export interface SmrCreateSaveRequest {
  guid: string
  smdid: string
  /** Полный XML SMR (UTF-8) в Base64 */
  smrXmlB64?: string
  authorityId?: string
  authorityName?: string
  authorityBriefName?: string
  descriptionText?: string
}

/** Документ исходной SMD в SMR (MeasureDocDetails + smsdo:MessageCode). */
export interface SmrMeasureDocDetails extends MeasureDocDetails {
  messageCode?: string
}

/** Строка документа на вкладке «Описание результатов». */
export interface SmrResultDocRow {
  countryCode: string
  languageCode: string
  docKindCode?: string
  docKindCodeListId?: string
  docKindName?: string
  docName: string
  docSeriesId: string
  docId: string
  docCreationDate: string
  docStartDate: string
  docValidityDate: string
  docValidityDuration: string
  authorityId: string
  authorityName: string
  descriptionText: string
  pageQuantity: string
  docBinaryText: string
  docBinaryMediaTypeCode?: string
  anyDetailsXml?: string
}

/** Содержимое XML SMR после разбора (EEC_R_SM_SS_09_SanitaryMeasureConsideration). */
export interface SmrParsedBundle {
  electronicDocument: ElectronicDocument
  respondingAuthority: {
    country: string
    identifier: string
    name: string
    shortName: string
  }
  measureDoc: SmrMeasureDocDetails
  measureImplementations: MeasureImplementationItem[]
  resultDescription: string | null
  resultDocuments: SmrResultDocRow[]
}
