/**
 * Серверная проверка XML по XSD ЕЭК (POST /api/xml/validate-schema).
 */

const BASE_URL = import.meta.env.BASE_URL || '/'

function apiUrl(path: string): string {
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}

/** Убирает из текста замечания пространства имён в фигурных скобках и префиксы элементов (для отчёта «Валидация карты»). */
export function sanitizeValidationMessageForDisplay(raw: string): string {
  if (!raw) return ''
  let s = raw.replace(/\{urn:[^}]+\}/g, '')
  s = s.replace(/\b(csdo|smcdo|smsdo|ccdo|doc|bdt):/gi, '')
  s = s.replace(/\s{2,}/g, ' ').trim()
  return s
}

export type XsdDocumentType = 'dpa' | 'pha' | 'ppv' | 'dpr'

/**
 * Возвращает список замечаний XSD (пустой — документ соответствует схеме с учётом исключений на сервере).
 */
export async function fetchSchemaValidationErrors(xml: string, documentType: XsdDocumentType): Promise<string[]> {
  const url = apiUrl('/api/xml/validate-schema')
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml; charset=UTF-8',
      'X-Document-Type': documentType,
    },
    credentials: 'same-origin',
    body: xml,
  })
  const text = await res.text()
  let parsed: { errors?: string[] }
  try {
    parsed = JSON.parse(text) as { errors?: string[] }
  } catch {
    throw new Error(res.ok ? 'Некорректный ответ сервера при проверке XSD' : `Ошибка ${res.status}: ${text.slice(0, 200)}`)
  }
  if (!res.ok) {
    const first = parsed.errors?.[0] ?? text.slice(0, 200)
    throw new Error(first)
  }
  return Array.isArray(parsed.errors) ? parsed.errors.map((e) => sanitizeValidationMessageForDisplay(e)) : []
}
