/** Метаданные шапки карты SMD из VW_SMD. */
export interface SmdMetadata {
  docCountryName: string | null
  docCountryCode: string | null
  docId: string | null
  docCreationDate: string | null
  smdVersion: number | null
  dataSourceKindCode: string | null
  dataSourceKindName: string | null
  creationDateTime: string | null
  modificationDateTime: string | null
  smdStatusName: string | null
  smdStatusCode: string | null
  smdStatusDesc: string | null
  smrStatusDesc: string | null
  messageName: string | null
  messageCode: string | null
  /** DEPID из SMDDEPPERMIS (если есть в metadata servlet). */
  smdAccessibleDepIds?: string[]
}

/** Строка API «Запрос сведений» (SMAQ/SMAR). */
export interface SmdInfoRequestApiRow {
  smaqId: number
  countryName: string | null
  requestDateTime: string | null
  requestVersion: number | null
  requestStatusName: string | null
  smarId: number | null
  responseVersion: number | null
  responseDateTime: string | null
  responseStatusName: string | null
  edocCode: string | null
}

/** Строка таблицы «Запрос сведений» с группировкой ответов по запросу. */
export interface SmdInfoRequestTableRow extends SmdInfoRequestApiRow {
  key: string
  requestRowSpan: number
  hasAnyResponseForRequest: boolean
}

/** Строка «Результаты рассмотрения» (SMR). */
export interface SmdReviewResultRow {
  smrId: number
  countryCode: string | null
  countryName: string | null
  creationDateTime: string | null
  statusName: string | null
}

/** Доступность действий на реляционных вкладках SMD. */
export interface SmdRelatedActions {
  dataSourceKindCode: string | null
  canAddInfoRequest: boolean
  canPrepareReviewResult: boolean
  hasIncomingStatusRight: boolean
  hasOutgoingEditRight: boolean
  isIncoming: boolean
  isOutgoing: boolean
  hasLinkedReviewResult: boolean
  canDelete?: boolean
  canDeleteReason?: string | null
}
