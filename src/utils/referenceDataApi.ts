/**
 * API для работы со справочниками
 */

import type { CardData } from '@/types/card'

const BASE_URL = import.meta.env.BASE_URL || '/';

export interface Country {
  countryId: number
  countryCode: string
  countrySDate: string
  countryEDate: string
  countryName: string
  eaeuGuid?: string
  seqNum?: number
  cDate: string
}

export interface CountryOption {
  code: string
  name: string
}

export interface IncidentAlertKindOption {
  code: string
  name: string
}

export interface AuthorityOption {
  uid: string
  name: string
  briefName: string
  countryCode: string
}

export interface SanitaryProdTypeOption {
  code: string
  name: string
}

export interface MeasurementUnitOption {
  code: string
  name: string
  briefName?: string
}

export interface ShipDocKindOption {
  code: string
  name: string
}

export interface SupplyChainPartyKindOption {
  code: string
  name: string
}

export interface TechRegulOption {
  code: string
  name: string
  regNum: string
}

export interface SanitaryMeasureObjKindOption {
  code: string
  name: string
}

export interface SanitaryMeasureOption {
  code: string
  name: string
}

/** Метаданные для сохранения новой карты (POST /api/dpa/save) */
export interface DpaSaveMetadata {
  incidentId?: string | null
  countryCode?: string | null
  docCreationDate?: string | null
  incidentAlertKindCode?: string | null
  commodityCode?: string | null
  sanitaryProdTypeName?: string | null
  sanitaryProdName?: string | null
  alertCountryId?: number | null
  manufCountryId?: number | null
  manufCountryCode?: string | null
  manufBusEntName?: string | null
  manufBusEntBriefName?: string | null
  edocCode?: string | null
  edocVersion?: string | null
}

/** Ответ успешного сохранения новой карты */
export interface DpaSaveResponse {
  success: boolean
  dpaid: number
}

/**
 * Создать или обновить карту в БД.
 * Создание: isNew true, xmlBody, metadata (dpaid в URL не передаётся).
 * Обновление: isNew false, dpaid из URL, xmlBody, metadata.
 */
export async function saveDpaCard(payload: {
  isNew: boolean
  xmlBody: string
  metadata: DpaSaveMetadata
  /** Для обновления — DPAID из URL (если не "-") */
  dpaid?: number
  /** При создании новой версии (копия из «Доставлено») — исходный DPAID и guid для проверки прав */
  copyFromDpaid?: number
  guid?: string
}): Promise<DpaSaveResponse> {
  let body: Record<string, unknown>
  if (payload.dpaid != null && !payload.isNew) {
    body = { isNew: false, dpaid: payload.dpaid, xmlBody: payload.xmlBody, metadata: payload.metadata }
  } else {
    body = { isNew: true, xmlBody: payload.xmlBody, metadata: payload.metadata }
    if (payload.copyFromDpaid != null && payload.guid) {
      body.copyFromDpaid = payload.copyFromDpaid
      body.guid = payload.guid
    }
  }
  if (payload.guid != null && payload.guid !== '') body.guid = payload.guid
  const url = `${BASE_URL}api/dpa/save`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 300)
    }
    console.error('[saveDpaCard]', response.status, url, errMsg, text.slice(0, 200))
    throw new Error(errMsg)
  }
  return JSON.parse(text) as DpaSaveResponse
}

/** Проверка возможности создания новой версии карты (кнопка «Сделать копию»). GET /api/dpa/can-create-new-version */
export interface CanCreateNewVersionResponse {
  allowed: boolean
  reason?: string
}
export async function canCreateNewVersion(dpaid: string, guid: string): Promise<CanCreateNewVersionResponse> {
  const url = `${BASE_URL}api/dpa/can-create-new-version?dpaid=${encodeURIComponent(dpaid)}&guid=${encodeURIComponent(guid)}`
  const response = await fetch(url)
  const text = await response.text()
  if (!response.ok) {
    return { allowed: false, reason: text || response.statusText }
  }
  return JSON.parse(text) as CanCreateNewVersionResponse
}

