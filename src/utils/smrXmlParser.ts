import { normalizeXmlNamespaces, SMR_CANONICAL_XML_NAMESPACES } from '@/utils/xmlNamespaceNormalizer'
import { getTextContent, parseMeasureImplementationDetailsFromParent } from '@/utils/xmlParser'
import type { ElectronicDocument, MeasureDocDetails } from '@/types/card'
import type { SmrParsedBundle, SmrResultDocRow } from '@/types/smrCard'

const NS_DOC = 'urn:EEC:R:SM:SS:09:SanitaryMeasureConsideration:v1.0.0'
const NS_CCDO = 'urn:EEC:M:ComplexDataObjects:v0.4.12'
const NS_SMCDO = 'urn:EEC:M:SM:ComplexDataObjects:v0.3.9'

function findRootDetails(xmlDoc: Document): Element | null {
  try {
    const list = xmlDoc.getElementsByTagNameNS(NS_DOC, 'SanitaryMeasureConsiderationDetails')
    if (list.length > 0) return list[0]
  } catch {
    /* ignore */
  }
  const all = xmlDoc.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === 'sanitarymeasureconsiderationdetails') return el
  }
  return null
}

function findFirstChildByLocalName(parent: Element, localName: string): Element | null {
  const want = localName.toLowerCase()
  for (let i = 0; i < parent.children.length; i++) {
    const el = parent.children[i]
    const ln = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (ln === want) return el as Element
  }
  return null
}

function getDirectChildText(parent: Element, localName: string): string | null {
  const child = findFirstChildByLocalName(parent, localName)
  if (!child) return null
  const text = child.textContent?.trim()
  return text || null
}

function parseEdocHeader(edocHeader: Element | null): ElectronicDocument {
  const electronicDocument: ElectronicDocument = {
    messageCode: getTextContent(edocHeader, 'InfEnvelopeCode') || '',
    documentCode: getTextContent(edocHeader, 'EDocCode') || '',
    documentId: getTextContent(edocHeader, 'EDocId') || '',
    documentDate: getTextContent(edocHeader, 'EDocDateTime') || '',
    language: getTextContent(edocHeader, 'LanguageCode') || 'ru',
    sourceDocumentId: getTextContent(edocHeader, 'EDocRefId') || '',
    validityPeriod: { start: '', end: '' },
    updateDateTime: '',
  }
  return electronicDocument
}

function parseUnifiedAuthority(authority: Element | null): SmrParsedBundle['respondingAuthority'] {
  return {
    country: authority ? getTextContent(authority, 'UnifiedCountryCode') || '' : '',
    identifier: authority ? getTextContent(authority, 'AuthorityId') || '' : '',
    name: authority ? getTextContent(authority, 'AuthorityName') || '' : '',
    shortName:
      authority
        ? getTextContent(authority, 'AuthorityBriefName') || getTextContent(authority, 'AuthorityShortName') || ''
        : '',
  }
}

function parseMeasureDoc(el: Element | null): MeasureDocDetails {
  if (!el) return {}
  return {
    country: getTextContent(el, 'UnifiedCountryCode') || undefined,
    languageCode: getTextContent(el, 'LanguageCode') || undefined,
    docKindName: getTextContent(el, 'DocKindName') || undefined,
    docName: getTextContent(el, 'DocName') || undefined,
    docSeriesId: getTextContent(el, 'DocSeriesId') || undefined,
    docId: getTextContent(el, 'DocId') || undefined,
    docCreationDate: getTextContent(el, 'DocCreationDate') || undefined,
    docStartDate: getTextContent(el, 'DocStartDate') || undefined,
    docValidityDate: getTextContent(el, 'DocValidityDate') || undefined,
    docValidityDuration: getTextContent(el, 'DocValidityDuration') || undefined,
    authorityId: getTextContent(el, 'AuthorityId') || undefined,
    authorityName: getTextContent(el, 'AuthorityName') || undefined,
    description: getTextContent(el, 'DescriptionText') || undefined,
    pageQuantity: getTextContent(el, 'PageQuantity') || undefined,
  }
}

