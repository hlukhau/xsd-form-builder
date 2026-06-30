/**
 * Парсинг smcdo:PublicHealthIncidentDetails (PHA SS.08, SMD SS.09).
 */

import type { DetectionPlaceData, PhaDiseaseDetails, PhaPatientGroupItem, PhaPathogenDetails } from '@/types/card'
import { getTextContent, parseDetectionPlaceDetails } from '@/utils/xmlParser'

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

function parseBooleanIndicator(raw: string | null | undefined): 0 | 1 | undefined {
  const v = raw?.trim().toLowerCase()
  if (v === '1' || v === 'true') return 1
  if (v === '0' || v === 'false') return 0
  return undefined
}

export interface ParsedPublicHealthIncident {
  phaDisease?: PhaDiseaseDetails
  phaPatientGroups?: PhaPatientGroupItem[]
  detectionPlace?: DetectionPlaceData
  spreadingZones?: DetectionPlaceData[]
  spreadingZone?: DetectionPlaceData
}

/** Парсит smcdo:PublicHealthIncidentDetails в поля карты. */
export function parsePublicHealthIncidentDetailsElement(incidentDetails: Element): ParsedPublicHealthIncident {
  const diseaseBlock = findElementByLocalName(incidentDetails, 'DiseaseHealthProblemDetails')
  const diseaseCode = diseaseBlock ? getTextContent(diseaseBlock, 'DiseaseHealthProblemCode')?.trim() : undefined
  const diseaseName = diseaseBlock ? getTextContent(diseaseBlock, 'DiseaseHealthProblemName')?.trim() : undefined
  const eventDate = getTextContent(incidentDetails, 'EventDate')?.trim()
  const incidentEndDate = getTextContent(incidentDetails, 'EndDate')?.trim()
  const crossborderSpreadRiskIndicator = parseBooleanIndicator(
    getTextContent(incidentDetails, 'CrossborderSpreadRiskIndicator')
  )

  const pathogenNodes = diseaseBlock ? findAllElementsByLocalName(diseaseBlock, 'PathogenDetails') : []
  const pathogens: PhaPathogenDetails[] = pathogenNodes.map((el) => ({
    pathogenKindName: getTextContent(el, 'PathogenKindName')?.trim(),
    pathogenName: getTextContent(el, 'PathogenName')?.trim(),
  }))

  const phaDisease: PhaDiseaseDetails | undefined =
    diseaseCode || diseaseName || eventDate || incidentEndDate || crossborderSpreadRiskIndicator != null || pathogens.length
      ? {
          diseaseCode: diseaseCode || undefined,
          diseaseName: diseaseName || undefined,
          firstCaseDate: eventDate || undefined,
          lastCaseDate: incidentEndDate || undefined,
          crossborderSpreadRiskIndicator: crossborderSpreadRiskIndicator ?? null,
          pathogens: pathogens.length > 0 ? pathogens : undefined,
        }
      : undefined

  const groupNodes = findAllElementsByLocalName(incidentDetails, 'PatientGroupDetails')
  const phaPatientGroups: PhaPatientGroupItem[] = groupNodes.map((el) => ({
    personQuantity: getTextContent(el, 'PersonQuantity')?.trim(),
    ageGroupCode: getTextContent(el, 'AgeGroupCode')?.trim(),
    diseaseOutcomeCode: getTextContent(el, 'DiseaseOutcomeCode')?.trim(),
    laboratoryConfirmedIndicator: parseBooleanIndicator(getTextContent(el, 'LaboratoryConfirmedIndicator')) ?? null,
  }))

  const placeEl = findElementByLocalName(incidentDetails, 'DetectionPlaceDetails')
  const detectionPlace = placeEl ? parseDetectionPlaceDetails(placeEl) : undefined

  const zoneNodes = findAllElementsByLocalName(incidentDetails, 'SpreadingZoneDetails')
  const spreadingZones = zoneNodes.map((z) => parseDetectionPlaceDetails(z))
  const spreadingZone = spreadingZones.length > 0 ? spreadingZones[0] : undefined

  return {
    phaDisease,
    phaPatientGroups: phaPatientGroups.length > 0 ? phaPatientGroups : undefined,
    detectionPlace,
    spreadingZones: spreadingZones.length > 0 ? spreadingZones : undefined,
    spreadingZone,
  }
}
