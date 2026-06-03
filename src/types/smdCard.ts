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

/** Строка таблицы «Сведения» / запросы (заготовка под API). */
export interface SmdInfoRequestRow {
  id?: number
  countryName?: string | null
  requestDateTime?: string | null
  statusName?: string | null
  description?: string | null
}

/** Строка «Результаты рассмотрения» (заготовка под API). */
export interface SmdReviewResultRow {
  id?: number
  countryName?: string | null
  responseDateTime?: string | null
  resultName?: string | null
  comment?: string | null
}
