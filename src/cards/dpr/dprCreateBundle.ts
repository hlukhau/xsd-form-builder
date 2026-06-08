import type { DprParsedBundle, DprPrepareContext, DprResultDocRow } from '@/types/dprCard'
import type { MeasuresData } from '@/types/card'

/** Собрать тело DPR для экспорта в XML при создании черновика из PPV. */
export function buildDprCreateBundle(
  eligibility: DprPrepareContext,
  auth: {
    country: string
    authorityUid?: string
    name: string
    shortName: string
  },
  descriptionText: string,
  measures: MeasuresData,
  documents: DprResultDocRow[]
): DprParsedBundle {
  const responseCountry = (auth.country || eligibility.responseCountryCode || 'BY').trim()
  return {
    electronicDocument: {
      messageCode: 'P.SS.08.MSG.018',
      documentCode: 'R.SM.SS.08.003',
      documentId: '',
      documentDate: new Date().toISOString(),
      language: 'ru',
      sourceDocumentId: '',
      validityPeriod: { start: '', end: '' },
      updateDateTime: '',
    },
    notifyingAuthority: {
      country: responseCountry,
      identifier: auth.authorityUid?.trim() ?? '',
      name: auth.name.trim(),
      shortName: auth.shortName.trim(),
    },
    incidentAlert: {
      country: (eligibility.alertCountryCode ?? '').trim(),
      registrationNumber: (eligibility.incidentId ?? '').trim(),
      typeCode: (eligibility.incidentKindCode ?? '').trim(),
      formationDate: (eligibility.docCreationDate ?? '').trim().slice(0, 10),
    },
    measures,
    resultDescription: descriptionText.trim() || null,
    resultDocuments: documents,
  }
}
