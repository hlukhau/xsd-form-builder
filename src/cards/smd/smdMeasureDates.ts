import type { CardData } from '@/types/card'
import { getSmdPrimaryMeasure } from './smdSanitaryMeasureModel'

/** Дата начала действия меры (csdo:StartDate / SMD.SANITARYMEASURESTARTDATE). */
export function resolveSmdMeasureStartDate(data: CardData): string | null {
  const measure = getSmdPrimaryMeasure(data)
  if (measure.startDate !== undefined && measure.startDate !== null) {
    const trimmed = String(measure.startDate).trim().slice(0, 10)
    return trimmed || null
  }
  const explicit = data.smdMeasureStartDate?.trim().slice(0, 10)
  return explicit || null
}

export function resolveSmdMeasureEndDate(data: CardData): string | null {
  return getSmdPrimaryMeasure(data).endDate?.trim().slice(0, 10) || null
}
