/**
 * Открытие реестра сведений об опасной продукции в легаси-приложении
 * с фильтром по "Страна" и "Регистрационный номер" (все версии по случаю).
 *
 * Задайте в .env или при сборке:
 *   VITE_LEGACY_REGISTER_URL=https://legacy-host/path/to/register
 * Имена параметров можно переопределить через:
 *   VITE_LEGACY_REGISTER_PARAM_COUNTRY=country
 *   VITE_LEGACY_REGISTER_PARAM_REG=registrationNumber
 */

const BASE_URL =
  typeof import.meta.env.VITE_LEGACY_REGISTER_URL === 'string'
    ? (import.meta.env.VITE_LEGACY_REGISTER_URL as string).replace(/\/$/, '')
    : ''

const PARAM_COUNTRY =
  (import.meta.env.VITE_LEGACY_REGISTER_PARAM_COUNTRY as string) || 'country'
const PARAM_REG =
  (import.meta.env.VITE_LEGACY_REGISTER_PARAM_REG as string) || 'registrationNumber'

export function buildLegacyRegisterUrl(country: string, registrationNumber: string): string {
  if (!BASE_URL) return ''
  const params = new URLSearchParams()
  if (country) params.set(PARAM_COUNTRY, country)
  if (registrationNumber) params.set(PARAM_REG, registrationNumber)
  const qs = params.toString()
  return qs ? `${BASE_URL}?${qs}` : BASE_URL
}

export function openLegacyRegisterAllVersions(country: string, registrationNumber: string): boolean {
  const url = buildLegacyRegisterUrl(country, registrationNumber)
  if (!url) return false
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

export function isLegacyRegisterConfigured(): boolean {
  return BASE_URL.length > 0
}
