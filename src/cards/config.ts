/**
 * Определение типа карты по base URL приложения.
 * - /dpa_card/  → DPA (карта сведений об опасной продукции)
 * - /pha_card/ → PHA (карта сведений об обнаружении болезней)
 */
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
  ? import.meta.env.BASE_URL
  : (typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/' : '/dpa_card/')

export const CARD_APP_BASE = BASE.replace(/\/$/, '') || '/'

export function isPhaApp(): boolean {
  return CARD_APP_BASE.includes('pha_card')
}

export function isDpaApp(): boolean {
  return !isPhaApp()
}

export type CardAppType = 'dpa' | 'pha'

export function getCardAppType(): CardAppType {
  return isPhaApp() ? 'pha' : 'dpa'
}
