/**
 * Валидация исходящей карты DPR.
 * Перед сохранением: только несоответствия формата заполненных полей и логика SES2025-314 (идентификатор ↔ метод).
 * «Валидация карты» и направление в ОП 57: форматно-логический контроль → несоответствие формату → XSD.
 */
import type { DprParsedBundle } from '@/types/dprCard'
import type { CardData, MeasureImplementationItem, MeasuresData, SubjectDetails } from '@/types/card'
import type { ValidationResult } from '@/utils/cardValidation'
import { collectFormatValidationErrors, validateOutgoingMeasuresLikeDpa } from '@/utils/cardValidation'
import { validateFieldValue } from '@/constants/xsdFieldConstraints'
import { fetchSchemaValidationErrors } from '@/utils/schemaValidationApi'

function empty(s: string | null | undefined): boolean {
  return s == null || String(s).trim() === ''
}

function pushFormatError(errors: string[], path: string, fieldKey: string, value: string | undefined): void {
  const msg = validateFieldValue(fieldKey, value ?? '')
  if (!msg) return
  const lastSegment = path.split(' → ').pop()?.trim() ?? ''
  const prefix = lastSegment ? `${lastSegment}: ` : ''
  const displayMsg = prefix && msg.startsWith(prefix) ? msg.slice(prefix.length) : msg
  errors.push(path ? `${path}: ${displayMsg}` : displayMsg)
}

function getMeasureImplementationSubjects(impl: MeasureImplementationItem): SubjectDetails[] {
  if (impl.subjectDetailsList && impl.subjectDetailsList.length > 0) {
    return impl.subjectDetailsList
  }
  return impl.subjectDetails ? [impl.subjectDetails] : []
}

/**
 * SES2025-314: идентификатор субъекта и метод идентификации заполняются одновременно или оба отсутствуют.
 */
export function collectDprSubjectIdentifierPairingErrors(measures: MeasuresData | null | undefined): string[] {
  const errors: string[] = []
  const measuresList = measures?.measures ?? []
  for (let mi = 0; mi < measuresList.length; mi++) {
    const impls = measuresList[mi]?.measureImplementationDetails ?? []
    for (let ii = 0; ii < impls.length; ii++) {
      const subjects = getMeasureImplementationSubjects(impls[ii])
      for (let si = 0; si < subjects.length; si++) {
        const entity = subjects[si]?.businessEntity
        if (!entity) continue
        const id = (entity.businessEntityId ?? '').trim()
        const method = (entity.identificationMethod ?? '').trim()
        if (!id && !method) continue
        const scope =
          subjects.length > 1
            ? `Принятые меры → Мера ${mi + 1} → Реализация ${ii + 1} → Субъект ${si + 1}`
            : `Принятые меры → Мера ${mi + 1} → Реализация ${ii + 1} → Субъект-исполнитель`
        if (id && !method) {
          errors.push(`${scope}: если указан идентификатор субъекта, должен быть указан метод идентификации`)
        }
        if (method && !id) {
          errors.push(`${scope}: если указан метод идентификации, должен быть указан идентификатор субъекта`)
        }
      }
    }
  }
  return errors
}

/** Перед сохранением в БД: только логика SES2025-314 (без прочих обязательных полей «Валидация карты»). */
export function collectDprSaveLogicalErrors(parsed: DprParsedBundle): string[] {
  return collectDprSubjectIdentifierPairingErrors(parsed.measures)
}

/**
 * Перед сохранением в БД: несоответствия типов, длины и шаблонов XSD для заполненных полей.
 */
export function collectDprFormatValidationErrors(parsed: DprParsedBundle): string[] {
  const errors: string[] = []

  const measuresOnly = collectFormatValidationErrors({ measures: parsed.measures } as CardData).errors
  errors.push(...measuresOnly)

  const auth = parsed.notifyingAuthority
  pushFormatError(errors, 'Уполномоченный орган → Наименование', 'authorityName', auth?.name)
  pushFormatError(errors, 'Уполномоченный орган → Краткое наименование', 'authorityBriefName', auth?.shortName)
  if ((auth?.identifier ?? '').trim()) {
    pushFormatError(errors, 'Уполномоченный орган → Идентификатор', 'authorityId', auth?.identifier)
  }

  const rawDesc = parsed.resultDescription ?? ''
  if (rawDesc.length > 0) {
    pushFormatError(errors, 'Описание результатов', 'dprResultDescription', rawDesc)
  }

  ;(parsed.resultDocuments ?? []).forEach((row, i) => {
    const p = `Документы с описанием результатов → Документ ${i + 1}`
    pushFormatError(errors, `${p} → Наименование`, 'docName', row.docName)
    pushFormatError(errors, `${p} → Номер`, 'docId', row.docId)
    pushFormatError(errors, `${p} → Серия`, 'measureDocDetailsDocSeriesId', row.docSeriesId)
    pushFormatError(errors, `${p} → Количество листов`, 'measureDocPageQuantity', row.pageQuantity)
    pushFormatError(errors, `${p} → Описание`, 'description', row.descriptionText)
    if ((row.authorityName ?? '').trim()) {
      pushFormatError(errors, `${p} → Наименование органа`, 'authorityName', row.authorityName)
    }
    if ((row.authorityId ?? '').trim()) {
      pushFormatError(errors, `${p} → Идентификатор органа`, 'authorityId', row.authorityId)
    }
  })

  const seen = new Set<string>()
  return errors.filter((e) => {
    if (seen.has(e)) return false
    seen.add(e)
    return true
  })
}

/** Форматно-логические контроли по разделам (без XSD). Используется в «Валидация карты» и перед направлением в ОП 57. */
export function validateDprFormatLogical(parsed: DprParsedBundle): ValidationResult {
  const sections: { sectionName: string; remarks: string[] }[] = []

  const measuresRes = validateOutgoingMeasuresLikeDpa(parsed.measures)
  if (!measuresRes.success) {
    sections.push(...measuresRes.sections)
  }

  const pairing = collectDprSubjectIdentifierPairingErrors(parsed.measures)
  if (pairing.length > 0) {
    const measuresSection = sections.find((s) => s.sectionName === 'Принятые меры')
    if (measuresSection) {
      measuresSection.remarks.push(...pairing)
    } else {
      sections.push({ sectionName: 'Принятые меры', remarks: pairing })
    }
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
 * Полная проверка («Валидация карты», направление в ОП 57):
 * форматно-логический → несоответствие формату → структурный (XSD).
 */
export async function validateDprOutgoingCardFull(parsed: DprParsedBundle, xml: string): Promise<ValidationResult> {
  const logical = validateDprFormatLogical(parsed)
  if (!logical.success) {
    return logical
  }

  const formatErrors = collectDprFormatValidationErrors(parsed)
  if (formatErrors.length > 0) {
    return {
      success: false,
      sections: [{ sectionName: 'Несоответствие данных формату', remarks: formatErrors }],
    }
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
