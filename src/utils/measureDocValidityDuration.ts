/** csdo:DocValidityDuration — максимум 5 цифр (дней в формате PnD). */
export const DOC_VALIDITY_DURATION_MAX_DAYS = 99_999

/** Целое число дней из PnD; иначе null. */
export function measureDocValidityDaysFromPnD(xmlDuration: string | undefined): number | null {
  const m = (xmlDuration ?? '').trim().match(/^P(\d+)D$/i)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) ? n : null
}

export function formatMeasureDocValidityDurationDays(days: number): string {
  const clamped = Math.min(Math.max(1, Math.floor(days)), DOC_VALIDITY_DURATION_MAX_DAYS)
  return `P${clamped}D`
}

/** Оставляет не более 5 цифр для ввода срока действия документа. */
export function parseMeasureDocValidityDaysInput(raw: string): number | null {
  const digits = raw.replace(/\D/g, '').slice(0, 5)
  if (!digits) return null
  const n = parseInt(digits, 10)
  if (!Number.isFinite(n) || n < 1) return null
  return Math.min(n, DOC_VALIDITY_DURATION_MAX_DAYS)
}
