/**
 * Парсер XML протоколов лабораторных исследований (LPXML).
 * Преобразует XML из таблицы LPXML в структурированные данные для отображения в форме.
 * Структура: smsdo:RegistrationCertificateId → smcdo:ProductDetails; протоколы с лабораторией (SubjectDetails, AccreditationCertificateDetails).
 */

import { getTextContent } from '@/utils/xmlParser'
import type {
  ProductDetails,
  TechnicalDocument,
  AddressDetails,
  LaboratoryProtocolsData,
  LaboratoryProtocol,
  LaboratoryDetails,
  AccreditationCertificateDetails,
} from '@/types/card'

function findByLocalName(parent: Element, localName: string): Element | null {
  const want = localName.toLowerCase()
  const all = parent.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === want) return el
  }
  return null
}

function findAllByLocalName(parent: Element, localName: string): Element[] {
  const want = localName.toLowerCase()
  const all = parent.getElementsByTagName('*')
  const out: Element[] = []
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === want) out.push(el)
  }
  return out
}

function getAttr(el: Element, name: string): string | undefined {
  return el.getAttribute(name) ?? el.getAttributeNS(null, name) ?? undefined
}

/** Текст только из первого прямого дочернего элемента с заданным локальным именем (чтобы не брать из вложенных LaboratoryDetails/AccreditationCertificateDetails). */
function getDirectChildText(parent: Element, localName: string): string | undefined {
  const want = localName.toLowerCase()
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i]
    if (node.nodeType !== 1) continue
    const el = node as Element
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === want) {
      const text = el.textContent?.trim()
      return text || undefined
    }
  }
  return undefined
}

function parseProductDetailsFromElement(el: Element): ProductDetails {
  const tradeNames = findAllByLocalName(el, 'ProductTradeName').map((n) => n.textContent?.trim() ?? '').filter(Boolean)
  const technicalDocs: TechnicalDocument[] = findAllByLocalName(el, 'TechnicalDocumentDetails').map((docEl) => ({
    docKindCode: getTextContent(docEl, 'DocKindCode') || undefined,
    docKindName: getTextContent(docEl, 'DocKindName') || undefined,
    docName: getTextContent(docEl, 'DocName') || undefined,
    docId: getTextContent(docEl, 'DocId') || undefined,
    docCreationDate: getTextContent(docEl, 'DocCreationDate') || undefined,
    docStartDate: getTextContent(docEl, 'DocStartDate') || undefined,
  }))
  return {
    productId: getTextContent(el, 'ProductId') || undefined,
    productName: getTextContent(el, 'ProductName') || undefined,
    tradeName: tradeNames[0],
    tradeNames: tradeNames.length ? tradeNames : undefined,
    description: getTextContent(el, 'DescriptionText') || undefined,
    commodityCode: getTextContent(el, 'CommodityCode') || undefined,
    productPurpose: getTextContent(el, 'ProductPurposeText') || undefined,
    applicationMethod: getTextContent(el, 'ProductApplicationMethodText') || undefined,
    releaseForm: getTextContent(el, 'ReleaseFormText') || undefined,
    storageCondition: getTextContent(el, 'StorageConditionText') || undefined,
    labelText: getTextContent(el, 'ProductLabelText') || undefined,
    technicalDocs: technicalDocs.length ? technicalDocs : undefined,
  }
}

function parseAddressDetails(addressEl: Element): AddressDetails {
  const get = (name: string) =>
    (getTextContent(addressEl, name) || '').trim()
  return {
    addressKindCode: get('AddressKindCode') || undefined,
    country: get('UnifiedCountryCode') || get('CountryCode') || undefined,
    territoryCode: get('TerritoryCode') || undefined,
    regionName: get('RegionName') || undefined,
    districtName: get('DistrictName') || undefined,
    cityName: get('CityName') || undefined,
    settlementName: get('SettlementName') || undefined,
    streetName: get('StreetName') || undefined,
    buildingNumberId: get('BuildingNumberId') || undefined,
    roomNumberId: get('RoomNumberId') || undefined,
    postOfficeBoxId: get('PostOfficeBoxId') || undefined,
    postCode: get('PostCode') || undefined,
    fullAddress: get('FullAddress') || undefined,
  }
}

