import type { ValidationResult } from '@/utils/cardValidation'
import { fetchSchemaValidationErrors } from '@/utils/schemaValidationApi'

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
