import type { CardData } from '@/types/card'
import type { ValidationResult } from '@/utils/cardValidation'
import { fetchSchemaValidationErrors } from '@/utils/schemaValidationApi'
import { validateSmdCardBeforeSave } from './smdSaveValidation'
import { syncSmdCardFromPrimaryMeasure } from './smdSanitaryMeasureModel'

function emptyXmlBody(xml: string | null | undefined): boolean {
  const t = (xml ?? '').trim()
  return !t || t.includes('<empty/>')
}

/**
 * Структурный контроль XML карты SMD по XSD SS.09 (тело из SMDXML / формы после экспорта).
 */
export async function validateSmdCardXml(xml: string | null | undefined): Promise<ValidationResult> {
  if (emptyXmlBody(xml)) {
    return {
      success: false,
      sections: [
        {
          sectionName: 'Структурный контроль',
          remarks: ['Тело XML карты отсутствует или пустое. Сохраните карту или загрузите документ из БД.'],
        },
      ],
    }
  }

  let xsdRemarks: string[] = []
  let schemaRequestFailed = false
  try {
    xsdRemarks = await fetchSchemaValidationErrors(xml!.trim(), 'smd')
  } catch (e) {
    schemaRequestFailed = true
    const msg = e instanceof Error ? e.message : String(e)
    xsdRemarks = [`Не удалось выполнить структурный контроль: ${msg}`]
  }

  if (schemaRequestFailed || xsdRemarks.length > 0) {
    return {
      success: false,
      sections: [{ sectionName: 'Структурный контроль', remarks: xsdRemarks }],
    }
  }

  return { success: true, sections: [] }
}

/** Валидация карты перед направлением сведений (логика + XSD). */
export async function validateSmdCardForSend(
  data: CardData,
  xml: string | null | undefined
): Promise<ValidationResult> {
  const synced = syncSmdCardFromPrimaryMeasure(data)
  const version = synced.version ?? 1
  const logicalErrors = validateSmdCardBeforeSave(synced, {
    requireMessageForNewVersion: version > 1,
  })
  if (logicalErrors.length > 0) {
    return {
      success: false,
      sections: [{ sectionName: 'Обязательные поля', remarks: logicalErrors }],
    }
  }
  return validateSmdCardXml(xml)
}