function parseAllAddresses(parent: Element): AddressDetails[] {
  const addressElements = findAllByLocalName(parent, 'SubjectAddressDetails')
  if (addressElements.length === 0) {
    const alt = findAllByLocalName(parent, 'ObjectAddressDetails')
    return alt.map(parseAddressDetails)
  }
  return addressElements.map(parseAddressDetails)
}

function addressByKind(addresses: AddressDetails[], kindCode: string): AddressDetails | undefined {
  return addresses.find((a) => (a.addressKindCode || '').trim() === kindCode)
}

function parseOneAccreditationCertificate(el: Element): AccreditationCertificateDetails | undefined {
  const docKindName = getTextContent(el, 'DocKindName') || undefined
  const docId = getTextContent(el, 'DocId') || undefined
  const eventDate = getTextContent(el, 'EventDate') || undefined
  const docStartDate = getTextContent(el, 'DocStartDate') || undefined
  const docValidityDate = getTextContent(el, 'DocValidityDate') || undefined
  const docBinaryEl = findByLocalName(el, 'DocBinaryText')
  let docBinaryText: { content?: string; mediaTypeCode?: string } | undefined
  if (docBinaryEl) {
    const content = docBinaryEl.textContent?.trim()
    const mediaTypeCode = getAttr(docBinaryEl, 'mediaTypeCode')
    if (content || mediaTypeCode) docBinaryText = { content, mediaTypeCode }
  }
  const anyDetailsEl = findByLocalName(el, 'AnyDetails')
  let xmlDocument: string | undefined
  if (anyDetailsEl && anyDetailsEl.childNodes.length > 0) {
    try {
      xmlDocument = Array.from(anyDetailsEl.childNodes)
        .map((n) => {
          if (n.nodeType === Node.ELEMENT_NODE) return new XMLSerializer().serializeToString(n as Element)
          if (n.nodeType === Node.TEXT_NODE) return n.textContent || ''
          return ''
        })
        .join('')
    } catch {
      xmlDocument = anyDetailsEl.textContent ?? undefined
    }
  }
  if (!docKindName && !docId && !eventDate && !docStartDate && !docValidityDate && !docBinaryText && !xmlDocument) {
    return undefined
  }
  return {
    docKindName,
    docId,
    eventDate,
    docStartDate,
    docValidityDate,
    docBinaryText,
    xmlDocument,
  }
}

function parseAllAccreditationCertificates(parent: Element): AccreditationCertificateDetails[] {
  const elements = findAllByLocalName(parent, 'AccreditationCertificateDetails')
  const out: AccreditationCertificateDetails[] = []
  for (const el of elements) {
    const cert = parseOneAccreditationCertificate(el)
    if (cert) out.push(cert)
  }
  return out
}

function parseAccreditationCertificateDetails(parent: Element): AccreditationCertificateDetails | undefined {
  const el = findByLocalName(parent, 'AccreditationCertificateDetails')
  return el ? parseOneAccreditationCertificate(el) : undefined
}

