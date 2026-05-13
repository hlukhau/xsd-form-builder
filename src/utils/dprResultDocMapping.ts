import type { MeasureDocDetails } from '@/types/card'
import type { DprResultDocRow } from '@/types/dprCard'

/** Пустая строка документа для добавления в форме DPR. */
export function emptyDprResultDocRow(): DprResultDocRow {
  return {
    countryCode: '',
    languageCode: 'ru',
    docKindCode: undefined,
    docKindCodeListId: undefined,
    docKindName: undefined,
    docName: '',
    docSeriesId: '',
    docId: '',
    docCreationDate: '',
    docStartDate: '',
    docValidityDate: '',
    docValidityDuration: '',
    authorityId: '',
    authorityName: '',
    descriptionText: '',
    pageQuantity: '',
    docBinaryText: '',
    docBinaryMediaTypeCode: undefined,
    anyDetailsXml: undefined,
  }
}

export function dprResultDocRowToMeasureDocDetails(row: DprResultDocRow): MeasureDocDetails {
  const bin = row.docBinaryText?.trim()
  return {
    country: row.countryCode?.trim() || undefined,
    languageCode: row.languageCode?.trim() || undefined,
    docKindCode: row.docKindCode,
    docKindCodeListId: row.docKindCodeListId,
    docKindName: row.docKindName,
    docName: row.docName,
    docSeriesId: row.docSeriesId,
    docId: row.docId,
    docCreationDate: row.docCreationDate,
    docStartDate: row.docStartDate,
    docValidityDate: row.docValidityDate,
    docValidityDuration: row.docValidityDuration,
    authorityId: row.authorityId?.trim() || undefined,
    authorityName: row.authorityName?.trim() || undefined,
    description: row.descriptionText?.trim() || undefined,
    pageQuantity: row.pageQuantity?.trim() || undefined,
    xmlDocument: row.anyDetailsXml?.trim() || undefined,
    docBinaryText: bin ? { content: bin, mediaTypeCode: row.docBinaryMediaTypeCode } : undefined,
  }
}

export function measureDocDetailsToDprResultDocRow(doc: MeasureDocDetails): DprResultDocRow {
  return {
    countryCode: doc.country?.trim() ?? '',
    languageCode: doc.languageCode?.trim() ?? '',
    docKindCode: doc.docKindCode,
    docKindCodeListId: doc.docKindCodeListId,
    docKindName: doc.docKindName,
    docName: doc.docName ?? '',
    docSeriesId: doc.docSeriesId ?? '',
    docId: doc.docId ?? '',
    docCreationDate: doc.docCreationDate ?? '',
    docStartDate: doc.docStartDate ?? '',
    docValidityDate: doc.docValidityDate ?? '',
    docValidityDuration: doc.docValidityDuration ?? '',
    authorityId: doc.authorityId?.trim() ?? '',
    authorityName: doc.authorityName?.trim() ?? '',
    descriptionText: doc.description ?? '',
    pageQuantity: doc.pageQuantity ?? '',
    docBinaryText: doc.docBinaryText?.content?.trim() ?? '',
    docBinaryMediaTypeCode: doc.docBinaryText?.mediaTypeCode,
    anyDetailsXml: doc.xmlDocument?.trim() || undefined,
  }
}

const s = (v: string | undefined) => (v ?? '').trim()

/** Есть ли содержимое для вывода ccdo:DocContentDetails в XML. */
export function hasDprResultDocRowContent(row: DprResultDocRow): boolean {
  if (
    s(row.countryCode) ||
    s(row.languageCode) ||
    s(row.docKindCode) ||
    s(row.docKindName) ||
    s(row.docName) ||
    s(row.docSeriesId) ||
    s(row.docId) ||
    s(row.docCreationDate) ||
    s(row.docStartDate) ||
    s(row.docValidityDate) ||
    s(row.docValidityDuration) ||
    s(row.authorityId) ||
    s(row.authorityName) ||
    s(row.descriptionText) ||
    s(row.pageQuantity)
  ) {
    return true
  }
  if (s(row.docBinaryText)) return true
  if (s(row.anyDetailsXml)) return true
  return false
}
