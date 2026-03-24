/**
 * Отдельный парсер XML карт PHA (обнаружение болезней).
 * Схема: EEC_R_SM_SS_08_PublicHealthAlert_v1.0.0.xsd
 *
 * Структура по XSD:
 * - Корень doc:PublicHealthAlertDetails (PublicHealthAlertDetailsType): sequence EDocHeader, 1..n smcdo:PublicHealthAlertDetails.
 * - smcdo:PublicHealthAlertDetails (PublicHealthAlertDetailsType) расширяет IncidentAlertDetailsType: UnifiedCountryCode, IncidentId, IncidentKindCode, DocCreationDate, EndDate, UnifiedAuthorityDetails; плюс 0..n smcdo:IncidentAlertIdDetails (причинные уведомления).
 * - smcdo:IncidentAlertIdDetails (IncidentAlertIdDetailsType): UnifiedCountryCode, IncidentId, IncidentKindCode, DocCreationDate.
 */

import type { CardData, ElectronicDocument, PhaDiseaseDetails, PhaPathogenDetails, PhaPatientGroupItem, SanitaryMeasure } from '@/types/card'
import { createNewCardData } from '@/utils/newCardData'
import { parseDetectionPlaceDetails } from '@/utils/xmlParser'

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
    getTextByLocalName(firstCaseBlock, 'UnifiedCountryCode')?.trim() ||
    getTextByLocalName(root, 'AlertCountryCode')?.trim() ||
    'BY'
  const registrationNumber = getTextByLocalName(firstCaseBlock, 'IncidentId')?.trim() || ''
  const docCreationDate = getTextByLocalName(firstCaseBlock, 'DocCreationDate')?.trim() || ''
  const incidentKindCode = getTextByLocalName(firstCaseBlock, 'IncidentKindCode')?.trim() || ''
  const endDate = getTextByLocalName(firstCaseBlock, 'EndDate')?.trim() || null

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

  // smcdo:IncidentAlertIdDetails — только внутри первого блока случая (причинные уведомления данного случая).
  const causeNodes = findAllElementsByLocalName(firstCaseBlock, 'IncidentAlertIdDetails')
  const phaCauseNotifications = causeNodes.map((el) => ({
    country: getTextByLocalName(el, 'UnifiedCountryCode')?.trim() || '',
    registrationNumber: getTextByLocalName(el, 'IncidentId')?.trim() || '',
    type: getTextByLocalName(el, 'IncidentKindCode')?.trim() || '',
    formationDate: getTextByLocalName(el, 'DocCreationDate')?.trim() || '',
  }))

  // smcdo:PublicHealthIncidentDetails — сведения о болезни (DiseaseHealthProblemDetails, EventDate, EndDate, CrossborderSpreadRiskIndicator, PathogenDetails).
  let phaDisease: PhaDiseaseDetails | undefined
  const incidentDetails = findElementByLocalName(firstCaseBlock, 'PublicHealthIncidentDetails')
  if (incidentDetails) {
    const diseaseBlock = findElementByLocalName(incidentDetails, 'DiseaseHealthProblemDetails')
    const diseaseName = diseaseBlock ? getTextByLocalName(diseaseBlock, 'DiseaseHealthProblemName')?.trim() : undefined
    const eventDate = getTextByLocalName(incidentDetails, 'EventDate')?.trim()
    const incidentEndDate = getTextByLocalName(incidentDetails, 'EndDate')?.trim()
    const crossborderRaw = getTextByLocalName(incidentDetails, 'CrossborderSpreadRiskIndicator')?.trim().toLowerCase()
    const crossborderSpreadRiskIndicator: 0 | 1 | undefined =
      crossborderRaw === '1' || crossborderRaw === 'true'
        ? 1
        : crossborderRaw === '0' || crossborderRaw === 'false'
          ? 0
          : undefined

    const pathogenNodes = diseaseBlock ? findAllElementsByLocalName(diseaseBlock, 'PathogenDetails') : []
    const pathogens: PhaPathogenDetails[] = pathogenNodes.map((el) => ({
      pathogenKindName: getTextByLocalName(el, 'PathogenKindName')?.trim(),
      pathogenName: getTextByLocalName(el, 'PathogenName')?.trim(),
    }))

    phaDisease = {
      diseaseName: diseaseName || undefined,
      firstCaseDate: eventDate || undefined,
      lastCaseDate: incidentEndDate || undefined,
      crossborderSpreadRiskIndicator,
      pathogens: pathogens.length > 0 ? pathogens : undefined,
    }
  }

  // smcdo:DetectionPlaceDetails — внутри PublicHealthIncidentDetails.
  let detectionPlace = incidentDetails
    ? (() => {
        const placeEl = findElementByLocalName(incidentDetails, 'DetectionPlaceDetails')
        return placeEl ? parseDetectionPlaceDetails(placeEl) : undefined
      })()
    : undefined

  // smcdo:SpreadingZoneDetails — внутри PublicHealthIncidentDetails (0..n, LocationDetailsType).
  let spreadingZones: import('@/types/card').DetectionPlaceData[] | undefined
  if (incidentDetails) {
    const zoneNodes = findAllElementsByLocalName(incidentDetails, 'SpreadingZoneDetails')
    const zones = zoneNodes.map((z) => parseDetectionPlaceDetails(z))
    if (zones.length > 0) spreadingZones = zones
  }
  const spreadingZone = spreadingZones && spreadingZones.length > 0 ? spreadingZones[0] : undefined

  // smcdo:PatientGroupDetails — внутри PublicHealthIncidentDetails (0..n).
  let phaPatientGroups: PhaPatientGroupItem[] | undefined
  if (incidentDetails) {
    const groupNodes = findAllElementsByLocalName(incidentDetails, 'PatientGroupDetails')
    phaPatientGroups = groupNodes.map((el) => {
      const labRaw = getTextByLocalName(el, 'LaboratoryConfirmedIndicator')?.trim()
      const laboratoryConfirmedIndicator: 0 | 1 | undefined =
        labRaw === '1' || labRaw?.toLowerCase() === 'true'
          ? 1
          : labRaw === '0' || labRaw?.toLowerCase() === 'false'
            ? 0
            : undefined
      return {
        personQuantity: getTextByLocalName(el, 'PersonQuantity')?.trim(),
        ageGroupCode: getTextByLocalName(el, 'AgeGroupCode')?.trim(),
        diseaseOutcomeCode: getTextByLocalName(el, 'DiseaseOutcomeCode')?.trim(),
        laboratoryConfirmedIndicator: laboratoryConfirmedIndicator ?? undefined,
      }
    })
    if (phaPatientGroups.length === 0) phaPatientGroups = undefined
  }

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
