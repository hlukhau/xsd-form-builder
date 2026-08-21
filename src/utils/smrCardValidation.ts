/**
 * Валидация исходящей карты SMR.
 */
import type { SmrParsedBundle } from '@/types/smrCard'
import type {
  MeasureImplementationItem,
  MeasuresData,
  SubjectDetails,
  UnifiedAuthorityDetails,
} from '@/types/card'
import type { ValidationResult } from '@/utils/cardValidation'
import { pushMeasuresFormatErrors } from '@/utils/cardValidation'
import { validateFieldValue } from '@/constants/xsdFieldConstraints'
import { fetchSchemaValidationErrors } from '@/utils/schemaValidationApi'
import { remarkContactsIncomplete } from '@/utils/contactValidation'

function empty(s: string | null | undefined): boolean {
  return s == null || String(s).trim() === ''
}

function hasDocReferenceContent(doc: MeasureImplementationItem['documentDetails']): boolean {
  if (!doc) return false
  return !(
    empty(doc.docKindCode) &&
    empty(doc.docKindName) &&
    empty(doc.docName) &&
    empty(doc.docId) &&
    empty(doc.docCreationDate) &&
    empty(doc.docStartDate)
  )
}

function getMeasureSubjectContacts(sd: SubjectDetails) {
  const be = sd.businessEntity
  if (be?.contacts && be.contacts.length > 0) return be.contacts
  return sd.contacts ?? []
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

function getMeasureImplementationAuthorities(impl: MeasureImplementationItem): UnifiedAuthorityDetails[] {
  if (impl.authorities && impl.authorities.length > 0) return impl.authorities
  return impl.authority ? [impl.authority] : []
}

function measureExecutorSubjectCountry(sd: SubjectDetails): string | undefined {
  const v = sd.businessEntity?.country ?? sd.country
  if (v == null || String(v).trim() === '') return undefined
  return String(v).trim()
}

function measureExecutorSubjectName(sd: SubjectDetails): string | undefined {
  const v = sd.businessEntity?.businessEntityName ?? sd.subjectName
  if (v == null || String(v).trim() === '') return undefined
  return String(v).trim()
}

function measureImplementationsToMeasuresData(
  items: MeasureImplementationItem[] | null | undefined
): MeasuresData {
  return { measures: [{ measureImplementationDetails: items ?? [] }] }
}

/**
 * Форматно-логические контроли вкладки «Мероприятия» исходящей SMR
 * (smcdo:MeasureImplementationDetails), без проверок «принятой меры» DPA/DPR.
 */
export function validateSmrMeasuresFormatLogical(
  items: MeasureImplementationItem[] | null | undefined
): ValidationResult {
  const remarks: string[] = []
  const add = (msg: string) => {
    if (!remarks.includes(msg)) remarks.push(msg)
  }

  const impls = items ?? []
  if (impls.length === 0) {
    add(
      'должен быть указан хотя бы один набор сведений о мероприятии, обеспечивающем соблюдение меры'
    )
    return { success: false, sections: [{ sectionName: 'Мероприятия', remarks }] }
  }

  let anyMissingCore = false
  let anyMissingStartDate = false
  let anyMissingCountry = false
  let anyMissingDescription = false
  let anyMissingSubjectCountry = false
  let anyMissingSubjectName = false

  for (const impl of impls) {
    const hasEntity =
      getMeasureImplementationAuthorities(impl).length > 0 ||
      getMeasureImplementationSubjects(impl).length > 0
    const hasDoc = hasDocReferenceContent(impl.documentDetails)
    const hasKind = !empty(impl.measureAffectedObjectKindCode)
    const hasRegion = !empty(impl.placeDetails?.regionName)
    if (!hasEntity || !hasDoc || !hasKind || !hasRegion) {
      anyMissingCore = true
    }
    if (empty(impl.startDate)) {
      anyMissingStartDate = true
    }
    if (empty(impl.country)) {
      anyMissingCountry = true
    }
    if (empty(impl.description)) {
      anyMissingDescription = true
    }

    for (const authority of getMeasureImplementationAuthorities(impl)) {
      if (empty(authority.country)) {
        add('Страна уполномоченного органа, обеспечивающего соблюдение меры должна быть указана')
      }
      if (empty(authority.authorityName)) {
        add('Наименование уполномоченного органа, обеспечивающего соблюдение меры должно быть указано')
      }
    }

    for (const subj of getMeasureImplementationSubjects(impl)) {
      if (empty(measureExecutorSubjectCountry(subj))) anyMissingSubjectCountry = true
      if (empty(measureExecutorSubjectName(subj))) anyMissingSubjectName = true

      if (subj.identityDoc !== undefined) {
        if (empty(subj.identityDoc.country)) {
          add(
            'В составе сведений об удостоверении личности субъекта, обеспечивающего соблюдение меры должна быть указана страна'
          )
        }
        if (empty(subj.identityDoc.docId)) {
          add(
            'В составе сведений об удостоверении личности субъекта, обеспечивающего соблюдение меры должен быть указан номер документа'
          )
        }
      }

      const cr = remarkContactsIncomplete(getMeasureSubjectContacts(subj))
      if (cr) add(cr)
    }

    if (impl.documentDetails !== undefined) {
      if (empty(impl.documentDetails.docName)) {
        add(
          'В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должно быть указано его наименование'
        )
      }
      if (empty(impl.documentDetails.docId)) {
        add(
          'В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должен быть указан его номер'
        )
      }
      if (empty(impl.documentDetails.docCreationDate)) {
        add(
          'В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должна быть указана его дата'
        )
      }
    }
  }

  if (anyMissingCore) {
    add(
      'В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должны быть указаны сведения об исполнителе, документ, устанавливающий мероприятие, вид объекта действия меры и регион'
    )
  }
  if (anyMissingCountry) {
    add(
      'В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должна быть указана страна'
    )
  }
  if (anyMissingStartDate) {
    add(
      'В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должна быть указана дата начала мероприятия'
    )
  }
  if (anyMissingDescription) {
    add(
      'В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должно быть указано описание'
    )
  }
  if (anyMissingSubjectCountry) {
    add('Код страны регистрации субъекта, обеспечивающего соблюдение меры должен быть указан')
  }
  if (anyMissingSubjectName) {
    add('Наименование субъекта, обеспечивающего соблюдение меры должно быть указано')
  }

  if (remarks.length === 0) {
    return { success: true, sections: [] }
  }
  return { success: false, sections: [{ sectionName: 'Мероприятия', remarks }] }
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

  const measuresRes = validateSmrMeasuresFormatLogical(parsed.measureImplementations)
  if (!measuresRes.success) {
    sections.push(...measuresRes.sections)
  }

  const pairing = collectSmrSubjectIdentifierPairingErrors(parsed.measureImplementations)
  if (pairing.length > 0) {
    const measuresSection = sections.find((s) => s.sectionName === 'Мероприятия')
    if (measuresSection) {
      for (const msg of pairing) {
        if (!measuresSection.remarks.includes(msg)) measuresSection.remarks.push(msg)
      }
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
