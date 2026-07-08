import type { ElectronicDocument } from '@/types/card'
import type { SmrResultDocRow } from '@/types/smrCard'

export type SmaCardKind = 'smaq' | 'smar'

/** Вид ответа SMAR: дополнительные сведения или сведения отсутствуют. */
export type SmarResponseKind = 'info' | 'absent'

/** Метаданные шапки SMAQ/SMAR. */
export interface SmaMetadataView {
  cardKind: SmaCardKind
  linkedSmdid: number
  linkedSmaqid?: number | null
  docId: string | null
  docCountryCode?: string | null
  docCreationDate?: string | null
  requestCountryName: string | null
  datasourceKindCode: string | null
  datasourceKindName: string | null
  statusName: string | null
  creationDateTime: string | null
  modificationDateTime: string | null
  statusId?: number | null
  statusCode?: string | null
  version?: number | null
  /** SMAR: R.SM.SS.09.002 или R.006 */
  edocCode?: string | null
  canEdit?: boolean
  canDeleteDraft?: boolean
  canSend?: boolean
  canCompleteIncomingProcessing?: boolean
}

/** Ответ GET /api/sma/create-eligibility/... */
export interface SmaCreateEligibilityResponse {
  allowed: boolean
  reason?: string
  kind?: SmaCardKind
  smdid?: number
  smaqid?: number
  docId?: string | null
  docCountryCode?: string | null
  docCreationDate?: string | null
  requestCountryId?: number
  requestCountryCode?: string | null
  requestCountryName?: string | null
  draftStatusId?: number
  draftStatusName?: string | null
}

/** Контекст создания карты (из eligibility). */
export interface SmaCreateContext {
  kind: SmaCardKind
  smdid: number
  smaqid?: number
  docId: string | null
  docCountryCode: string | null
  docCreationDate: string | null
  requestCountryId?: number
  requestCountryCode: string | null
  requestCountryName: string | null
  draftStatusId: number
  draftStatusName: string | null
}

/** Тело POST /api/sma/create-save */
export interface SmaCreateSaveRequest {
  kind: SmaCardKind
  guid: string
  smdid?: string
  smaqid?: string
  smaXmlB64?: string
  authorityId?: string
  authorityName?: string
  authorityBriefName?: string
  descriptionText?: string
  responseKind?: SmarResponseKind
}

/** Ссылка на документ, вводящий меру (smcdo:MeasureDocReferenceDetails). */
export interface SmaMeasureDocReference {
  country?: string
  docId?: string
  docCreationDate?: string
}

/** Уведомление об инциденте (smcdo:IncidentAlertIdDetails). */
export interface SmaIncidentAlert {
  country: string
  registrationNumber: string
  typeCode: string
  formationDate: string
}

/** Строка документа (ccdo:DocContentDetails) — тот же формат, что у SMR. */
export type SmaDocRow = SmrResultDocRow

/** Содержимое XML после разбора (EEC_R_SM_SS_09_AdditionalInfoDetails или EEC_R_ProcessingResultDetails). */
export interface SmaParsedBundle {
  electronicDocument: ElectronicDocument
  /** Для R.006: дата и время окончания обработки (csdo:EventDateTime). */
  eventDateTime?: string | null
  /** Для R.006: код результата обработки (csdo:ProcessingResultV2Code). */
  processingResultV2Code?: string | null
  authority: {
    country: string
    identifier: string
    name: string
    shortName: string
  }
  measureCountryCode: string | null
  measureDocReference: SmaMeasureDocReference
  incidentAlert: SmaIncidentAlert
  descriptionText: string | null
  sanitaryProductTypeCode: string | null
  productName: string | null
  laboratoryTestMethodName: string | null
  documents: SmaDocRow[]
}
