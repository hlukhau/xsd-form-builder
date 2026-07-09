import type { CardData } from '@/types/card'
import type { ValidationResult } from '@/utils/cardValidation'
import { fetchSchemaValidationErrors } from '@/utils/schemaValidationApi'
import { validateSmdFormatLogical } from './smdFormatLogicalValidation'
import { collectSmdFormatValidationErrors } from './smdFormatValidation'
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

/** Форматно-логические контроли исходящей карты SMD. */
export function validateSmdOutgoingCardFull(data: CardData): ValidationResult {
  const synced = syncSmdCardFromPrimaryMeasure(data)
  return validateSmdFormatLogical(synced)
}

/**
 * Полная валидация: сначала форматно-логический контроль, затем структурный (XSD).
 */
export async function validateSmdOutgoingCardFullWithSchema(
  data: CardData,
  xml: string | null | undefined
): Promise<ValidationResult> {
  const logical = validateSmdOutgoingCardFull(data)
  if (!logical.success) {
    return logical
  }

  const formatResult = collectSmdFormatValidationErrors(data)
  if (formatResult.errors.length > 0) {
    return {
      success: false,
      sections: [{ sectionName: 'Структурный контроль', remarks: formatResult.errors }],
    }
  }

  return validateSmdCardXml(xml)
}

/** Валидация карты перед направлением сведений (логика + XSD). */
export async function validateSmdCardForSend(
  data: CardData,
  xml: string | null | undefined
): Promise<ValidationResult> {
  return validateSmdOutgoingCardFullWithSchema(data, xml)
}
