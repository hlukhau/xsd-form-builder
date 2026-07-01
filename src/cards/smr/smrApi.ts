import type {
  SmrMetadataView,
  SmrResolutionRow,
  SmrSmdIncomingActionsResponse,
  SmrCreateEligibilityResponse,
  SmrCreateSaveRequest,
} from '@/types/smrCard'
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

function withGuidParams(params: URLSearchParams, guid?: string): URLSearchParams {
  if (guid?.trim()) params.set('guid', guid.trim())
  return params
}

function withGuidBody<T extends Record<string, unknown>>(body: T, guid?: string): T & { guid?: string } {
  if (!guid?.trim()) return body
  return { ...body, guid: guid.trim() }
}

export async function fetchSmrXml(smrId: string, guid?: string): Promise<string> {
  const response = await fetch(withGuidUrl(getApiUrl(`/api/smr/xml/${encodeURIComponent(smrId)}`), guid), {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text.slice(0, 300) || response.statusText)
  }
  return response.text()
}

export async function fetchSmrMetadata(smrId: string, guid?: string): Promise<SmrMetadataView> {
  const response = await fetch(withGuidUrl(getApiUrl(`/api/smr/metadata/${encodeURIComponent(smrId)}`), guid), {
    headers: withGuidHeaders(guid),
    credentials: 'same-origin',
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
    throw new Error(errMsg || response.statusText)
  }
  return JSON.parse(text) as SmrMetadataView
}

export async function fetchSmrStatusHistory(smrId: string, guid?: string): Promise<StatusHistoryItem[]> {
  const response = await fetch(
    withGuidUrl(getApiUrl(`/api/smr/status-history/${encodeURIComponent(smrId)}`), guid),
    { headers: withGuidHeaders(guid), credentials: 'same-origin' }
  )
  const text = await response.text()
  if (!response.ok) {
    throw new Error(text.slice(0, 200) || response.statusText)
  }
  return JSON.parse(text) as StatusHistoryItem[]
}

/** GET /api/smr/resolutions?smrId=&guid= */
export async function fetchSmrResolutions(smrId: string, guid?: string): Promise<SmrResolutionRow[]> {
  const params = withGuidParams(new URLSearchParams(), guid)
  params.set('smrId', smrId)
  const response = await fetch(withGuidUrl(getApiUrl(`/api/smr/resolutions?${params.toString()}`), guid))
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
    const data = JSON.parse(text) as { resolutions?: SmrResolutionRow[] }
    return Array.isArray(data.resolutions) ? data.resolutions : []
  } catch {
    return []
  }
}

/** POST /api/smr/save */
export async function postSmrSave(payload: {
  guid: string
  smrId: string
  smrXmlB64: string
}): Promise<{ ok: boolean; smrStatusId?: number }> {
  const response = await fetch(getApiUrl('/api/smr/save'), {
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
  return JSON.parse(text) as { ok: boolean; smrStatusId?: number }
}

/** POST /api/smr/delete-draft */
export async function postSmrDeleteDraft(payload: { guid: string; smrId: string }): Promise<{ ok: boolean }> {
  const response = await fetch(getApiUrl('/api/smr/delete-draft'), {
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

/** POST /api/smr/status */
export async function postSmrStatusChange(
  smrId: string,
  action: string,
  options?: { depKindCode?: string; guid?: string }
): Promise<{ newStatus?: string; newStatusId?: number; ok?: boolean }> {
  const body: Record<string, string> = { smrId, action }
  if (options?.depKindCode) body.depKindCode = options.depKindCode
  const response = await fetch(getApiUrl('/api/smr/status'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(withGuidBody(body, options?.guid)),
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

/** GET /api/smr/smd-incoming-actions/{SMDID}?guid= */
export async function fetchSmrSmdIncomingActions(
  smdid: string,
  guid?: string
): Promise<SmrSmdIncomingActionsResponse> {
  const response = await fetch(
    withGuidUrl(getApiUrl(`/api/smr/smd-incoming-actions/${encodeURIComponent(smdid)}`), guid)
  )
  if (!response.ok) {
    const text = await response.text()
    let errMsg = response.statusText
    try {
      const json = JSON.parse(text) as { error?: string }
      if (json.error) errMsg = json.error
    } catch {
      if (text) errMsg = text.slice(0, 200)
    }
    throw new Error(errMsg)
  }
  return response.json() as Promise<SmrSmdIncomingActionsResponse>
}

/** Возможность создать SMR по входящей SMD (через smd-incoming-actions). */
export async function fetchSmrCreateEligibility(
  smdid: string,
  guid?: string
): Promise<SmrCreateEligibilityResponse> {
  const a = await fetchSmrSmdIncomingActions(smdid, guid)
  if (!a.canPrepareReviewResult) {
    return { allowed: false, reason: a.prepareReviewResultReason ?? undefined }
  }
  const c = a.prepareContext
  if (!c) {
    return { allowed: false, reason: a.prepareReviewResultReason ?? 'Нет контекста создания' }
  }
  return {
    allowed: true,
    smdid: c.smdid,
    docId: c.docId,
    docCountryCode: c.docCountryCode,
    messageCode: c.messageCode,
    docCreationDate: c.docCreationDate,
    responseCountryId: c.responseCountryId,
    responseCountryCode: c.responseCountryCode,
    responseCountryName: c.responseCountryName,
    draftSmrStatusId: c.draftSmrStatusId,
    draftSmrStatusName: c.draftSmrStatusName,
  }
}

/** POST /api/smr/create-save */
export async function postSmrCreateSave(body: SmrCreateSaveRequest): Promise<{ smrId: string }> {
  const response = await fetch(getApiUrl('/api/smr/create-save'), {
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
    const json = JSON.parse(text) as { smrId?: number | string }
    return { smrId: String(json.smrId ?? '') }
  } catch {
    throw new Error('Некорректный ответ сервера при сохранении SMR')
  }
}
