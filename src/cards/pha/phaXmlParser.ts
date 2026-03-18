/**
 * Отдельный парсер XML карт PHA (обнаружение болезней).
 * Схема: EEC_R_SM_SS_08_PublicHealthAlert_v1.0.0.xsd
 * Не использует парсер DPA (xmlParser.ts) и не требует элемент DangerousProductAlertDetails.
 */

import type { CardData, ElectronicDocument } from '@/types/card'
import { createNewCardData } from '@/utils/newCardData'

/** Извлекает текст первого найденного потомка по локальному имени (без учёта namespace). */
function getTextByLocalName(parent: Element | null, localName: string): string | null {
  if (!parent) return null
  const want = localName.toLowerCase()
  const all = parent.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    const el = all[i]
    const local = (el.localName || el.tagName.split(':').pop() || '').toLowerCase()
    if (local === want) {
      const t = el.textContent?.trim() ?? null
      return t || null
    }
  }
  return null
}

/** Находит первый элемент по локальному имени среди потомков. */
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

/**
 * Парсит XML карты PHA и возвращает CardData.
 * Полностью отделён от DPA-парсера; структура по схеме PublicHealthAlert.
 */
export function parsePhaXmlToCardData(xmlText: string): CardData {
  const parser = new DOMParser()
  const xmlDoc = parser.parseFromString(xmlText, 'text/xml')

  const parserError = xmlDoc.querySelector('parsererror')
  if (parserError) {
    const errorText = parserError.textContent || 'Неизвестная ошибка'
    throw new Error(`Ошибка парсинга XML: ${errorText}`)
  }

  const root = xmlDoc.documentElement
  if (!root) {
    throw new Error('XML документ не содержит корневого элемента')
  }

  const edocHeader = findElementByLocalName(root, 'EDocHeader')

  const electronicDocument: ElectronicDocument = {
    messageCode: getTextByLocalName(edocHeader, 'InfEnvelopeCode') || '',
    documentCode: getTextByLocalName(edocHeader, 'EDocCode') || '',
    documentId: getTextByLocalName(edocHeader, 'EDocId') || '',
    documentDate: getTextByLocalName(edocHeader, 'EDocDateTime') || '',
    language: getTextByLocalName(edocHeader, 'LanguageCode') || 'ru',
    sourceDocumentId: getTextByLocalName(edocHeader, 'EDocRefId') || '',
    validityPeriod: { start: '', end: '' },
    updateDateTime: '',
  }

  const country =
    getTextByLocalName(root, 'UnifiedCountryCode')?.trim() ||
    getTextByLocalName(root, 'AlertCountryCode')?.trim() ||
    'BY'
  const registrationNumber = getTextByLocalName(root, 'IncidentId')?.trim() || ''
  const docCreationDate = getTextByLocalName(root, 'DocCreationDate')?.trim() || ''
  const incidentKindCode = getTextByLocalName(root, 'IncidentKindCode')?.trim() || ''

  const authority = findElementByLocalName(root, 'UnifiedAuthorityDetails')
  const authorizedBody = {
    country: authority ? (getTextByLocalName(authority, 'UnifiedCountryCode') || '') : '',
    identifier: authority ? (getTextByLocalName(authority, 'AuthorityId') || '') : '',
    name: authority ? (getTextByLocalName(authority, 'AuthorityName') || '') : '',
    shortName:
      authority
        ? (getTextByLocalName(authority, 'AuthorityBriefName') ||
           getTextByLocalName(authority, 'AuthorityShortName') ||
           '')
        : '',
  }

  const base = createNewCardData(country, { registrationNumber: registrationNumber || undefined })

  const cardData: CardData = {
    ...base,
    country: country || base.country,
    registrationNumber: registrationNumber || base.registrationNumber,
    electronicDocument,
    notification: {
      ...base.notification,
      country: country || base.notification.country,
      registrationNumber: registrationNumber || base.notification.registrationNumber,
      type: incidentKindCode || base.notification.type,
      formationDate: docCreationDate || base.notification.formationDate,
      endDate: base.notification.endDate,
      authorizedBody,
    },
  }

  return cardData
}
