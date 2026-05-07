/**
 * API для карты PHA (сведений об обнаружении болезней).
 * Базовый URL задаётся при сборке (base: /pha_card/).
 * Эндпоинты: /api/pha/xml/{PHAID}, /api/pha/metadata/{PHAID} и т.д.
 */

import type { CardData } from '@/types/card'

const BASE = import.meta.env.BASE_URL || '/'

function getApiUrl(path: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

/** Тело XML из PHAXML. Версия карты (PHA.PHAVERSION) — только через GET /api/pha/metadata/{PHAID}. */
export async function fetchPhaXml(phaid: string, guid?: string): Promise<string> {
  const url = getApiUrl(`/api/pha/xml/${phaid}`)
  const res = await fetch(url, {
    method: 'GET',
    headers: guid ? { 'X-GUID': guid } : {},
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(res.status === 404 ? `Карта PHA с PHAID ${phaid} не найдена` : (text || res.statusText))
  }
  return res.text()
}

export async function fetchPhaMetadata(phaid: string, guid?: string): Promise<{
  phaId: number
  incidentId: string
  phaVersion: number
  alertCountryCode?: string
  /** Наименование страны инцидента (COUNTRY.COUNTRYNAME) */
  alertCountryName?: string | null
  /** Код источника PHA (DATASOURCEKINDCODE): 1 — входящие, 2 — исходящие */
  dataSourceKindCode?: string
  /** Источник: Входящие сведения, Исходящие сведения, Данные ЕЭК (VW_PHA + DATASOURCEKIND) */
  dataSourceKindName?: string
  creationDateTime?: string
  modificationDateTime?: string
  phaStatusName?: string
  phaStatusId?: number
  /** DEPID из PHADEPPERMIS */
  phaAccessibleDepIds?: string[]
  /** PHA.ENDDATE (дата закрытия ситуации), YYYY-MM-DD */
  situationEndDate?: string
  /** AUTHORITY.AUTHORITYUID для PHA.AUTHORITYID — подставлять в форму как идентификатор УО (в XML может не быть). */
  authorityUid?: string | null
}> {
  const url = getApiUrl(`/api/pha/metadata/${phaid}`)
  const res = await fetch(url, {
    method: 'GET',
    headers: guid ? { 'X-GUID': guid } : {},
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText))
  return res.json()
}

/** Элемент истории смены статусов PHA (ответ /api/pha/status-history/{PHAID}). */
export interface PhaStatusHistoryItem {
  status: string
  dateTime: string
  employee: string | null
}

/**
 * История смены статусов карты PHA (PHASTATUSHIST + наименования из PHASTATUS).
 * GET /api/pha/status-history/{PHAID}
 */
export async function fetchPhaStatusHistory(phaid: string, guid?: string): Promise<PhaStatusHistoryItem[]> {
  const url = getApiUrl(`/api/pha/status-history/${phaid}`)
  const res = await fetch(url, {
    method: 'GET',
    headers: guid ? { 'X-GUID': guid } : {},
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(res.status === 404 ? `История статусов для PHAID ${phaid} не найдена` : (text || res.statusText))
  }
  return res.json()
}

/** Метаданные для POST /api/pha/save (поля PHA / справочники). */
export interface PhaSaveMetadata {
  incidentId: string | null
  countryCode: string | null
  docCreationDate?: string | null
  /** UID выбранного УО из справочника AUTHORITY (резолвится на сервере в PHA.AUTHORITYID). */
  authorityIdentifier?: string | null
  /** csdo:EndDate из уведомления (сохраняется в PHA.ENDDATE). */
  endDate?: string | null
  incidentAlertKindCode?: string | null
  diseaseName?: string | null
  firstCaseDate?: string | null
  lastCaseDate?: string | null
  crossborderRiskFl?: number | null
}

/**
 * Сохранение карты PHA. POST /api/pha/save.
 */
export async function savePhaCard(payload: {
  isNew: boolean
  xmlBody: string
  metadata: PhaSaveMetadata
  phaid?: number
  guid?: string
}): Promise<{ success: boolean; phaid: number }> {
  const url = getApiUrl('/api/pha/save')
  const body: Record<string, unknown> = {
    isNew: payload.isNew,
    xmlBody: payload.xmlBody,
    metadata: payload.metadata,
  }
  if (payload.guid) body.guid = payload.guid
  if (!payload.isNew && payload.phaid != null) body.phaid = payload.phaid

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      ...(payload.guid ? { 'X-GUID': payload.guid } : {}),
    },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    let errMsg = res.statusText
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) errMsg = j.error
    } catch {
      if (text) errMsg = text.slice(0, 400)
    }
    throw new Error(errMsg)
  }
  return JSON.parse(text) as { success: boolean; phaid: number }
}

