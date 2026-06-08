import { normalizeXmlNamespaces, DPR_CANONICAL_XML_NAMESPACES } from '@/utils/xmlNamespaceNormalizer'
import { getTextContent, parseMeasures } from '@/utils/xmlParser'
import type { ElectronicDocument, MeasuresData } from '@/types/card'
import type { DprParsedBundle, DprResultDocRow } from '@/types/dprCard'

const NS_DOC = 'urn:EEC:R:SM:SS:08:DangerousProductAlertResponse:v1.0.0'
const NS_CCDO = 'urn:EEC:M:ComplexDataObjects:v0.4.12'
const NS_SMCDO = 'urn:EEC:M:SM:ComplexDataObjects:v0.3.9'

function findRootDetails(xmlDoc: Document): Element | null {
  try {
    const list = xmlDoc.getElementsByTagNameNS(NS_DOC, 'DangerousProductAlertResponseDetails')
    if (list.length > 0) return list[0]
  } catch {
    /* ignore */
  }
  const all = xmlDoc.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const ns = el.namespaceURI || ''
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === 'dangerousproductalertresponsedetails' && (ns === NS_DOC || ns === '')) {
      return el
    }
  }
  return null
}

function findFirstChildByLocalName(parent: Element, localName: string): Element | null {
  const want = localName.toLowerCase()
  const children = parent.children
  for (let i = 0; i < children.length; i++) {
    const el = children[i]
    const ln = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (ln === want) return el as Element
  }
  return null
}

/** Текст только у прямого потомка (не у вложенных мер/документов). */
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
  const findByName = (parent: Element | null, local: string): Element | null => {
    if (!parent) return null
    const w = local.toLowerCase()
    try {
      const byNs = parent.getElementsByTagNameNS('*', local)
      if (byNs.length > 0) return byNs[0]
    } catch {
      /* ignore */
    }
    const all = parent.getElementsByTagName('*')
    for (let i = 0; i < all.length; i++) {
      const el = all[i]
      const ln = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
      if (ln === w) return el
    }
    return null
  }
  if (edocHeader) {
    let resourceStatus = findByName(edocHeader, 'ResourceItemStatusDetails')
    if (!resourceStatus) resourceStatus = findByName(edocHeader.parentElement as Element, 'ResourceItemStatusDetails')
    let validityPeriod: Element | null = null
    if (resourceStatus) {
      validityPeriod = findByName(resourceStatus, 'ValidityPeriodDetails')
    }
    const startDateTime = (validityPeriod ? getTextContent(validityPeriod, 'StartDateTime') : null)?.trim() || ''
    const endDateTime = (validityPeriod ? getTextContent(validityPeriod, 'EndDateTime') : null)?.trim() || ''
    const updateDateTime = (resourceStatus ? getTextContent(resourceStatus, 'UpdateDateTime') : null)?.trim() || ''
    if (startDateTime) electronicDocument.validityPeriod.start = startDateTime
    if (endDateTime) electronicDocument.validityPeriod.end = endDateTime
    if (updateDateTime) electronicDocument.updateDateTime = updateDateTime
  }
  return electronicDocument
}

