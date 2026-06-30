import type { DetectionPlaceData } from '@/types/card'
import { formatAddressLineObjectAddress, getDefaultCountryName } from '@/utils/addressFormatUtils'

export function formatPlaceOrganizationName(place?: DetectionPlaceData): string {
  return place?.organization?.businessEntityName?.trim() || '—'
}

export function formatPlaceCheckpointLabel(
  place?: DetectionPlaceData,
  getCheckpointName?: (code: string) => string | null
): string {
  const bc = place?.borderCheckpoint
  if (!bc) return '—'
  const code = bc.checkpointCode?.trim()
  if (code) {
    const name = getCheckpointName?.(code)
    return name ? `${code} — ${name}` : code
  }
  return bc.checkpointName?.trim() || '—'
}

export function formatPlaceAddressLabel(
  place?: DetectionPlaceData,
  getCountryName?: (code?: string) => string
): string {
  if (!place?.address) return '—'
  const line = formatAddressLineObjectAddress(place.address, getCountryName ?? getDefaultCountryName)
  return line?.trim() || '—'
}

export function formatPlaceDescriptionLabel(place?: DetectionPlaceData): string {
  const d = place?.description?.trim()
  if (!d || d === 'csdo:DescriptionText') return '—'
  return d
}
