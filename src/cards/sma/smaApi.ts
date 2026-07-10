import type {
  SmaMetadataView,
  SmaCreateEligibilityResponse,
  SmaCreateSaveRequest,
  SmaCardKind,
  SmarResponseKind,
} from '@/types/smaCard'
import type { StatusHistoryItem } from '@/types/card'

const BASE = import.meta.env.BASE_URL || '/'

function getApiUrl(path: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

function withGuidUrl(url: string, guid?: string): string {
  if (!guid?.trim()) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}guid=${encodeURIComponent(guid.trim())}`
}

function withGuidHeaders(guid?: string): HeadersInit {
  return guid?.trim() ? { 'X-GUID': guid.trim() } : {}
}

function withGuidBody<T extends Record<string, unknown>>(body: T, guid?: string): T & { guid?: string } {
  if (!guid?.trim()) return body
  return { ...body, guid: guid.trim() }
}

export async function fetchSmaXml(kind: SmaCardKind, id: string, guid?: string): Promise<string> {
  const response = await fetch(
    withGuidUrl(getApiUrl(`/api/sma/xml/${kind}/${encodeURIComponent(id)}`), guid),
    { headers: withGuidHeaders(guid), credentials: 'same-origin' }
  )
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text.slice(0, 300) || response.statusText)
  }
  return response.text()
}

export async function fetchSmaMetadata(kind: SmaCardKind, id: string, guid?: string): Promise<SmaMetadataView> {
  const response = await fetch(
    withGuidUrl(getApiUrl(`/api/sma/metadata/${kind}/${encodeURIComponent(id)}`), guid),
    { headers: withGuidHeaders(guid), credentials: 'same-origin' }
  )
  const text = await response.text()
  if (!response.ok) {
    let errMsg = text
    try {
      const j = JSON.parse(text) as { error?: string }
      if (j.error) errMsg = j.error
    } catch {
      /* ignore */
    }
    throw new Error(errMsg || response.statusText)
  }
  return JSON.parse(text) as SmaMetadataView
}

export async function fetchSmaStatusHistory(
  kind: SmaCardKind,
  id: string,
  guid?: string
): Promise<StatusHistoryItem[]> {
  const response = await fetch(
    withGuidUrl(getApiUrl(`/api/sma/status-history/${kind}/${encodeURIComponent(id)}`), guid),
    { headers: withGuidHeaders(guid), credentials: 'same-origin' }
  )
  const text = await response.text()
  if (!response.ok) {
    throw new Error(text.slice(0, 200) || response.statusText)
  }
  return JSON.parse(text) as StatusHistoryItem[]
}

/** GET /api/sma/create-eligibility/smd/{smdid}?guid= */
export async function fetchSmaqCreateEligibility(
  smdid: string,
  guid?: string
): Promise<SmaCreateEligibilityResponse> {
  const response = await fetch(
    withGuidUrl(getApiUrl(`/api/sma/create-eligibility/smd/${encodeURIComponent(smdid)}`), guid),
    { headers: withGuidHeaders(guid), credentials: 'same-origin' }
  )
  const text = await response.text()
  if (!response.ok) {
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return JSON.parse(text) as SmaCreateEligibilityResponse
}

/** GET /api/sma/create-eligibility/smaq/{smaqid}?guid= */
export async function fetchSmarCreateEligibility(
  smaqid: string,
  guid?: string
): Promise<SmaCreateEligibilityResponse> {
  const response = await fetch(
    withGuidUrl(getApiUrl(`/api/sma/create-eligibility/smaq/${encodeURIComponent(smaqid)}`), guid),
    { headers: withGuidHeaders(guid), credentials: 'same-origin' }
  )
  const text = await response.text()
  if (!response.ok) {
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return JSON.parse(text) as SmaCreateEligibilityResponse
}

/** POST /api/sma/create-save */
export async function postSmaCreateSave(
  body: SmaCreateSaveRequest
): Promise<{ kind: SmaCardKind; smaqId?: string; smarId?: string }> {
  const response = await fetch(getApiUrl('/api/sma/create-save'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json;charset=UTF-8' },
    body: JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) {
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  try {
    const json = JSON.parse(text) as {
      kind?: SmaCardKind
      smaqId?: number | string
      smarId?: number | string
    }
    return {
      kind: json.kind ?? body.kind,
      smaqId: json.smaqId != null ? String(json.smaqId) : undefined,
      smarId: json.smarId != null ? String(json.smarId) : undefined,
    }
  } catch {
    throw new Error('Некорректный ответ сервера при сохранении SMA')
  }
}

/** POST /api/sma/save */
export async function postSmaSave(payload: {
  kind: SmaCardKind
  id: string
  guid: string
  smaXmlB64: string
  responseKind?: SmarResponseKind
  authorityId?: string
}): Promise<{ ok: boolean; statusId?: number; edocCode?: string }> {
  const response = await fetch(getApiUrl('/api/sma/save'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withGuidBody(payload, payload.guid)),
  })
  const text = await response.text()
  if (!response.ok) {
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return JSON.parse(text) as { ok: boolean; statusId?: number; edocCode?: string }
}

/** POST /api/sma/delete-draft */
export async function postSmaDeleteDraft(payload: {
  kind: SmaCardKind
  id: string
  guid: string
}): Promise<{ ok: boolean }> {
  const response = await fetch(getApiUrl('/api/sma/delete-draft'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withGuidBody(payload, payload.guid)),
  })
  const text = await response.text()
  if (!response.ok) {
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return JSON.parse(text) as { ok: boolean }
}

/** POST /api/sma/status */
export async function postSmaStatusChange(
  kind: SmaCardKind,
  id: string,
  action: string,
  guid?: string
): Promise<{ newStatus?: string; newStatusId?: number; ok?: boolean }> {
  const body: Record<string, string> = { kind, id, action }
  const response = await fetch(getApiUrl('/api/sma/status'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withGuidBody(body, guid)),
  })
  const text = await response.text()
  if (!response.ok) {
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return JSON.parse(text) as { newStatus?: string; newStatusId?: number; ok?: boolean }
}
