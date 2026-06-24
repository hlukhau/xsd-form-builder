import type { CardData, StatusHistoryItem } from '@/types/card'
import { getSmdMessageName } from '@/constants/smdCard'
import { resolveSmdMeasureStartDate, resolveSmdMeasureEndDate } from './smdMeasureDates'
import { getSmdRegulatoryDocCreationDate, getSmdRegulatoryDocId, getSmdRegulatoryMeasureDoc } from './smdMeasureDoc'
import type {
  SmdInfoRequestApiRow,
  SmdMetadata,
  SmdRelatedActions,
  SmdReviewResultRow,
} from '@/types/smdCard'
import { withGuidUrl } from '@/utils/referenceDataApi'

const BASE = import.meta.env.BASE_URL || '/'

function getApiUrl(path: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

function withGuidHeaders(guid?: string): HeadersInit {
  return guid?.trim() ? { 'X-GUID': guid.trim() } : {}
}

export function smdSourceToViewRight(dataSourceKindCode: string | null | undefined): string {
  const c = String(dataSourceKindCode ?? '').trim()
  if (c === '1') return 'sanitaryMeasureIn:view'
  if (c === '2') return 'sanitaryMeasureOut:view'
  if (c === '3') return 'sanitaryMeasureDB:view'
  const lower = c.toLowerCase()
  if (lower.includes('входящ')) return 'sanitaryMeasureIn:view'
  if (lower.includes('исходящ')) return 'sanitaryMeasureOut:view'
  if (lower.includes('еэк')) return 'sanitaryMeasureDB:view'
  return 'sanitaryMeasureIn:view'
}

/** Право управления доступом к карте SMD по коду/подписи источника. */
export function smdSourceToAccessRight(
  dataSourceKindCode: string | null | undefined,
  sourceLabel?: string | null
): 'sanitaryMeasureIn:access' | 'sanitaryMeasureOut:access' | 'sanitaryMeasureDB:access' | undefined {
  const c = String(dataSourceKindCode ?? '').trim()
  if (c === '1') return 'sanitaryMeasureIn:access'
  if (c === '2') return 'sanitaryMeasureOut:access'
  if (c === '3') return 'sanitaryMeasureDB:access'
  const s = (sourceLabel ?? c).trim().toLowerCase()
  if (s.includes('входящ')) return 'sanitaryMeasureIn:access'
  if (s.includes('исходящ')) return 'sanitaryMeasureOut:access'
  if (s.includes('еэк') || s.includes('данные еэк')) return 'sanitaryMeasureDB:access'
  return undefined
}

export function smdApiSourceToAccessRight(
  api: 'incoming' | 'outgoing' | 'eec' | undefined
): 'sanitaryMeasureIn:access' | 'sanitaryMeasureOut:access' | 'sanitaryMeasureDB:access' | undefined {
  if (api === 'incoming') return 'sanitaryMeasureIn:access'
  if (api === 'outgoing') return 'sanitaryMeasureOut:access'
  if (api === 'eec') return 'sanitaryMeasureDB:access'
  return undefined
}

export async function fetchSmdMetadata(smdid: string, guid?: string): Promise<SmdMetadata> {
  const url = withGuidUrl(getApiUrl(`/api/smd/metadata/${encodeURIComponent(smdid)}`), guid)
  const response = await fetch(url, {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const text = await response.text()
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Ошибка загрузки метаданных SMD (${response.status})`)
  }
  return response.json() as Promise<SmdMetadata>
}

export async function fetchSmdXml(smdid: string, guid?: string): Promise<string> {
  const url = withGuidUrl(getApiUrl(`/api/smd/xml/${encodeURIComponent(smdid)}`), guid)
  const response = await fetch(url, {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Ошибка загрузки XML SMD (${response.status})`)
  }
  return response.text()
}

export async function fetchSmdStatusHistory(smdid: string, guid?: string): Promise<StatusHistoryItem[]> {
  const url = withGuidUrl(getApiUrl(`/api/smd/status-history/${encodeURIComponent(smdid)}`), guid)
  const response = await fetch(url, {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Ошибка загрузки истории статусов (${response.status})`)
  }
  const raw = (await response.json()) as Array<{ status?: string; dateTime?: string; employee?: string | null }>
  return raw.map((r) => ({
    status: r.status ?? '',
    dateTime: r.dateTime ?? '',
    employee: r.employee ?? null,
  }))
}

export async function fetchSmdInfoRequests(
  smdid: string,
  guid?: string
): Promise<SmdInfoRequestApiRow[]> {
  const url = withGuidUrl(getApiUrl(`/api/smd/info-requests/${encodeURIComponent(smdid)}`), guid)
  const response = await fetch(url, {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const text = await response.text()
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Ошибка загрузки запросов сведений (${response.status})`)
  }
  const data = (await response.json()) as { requests?: SmdInfoRequestApiRow[] }
  return data.requests ?? []
}

export async function fetchSmdReviewResults(
  smdid: string,
  guid?: string
): Promise<SmdReviewResultRow[]> {
  const url = withGuidUrl(getApiUrl(`/api/smd/review-results/${encodeURIComponent(smdid)}`), guid)
  const response = await fetch(url, {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const text = await response.text()
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Ошибка загрузки результатов рассмотрения (${response.status})`)
  }
  const data = (await response.json()) as { results?: SmdReviewResultRow[] }
  return data.results ?? []
}

export async function fetchSmdRelatedActions(
  smdid: string,
  guid?: string
): Promise<SmdRelatedActions> {
  const url = withGuidUrl(getApiUrl(`/api/smd/related-actions/${encodeURIComponent(smdid)}`), guid)
  const response = await fetch(url, {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const text = await response.text()
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Ошибка загрузки действий SMD (${response.status})`)
  }
  return response.json() as Promise<SmdRelatedActions>
}

export interface SmdSaveMetadata {
  docId: string | null
  docCreationDate: string | null
  sanitaryMeasureStartDate: string | null
  sanitaryMeasureEndDate: string | null
  countryCode: string | null
  messageCode: string | null
  edocCode: string | null
  edocVersion: string | null
}

export function buildSmdSaveMetadataFromCardData(data: CardData): SmdSaveMetadata {
  const doc = getSmdRegulatoryMeasureDoc(data)
  const docId = getSmdRegulatoryDocId(data)
  const docCreationDate = getSmdRegulatoryDocCreationDate(data)
  const version = data.version ?? 1
  const messageRaw = data.electronicDocument?.messageCode?.trim() ?? ''
  return {
    docId,
    docCreationDate,
    sanitaryMeasureStartDate: resolveSmdMeasureStartDate(data),
    sanitaryMeasureEndDate: resolveSmdMeasureEndDate(data),
    countryCode: (doc?.country || data.country || data.notification?.country || 'BY')
      .trim()
      .toUpperCase()
      .slice(0, 2),
    messageCode: messageRaw || (version > 1 ? null : 'P.SS.09.MSG.001'),
    edocCode: data.electronicDocument?.documentCode?.trim() || 'R.SM.SS.09.001',
    edocVersion: '1.0.0',
  }
}

/** Синтетические метаданные шапки для формы создания (до сохранения в БД). */
export function buildCreateSmdMetadata(data: CardData, countryName?: string | null): SmdMetadata {
  const now = data.createdAt || new Date().toISOString()
  const saveMeta = buildSmdSaveMetadataFromCardData(data)
  const version = data.version ?? 1
  const messageCode = saveMeta.messageCode
  return {
    docCountryCode: saveMeta.countryCode,
    docCountryName: countryName ?? 'Беларусь',
    docId: saveMeta.docId,
    docCreationDate: saveMeta.docCreationDate,
    smdVersion: version,
    dataSourceKindCode: '2',
    dataSourceKindName: 'Исходящие сведения',
    creationDateTime: now,
    modificationDateTime: data.modifiedAt || now,
    smdStatusName: data.status || 'Новое',
    smdStatusCode: 'NEW',
    smdStatusDesc: null,
    smrStatusDesc: null,
    messageName:
      getSmdMessageName(messageCode, version) ??
      data.notification?.type ??
      (version > 1 ? null : 'Сведения о введении временной санитарной мере'),
    messageCode,
  }
}

export interface CanCreateSmdNewVersionResponse {
  allowed: boolean
  reason?: string
}

export async function canCreateSmdNewVersion(smdid: string, guid?: string): Promise<CanCreateSmdNewVersionResponse> {
  const params = new URLSearchParams({ smdid })
  if (guid?.trim()) params.set('guid', guid.trim())
  const url = getApiUrl(`/api/smd/can-create-new-version?${params.toString()}`)
  const res = await fetch(url, {
    method: 'GET',
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  const text = await res.text()
  if (!res.ok) {
    return { allowed: false, reason: text || res.statusText }
  }
  try {
    return JSON.parse(text) as CanCreateSmdNewVersionResponse
  } catch {
    return { allowed: false, reason: text || 'Не удалось проверить условия создания новой версии' }
  }
}

export async function saveSmdCard(payload: {
  isNew: boolean
  xmlBody: string
  metadata: SmdSaveMetadata
  guid?: string
  copyFromSmdid?: number
}): Promise<{ success: boolean; smdid: number }> {
  const url = getApiUrl('/api/smd/save')
  const body: Record<string, unknown> = {
    isNew: payload.isNew,
    xmlBody: payload.xmlBody,
    metadata: payload.metadata,
  }
  if (payload.guid) body.guid = payload.guid
  if (payload.isNew && payload.copyFromSmdid != null && payload.copyFromSmdid > 0) {
    body.copyFromSmdid = payload.copyFromSmdid
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...(payload.guid ? { 'X-GUID': payload.guid.trim() } : {}),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    let errMsg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) errMsg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(errMsg || `Ошибка сохранения SMD (${response.status})`)
  }
  return JSON.parse(text) as { success: boolean; smdid: number }
}

export interface SmdDeleteResponse {
  success: boolean
  docId?: string
}

export interface CanDeleteSmdResponse {
  allowed: boolean
  reason?: string
}

/** Проверка возможности удаления новой исходящей карты SMD. */
export async function canDeleteSmdCard(smdid: string, guid?: string): Promise<CanDeleteSmdResponse> {
  const params = new URLSearchParams({ smdid })
  if (guid?.trim()) params.set('guid', guid.trim())
  const url = getApiUrl(`/api/smd/can-delete?${params.toString()}`)
  const res = await fetch(url, {
    method: 'GET',
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  const text = await res.text()
  if (!res.ok) {
    return { allowed: false, reason: text || res.statusText }
  }
  try {
    return JSON.parse(text) as CanDeleteSmdResponse
  } catch {
    return { allowed: false, reason: text || 'Не удалось проверить условия удаления' }
  }
}

/**
 * Удалить новую исходящую карту SMD.
 * POST /api/smd/delete — тело { smdid, guid }.
 */
export async function deleteSmdCard(smdid: number | string, guid?: string): Promise<SmdDeleteResponse> {
  const url = getApiUrl('/api/smd/delete')
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...(guid ? { 'X-GUID': guid.trim() } : {}),
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      smdid: Number(smdid),
      ...(guid?.trim() ? { guid: guid.trim() } : {}),
    }),
  })
  const text = await response.text()
  if (!response.ok) {
    let errMsg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) errMsg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(errMsg || `Ошибка удаления SMD (${response.status})`)
  }
  return JSON.parse(text) as SmdDeleteResponse
}

