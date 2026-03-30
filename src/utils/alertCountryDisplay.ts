import type { CountryOption } from '@/utils/referenceDataApi'
import { getDefaultCountryName } from '@/utils/addressFormatUtils'

/**
 * Наименование страны карты (инцидента) для postMessage all_version: не код, а человекочитаемое имя.
 */
export function resolveAlertCountryNameForPostMessage(
  countryCode: string | undefined,
  alertCountryNameFromMeta: string | undefined | null,
  countryOptions: CountryOption[]
): string {
  const fromMeta = alertCountryNameFromMeta?.trim()
  if (fromMeta) return fromMeta
  if (!countryCode?.trim()) return ''
  const normalized = countryCode.includes('-') ? countryCode.split('-')[0].trim() : countryCode.trim()
  const opt = countryOptions.find((o) => (o.code || '').toUpperCase() === normalized.toUpperCase())
  if (opt?.name?.trim()) return opt.name.trim()
  const fb = getDefaultCountryName(normalized)
  if (fb && fb.toUpperCase() !== normalized.toUpperCase()) return fb
  return ''
}
