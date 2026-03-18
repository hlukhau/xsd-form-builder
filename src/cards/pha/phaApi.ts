/**
 * API для карты PHA (сведений об обнаружении болезней).
 * Базовый URL задаётся при сборке (base: /xsd_form_builder_57/).
 * Эндпоинты: /api/pha/xml/{PHAID}, /api/pha/metadata/{PHAID} и т.д.
 */

import type { CardData } from '@/types/card'

const BASE = import.meta.env.BASE_URL || '/'

function getApiUrl(path: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

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
  /** Источник: Входящие сведения, Исходящие сведения, Данные ЕЭК (VW_PHA + DATASOURCEKIND) */
  dataSourceKindName?: string
  creationDateTime?: string
  modificationDateTime?: string
  phaStatusName?: string
  phaStatusId?: number
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

/** Тело запроса сохранения карты PHA (JSON). */
export interface SavePhaCardPayload {
  phaid: string
  guid?: string
  data: CardData
}

/**
 * Сохранение карты PHA. POST /api/pha/save.
 * При отсутствии бэкенда (404/501) выбрасывает ошибку с сообщением «Сохранение PHA в разработке».
 */
export async function savePhaCard(payload: SavePhaCardPayload): Promise<void> {
  const url = getApiUrl('/api/pha/save')
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(payload.guid ? { 'X-GUID': payload.guid } : {}) },
    credentials: 'same-origin',
    body: JSON.stringify({ phaid: payload.phaid, guid: payload.guid, data: payload.data }),
  })
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 404 || res.status === 501) throw new Error('Сохранение PHA в разработке')
    throw new Error(text || res.statusText)
  }
}