/** Собрать metadata для сохранения PHA из CardData. */
export function buildPhaSaveMetadataFromCardData(data: CardData): PhaSaveMetadata {
  const notification = data.notification
  const countryCode = data.country || notification?.country || null
  const incidentId =
    (data.registrationNumber || notification?.registrationNumber || '').trim() || null
  const docCreationDate = notification?.formationDate?.trim() || null
  const typeRaw = notification?.type
  const incidentAlertKindCode =
    typeof typeRaw === 'string' && /^\d+$/.test(typeRaw.trim()) ? typeRaw.trim() : null
  return {
    incidentId,
    countryCode: countryCode ? String(countryCode).trim() : null,
    docCreationDate,
    authorityIdentifier: notification?.authorizedBody?.identifier?.trim() || null,
    endDate: notification?.endDate?.trim() || null,
    incidentAlertKindCode,
    diseaseName: data.phaDisease?.diseaseName?.trim() || null,
    firstCaseDate: data.phaDisease?.firstCaseDate?.trim() || null,
    lastCaseDate: data.phaDisease?.lastCaseDate?.trim() || null,
    crossborderRiskFl:
      data.phaDisease?.crossborderSpreadRiskIndicator === 0 || data.phaDisease?.crossborderSpreadRiskIndicator === 1
        ? data.phaDisease.crossborderSpreadRiskIndicator
        : null,
  }
}

export interface PhaDeleteResponse {
  success: boolean
  registrationNumber?: string
}

/** Проверка возможности создания новой версии карты PHA. */
export interface CanCreatePhaNewVersionResponse {
  allowed: boolean
  reason?: string
}

export async function canCreatePhaNewVersion(phaid: string, guid?: string): Promise<CanCreatePhaNewVersionResponse> {
  const params = new URLSearchParams({ phaid })
  if (guid?.trim()) params.set('guid', guid.trim())
  const url = getApiUrl(`/api/pha/can-create-new-version?${params.toString()}`)
  const res = await fetch(url, {
    method: 'GET',
    headers: guid ? { 'X-GUID': guid } : {},
    credentials: 'same-origin',
  })
  const text = await res.text()
  if (!res.ok) {
    return { allowed: false, reason: text || res.statusText }
  }
  try {
    return JSON.parse(text) as CanCreatePhaNewVersionResponse
  } catch {
    return { allowed: false, reason: text || 'Не удалось проверить условия создания новой версии' }
  }
}

/**
 * Удалить исходящую карту PHA (статус «Новое», проверка прав на сервере).
 * POST /api/pha/delete
 */
export async function deletePhaCard(phaid: number | string, guid?: string): Promise<PhaDeleteResponse> {
  const url = getApiUrl('/api/pha/delete')
  const body: Record<string, unknown> = { phaid: Number(phaid) }
  if (guid?.trim()) body.guid = guid.trim()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    let errMsg = res.statusText
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) errMsg = j.error
    } catch {
      if (text) errMsg = text.slice(0, 400)
    }
    throw new Error(errMsg)
  }
  return JSON.parse(text) as PhaDeleteResponse
}

/** Ответ POST /api/pha/status */
export interface PhaStatusChangeResponse {
  ok: boolean
  changed?: boolean
  newStatus?: string
  newStatusId?: number
}

/**
 * Смена статуса PHA (входящие).
 * first_open — Получено→В обработке при открытии (только DATASOURCEKINDCODE=1; publicHealthIn:view; guid с userId для PHASTATUSHIST);
 * complete_processing, close — publicHealthIn:status (входящие);
 * send, close, to_new — publicHealthOut:send / publicHealthOut:status (исходящие).
 */
export async function postPhaStatus(
  phaid: string,
  action: 'first_open' | 'complete_processing' | 'close' | 'send' | 'to_new',
  guid?: string
): Promise<PhaStatusChangeResponse> {
  const url = getApiUrl('/api/pha/status')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(guid ? { 'X-GUID': guid } : {}),
    },
    credentials: 'same-origin',
    body: JSON.stringify({ phaid, action, guid }),
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
    return JSON.parse(text) as PhaStatusChangeResponse
  } catch {
    return { ok: true }
  }
}