/** Ответ успешного удаления карты исходящих (черновик). */
export interface DpaDeleteResponse {
  success: boolean
  registrationNumber?: string
}

/**
 * Удалить карту исходящих сведений (только черновик).
 * POST /api/dpa/delete — тело { dpaid, guid }.
 * Условия на сервере: DATASOURCEKINDCODE=2, DPASTATUSID=5, право dangerousProductOut:edit в пределах хотя бы одного подразделения из DPADEPPERMIS.
 */
export async function deleteDpaCard(dpaid: number | string, guid: string): Promise<DpaDeleteResponse> {
  const url = `${BASE_URL}api/dpa/delete`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dpaid: Number(dpaid), guid }),
  })
  const text = await response.text()
  if (!response.ok) {
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 300)
    }
    throw new Error(errMsg)
  }
  return JSON.parse(text) as DpaDeleteResponse
}

/**
 * Собрать метаданные для POST /api/dpa/save из данных карты.
 */
export function buildSaveMetadataFromCardData(data: CardData): DpaSaveMetadata {
  const notification = data.notification
  const product = data.product
  const countryCode = data.country || notification?.country || undefined
  const incidentId = data.registrationNumber || notification?.registrationNumber || undefined
  const docCreationDate = notification?.formationDate || undefined
  const typeRaw = notification?.type
  const incidentAlertKindCode = typeof typeRaw === 'string' && /^\d+$/.test(typeRaw) ? typeRaw : undefined
  const commodityCode = product?.productDetails?.commodityCode ?? undefined
  const sanitaryProdTypeName = product?.typeName ?? undefined
  const sanitaryProdName = product?.productDetails?.productName ?? undefined
  const manufacturer = product?.manufacturer
  const manufCountryCode = manufacturer?.country || undefined
  const manufBusEntName = manufacturer?.businessEntityName ?? undefined
  const manufBusEntBriefName = manufacturer?.shortName ?? undefined
  const edocCode = data.electronicDocument?.documentCode ?? undefined
  const edocVersion = '1.0.0'
  return {
    incidentId: incidentId || null,
    countryCode: countryCode || null,
    docCreationDate: docCreationDate || null,
    incidentAlertKindCode: incidentAlertKindCode || null,
    commodityCode: commodityCode || null,
    sanitaryProdTypeName: sanitaryProdTypeName || null,
    sanitaryProdName: sanitaryProdName || null,
    manufCountryCode: manufCountryCode || null,
    manufBusEntName: manufBusEntName || null,
    manufBusEntBriefName: manufBusEntBriefName || null,
    edocCode: edocCode || null,
    edocVersion: edocVersion || null,
  }
}

/**
 * Получить следующий уникальный регистрационный номер для страны (при создании карты).
 * GET /api/dpa/next-registration-number?country=BY → { registrationNumber: "BY-DP00002-26" }
 */
export async function fetchNextRegistrationNumber(countryCode: string): Promise<{ registrationNumber: string }> {
  const country = (countryCode || 'BY').trim().toUpperCase().slice(0, 2)
  const response = await fetch(`${BASE_URL}api/dpa/next-registration-number?country=${encodeURIComponent(country)}`)
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.json()
}

/**
 * Загрузить XML по DPAID из таблицы DPAXML (GET /api/dpa/xml/{DPAID})
 */
export async function fetchDpaXml(dpaid: string): Promise<string> {
  const response = await fetch(`${BASE_URL}api/dpa/xml/${encodeURIComponent(dpaid)}`)
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.text()
}

/** Метаданные шапки карты из VW_DPA (GET /api/dpa/metadata/{DPAID}) */
export interface DpaMetadata {
  incidentId: string | null
  /** Код страны из справочника COUNTRY (BY, RU, ...) */
  alertCountryCode: string | null
  alertCountryName: string | null
  dpaVersion: number | null
  /** DATASOURCEKINDCODE из DPA; "2" = исходящие (код 3 — из БД ЕЭК) */
  datasourceKindCode: string | null
  datasourceKindName: string | null
  creationDateTime: string | null
  modificationDateTime: string | null
  dpaStatusId: number | null
  dpaStatusName: string | null
}

