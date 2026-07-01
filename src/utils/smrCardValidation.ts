/**
 * Валидация исходящей карты SMR.
 */
import type { SmrParsedBundle } from '@/types/smrCard'
import type { MeasureImplementationItem, MeasuresData, SubjectDetails } from '@/types/card'
import type { ValidationResult } from '@/utils/cardValidation'
import { pushMeasuresFormatErrors, validateDprMeasuresFormatLogical } from '@/utils/cardValidation'
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

function measureImplementationsToMeasuresData(
  items: MeasureImplementationItem[] | null | undefined
): MeasuresData {
  return { measures: [{ measureImplementationDetails: items ?? [] }] }
}

/** SES2025-314 для мероприятий SMR. */
export function collectSmrSubjectIdentifierPairingErrors(
  items: MeasureImplementationItem[] | null | undefined
): string[] {
  const errors: string[] = []
  const impls = items ?? []
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
          ? `Мероприятия → Мероприятие ${ii + 1} → Субъект ${si + 1}`
          : `Мероприятия → Мероприятие ${ii + 1} → Субъект-исполнитель`
      if (id && !method) {
        errors.push(`${scope}: если указан идентификатор субъекта, должен быть указан метод идентификации`)
      }
      if (method && !id) {
        errors.push(`${scope}: если указан метод идентификации, должен быть указан идентификатор субъекта`)
      }
    }
  }
  return errors
}

export function collectSmrSaveLogicalErrors(parsed: SmrParsedBundle): string[] {
  return collectSmrSubjectIdentifierPairingErrors(parsed.measureImplementations)
}

export function collectSmrFormatValidationErrors(parsed: SmrParsedBundle): string[] {
  const errors: string[] = []

  pushMeasuresFormatErrors(errors, measureImplementationsToMeasuresData(parsed.measureImplementations), true)

  const auth = parsed.respondingAuthority
  pushFormatError(errors, 'Уведомление → Уполномоченный орган → Наименование', 'authorityName', auth?.name)
  if ((auth?.identifier ?? '').trim()) {
    pushFormatError(errors, 'Уполномоченный орган → Идентификатор', 'authorityId', auth?.identifier)
  }

  const doc = parsed.measureDoc
  pushFormatError(errors, 'Уведомление → Документ меры → Наименование', 'docName', doc?.docName)
  if ((doc?.docId ?? '').trim()) {
    pushFormatError(errors, 'Уведомление → Документ меры → Номер', 'docId', doc?.docId)
  }

  const seen = new Set<string>()
  return errors.filter((e) => {
    if (seen.has(e)) return false
    seen.add(e)
    return true
  })
}

export function validateSmrFormatLogical(parsed: SmrParsedBundle): ValidationResult {
  const sections: { sectionName: string; remarks: string[] }[] = []

  const measuresRes = validateDprMeasuresFormatLogical(
    measureImplementationsToMeasuresData(parsed.measureImplementations)
  )
  if (!measuresRes.success) {
    const renamed = measuresRes.sections.map((s) => ({
      ...s,
      sectionName: s.sectionName === 'Принятые меры' ? 'Мероприятия' : s.sectionName,
    }))
    sections.push(...renamed)
  }

  const pairing = collectSmrSubjectIdentifierPairingErrors(parsed.measureImplementations)
  if (pairing.length > 0) {
    const measuresSection = sections.find((s) => s.sectionName === 'Мероприятия')
    if (measuresSection) {
      measuresSection.remarks.push(...pairing)
    } else {
      sections.push({ sectionName: 'Мероприятия', remarks: pairing })
    }
  }

  const auth = parsed.respondingAuthority
  const secNotification = { sectionName: 'Уведомление', remarks: [] as string[] }
  if (empty(auth?.country)) {
    secNotification.remarks.push('Должен быть указан код страны уполномоченного органа')
  }
  if (empty(auth?.name)) {
    secNotification.remarks.push('Наименование уполномоченного органа должно быть указано')
  }
  const doc = parsed.measureDoc
  if (empty(doc?.country)) {
    secNotification.remarks.push('Должен быть указан код страны по исходному документу меры')
  }
  if (empty(doc?.docId)) {
    secNotification.remarks.push('Должен быть указан номер исходного документа меры')
  }
  if (empty(doc?.docCreationDate)) {
    secNotification.remarks.push('Должна быть указана дата формирования исходного документа меры')
  }
  if (secNotification.remarks.length) sections.push(secNotification)

  const total = sections.reduce((n, s) => n + s.remarks.length, 0)
  return { success: total === 0, sections }
}

function isSmrResultSectionStructuralRemark(remark: string): boolean {
  const s = remark.toLowerCase()
  if (s.includes('doccontentdetails')) return true
  if (s.includes('описание результатов')) return true
  if (s.includes('descriptiontext') && !s.includes('мероприят')) return true
  if (s.includes('текстовое описание') && !s.includes('мероприят')) return true
  return false
}

function isSmrAuthorityBriefNameRemark(remark: string): boolean {
  const s = remark.toLowerCase()
  return (
    s.includes('authoritybriefname') ||
    s.includes('краткое наименование уполномоченного') ||
    s.includes('краткое наименование органа')
  )
}

function normalizeSmrStructuralRemark(remark: string): string | null {
  const t = remark.trim()
  if (!t) return null
  if (isSmrResultSectionStructuralRemark(t)) return null
  if (isSmrAuthorityBriefNameRemark(t)) return null
  if (
    /наименование уполномоченного органа должно быть указано/i.test(t) ||
    /должно быть указано.*наименование.*уполномоченн/i.test(t) ||
    (/authorityname|наименование органа/i.test(t) && /уполномоченн/i.test(t))
  ) {
    return 'Наименование уполномоченного органа должно быть указано'
  }
  return t.replace(/\s*\([^)]*authorityname[^)]*\)/gi, '').trim() || null
}

export async function validateSmrOutgoingCardFull(parsed: SmrParsedBundle, xml: string): Promise<ValidationResult> {
  const logical = validateSmrFormatLogical(parsed)
  if (!logical.success) {
    return logical
  }

  const formatErrors = collectSmrFormatValidationErrors(parsed)
  if (formatErrors.length > 0) {
    return {
      success: false,
      sections: [{ sectionName: 'Несоответствие данных формату', remarks: formatErrors }],
    }
  }

  let xsdRemarks: string[] = []
  try {
    xsdRemarks = await fetchSchemaValidationErrors(xml, 'smr')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      success: false,
      sections: [{ sectionName: 'Структурный контроль', remarks: [`Не удалось выполнить структурный контроль: ${msg}`] }],
    }
  }
  if (xsdRemarks.length > 0) {
    const filtered = xsdRemarks
      .map((r) => normalizeSmrStructuralRemark(r))
      .filter((r): r is string => !!r)
    const unique = [...new Set(filtered)]
    if (unique.length > 0) {
      return {
        success: false,
        sections: [{ sectionName: 'Структурный контроль', remarks: unique }],
      }
    }
  }
  return { success: true, sections: [] }
}
