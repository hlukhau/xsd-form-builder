/**
 * Определение типа карты по base URL приложения.
 * - /xsd_form_builder/  → DPA (карта сведений об опасной продукции)
 * - /xsd_form_builder_57/ → PHA (карта сведений об обнаружении болезней)
 */
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
  ? import.meta.env.BASE_URL
  : (typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/' : '/xsd_form_builder/')

export const CARD_APP_BASE = BASE.replace(/\/$/, '') || '/'

export function isPhaApp(): boolean {
  return CARD_APP_BASE.includes('xsd_form_builder_57')
}

export function isDpaApp(): boolean {
  return !isPhaApp()
}

export type CardAppType = 'dpa' | 'pha'

export function getCardAppType(): CardAppType {
  return isPhaApp() ? 'pha' : 'dpa'
}
