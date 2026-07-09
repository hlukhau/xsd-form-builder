import type { CountryOption } from '@/utils/referenceDataApi'

/** Отображение страны: «код — наименование» (как в остальных картах). */
export function formatSmrCountryName(
  code: string | null | undefined,
  countryOptions: CountryOption[],
  fallbackName?: string | null
): string {
  const c = (code ?? '').trim()
  if (!c) {
    const nameOnly = (fallbackName ?? '').trim()
    return nameOnly || '—'
  }
  const opt = countryOptions.find((o) => (o.code ?? '').toUpperCase() === c.toUpperCase())
  let name = opt?.name?.trim() || (fallbackName ?? '').trim()
  if (name) {
    const stripped = name.replace(new RegExp(`^${c}\\s*[-—]\\s*`, 'i'), '').trim()
    if (stripped && stripped !== name) {
      name = stripped
    } else if (name.toUpperCase().startsWith(c.toUpperCase())) {
      const afterCode = name.slice(c.length).replace(/^[\s—-]+/, '').trim()
      if (afterCode) name = afterCode
    }
    return `${c} — ${name}`
  }
  return c
}

export const SMR_SOURCE_MEASURE_CARD_TITLE = 'Исходная карта о временной санитарной мере'
