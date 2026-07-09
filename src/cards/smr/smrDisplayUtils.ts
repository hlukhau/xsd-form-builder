import type { CountryOption } from '@/utils/referenceDataApi'

/** Наименование страны без дублирования кода (для блока УО в SMR). */
export function formatSmrCountryName(
  code: string | null | undefined,
  countryOptions: CountryOption[],
  fallbackName?: string | null
): string {
  const c = (code ?? '').trim()
  if (!c) return '—'
  const fromName = (fallbackName ?? '').trim()
  if (fromName && !fromName.toUpperCase().startsWith(c.toUpperCase())) {
    return fromName
  }
  const opt = countryOptions.find((o) => (o.code ?? '').toUpperCase() === c.toUpperCase())
  if (opt?.name?.trim()) return opt.name.trim()
  if (fromName) {
    const stripped = fromName.replace(new RegExp(`^${c}\\s*[-—]\\s*`, 'i'), '').trim()
    return stripped || fromName
  }
  return c
}

export const SMR_SOURCE_MEASURE_CARD_TITLE = 'Исходная карта о временной санитарной мере'