function parseLaboratoryFromSubject(subjectEl: Element): LaboratoryDetails {
  const addresses = parseAllAddresses(subjectEl)
  const registrationAddress = addressByKind(addresses, '1')
  const actualAddress = addressByKind(addresses, '2')
  const mailingAddress = addressByKind(addresses, '3')
  const businessEntityIdEl = findByLocalName(subjectEl, 'BusinessEntityId')
  const subjectId = businessEntityIdEl?.textContent?.trim() || getTextContent(subjectEl, 'BusinessEntityId') || undefined
  const identificationMethod = businessEntityIdEl ? (getAttr(businessEntityIdEl, 'kindId') || undefined) : undefined
  const businessEntityTypeCodeEl = Array.from(subjectEl.getElementsByTagName('*')).find(
    (e) => (e.localName || e.tagName.split(':').pop()?.toLowerCase()) === 'businessentitytypecode'
  )
  const businessEntityTypeCode = businessEntityTypeCodeEl?.textContent?.trim()
  const businessEntityTypeCodeListId = businessEntityTypeCodeEl ? (getAttr(businessEntityTypeCodeEl, 'codeListId') || undefined) : undefined
  const businessEntityTypeName = getTextContent(subjectEl, 'BusinessEntityTypeName') || undefined
  const organizationalForm = businessEntityTypeName || (businessEntityTypeCode ? `${businessEntityTypeCode}` : undefined)
  const accreditationCertificates = parseAllAccreditationCertificates(subjectEl)
  const accreditationCertificate = accreditationCertificates[0]
  return {
    subjectId: subjectId || undefined,
    identificationMethod: identificationMethod || undefined,
    organizationalForm: organizationalForm || undefined,
    businessEntityTypeCode: businessEntityTypeCode || undefined,
    businessEntityTypeCodeListId: businessEntityTypeCodeListId || undefined,
    businessEntityName: getTextContent(subjectEl, 'BusinessEntityName') || undefined,
    addresses: addresses.length ? addresses : undefined,
    registrationAddress,
    actualAddress,
    mailingAddress,
    accreditationCertificates: accreditationCertificates.length ? accreditationCertificates : undefined,
    accreditationCertificate,
  }
}

/** Парсинг блока smcdo:LaboratoryDetails (BusinessEntityName + AccreditationCertificateDetails без SubjectDetails) */
function parseLaboratoryFromLaboratoryDetails(labEl: Element): LaboratoryDetails {
  const addresses = parseAllAddresses(labEl)
  const registrationAddress = addressByKind(addresses, '1')
  const actualAddress = addressByKind(addresses, '2')
  const mailingAddress = addressByKind(addresses, '3')
  const accreditationCertificates = parseAllAccreditationCertificates(labEl)
  const accreditationCertificate = accreditationCertificates[0]
  const businessEntityName = getTextContent(labEl, 'BusinessEntityName') || undefined
  const subjectId = getTextContent(labEl, 'BusinessEntityId') || undefined
  const identificationMethod = (() => {
    const businessEntityIdEl = findByLocalName(labEl, 'BusinessEntityId')
    return businessEntityIdEl ? (getAttr(businessEntityIdEl, 'kindId') || undefined) : undefined
  })()
  const businessEntityTypeCodeEl = Array.from(labEl.getElementsByTagName('*')).find(
    (e) => (e.localName || e.tagName.split(':').pop()?.toLowerCase()) === 'businessentitytypecode'
  )
  const businessEntityTypeCode = businessEntityTypeCodeEl?.textContent?.trim()
  const businessEntityTypeCodeListId = businessEntityTypeCodeEl ? (getAttr(businessEntityTypeCodeEl, 'codeListId') || undefined) : undefined
  const businessEntityTypeName = getTextContent(labEl, 'BusinessEntityTypeName') || undefined
  const organizationalForm = businessEntityTypeName || (businessEntityTypeCode ? `${businessEntityTypeCode}` : undefined)
  return {
    subjectId: subjectId || undefined,
    identificationMethod: identificationMethod || undefined,
    organizationalForm: organizationalForm || undefined,
    businessEntityTypeCode: businessEntityTypeCode || undefined,
    businessEntityTypeCodeListId: businessEntityTypeCodeListId || undefined,
    businessEntityName: businessEntityName || undefined,
    addresses: addresses.length ? addresses : undefined,
    registrationAddress: registrationAddress || undefined,
    actualAddress: actualAddress || undefined,
    mailingAddress: mailingAddress || undefined,
    accreditationCertificates: accreditationCertificates.length ? accreditationCertificates : undefined,
    accreditationCertificate,
  }
}

