import type { SmaParsedBundle, SmaCreateContext, SmaDocRow, SmarResponseKind } from '@/types/smaCard'
import {
  SMAR_ABSENT_PROCESSING_RESULT_CODE,
  SMAR_EDOCCODE_ABSENT,
  SMAR_EDOCCODE_INFO,
} from '@/constants/smarResponse'
import { defaultSmarAbsentResponseValue } from '@/cards/sma/SmarAbsentResponseFields'

/** Собрать тело SMA для экспорта в XML при создании черновика. */
export function buildSmaCreateBundle(
  context: SmaCreateContext,
  auth: {
    country: string
    authorityUid?: string
    name: string
    shortName: string
  },
  descriptionText: string,
  documents: SmaDocRow[],
  options?: {
    sanitaryProductTypeCode?: string
    productName?: string
    laboratoryTestMethodName?: string
    responseKind?: SmarResponseKind
    eventDateTime?: string | null
    processingResultV2Code?: string | null
  }
): SmaParsedBundle {
  const authCountry = (auth.country || context.requestCountryCode || 'BY').trim()
  const docCountry = (context.docCountryCode ?? '').trim()
  const isSmarAbsent = context.kind === 'smar' && options?.responseKind === 'absent'
  const edocCode = isSmarAbsent ? SMAR_EDOCCODE_ABSENT : SMAR_EDOCCODE_INFO
  const absentDefaults = defaultSmarAbsentResponseValue()

  return {
    electronicDocument: {
      messageCode: 'P.SS.09.MSG.019',
      documentCode: edocCode,
      documentId: '',
      documentDate: new Date().toISOString(),
      language: 'ru',
      sourceDocumentId: '',
      validityPeriod: { start: '', end: '' },
      updateDateTime: '',
    },
    eventDateTime: isSmarAbsent
      ? options?.eventDateTime?.trim() || absentDefaults.eventDateTime
      : null,
    processingResultV2Code: isSmarAbsent
      ? options?.processingResultV2Code?.trim() || SMAR_ABSENT_PROCESSING_RESULT_CODE
      : null,
    authority: {
      country: authCountry,
      identifier: auth.authorityUid?.trim() ?? '',
      name: auth.name.trim(),
      shortName: auth.shortName.trim(),
    },
    measureCountryCode: isSmarAbsent ? null : docCountry || null,
    measureDocReference: isSmarAbsent
      ? {}
      : {
          country: docCountry,
          docId: (context.docId ?? '').trim(),
          docCreationDate: (context.docCreationDate ?? '').trim().slice(0, 10),
        },
    incidentAlert: { country: '', registrationNumber: '', typeCode: '', formationDate: '' },
    descriptionText: descriptionText.trim() || null,
    sanitaryProductTypeCode: isSmarAbsent ? null : options?.sanitaryProductTypeCode?.trim() || null,
    productName: isSmarAbsent ? null : options?.productName?.trim() || null,
    laboratoryTestMethodName: isSmarAbsent ? null : options?.laboratoryTestMethodName?.trim() || null,
    documents: isSmarAbsent ? [] : documents,
  }
}

/** Преобразовать ответ eligibility в контекст создания. */
export function eligibilityToCreateContext(elig: {
  kind?: string
  smdid?: number
  smaqid?: number
  docId?: string | null
  docCountryCode?: string | null
  docCreationDate?: string | null
  requestCountryId?: number
  requestCountryCode?: string | null
  requestCountryName?: string | null
  draftStatusId?: number
  draftStatusName?: string | null
}): import('@/types/smaCard').SmaCreateContext | null {
  const kind = elig.kind === 'smar' ? 'smar' : elig.kind === 'smaq' ? 'smaq' : null
  if (!kind || elig.smdid == null || elig.draftStatusId == null) return null
  return {
    kind,
    smdid: elig.smdid,
    smaqid: elig.smaqid,
    docId: elig.docId ?? null,
    docCountryCode: elig.docCountryCode ?? null,
    docCreationDate: elig.docCreationDate ?? null,
    requestCountryId: elig.requestCountryId,
    requestCountryCode: elig.requestCountryCode ?? null,
    requestCountryName: elig.requestCountryName ?? null,
    draftStatusId: elig.draftStatusId,
    draftStatusName: elig.draftStatusName ?? null,
  }
}
