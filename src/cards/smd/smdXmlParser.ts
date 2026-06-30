/**
 * Парсер XML карт SMD (временная санитарная мера).
 * Схема: EEC_R_SM_SS_09_SanitaryMeasureDetails_v1.0.0.xsd
 *
 * Корень doc:SanitaryMeasureDetails → ccdo:EDocHeader, smcdo:SanitaryMeasureDetails.
 */

import type { CardData, ElectronicDocument, PhaCauseNotificationItem, SmdProductBatchItem } from '@/types/card'
import { createNewCardData } from '@/utils/newCardData'
import {
  getTextContent,
  parseProductData,
  parseSanitaryMeasureElement,
  parseTSDData,
} from '@/utils/xmlParser'
import { normalizeXmlNamespaces, SMD_CANONICAL_XML_NAMESPACES } from '@/utils/xmlNamespaceNormalizer'
import { parsePublicHealthIncidentDetailsElement } from '@/utils/publicHealthIncidentParser'

function findElementByLocalName(parent: Element | null, localName: string): Element | null {
  if (!parent) return null
  const want = localName.toLowerCase()
  const all = parent.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === want) return el
  }
  return null
}

function findAllElementsByLocalName(parent: Element | null, localName: string): Element[] {
  if (!parent) return []
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

function getDirectChildTextByLocalName(parent: Element | null, localName: string): string | null {
  if (!parent) return null
  const want = localName.toLowerCase()
  const children = parent.children
  for (let i = 0; i < children.length; i++) {
    const el = children[i] as Element
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === want) {
      const t = el.textContent?.trim() ?? null
      return t || null
    }
  }
  return null
}

/** Внутренний блок smcdo:SanitaryMeasureDetails (не корневой doc:SanitaryMeasureDetails). */
function findSmdMeasureBlock(root: Element): Element | null {
  const blocks = findAllElementsByLocalName(root, 'SanitaryMeasureDetails')
  if (blocks.length > 1) return blocks[1]
  if (blocks.length === 1 && blocks[0] !== root) return blocks[0]
  return blocks[0] ?? null
}

function parseIncidentAlerts(measureBlock: Element): PhaCauseNotificationItem[] {
  const nodes = findAllElementsByLocalName(measureBlock, 'IncidentAlertIdDetails')
  return nodes.map((el) => ({
    country: getTextContent(el, 'UnifiedCountryCode')?.trim() || '',
    registrationNumber: getTextContent(el, 'IncidentId')?.trim() || '',
    type: getTextContent(el, 'IncidentKindCode')?.trim() || '',
    formationDate: getTextContent(el, 'DocCreationDate')?.trim().slice(0, 10) || '',
  }))
}

function buildSmdProductBatches(measureBlock: Element, root: Element): SmdProductBatchItem[] {
  const product = parseProductData(measureBlock, root)
  const tsd = parseTSDData(measureBlock, root)
  const batches = tsd?.batches ?? []
  if (batches.length === 0 && !product) return []

  if (batches.length === 0) {
    return [
      {
        key: 'batch-0',
        summaryLabel: product?.productDetails?.productName?.trim() || undefined,
        product,
        tsd: { batches: [] },
      },
    ]
  }

  return batches.map((batch, i) => ({
    key: `batch-${i}`,
    summaryLabel:
      product?.productDetails?.productName?.trim() ||
      batch.batchDetails?.batchId?.trim() ||
      `Продукция ${i + 1}`,
    product,
    tsd: { batches: [batch] },
  }))
}

function parseElectronicDocument(root: Element): ElectronicDocument {
  const edocHeader = findElementByLocalName(root, 'EDocHeader')
  const resourceStatus = findElementByLocalName(root, 'ResourceItemStatusDetails')
  const validityPeriod = resourceStatus ? findElementByLocalName(resourceStatus, 'ValidityPeriodDetails') : null

  return {
    messageCode: getTextContent(edocHeader, 'InfEnvelopeCode') || '',
    documentCode: getTextContent(edocHeader, 'EDocCode') || '',
    documentId: getTextContent(edocHeader, 'EDocId') || '',
    documentDate: getTextContent(edocHeader, 'EDocDateTime') || '',
    language: getTextContent(edocHeader, 'LanguageCode') || 'ru',
    sourceDocumentId: getTextContent(edocHeader, 'EDocRefId') || '',
    validityPeriod: {
      start: getDirectChildTextByLocalName(validityPeriod, 'StartDateTime') || '',
      end: getDirectChildTextByLocalName(validityPeriod, 'EndDateTime') || '',
    },
    updateDateTime: getDirectChildTextByLocalName(resourceStatus, 'UpdateDateTime') || '',
  }
}

/**
 * Парсит XML карты SMD (SS.09) и возвращает CardData для тела карты.
 */
export function parseSmdXmlToCardData(xmlText: string): CardData {
  const xmlTextNormalized = normalizeXmlNamespaces(xmlText, SMD_CANONICAL_XML_NAMESPACES)
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlTextNormalized, 'text/xml')

  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    const errorText = parserError.textContent || 'Неизвестная ошибка'
    throw new Error(`Ошибка парсинга XML: ${errorText}`)
  }

  const root = xmlDoc.documentElement
  if (!root) {
    throw new Error('XML документ не содержит корневого элемента')
  }

  const measureBlock = findSmdMeasureBlock(root)
  if (!measureBlock) {
    throw new Error('Не найден элемент smcdo:SanitaryMeasureDetails в XML')
  }

  const electronicDocument = parseElectronicDocument(root)
  const measure = parseSanitaryMeasureElement(measureBlock)
  const smdIncidentAlerts = parseIncidentAlerts(measureBlock)
  const smdProductBatches = buildSmdProductBatches(measureBlock, root)
  const incidentEl = findElementByLocalName(measureBlock, 'PublicHealthIncidentDetails')
  const incidentParsed = incidentEl ? parsePublicHealthIncidentDetailsElement(incidentEl) : {}

  const regulatoryDoc = measure?.measureDocDetails
  const docId = regulatoryDoc?.docId?.trim() || ''
  const docCreationDate = regulatoryDoc?.docCreationDate?.trim().slice(0, 10) || ''
  const docCountry = regulatoryDoc?.country?.trim().toUpperCase().slice(0, 2) || ''

  const base = createNewCardData()
  const startDate = measure?.startDate?.trim().slice(0, 10) || ''

  return {
    ...base,
    country: docCountry || base.country,
    registrationNumber: docId,
    smdMeasureStartDate: startDate || undefined,
    electronicDocument: {
      ...base.electronicDocument,
      ...electronicDocument,
    },
    notification: {
      ...base.notification,
      country: docCountry || base.notification.country,
      registrationNumber: docId,
      formationDate: docCreationDate,
      authorizedBody: {
        ...base.notification.authorizedBody,
        country: docCountry || base.notification.authorizedBody.country,
        name: regulatoryDoc?.authorityName?.trim() || base.notification.authorizedBody.name,
      },
    },
    measures: measure ? { measures: [measure] } : base.measures,
    smdIncidentAlerts: smdIncidentAlerts.length > 0 ? smdIncidentAlerts : [],
    smdProductBatches: smdProductBatches.length > 0 ? smdProductBatches : [],
    phaDisease: incidentParsed.phaDisease,
    phaPatientGroups: incidentParsed.phaPatientGroups,
    detectionPlace: incidentParsed.detectionPlace,
    spreadingZones: incidentParsed.spreadingZones,
    spreadingZone: incidentParsed.spreadingZone,
  }
}
