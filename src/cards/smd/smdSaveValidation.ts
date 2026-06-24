import type { CardData, PhaCauseNotificationItem } from '@/types/card'
import { getSmdPrimaryMeasure } from './smdSanitaryMeasureModel'
import { getSmdRegulatoryDocCreationDate, getSmdRegulatoryDocId, getSmdRegulatoryMeasureDoc } from './smdMeasureDoc'
import { resolveSmdMeasureStartDate } from './smdMeasureDates'

function isBlank(s: string | null | undefined): boolean {
  return !s || !String(s).trim()
}

function isIncidentRowTouched(row: PhaCauseNotificationItem): boolean {
  return (
    !isBlank(row.country) ||
    !isBlank(row.registrationNumber) ||
    !isBlank(row.type) ||
    !isBlank(row.formationDate)
  )
}

function isIncidentRowComplete(row: PhaCauseNotificationItem): boolean {
  return (
    !isBlank(row.country) &&
    !isBlank(row.registrationNumber) &&
    !isBlank(row.type) &&
    !isBlank(row.formationDate)
  )
}

/** Проверки обязательных полей перед сохранением новой карты SMD. */
export function validateSmdCardBeforeSave(data: CardData): string[] {
  const errors: string[] = []
  const measure = getSmdPrimaryMeasure(data)
  const doc = getSmdRegulatoryMeasureDoc(data)

  if (isBlank(doc?.country)) {
    errors.push('Укажите страну в блоке «Документ, регламентирующий введение (отмену) меры»')
  }
  if (isBlank(doc?.docId)) {
    errors.push('Укажите номер документа в блоке «Документ, регламентирующий введение (отмену) меры»')
  }
  if (isBlank(doc?.docCreationDate)) {
    errors.push('Укажите дату документа в блоке «Документ, регламентирующий введение (отмену) меры»')
  }

  if (!resolveSmdMeasureStartDate(data)) {
    errors.push('Укажите начальную дату действия меры')
  }

  if (measure.measureCode?.trim() && measure.measureName?.trim()) {
    errors.push('Нельзя одновременно указать код и наименование принятой меры')
  }

  if (doc?.docKindCode?.trim() && doc?.docKindName?.trim()) {
    errors.push('Нельзя одновременно указать код и наименование вида документа')
  }

  for (const row of data.smdIncidentAlerts ?? []) {
    if (isIncidentRowTouched(row) && !isIncidentRowComplete(row)) {
      errors.push(
        'Заполните все обязательные поля в блоке «Уведомление о нежелательной ситуации» или удалите незавершённую строку'
      )
      break
    }
  }

  return errors
}
