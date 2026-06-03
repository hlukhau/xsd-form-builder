import type { StatusHistoryItem } from '@/types/card'
import type { SmdMetadata } from '@/types/smdCard'
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
