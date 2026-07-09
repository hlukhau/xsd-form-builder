import type { SmrParsedBundle, SmrPrepareContext, SmrResultDocRow } from '@/types/smrCard'
import type { MeasureImplementationItem } from '@/types/card'

/** Собрать тело SMR для экспорта в XML при создании черновика из SMD. */
export function buildSmrCreateBundle(
  eligibility: SmrPrepareContext,
  auth: {
    country: string
    authorityUid?: string
    name: string
    shortName: string
  },
  descriptionText: string,
  measureImplementations: MeasureImplementationItem[],
  documents: SmrResultDocRow[]
): SmrParsedBundle {
  const responseCountry = (auth.country || eligibility.responseCountryCode || 'BY').trim()
  const docCountry = (eligibility.docCountryCode ?? '').trim()
  return {
    electronicDocument: {
      messageCode: 'P.SS.09.MSG.018',
      documentCode: 'R.SM.SS.09.003',
      documentId: '',
      documentDate: new Date().toISOString(),
      language: 'ru',
      sourceDocumentId: '',
      validityPeriod: { start: '', end: '' },
      updateDateTime: '',
    },
  respondingAuthority: {
    country: responseCountry,
    identifier: '',
    name: auth.name.trim(),
    shortName: auth.shortName.trim(),
  },
    measureDoc: {
      country: docCountry,
      docId: (eligibility.docId ?? '').trim(),
      messageCode: (eligibility.messageCode ?? '').trim() || undefined,
      docCreationDate: (eligibility.docCreationDate ?? '').trim().slice(0, 10),
    },
    measureImplementations,
    resultDescription: descriptionText.trim() || null,
    resultDocuments: documents,
  }
}
