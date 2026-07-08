import { normalizeXmlNamespaces, SMA_CANONICAL_XML_NAMESPACES } from '@/utils/xmlNamespaceNormalizer'
import { getTextContent } from '@/utils/xmlParser'
import type { ElectronicDocument } from '@/types/card'
import type {
  SmaParsedBundle,
  SmaDocRow,
  SmaMeasureDocReference,
  SmaIncidentAlert,
} from '@/types/smaCard'

const NS_DOC = 'urn:EEC:R:SM:SS:09:AdditionalInfoDetails:v1.0.0'
const NS_CCDO = 'urn:EEC:M:ComplexDataObjects:v0.4.12'
const NS_SMCDO = 'urn:EEC:M:SM:ComplexDataObjects:v0.3.9'

function findRootDetails(xmlDoc: Document): Element | null {
  try {
    const list = xmlDoc.getElementsByTagNameNS(NS_DOC, 'AdditionalInfoDetails')
    if (list.length > 0) return list[0]
  } catch {
    /* ignore */
  }
  const all = xmlDoc.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === 'additionalinfodetails') return el
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
  return {
    messageCode: getTextContent(edocHeader, 'InfEnvelopeCode') || '',
    documentCode: getTextContent(edocHeader, 'EDocCode') || '',
    documentId: getTextContent(edocHeader, 'EDocId') || '',
    documentDate: getTextContent(edocHeader, 'EDocDateTime') || '',
    language: getTextContent(edocHeader, 'LanguageCode') || 'ru',
    sourceDocumentId: getTextContent(edocHeader, 'EDocRefId') || '',
    validityPeriod: { start: '', end: '' },
    updateDateTime: '',
  }
}

function parseAuthority(authority: Element | null): SmaParsedBundle['authority'] {
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

function parseMeasureDocReference(el: Element | null): SmaMeasureDocReference {
  if (!el) return {}
  return {
    country: getTextContent(el, 'UnifiedCountryCode') || undefined,
    docId: getTextContent(el, 'DocId') || undefined,
    docCreationDate: getTextContent(el, 'DocCreationDate')?.trim().slice(0, 10) || undefined,
  }
}

function parseIncidentAlert(inc: Element | null): SmaIncidentAlert {
  return {
    country: inc ? getTextContent(inc, 'UnifiedCountryCode') || '' : '',
    registrationNumber: inc ? getTextContent(inc, 'IncidentId') || '' : '',
    typeCode: inc ? getTextContent(inc, 'IncidentKindCode') || '' : '',
    formationDate: inc ? getTextContent(inc, 'DocCreationDate')?.trim().slice(0, 10) || '' : '',
  }
}

function parseDocContentRow(el: Element): SmaDocRow {
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
 * Разбор XML карты SMAQ/SMAR (EEC_R_SM_SS_09_AdditionalInfoDetails_v1.0.0).
 */
export function parseSmaXmlToBundle(xmlText: string): SmaParsedBundle {
  const normalized = normalizeXmlNamespaces(xmlText, SMA_CANONICAL_XML_NAMESPACES)
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(normalized, 'text/xml')
  const err = xmlDoc.querySelector('parsererror')
  if (err) {
    throw new Error(err.textContent || 'Ошибка разбора XML SMA')
  }
  const root = findRootDetails(xmlDoc)
  if (!root) {
    throw new Error('Не найден элемент AdditionalInfoDetails')
  }

  const edoc =
    findFirstChildByLocalName(root, 'EDocHeader') ?? xmlDoc.getElementsByTagNameNS(NS_CCDO, 'EDocHeader')[0]
  const electronicDocument = parseEdocHeader(edoc)

  const authority =
    findFirstChildByLocalName(root, 'UnifiedAuthorityDetails') ??
    xmlDoc.getElementsByTagNameNS(NS_CCDO, 'UnifiedAuthorityDetails')[0]
  const authorityParsed = parseAuthority(authority)

  const incidentEl =
    findFirstChildByLocalName(root, 'IncidentAlertIdDetails') ??
    root.getElementsByTagNameNS(NS_SMCDO, 'IncidentAlertIdDetails')[0] ??
    null
  const incidentAlert = parseIncidentAlert(incidentEl)

  const measureCountryCode = getDirectChildText(root, 'UnifiedCountryCode')

  const measureDocEl =
    findFirstChildByLocalName(root, 'MeasureDocReferenceDetails') ??
    root.getElementsByTagNameNS(NS_SMCDO, 'MeasureDocReferenceDetails')[0] ??
    null
  const measureDocReference = parseMeasureDocReference(measureDocEl)

  const desc = getDirectChildText(root, 'DescriptionText')
  const sanitaryProductTypeCode = getDirectChildText(root, 'SanitaryProductTypeCode')
  const productName = getDirectChildText(root, 'ProductName')
  const laboratoryTestMethodName = getDirectChildText(root, 'LaboratoryTestMethodName')

  const documents: SmaDocRow[] = []
  try {
    const docNodes = root.getElementsByTagNameNS(NS_CCDO, 'DocContentDetails')
    for (let i = 0; i < docNodes.length; i++) {
      if (docNodes[i].parentElement === root) {
        documents.push(parseDocContentRow(docNodes[i]))
      }
    }
  } catch {
    /* ignore */
  }
  if (documents.length === 0) {
    for (let i = 0; i < root.children.length; i++) {
      const el = root.children[i]
      const ln = (el.localName || '').toLowerCase()
      if (ln === 'doccontentdetails') {
        documents.push(parseDocContentRow(el as Element))
      }
    }
  }

  return {
    electronicDocument,
    authority: authorityParsed,
    measureCountryCode,
    measureDocReference,
    incidentAlert,
    descriptionText: desc,
    sanitaryProductTypeCode,
    productName,
    laboratoryTestMethodName,
    documents,
  }
}