function parseDocContentRow(el: Element): SmrResultDocRow {
  const docKindEl = Array.from(el.getElementsByTagName('*')).find(
    (n) => (n.localName || '').toLowerCase() === 'dockindcode'
  )
  const docBinaryEl = Array.from(el.getElementsByTagName('*')).find(
    (n) => (n.localName || '').toLowerCase() === 'docbinarytext'
  )
  const anyDetailsEl = Array.from(el.getElementsByTagName('*')).find(
    (n) => (n.localName || '').toLowerCase() === 'anydetails'
  )
  return {
    countryCode: getTextContent(el, 'UnifiedCountryCode') || '',
    languageCode: getTextContent(el, 'LanguageCode') || '',
    docKindCode: docKindEl?.textContent?.trim() || undefined,
    docKindCodeListId: docKindEl?.getAttribute('codeListId')?.trim() || undefined,
    docKindName: getTextContent(el, 'DocKindName')?.trim() || undefined,
    docName: getTextContent(el, 'DocName') || '',
    docSeriesId: getTextContent(el, 'DocSeriesId') || '',
    docId: getTextContent(el, 'DocId') || '',
    docCreationDate: getTextContent(el, 'DocCreationDate') || '',
    docStartDate: getTextContent(el, 'DocStartDate') || '',
    docValidityDate: getTextContent(el, 'DocValidityDate') || '',
    docValidityDuration: getTextContent(el, 'DocValidityDuration') || '',
    authorityId: getTextContent(el, 'AuthorityId') || '',
    authorityName: getTextContent(el, 'AuthorityName') || '',
    descriptionText: getTextContent(el, 'DescriptionText') || '',
    pageQuantity: getTextContent(el, 'PageQuantity') || '',
    docBinaryText: docBinaryEl?.textContent?.trim() || '',
    docBinaryMediaTypeCode: docBinaryEl?.getAttribute('mediaTypeCode')?.trim() || undefined,
    anyDetailsXml: anyDetailsEl?.innerHTML?.trim() || anyDetailsEl?.textContent?.trim() || undefined,
  }
}

/**
 * Разбор XML карты SMR (EEC_R_SM_SS_09_SanitaryMeasureConsideration_v1.0.0).
 */
export function parseSmrXmlToBundle(xmlText: string): SmrParsedBundle {
  const normalized = normalizeXmlNamespaces(xmlText, SMR_CANONICAL_XML_NAMESPACES)
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(normalized, 'text/xml')
  const err = xmlDoc.querySelector('parsererror')
  if (err) {
    throw new Error(err.textContent || 'Ошибка разбора XML SMR')
  }
  const root = findRootDetails(xmlDoc)
  if (!root) {
    throw new Error('Не найден элемент SanitaryMeasureConsiderationDetails')
  }

  const edoc =
    findFirstChildByLocalName(root, 'EDocHeader') ?? xmlDoc.getElementsByTagNameNS(NS_CCDO, 'EDocHeader')[0]
  const electronicDocument = parseEdocHeader(edoc)

  const authority =
    findFirstChildByLocalName(root, 'UnifiedAuthorityDetails') ??
    xmlDoc.getElementsByTagNameNS(NS_CCDO, 'UnifiedAuthorityDetails')[0]
  const respondingAuthority = parseUnifiedAuthority(authority)

  const measureDocEl =
    findFirstChildByLocalName(root, 'MeasureDocDetails') ??
    root.getElementsByTagNameNS(NS_SMCDO, 'MeasureDocDetails')[0] ??
    null
  const measureDoc = parseMeasureDoc(measureDocEl)

  const measureImplementations = parseMeasureImplementationDetailsFromParent(root)

  const desc = getDirectChildText(root, 'DescriptionText')

  const resultDocuments: SmrResultDocRow[] = []
  try {
    const docNodes = root.getElementsByTagNameNS(NS_CCDO, 'DocContentDetails')
    for (let i = 0; i < docNodes.length; i++) {
      if (docNodes[i].parentElement === root) {
        resultDocuments.push(parseDocContentRow(docNodes[i]))
      }
    }
  } catch {
    /* ignore */
  }
  if (resultDocuments.length === 0) {
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i]
      const ln = (el.localName || '').toLowerCase()
      if (ln === 'doccontentdetails') {
        resultDocuments.push(parseDocContentRow(el as Element))
      }
    }
  }

  return {
    electronicDocument,
    respondingAuthority,
    measureDoc,
    measureImplementations,
    resultDescription: desc,
    resultDocuments,
  }
}
