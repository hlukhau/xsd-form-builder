import type { ElectronicDocument, MeasuresData } from '@/types/card'

/** Метаданные шапки DPR (VW_DPR + связь с PPV). */
export interface DprMetadataView {
  incidentId: string | null
  responseCountryName: string | null
  datasourceKindCode: string | null
  datasourceKindName: string | null
  dprStatusName: string | null
  creationDateTime: string | null
  modificationDateTime: string | null
  linkedPpvid: number
}

/** Ответ GET /api/dpr/create-eligibility/{PPVID} — возможность создать DPR по входящей PPV. */
export interface DprCreateEligibilityResponse {
  allowed: boolean
  reason?: string
  ppvid?: number
  incidentId?: string | null
  alertCountryCode?: string | null
  incidentKindCode?: string | null
  docCreationDate?: string | null
  responseCountryId?: number
  responseCountryCode?: string | null
  responseCountryName?: string | null
  draftDprStatusId?: number
  draftDprStatusName?: string | null
}

/** Тело POST /api/dpr/create-save */
export interface DprCreateSaveRequest {
  guid: string
  ppvid: string
  authorityId?: string
  authorityName?: string
  authorityBriefName?: string
  descriptionText?: string
}

/** Строка документа на вкладке «Описание результатов». */
export interface DprResultDocRow {
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

/** Содержимое XML DPR после разбора. */
export interface DprParsedBundle {
  electronicDocument: ElectronicDocument
  notifyingAuthority: {
    country: string
    identifier: string
    name: string
    shortName: string
  }
  incidentAlert: {
    country: string
    registrationNumber: string
    typeCode: string
    formationDate: string
  }
  measures: MeasuresData
  resultDescription: string | null
  resultDocuments: DprResultDocRow[]
}
