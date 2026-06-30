/**
 * Отдельный парсер XML карт PHA (обнаружение болезней).
 * Схема: EEC_R_SM_SS_08_PublicHealthAlert_v1.0.0.xsd
 *
 * Структура по XSD:
 * - Корень doc:PublicHealthAlertDetails (PublicHealthAlertDetailsType): sequence EDocHeader, 1..n smcdo:PublicHealthAlertDetails.
 * - smcdo:PublicHealthAlertDetails (PublicHealthAlertDetailsType): база IncidentAlertDetailsType; затем PublicHealthIncidentDetails?, MeasureCode*, MeasureName*, IncidentAlertIdDetails* (причинные), ResourceItemStatusDetails?.
 * - smcdo:IncidentAlertIdDetails (IncidentAlertIdDetailsType): UnifiedCountryCode, IncidentId, IncidentKindCode, DocCreationDate.
 */

import type { CardData, ElectronicDocument, SanitaryMeasure } from '@/types/card'
import { createNewCardData } from '@/utils/newCardData'
import { parsePublicHealthIncidentDetailsElement } from '@/utils/publicHealthIncidentParser'
import { normalizeXmlNamespaces, PHA_CANONICAL_XML_NAMESPACES } from '@/utils/xmlNamespaceNormalizer'

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

/** Извлекает текст ПРЯМОГО дочернего элемента по локальному имени (без учёта namespace). */
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

/** Находит все элементы по локальному имени среди потомков. */
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

/**
 * Парсит XML карты PHA и возвращает CardData.
 * Полностью отделён от DPA-парсера; структура по схеме PublicHealthAlert.
 */