export async function fetchDpaMetadata(dpaid: string): Promise<DpaMetadata> {
  const response = await fetch(`${BASE_URL}api/dpa/metadata/${encodeURIComponent(dpaid)}`)
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.json()
}

/** Элемент истории статусов (ответ /api/dpa/status-history/{DPAID}) */
export interface DpaStatusHistoryItem {
  status: string
  dateTime: string | null
  employee: string | null
}

export async function fetchDpaStatusHistory(dpaid: string): Promise<DpaStatusHistoryItem[]> {
  const response = await fetch(`${BASE_URL}api/dpa/status-history/${encodeURIComponent(dpaid)}`)
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.json()
}

/** Элемент из API электронных документов (EDOC + contentBody) */
export interface DpaElectronicDocRaw {
  messageCode: string | null
  documentCode: string | null
  documentId: string | null
  documentDate: string | null
  language: string | null
  sourceDocumentId: string | null
  contentBody: string | null
}

export async function fetchDpaElectronicDocs(dpaid: string): Promise<DpaElectronicDocRaw[]> {
  const response = await fetch(`${BASE_URL}api/dpa/electronic-docs/${encodeURIComponent(dpaid)}`)
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.json()
}

/**
 * Получить все активные страны
 */
export async function getCountries(): Promise<Country[]> {
  try {
    const response = await fetch(`${BASE_URL}api/countries`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки стран: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки стран:', error)
    throw error
  }
}

/**
 * Получить опции для выпадающего списка стран
 */
export async function getCountryOptions(): Promise<CountryOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/countries/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций стран: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций стран:', error)
    throw error
  }
}

/**
 * Получить страну по коду
 */
export async function getCountryByCode(code: string): Promise<Country | null> {
  try {
    const response = await fetch(`${BASE_URL}api/countries/${code}`)
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`Ошибка загрузки страны: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки страны:', error)
    return null
  }
}

/**
 * Проверить существование страны по коду
 */
export async function checkCountryExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const response = await fetch(`${BASE_URL}api/countries/${code}/exists`)
    if (!response.ok) {
      return false
    }
    const data = await response.json()
    return data.exists === true
  } catch (error) {
    console.error('Ошибка проверки страны:', error)
    return false
  }
}

/**
 * Получить опции для выпадающего списка видов уведомлений
 */
export async function getIncidentAlertKindOptions(): Promise<IncidentAlertKindOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/incident-alert-kinds/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций видов уведомлений: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций видов уведомлений:', error)
    throw error
  }
}

/**
 * Проверить существование вида уведомления по коду
 */
export async function checkIncidentAlertKindExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const options = await getIncidentAlertKindOptions()
    const codeStr = String(code).trim()
    return options.some(opt => String(opt.code ?? '').trim() === codeStr)
  } catch (error) {
    console.error('Ошибка проверки вида уведомления:', error)
    return false
  }
}

/**
 * Получить название вида уведомления по коду
 */
export async function getIncidentAlertKindNameByCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getIncidentAlertKindOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия вида уведомления:', error)
    return null
  }
}

/** JSON прав по GUID (для department.depid — ЦГЭ создателя карты при «Определить доступ»). GET /api/rights?guid= */
export interface RightsJson {
  department?: { depid?: number }
}
export async function fetchRightsByGuid(guid: string): Promise<RightsJson> {
  const response = await fetch(`${BASE_URL}api/rights?guid=${encodeURIComponent(guid)}`)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(response.status === 404 ? 'GUID не найден' : (text || response.statusText))
  }
  return response.json()
}

/** Список доступа по DPAID (SESINT.DPADEPPERMIS + TB_DEP + TB_DEPKIND) — GET /api/dpa/access?dpaid=...&source=incoming|outgoing|eec&creatorDepId=... */
export interface AccessItemDto {
  id: string
  name: string
  depKindCode?: string
}

/** Маппинг источника карты в параметр API (для списка по умолчанию). */
export function cardSourceToApiSource(source: string): 'incoming' | 'outgoing' | 'eec' | undefined {
  if (!source || !source.trim()) return undefined
  const s = source.trim().toLowerCase()
  if (s.includes('входящ')) return 'incoming'
  if (s.includes('исходящ')) return 'outgoing'
  if (s.includes('еэк')) return 'eec'
  return undefined
}

/** Право для проверки управления доступом по источнику карты. */
export function cardSourceToAccessRight(source: string): 'dangerousProductIn:access' | 'dangerousProductOut:access' | 'dangerousProductDB:access' | undefined {
  const api = cardSourceToApiSource(source)
  if (api === 'incoming') return 'dangerousProductIn:access'
  if (api === 'outgoing') return 'dangerousProductOut:access'
  if (api === 'eec') return 'dangerousProductDB:access'
  return undefined
}

export async function fetchDpaAccess(dpaid: string, source?: string, creatorDepId?: string | number): Promise<AccessItemDto[]> {
  const params = new URLSearchParams({ dpaid })
  const apiSource = source != null ? cardSourceToApiSource(source) : undefined
  if (apiSource) params.set('source', apiSource)
  if (creatorDepId != null && String(creatorDepId).trim()) params.set('creatorDepId', String(creatorDepId).trim())
  const response = await fetch(`${BASE_URL}api/dpa/access?${params.toString()}`)
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.json()
}

export async function addDpaAccess(dpaid: string, depId: string): Promise<void> {
  const response = await fetch(`${BASE_URL}api/dpa/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dpaid, depId }),
  })
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
}

