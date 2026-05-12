/**
 * Определение типа карты по base URL приложения.
 * - /dpa_card/  → DPA (карта сведений об опасной продукции)
 * - /ppv_card/  → PPV (карта сведений о выявленных нарушениях; тот же UI и справочники, другой API-префикс)
 * - /pha_card/ → PHA (карта сведений об обнаружении болезней)
 * - /dpr_card/ → DPR (карта сведений о результатах рассмотрения)
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

export function isDprApp(): boolean {
  return CARD_APP_BASE.includes('dpr_card')
}

/** Только приложение DPA (не PHA, не PPV и не DPR). */
export function isDpaApp(): boolean {
  return !isPhaApp() && !isPpvApp() && !isDprApp()
}

export type CardAppType = 'dpa' | 'pha' | 'ppv' | 'dpr'

export function getCardAppType(): CardAppType {
  if (isPhaApp()) return 'pha'
  if (isPpvApp()) return 'ppv'
  if (isDprApp()) return 'dpr'
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
