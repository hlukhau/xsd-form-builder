/**
 * Валидация исходящей карты DPR: форматно-логические контроли (в т.ч. «Принятые меры» как у DPA), затем XSD
 * EEC_R_SM_SS_08_DangerousProductAlertResponse (на сервере блок EDocHeader исключается из отчёта).
 */
import type { DprParsedBundle } from '@/types/dprCard'
import type { ValidationResult } from '@/utils/cardValidation'
import { validateOutgoingMeasuresLikeDpa } from '@/utils/cardValidation'
import { fetchSchemaValidationErrors } from '@/utils/schemaValidationApi'

function empty(s: string | null | undefined): boolean {
  return s == null || String(s).trim() === ''
}

/** Форматно-логические контроли по разделам (без XSD). */
export function validateDprFormatLogical(parsed: DprParsedBundle): ValidationResult {
  const sections: { sectionName: string; remarks: string[] }[] = []

  const measuresRes = validateOutgoingMeasuresLikeDpa(parsed.measures)
  if (!measuresRes.success) {
    sections.push(...measuresRes.sections)
  }

  const auth = parsed.notifyingAuthority
  const secAuth = { sectionName: 'Уполномоченный орган', remarks: [] as string[] }
  if (empty(auth?.country)) {
    secAuth.remarks.push('Должен быть указан код страны уполномоченного органа')
  }
  if (empty(auth?.name)) {
    secAuth.remarks.push('Должно быть указано наименование уполномоченного органа (csdo:AuthorityName)')
  }
  if (empty(auth?.shortName)) {
    secAuth.remarks.push('Должно быть указано краткое наименование уполномоченного органа')
  }
  if (secAuth.remarks.length) sections.push(secAuth)

  const inc = parsed.incidentAlert
  const secInc = { sectionName: 'Исходная карта сведений о выявленных нарушениях', remarks: [] as string[] }
  if (empty(inc?.country)) {
    secInc.remarks.push('Должен быть указан код страны по исходной карте сведений о выявленных нарушениях')
  }
  if (empty(inc?.registrationNumber)) {
    secInc.remarks.push('Должен быть указан регистрационный номер исходной карты')
  }
  if (empty(inc?.typeCode)) {
    secInc.remarks.push('Должен быть указан вид уведомления (код)')
  }
  if (empty(inc?.formationDate)) {
    secInc.remarks.push('Должна быть указана дата формирования исходной карты')
  }
  if (secInc.remarks.length) sections.push(secInc)

  const docs = parsed.resultDocuments ?? []
  if (docs.length > 0) {
    const secDoc = { sectionName: 'Документы с описанием результатов рассмотрения', remarks: [] as string[] }
    for (let i = 0; i < docs.length; i++) {
      const row = docs[i]
      const pfx = `Документ ${i + 1}:`
      if (empty(row.countryCode)) secDoc.remarks.push(`${pfx} должна быть указана страна`)
      if (empty(row.languageCode)) secDoc.remarks.push(`${pfx} должен быть указан язык`)
      if (empty(row.docName)) secDoc.remarks.push(`${pfx} должно быть указано наименование документа`)
      if (empty(row.docId)) secDoc.remarks.push(`${pfx} должен быть указан номер документа`)
      if (empty(row.docCreationDate)) secDoc.remarks.push(`${pfx} должна быть указана дата документа`)
    }
    if (secDoc.remarks.length) sections.push(secDoc)
  }

  const total = sections.reduce((n, s) => n + s.remarks.length, 0)
  return { success: total === 0, sections }
}

/**
 * Полная проверка: сначала форматно-логический контроль, при успехе — структурный (XSD), раздел «Ошибки структуры (XSD)».
 */
export async function validateDprOutgoingCardFull(parsed: DprParsedBundle, xml: string): Promise<ValidationResult> {
  const logical = validateDprFormatLogical(parsed)
  if (!logical.success) {
    return logical
  }
  let xsdRemarks: string[] = []
  try {
    xsdRemarks = await fetchSchemaValidationErrors(xml, 'dpr')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      success: false,
      sections: [{ sectionName: 'Ошибки структуры (XSD)', remarks: [`Не удалось выполнить структурный контроль: ${msg}`] }],
    }
  }
  if (xsdRemarks.length > 0) {
    return {
      success: false,
      sections: [{ sectionName: 'Ошибки структуры (XSD)', remarks: xsdRemarks }],
    }
  }
  return { success: true, sections: [] }
}