export async function removeDpaAccess(dpaid: string, depId: string): Promise<void> {
  const response = await fetch(
    `${BASE_URL}api/dpa/access?dpaid=${encodeURIComponent(dpaid)}&depId=${encodeURIComponent(depId)}`,
    { method: 'DELETE' }
  )
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
}

/** Уровень ЦГЭ (depKindCode + depKindName). Для текущего пользователя и для уровня по depid из карты прав. */
export interface DepKindLevel {
  depKindCode: string | null
  depKindName: string | null
}

/** Текущий пользователь: уровень ЦГЭ (TB_USER → TB_EMP → TB_DEP → TB_DEPKIND). GET /api/current-user */
export type CurrentUserLevel = DepKindLevel

export async function fetchCurrentUser(): Promise<CurrentUserLevel> {
  const response = await fetch(`${BASE_URL}api/current-user`)
  if (!response.ok) return { depKindCode: null, depKindName: null }
  const data = await response.json()
  return { depKindCode: data.depKindCode ?? null, depKindName: data.depKindName ?? null }
}

/** Уровень ЦГЭ по DEPID (из карты прав доступа). GET /api/dep/info?depid=... */
export async function fetchDepInfo(depid: number): Promise<DepKindLevel> {
  const response = await fetch(`${BASE_URL}api/dep/info?depid=${encodeURIComponent(depid)}`)
  if (!response.ok) return { depKindCode: null, depKindName: null }
  const data = await response.json()
  return { depKindCode: data.depKindCode ?? null, depKindName: data.depKindName ?? null }
}

/** Список резолюций по карте (какие уровни уже наложили резолюцию). GET /api/dpa/resolutions?dpaid=... */
export interface DpaResolutionLevel {
  depKindCode: string
  depKindName: string
}

export async function fetchDpaResolutions(dpaid: string): Promise<DpaResolutionLevel[]> {
  const response = await fetch(`${BASE_URL}api/dpa/resolutions?dpaid=${encodeURIComponent(dpaid)}`)
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data.resolutions) ? data.resolutions : []
}

