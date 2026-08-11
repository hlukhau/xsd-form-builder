import type { CardData } from '@/types/card'
import { SANITARY_MEASURE_START_DATE_XML_PLACEHOLDER } from '@/constants/measureXml'
import { getSmdPrimaryMeasure } from './smdSanitaryMeasureModel'

function normalizeMeasureStartDate(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim().slice(0, 10)
  if (!trimmed || trimmed === SANITARY_MEASURE_START_DATE_XML_PLACEHOLDER) return null
  return trimmed
}

/** Дата начала действия меры (csdo:StartDate / SMD.SANITARYMEASURESTARTDATE). */
export function resolveSmdMeasureStartDate(data: CardData): string | null {
  const measure = getSmdPrimaryMeasure(data)
  if (measure.startDate !== undefined && measure.startDate !== null) {
    return normalizeMeasureStartDate(String(measure.startDate))
  }
  return normalizeMeasureStartDate(data.smdMeasureStartDate)
}

export function resolveSmdMeasureEndDate(data: CardData): string | null {
  return getSmdPrimaryMeasure(data).endDate?.trim().slice(0, 10) || null
}