/** Ищем элемент лаборатории: LaboratoryDetails, SubjectDetails или любой элемент с BusinessEntityId и адресами/аккредитацией */
function findAndParseLaboratory(protocolEl: Element): LaboratoryDetails | undefined {
  const labDetailsEl = findByLocalName(protocolEl, 'LaboratoryDetails')
  if (labDetailsEl) return parseLaboratoryFromLaboratoryDetails(labDetailsEl)
  const subjectEl = findByLocalName(protocolEl, 'SubjectDetails')
  if (subjectEl) return parseLaboratoryFromSubject(subjectEl)
  const withBusinessId = findAllByLocalName(protocolEl, 'BusinessEntityId')
  if (withBusinessId.length > 0) {
    const parent = withBusinessId[0].parentElement
    if (parent) return parseLaboratoryFromSubject(parent)
  }
  return undefined
}

/** Элемент считается протоколом, если содержит DocId или DocName и (DocKindCode или DocCreationDate) */
function isProtocolElement(el: Element): boolean {
  const hasDocId = !!getTextContent(el, 'DocId')
  const hasDocName = !!getTextContent(el, 'DocName')
  const hasDocKindCode = !!getTextContent(el, 'DocKindCode')
  const hasDocCreationDate = !!getTextContent(el, 'DocCreationDate')
  return (hasDocId || hasDocName) && (hasDocKindCode || hasDocCreationDate)
}

function parseDocBinaryTextFromElement(parent: Element): { content?: string; mediaTypeCode?: string } | undefined {
  const docBinaryEl = findByLocalName(parent, 'DocBinaryText')
  if (!docBinaryEl) return undefined
  const content = docBinaryEl.textContent?.trim()
  const mediaTypeCode = getAttr(docBinaryEl, 'mediaTypeCode')
  if (!content && !mediaTypeCode) return undefined
  return { content, mediaTypeCode }
}

function parseProtocolElement(el: Element): LaboratoryProtocol {
  // Только прямые дети ComplianceDocDetails: иначе подтягивается DocKindName из вложенного AccreditationCertificateDetails («Аттестат аккредитации»)
  const docKindCode = getDirectChildText(el, 'DocKindCode')
  const docKindName = getDirectChildText(el, 'DocKindName')
  const docBinaryText = parseDocBinaryTextFromElement(el)
  return {
    docKindCode: docKindCode || undefined,
    docKindName: docKindName || undefined,
    docName: (getDirectChildText(el, 'DocName') ?? getTextContent(el, 'DocName')) || undefined,
    docId: (getDirectChildText(el, 'DocId') ?? getTextContent(el, 'DocId')) || undefined,
    docCreationDate: (getDirectChildText(el, 'DocCreationDate') ?? getTextContent(el, 'DocCreationDate')) || undefined,
    docBinaryText: docBinaryText || undefined,
    laboratory: findAndParseLaboratory(el),
  }
}

/**
 * Парсит XML протоколов лабораторных исследований (LPXML) в структурированные данные.
 * ProductDetails — из первого smcdo:ProductDetails (в т.ч. внутри RegistrationCertificateId).
 * Протоколы — все элементы, похожие на документ (DocKindCode, DocName, DocId, DocCreationDate), с детализацией по лаборатории.
 */
export function parseLabProtocolsXml(xmlText: string): LaboratoryProtocolsData {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error(`Ошибка парсинга XML: ${parserError.textContent || 'Неизвестная ошибка'}`)
  }
  const root = doc.documentElement
  if (!root) throw new Error('XML не содержит корневого элемента')

  let product: ProductDetails | undefined
  const firstProductEl = findByLocalName(root, 'ProductDetails')
  if (firstProductEl) {
    product = parseProductDetailsFromElement(firstProductEl)
  }

  // Протоколы — только smcdo:ComplianceDocDetails (документы соответствия с лабораторией), не элементы из ProductDetails
  const complianceDocElements = findAllByLocalName(root, 'ComplianceDocDetails')
  const protocolElements =
    complianceDocElements.length > 0
      ? complianceDocElements
      : (() => {
          const candidates = Array.from(root.getElementsByTagName('*')).filter(isProtocolElement)
          return candidates.filter((el) => !candidates.some((other) => other !== el && other.contains(el)))
        })()
  const protocols: LaboratoryProtocol[] = protocolElements.map(parseProtocolElement)

  return { product, protocols }
}
