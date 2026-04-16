/**
 * Определение типа карты по base URL приложения.
 * - /dpa_card/  → DPA (карта сведений об опасной продукции)
 * - /ppv_card/  → PPV (карта сведений о выявленных нарушениях; тот же UI и справочники, другой API-префикс)
 * - /pha_card/ → PHA (карта сведений об обнаружении болезней)
 */
const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL)
  ? import.meta.env.BASE_URL
  : (typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '').split('/').slice(0, -1).join('/') || '/' : '/dpa_card/')

export const CARD_APP_BASE = BASE.replace(/\/$/, '') || '/'

export function isPhaApp(): boolean {
  return CARD_APP_BASE.includes('pha_card')
}

export function isPpvApp(): boolean {
  return CARD_APP_BASE.includes('ppv_card')
}

/** Только приложение DPA (не PHA и не PPV). */
export function isDpaApp(): boolean {
  return !isPhaApp() && !isPpvApp()
}

export type CardAppType = 'dpa' | 'pha' | 'ppv'

export function getCardAppType(): CardAppType {
  if (isPhaApp()) return 'pha'
  if (isPpvApp()) return 'ppv'
  return 'dpa'
}

/** Ключи sessionStorage после сохранения новой карты (чтобы DPA и PPV не пересекались в одной вкладке). */
export function getDpaLikeCardSessionKeys(): { lastSavedIdKey: string; saveHappenedKey: string } {
  if (isPpvApp()) {
    return { lastSavedIdKey: 'ppv_card_last_saved_ppvid', saveHappenedKey: 'ppv_card_save_happened' }
  }
  return { lastSavedIdKey: 'dpa_card_last_saved_dpaid', saveHappenedKey: 'dpa_card_save_happened' }
}

/** Подпись идентификатора в сообщениях (в JSON API по-прежнему поле dpaid). */
export function getDpaLikeCardIdLabel(): 'DPAID' | 'PPVID' {
  return isPpvApp() ? 'PPVID' : 'DPAID'
}
