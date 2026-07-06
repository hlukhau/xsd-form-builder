import type { CardData } from '@/types/card'
import { getSmdPrimaryMeasure } from './smdSanitaryMeasureModel'

/** Дата начала действия меры (csdo:StartDate / SMD.SANITARYMEASURESTARTDATE). */
export function resolveSmdMeasureStartDate(data: CardData): string | null {
  const fromMeasure = getSmdPrimaryMeasure(data).startDate?.trim().slice(0, 10)
  if (fromMeasure) return fromMeasure
  const explicit = data.smdMeasureStartDate?.trim().slice(0, 10)
  if (explicit) return explicit
  return null
}

export function resolveSmdMeasureEndDate(data: CardData): string | null {
  return getSmdPrimaryMeasure(data).endDate?.trim().slice(0, 10) || null
}