export interface SmdStatusChangeResponse {
  ok: boolean
  changed?: boolean
  newStatus?: string
  newStatusId?: number
  newStatusCode?: string
}

/** Направление сведений / завершение обработки: POST /api/smd/status */
export async function postSmdStatus(
  smdid: string,
  action: 'send' | 'complete_processing' | 'close',
  guid?: string
): Promise<SmdStatusChangeResponse> {
  const url = getApiUrl('/api/smd/status')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...(guid ? { 'X-GUID': guid.trim() } : {}),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ smdid, action, guid }),
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* use text */
    }
    throw new Error(msg || res.statusText)
  }
  try {
    return JSON.parse(text) as SmdStatusChangeResponse
  } catch {
    return { ok: true }
  }
}

/** Входящие SMD: признак отправленной связанной карты SMR для диалога завершения обработки. */
export async function fetchSmdIncomingCompletePreview(
  smdid: string,
  guid?: string
): Promise<{ reviewOutcomeSent: boolean }> {
  const params = new URLSearchParams({ preview: 'incoming_complete', smdid })
  if (guid?.trim()) params.set('guid', guid.trim())
  const url = getApiUrl(`/api/smd/status?${params.toString()}`)
  const res = await fetch(url, {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  const text = await res.text()
  if (!res.ok) {
    let msg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) msg = j.error
    } catch {
      /* use text */
    }
    throw new Error(msg || res.statusText)
  }
  return JSON.parse(text) as { reviewOutcomeSent: boolean }
}