export function parsePhaXmlToCardData(xmlText: string): CardData {
  const xmlTextNormalized = normalizeXmlNamespaces(xmlText, PHA_CANONICAL_XML_NAMESPACES)
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

  // По XSD: корень doc:PublicHealthAlertDetails содержит ccdo:EDocHeader и 1..n smcdo:PublicHealthAlertDetails.
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

  // Первый блок smcdo:PublicHealthAlertDetails (дочерний корня). Корень тоже имеет localName PublicHealthAlertDetails — берём второй элемент.
  const allCaseBlocks = findAllElementsByLocalName(root, 'PublicHealthAlertDetails')
  const firstCaseBlock =
    allCaseBlocks.length > 1 ? allCaseBlocks[1] : allCaseBlocks[0]
  // Поля уведомления — из IncidentAlertDetailsType (UnifiedCountryCode, IncidentId, IncidentKindCode, DocCreationDate, EndDate, UnifiedAuthorityDetails).
  const country =
    getDirectChildTextByLocalName(firstCaseBlock, 'UnifiedCountryCode')?.trim() ||
    getTextByLocalName(root, 'AlertCountryCode')?.trim() ||
    'BY'
  const registrationNumber = getDirectChildTextByLocalName(firstCaseBlock, 'IncidentId')?.trim() || ''
  const docCreationDate = getDirectChildTextByLocalName(firstCaseBlock, 'DocCreationDate')?.trim() || ''
  const incidentKindCode = getDirectChildTextByLocalName(firstCaseBlock, 'IncidentKindCode')?.trim() || ''
  const endDate = getDirectChildTextByLocalName(firstCaseBlock, 'EndDate')?.trim() || null

  const authority = findElementByLocalName(firstCaseBlock, 'UnifiedAuthorityDetails')
  const authorizedBody = {
    country: authority ? (getTextByLocalName(authority, 'UnifiedCountryCode') || '') : '',
    /** csdo:AuthorityId — при наличии; иначе идентификатор подставляется из БД (PHA.AUTHORITYID → метаданные authorityUid). */
    identifier: authority ? (getTextByLocalName(authority, 'AuthorityId')?.trim() || '') : '',
    name: authority ? (getTextByLocalName(authority, 'AuthorityName') || '') : '',
    shortName:
      authority
        ? (getTextByLocalName(authority, 'AuthorityBriefName') ||
           getTextByLocalName(authority, 'AuthorityShortName') ||
           '')
        : '',
  }

  // smsdo:MeasureCode и smsdo:MeasureName — прямые потомки PublicHealthAlertDetails (0..n каждый). Сначала все коды, затем все наименования.
  const measureCodeEls = findAllElementsByLocalName(firstCaseBlock, 'MeasureCode')
  const measureNameEls = findAllElementsByLocalName(firstCaseBlock, 'MeasureName')
  const codeRows: SanitaryMeasure[] = measureCodeEls
    .map((el) => {
      const measureCode = el.textContent?.trim() ?? ''
      if (!measureCode) return null
      const listId = el.getAttribute('codeListId')?.trim()
      return {
        measureCode,
        ...(listId ? { measureCodeListId: listId } : {}),
      } as SanitaryMeasure
    })
    .filter((x): x is SanitaryMeasure => x != null)
  const nameValues = measureNameEls.map((el) => el.textContent?.trim() ?? '').filter(Boolean)
  const phaMeasures: SanitaryMeasure[] = [
    ...codeRows,
    ...nameValues.map((measureName) => ({ measureName })),
  ]
  const measures = phaMeasures.length > 0 ? { measures: phaMeasures } : undefined

  // smcdo:IncidentAlertIdDetails — причинные уведомления (по XSD после мер; ищем среди потомков блока случая).
  const causeNodes = findAllElementsByLocalName(firstCaseBlock, 'IncidentAlertIdDetails')
  const phaCauseNotifications = causeNodes.map((el) => ({
    country: getTextByLocalName(el, 'UnifiedCountryCode')?.trim() || '',
    registrationNumber: getTextByLocalName(el, 'IncidentId')?.trim() || '',
    type: getTextByLocalName(el, 'IncidentKindCode')?.trim() || '',
    formationDate: getTextByLocalName(el, 'DocCreationDate')?.trim() || '',
  }))

  // smcdo:PublicHealthIncidentDetails — сведения о болезни.
  const incidentDetails = findElementByLocalName(firstCaseBlock, 'PublicHealthIncidentDetails')
  const incidentParsed = incidentDetails ? parsePublicHealthIncidentDetailsElement(incidentDetails) : {}
  const phaDisease = incidentParsed.phaDisease
  const detectionPlace = incidentParsed.detectionPlace
  const spreadingZones = incidentParsed.spreadingZones
  const spreadingZone = incidentParsed.spreadingZone
  const phaPatientGroups = incidentParsed.phaPatientGroups

  const base = createNewCardData(country, { registrationNumber: registrationNumber || undefined }, { forPha: true })

  const cardData: CardData = {
    ...base,
    /** Версия задаётся в БД (PHA.PHAVERSION); из XML не берём — подставляет /api/pha/metadata. */
    version: undefined,
    country: country || base.country,
    registrationNumber: registrationNumber || base.registrationNumber,
    electronicDocument,
    notification: {
      ...base.notification,
      country: country || base.notification.country,
      registrationNumber: registrationNumber || base.notification.registrationNumber,
      type: incidentKindCode || base.notification.type,
      formationDate: docCreationDate || base.notification.formationDate,
      endDate: endDate ?? base.notification.endDate,
      authorizedBody,
    },
    phaCauseNotifications: phaCauseNotifications.length > 0 ? phaCauseNotifications : undefined,
    phaDisease: phaDisease ?? undefined,
    phaPatientGroups: phaPatientGroups ?? undefined,
    detectionPlace: detectionPlace ?? undefined,
    spreadingZone: spreadingZone ?? undefined,
    spreadingZones: spreadingZones ?? undefined,
    measures,
  }

  return cardData
}

/**
 * Поля версии/статуса/источника и доступа к карте задаются в БД (метаданные PHA), парсер XML их не заполняет.
 * Без выравнивания compareCardData даёт ложные «Добавлен атрибут version: 1» при сохранении без изменений.
 */
export function alignPhaParsedCardForCompare(parsed: CardData, reference: CardData): CardData {
  return {
    ...parsed,
    version: parsed.version ?? reference.version,
    statusId: parsed.statusId ?? reference.statusId,
    status: parsed.status ?? reference.status,
    datasourceKindCode: parsed.datasourceKindCode ?? reference.datasourceKindCode,
    source: parsed.source ?? reference.source,
    phaAccessibleDepIds: parsed.phaAccessibleDepIds ?? reference.phaAccessibleDepIds,
    country: parsed.country || reference.country,
    alertCountryName: parsed.alertCountryName ?? reference.alertCountryName,
    registrationNumber: parsed.registrationNumber || reference.registrationNumber,
    createdAt: parsed.createdAt ?? reference.createdAt,
    modifiedAt: parsed.modifiedAt ?? reference.modifiedAt,
  }
}