function parseUnifiedAuthority(authority: Element | null): DprParsedBundle['notifyingAuthority'] {
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

function parseIncidentAlert(inc: Element | null): DprParsedBundle['incidentAlert'] {
  const formation = inc ? getTextContent(inc, 'DocCreationDate')?.trim().slice(0, 10) || '' : ''
  return {
    country: inc ? getTextContent(inc, 'UnifiedCountryCode') || '' : '',
    registrationNumber: inc ? getTextContent(inc, 'IncidentId') || '' : '',
    typeCode: inc ? getTextContent(inc, 'IncidentKindCode') || '' : '',
    formationDate: formation,
  }
}

function parseDocContentRow(el: Element): DprResultDocRow {
  const docKindEl = Array.from(el.getElementsByTagName('*')).find(
    (n) => (n.localName || '').toLowerCase() === 'dockindcode'
  )
  const docKindCode = docKindEl?.textContent?.trim() || ''
  const docKindCodeListId = docKindEl?.getAttribute('codeListId')?.trim() || undefined
  const docKindName = getTextContent(el, 'DocKindName')?.trim() || ''
  const docBinaryEl = Array.from(el.getElementsByTagName('*')).find(
    (n) => (n.localName || '').toLowerCase() === 'docbinarytext'
  )
  const anyDetailsEl = Array.from(el.getElementsByTagName('*')).find(
    (n) => (n.localName || '').toLowerCase() === 'anydetails'
  )
  let anyXml: string | undefined
  if (anyDetailsEl) {
    anyXml = anyDetailsEl.innerHTML?.trim() || anyDetailsEl.textContent?.trim() || undefined
  }
  return {
    countryCode: getTextContent(el, 'UnifiedCountryCode') || '',
    languageCode: getTextContent(el, 'LanguageCode') || '',
    docKindCode: docKindCode || undefined,
    docKindCodeListId,
    docKindName: docKindName || undefined,
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
    anyDetailsXml: anyXml,
  }
}

/**
 * Разбор XML карты DPR (EEC_R_SM_SS_08_DangerousProductAlertResponse_v1.0.0) по URI пространств имён.
 */
export function parseDprXmlToBundle(xmlText: string): DprParsedBundle {
  const normalized = normalizeXmlNamespaces(xmlText, DPR_CANONICAL_XML_NAMESPACES)
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(normalized, 'text/xml')
  const err = xmlDoc.querySelector('parsererror')
  if (err) {
    throw new Error(err.textContent || 'Ошибка разбора XML DPR')
  }
  const root = findRootDetails(xmlDoc)
  if (!root) {
    throw new Error('Не найден элемент DangerousProductAlertResponseDetails')
  }

  const edoc =
    findFirstChildByLocalName(root, 'EDocHeader') ?? xmlDoc.getElementsByTagNameNS(NS_CCDO, 'EDocHeader')[0]
  const electronicDocument = parseEdocHeader(edoc)

  const authority =
    findFirstChildByLocalName(root, 'UnifiedAuthorityDetails') ??
    xmlDoc.getElementsByTagNameNS(NS_CCDO, 'UnifiedAuthorityDetails')[0]
  const notifyingAuthority = parseUnifiedAuthority(authority)

  const incident =
    findFirstChildByLocalName(root, 'IncidentAlertIdDetails') ??
    root.getElementsByTagNameNS(NS_SMCDO, 'IncidentAlertIdDetails')[0] ??
    null
  const incidentAlert = parseIncidentAlert(incident)

  const measuresBlock: MeasuresData = parseMeasures(root, root) ?? { measures: [] }

  // Описание результатов — прямой потомок корня; getTextContent находил бы DescriptionText из мер/документов.
  const desc = getDirectChildText(root, 'DescriptionText')

  const resultDocuments: DprResultDocRow[] = []
  try {
    const docNodes = root.getElementsByTagNameNS(NS_CCDO, 'DocContentDetails')
    for (let i = 0; i < docNodes.length; i++) {
      resultDocuments.push(parseDocContentRow(docNodes[i]))
    }
  } catch {
    /* ignore */
  }
  if (resultDocuments.length === 0) {
    const all = root.getElementsByTagName('*')
    for (let i = 0; i < all.length; i++) {
      const el = all[i]
      const ln = (el.localName || '').toLowerCase()
      if (ln === 'doccontentdetails' && el.parentElement === root) {
        resultDocuments.push(parseDocContentRow(el))
      }
    }
  }

  return {
    electronicDocument,
    notifyingAuthority,
    incidentAlert,
    measures: measuresBlock,
    resultDescription: desc,
    resultDocuments,
  }
}