/** Проверка права доступа — GET /api/access/check?id=...&right=... */
export async function checkAccessRight(id: string | null, right: string): Promise<boolean> {
  const params = new URLSearchParams()
  if (id != null && id !== '') params.set('id', id)
  params.set('right', right)
  const response = await fetch(`${BASE_URL}api/access/check?${params.toString()}`)
  if (!response.ok) return false
  const data = await response.json()
  return data.allowed === true
}

/** Смена статуса карты. Входящие: complete_processing, close. Исходящие: mark_ready (передайте depKindCode), send, close. guid — для USERID и depKindCode из карты прав. POST /api/dpa/status */
export async function changeDpaStatus(
  dpaid: string,
  action: string,
  options?: { depKindCode?: string; guid?: string }
): Promise<{ newStatus: string }> {
  const body: { dpaid: string; action: string; depKindCode?: string; guid?: string } = { dpaid, action }
  if (options?.depKindCode != null && options.depKindCode !== '') body.depKindCode = options.depKindCode
  if (options?.guid != null && options.guid !== '') body.guid = options.guid
  const response = await fetch(`${BASE_URL}api/dpa/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.json()
}

/** Подразделение из SESDEV.TB_DEP + TB_DEPKIND (DEPKINDCODE) — GET /api/dep/options */
export interface DepOption {
  id: string
  name: string
  depKindCode?: string
}

export async function fetchDepOptions(): Promise<DepOption[]> {
  const response = await fetch(`${BASE_URL}api/dep/options`)
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text)
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.json()
}

/**
 * Получить опции для выпадающего списка уполномоченных органов
 * @param countryCode - код страны для фильтрации (опционально)
 */
export async function getAuthorityOptions(countryCode?: string): Promise<AuthorityOption[]> {
  try {
    const url = countryCode 
      ? `${BASE_URL}api/authorities/options?countryCode=${encodeURIComponent(countryCode)}`
      : `${BASE_URL}api/authorities/options`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций уполномоченных органов: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций уполномоченных органов:', error)
    throw error
  }
}

/**
 * Получить опции для выпадающего списка типов санитарной продукции
 */
export async function getSanitaryProdTypeOptions(): Promise<SanitaryProdTypeOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/sanitary-prod-types/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций типов санитарной продукции: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций типов санитарной продукции:', error)
    throw error
  }
}

/**
 * Проверить существование типа санитарной продукции по коду
 */
export async function checkSanitaryProdTypeExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const options = await getSanitaryProdTypeOptions()
    return options.some(opt => opt.code === code)
  } catch (error) {
    console.error('Ошибка проверки типа санитарной продукции:', error)
    return false
  }
}

/**
 * Получить название типа санитарной продукции по коду
 */
export async function getSanitaryProdTypeNameByCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getSanitaryProdTypeOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия типа санитарной продукции:', error)
    return null
  }
}

/**
 * Получить опции для выпадающего списка единиц измерения
 */
export async function getMeasurementUnitOptions(): Promise<MeasurementUnitOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/measurement-units/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций единиц измерения: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций единиц измерения:', error)
    throw error
  }
}

/**
 * Получить единицу измерения по коду
 */
export async function getMeasurementUnitByCode(code: string): Promise<MeasurementUnitOption | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getMeasurementUnitOptions()
    return options.find(opt => opt.code === code) || null
  } catch (error) {
    console.error('Ошибка получения единицы измерения:', error)
    return null
  }
}

/**
 * Получить опции для выпадающего списка видов товаросопроводительных документов
 */
export async function getShipDocKindOptions(): Promise<ShipDocKindOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/ship-doc-kinds/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций видов товаросопроводительных документов: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций видов товаросопроводительных документов:', error)
    throw error
  }
}

/**
 * Проверить существование вида товаросопроводительного документа по коду
 */
export async function checkShipDocKindExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const options = await getShipDocKindOptions()
    return options.some(opt => opt.code === code)
  } catch (error) {
    console.error('Ошибка проверки вида товаросопроводительного документа:', error)
    return false
  }
}

/**
 * Получить название вида товаросопроводительного документа по коду
 */
export async function getShipDocKindNameByCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getShipDocKindOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия вида товаросопроводительного документа:', error)
    return null
  }
}

/**
 * Получить опции для выпадающего списка видов участников цепи поставки
 */
export async function getSupplyChainPartyKindOptions(): Promise<SupplyChainPartyKindOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/supply-chain-party-kinds/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций видов участников цепи поставки: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций видов участников цепи поставки:', error)
    throw error
  }
}

/**
 * Проверить существование вида участника цепи поставки по коду
 */
export async function checkSupplyChainPartyKindExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const options = await getSupplyChainPartyKindOptions()
    return options.some(opt => opt.code === code)
  } catch (error) {
    console.error('Ошибка проверки вида участника цепи поставки:', error)
    return false
  }
}

/**
 * Получить название вида участника цепи поставки по коду
 */
export async function getSupplyChainPartyKindNameByCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getSupplyChainPartyKindOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия вида участника цепи поставки:', error)
    return null
  }
}

/**
 * Получить опции для выпадающего списка технических регламентов
 */
export async function getTechRegulOptions(): Promise<TechRegulOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/tech-reguls/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций технических регламентов: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций технических регламентов:', error)
    throw error
  }
}

/**
 * Проверить существование технического регламента по коду
 */
export async function checkTechRegulExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const options = await getTechRegulOptions()
    return options.some(opt => opt.code === code)
  } catch (error) {
    console.error('Ошибка проверки технического регламента:', error)
    return false
  }
}

/**
 * Получить название технического регламента по коду
 */
export async function getTechRegulNameByCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getTechRegulOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия технического регламента:', error)
    return null
  }
}

/**
 * Получить все опции видов объектов действия мер
 */
export async function getSanitaryMeasureObjKindOptions(): Promise<SanitaryMeasureObjKindOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/sanitary-measure-obj-kinds/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций видов объектов действия мер: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций видов объектов действия мер:', error)
    throw error
  }
}

/**
 * Проверить существование вида объекта действия мер по коду
 */
export async function checkSanitaryMeasureObjKindExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const options = await getSanitaryMeasureObjKindOptions()
    return options.some(opt => opt.code === code)
  } catch (error) {
    console.error('Ошибка проверки вида объекта действия мер:', error)
    return false
  }
}

/**
 * Получить название вида объекта действия мер по коду
 */
export async function getSanitaryMeasureObjKindNameByCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getSanitaryMeasureObjKindOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия вида объекта действия мер:', error)
    return null
  }
}

/**
 * Получить все опции санитарных мер
 */
export async function getSanitaryMeasureOptions(): Promise<SanitaryMeasureOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/sanitary-measures/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций санитарных мер: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций санитарных мер:', error)
    throw error
  }
}

/**
 * Проверить существование санитарной меры по коду
 */
export async function checkSanitaryMeasureExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const options = await getSanitaryMeasureOptions()
    return options.some(opt => opt.code === code)
  } catch (error) {
    console.error('Ошибка проверки санитарной меры:', error)
    return false
  }
}

/**
 * Получить название санитарной меры по коду
 */
export async function getSanitaryMeasureNameByCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getSanitaryMeasureOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия санитарной меры:', error)
    return null
  }
}

export interface MediaTypeOption {
  code: string
  name: string
}

/**
 * Получить все форматы данных (MEDIATYPE)
 */
export async function getMediaTypeOptions(): Promise<MediaTypeOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/media-types/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций форматов данных: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций форматов данных:', error)
    throw error
  }
}

/**
 * Получить название формата данных по коду
 */
export async function getMediaTypeNameByCode(code: string): Promise<string | null> {
  try {
    const options = await getMediaTypeOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия формата данных:', error)
    return null
  }
}

