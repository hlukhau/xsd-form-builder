import type { CardData, PhaCauseNotificationItem } from '@/types/card'
import { SMD_MESSAGE_CANCEL, SMD_MESSAGE_CHANGE } from '@/constants/smdCard'
import { getSmdPrimaryMeasure } from './smdSanitaryMeasureModel'
import { getSmdRegulatoryMeasureDoc } from './smdMeasureDoc'
import { resolveSmdMeasureStartDate } from './smdMeasureDates'
import { collectBusinessEntityIdMethodPairErrorsFromCard } from '@/utils/businessEntityIdentificationValidation'

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
export function validateSmdCardBeforeSave(
  data: CardData,
  options?: { requireMessageForNewVersion?: boolean }
): string[] {
  const errors: string[] = []
  const measure = getSmdPrimaryMeasure(data)
  const doc = getSmdRegulatoryMeasureDoc(data)
  const version = data.version ?? 1
  const requireMessage = options?.requireMessageForNewVersion || version > 1

  if (requireMessage) {
    const code = data.electronicDocument?.messageCode?.trim() ?? ''
    if (!code) {
      errors.push('Укажите вид сообщения')
    } else if (code !== SMD_MESSAGE_CHANGE && code !== SMD_MESSAGE_CANCEL) {
      errors.push('Для новой версии выберите вид сообщения P.SS.09.MSG.002 или P.SS.09.MSG.003')
    }
  }

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

  errors.push(...collectBusinessEntityIdMethodPairErrorsFromCard(data))

  return errors
}
