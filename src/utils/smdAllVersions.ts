import type { CountryOption } from '@/utils/referenceDataApi'
import type { SmdMetadata } from '@/types/smdCard'
import { resolveAlertCountryNameForPostMessage } from '@/utils/alertCountryDisplay'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'

/**
 * Открытие реестра всех версий SMD в легаси-приложении
 * с фильтром по стране, номеру и дате документа.
 *
 *   VITE_LEGACY_SMD_REGISTER_URL=https://legacy-host/path/to/smd-register
 *   VITE_LEGACY_SMD_REGISTER_PARAM_COUNTRY=country
 *   VITE_LEGACY_SMD_REGISTER_PARAM_DOCID=docId
 *   VITE_LEGACY_SMD_REGISTER_PARAM_DOC_DATE=docCreationDate
 */

const BASE_URL =
  typeof import.meta.env.VITE_LEGACY_SMD_REGISTER_URL === 'string'
    ? (import.meta.env.VITE_LEGACY_SMD_REGISTER_URL as string).replace(/\/$/, '')
    : ''

const PARAM_COUNTRY =
  (import.meta.env.VITE_LEGACY_SMD_REGISTER_PARAM_COUNTRY as string) || 'country'
const PARAM_DOC_ID =
  (import.meta.env.VITE_LEGACY_SMD_REGISTER_PARAM_DOCID as string) || 'docId'
const PARAM_DOC_DATE =
  (import.meta.env.VITE_LEGACY_SMD_REGISTER_PARAM_DOC_DATE as string) || 'docCreationDate'

export type SmdRegistryTab = 'incoming' | 'outgoing' | 'eec'

export function resolveSmdRegistryTab(dataSourceKindCode: string | null | undefined): SmdRegistryTab {
  const c = String(dataSourceKindCode ?? '').trim()
  if (c === '2') return 'outgoing'
  if (c === '3') return 'eec'
  return 'incoming'
}

function normalizeDocDate(docCreationDate: string | null | undefined): string {
  return (docCreationDate ?? '').trim().slice(0, 10)
}

export function buildSmdAllVersionsRegisterUrl(params: {
  countryCode: string
  docId: string
  docCreationDate: string
}): string {
  if (!BASE_URL) return ''
  const search = new URLSearchParams()
  if (params.countryCode.trim()) search.set(PARAM_COUNTRY, params.countryCode.trim())
  if (params.docId.trim()) search.set(PARAM_DOC_ID, params.docId.trim())
  const docDate = normalizeDocDate(params.docCreationDate)
  if (docDate) search.set(PARAM_DOC_DATE, docDate)
  const qs = search.toString()
  return qs ? `${BASE_URL}?${qs}` : BASE_URL
}

export function isSmdLegacyRegisterConfigured(): boolean {
  return BASE_URL.length > 0
}

export function openSmdAllVersionsInLegacy(params: {
  countryCode: string
  docId: string
  docCreationDate: string
}): boolean {
  const url = buildSmdAllVersionsRegisterUrl(params)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export function openSmdAllVersions(meta: SmdMetadata, countryOptions: CountryOption[] = []): void {
  const docId = (meta.docId ?? '').trim()
  const docCreationDate = normalizeDocDate(meta.docCreationDate)
  const countryName = resolveAlertCountryNameForPostMessage(
    meta.docCountryCode ?? undefined,
    meta.docCountryName,
    countryOptions
  )
  const registryTab = resolveSmdRegistryTab(meta.dataSourceKindCode)

  const payload = {
    code: 'all_version' as const,
    DOCID: docId,
    COUNTRY: countryName,
    DOCCREATIONDATE: docCreationDate,
    registryTab,
  }
  postMessageFromCardToParent(payload, 'SMD: открыть все версии')

  if (isSmdLegacyRegisterConfigured()) {
    openSmdAllVersionsInLegacy({
      countryCode: (meta.docCountryCode ?? '').trim(),
      docId,
      docCreationDate,
    })
  }
}
