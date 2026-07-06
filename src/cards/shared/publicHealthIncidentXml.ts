/**
 * Экспорт smcdo:PublicHealthIncidentDetails (PHA SS.08, SMD SS.09).
 */

import type { CardData } from '@/types/card'
import { hasPhaPatientGroupExportContent } from '@/cards/pha/phaPatientGroupXml'
import { exportDetectionPlace, exportSpreadingZone } from '@/utils/xmlExporter'

function escapeXML(str: string | undefined | null): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function spreadingZonesList(data: CardData) {
  if (data.spreadingZones && data.spreadingZones.length > 0) return data.spreadingZones
  if (data.spreadingZone) return [data.spreadingZone]
  return []
}

/** Есть ли содержимое для вывода smcdo:PublicHealthIncidentDetails. */
export function shouldExportPublicHealthIncident(data: CardData): boolean {
  const disease = data.phaDisease
  const hasDisease =
    disease &&
    (disease.diseaseName ||
      disease.firstCaseDate ||
      disease.lastCaseDate != null ||
      disease.crossborderSpreadRiskIndicator != null ||
      (disease.pathogens?.length ?? 0) > 0)
  const patientGroupsToExport = (data.phaPatientGroups ?? []).filter(hasPhaPatientGroupExportContent)
  return (
    !!hasDisease ||
    patientGroupsToExport.length > 0 ||
    !!data.detectionPlace ||
    spreadingZonesList(data).length > 0 ||
    disease?.crossborderSpreadRiskIndicator === 0 ||
    disease?.crossborderSpreadRiskIndicator === 1
  )
}

/** @deprecated используйте shouldExportPublicHealthIncident */
export const phaShouldExportPublicHealthIncident = shouldExportPublicHealthIncident

export function exportPublicHealthIncidentDetails(xmlParts: string[], data: CardData, indent: string): void {
  if (!shouldExportPublicHealthIncident(data)) return

  const disease = data.phaDisease
  const patientGroupsToExport = (data.phaPatientGroups ?? []).filter(hasPhaPatientGroupExportContent)
  const zones = spreadingZonesList(data)

  const innerParts: string[] = []
  const inner = `${indent}  `

  const hasDiseaseProblemContent =
    !!(disease?.diseaseName?.trim()) ||
    (disease?.pathogens ?? []).some((p) => !!(p.pathogenKindName?.trim() || p.pathogenName?.trim()))

  if (hasDiseaseProblemContent) {
    innerParts.push(`${inner}<smcdo:DiseaseHealthProblemDetails>`)
    const problemInner = `${inner}  `
    if (disease?.diseaseName?.trim()) {
      innerParts.push(
        `${problemInner}<smsdo:DiseaseHealthProblemName>${escapeXML(disease.diseaseName.trim())}</smsdo:DiseaseHealthProblemName>`
      )
    }
    for (const p of disease?.pathogens ?? []) {
      if (!p.pathogenKindName?.trim() && !p.pathogenName?.trim()) continue
      innerParts.push(`${problemInner}<smcdo:PathogenDetails>`)
      const pathInner = `${problemInner}  `
      if (p.pathogenKindName?.trim()) {
        innerParts.push(
          `${pathInner}<smsdo:PathogenKindName>${escapeXML(p.pathogenKindName.trim())}</smsdo:PathogenKindName>`
        )
      }
      if (p.pathogenName?.trim()) {
        innerParts.push(`${pathInner}<smsdo:PathogenName>${escapeXML(p.pathogenName.trim())}</smsdo:PathogenName>`)
      }
      innerParts.push(`${problemInner}</smcdo:PathogenDetails>`)
    }
    innerParts.push(`${inner}</smcdo:DiseaseHealthProblemDetails>`)
  }

  const eventDateStr = disease?.firstCaseDate?.trim().slice(0, 10)
  if (eventDateStr) {
    innerParts.push(`${inner}<csdo:EventDate>${escapeXML(eventDateStr)}</csdo:EventDate>`)
  }

  if (disease?.lastCaseDate) {
    const d = disease.lastCaseDate.trim().slice(0, 10)
    if (d) innerParts.push(`${inner}<csdo:EndDate>${escapeXML(d)}</csdo:EndDate>`)
  }

  for (const g of patientGroupsToExport) {
    innerParts.push(`${inner}<smcdo:PatientGroupDetails>`)
    const gInner = `${inner}  `
    if (g.personQuantity != null && g.personQuantity !== '') {
      innerParts.push(`${gInner}<smsdo:PersonQuantity>${escapeXML(String(g.personQuantity))}</smsdo:PersonQuantity>`)
    }
    if (g.ageGroupCode) {
      innerParts.push(`${gInner}<smsdo:AgeGroupCode>${escapeXML(g.ageGroupCode)}</smsdo:AgeGroupCode>`)
    }
    if (g.diseaseOutcomeCode) {
      innerParts.push(`${gInner}<smsdo:DiseaseOutcomeCode>${escapeXML(g.diseaseOutcomeCode)}</smsdo:DiseaseOutcomeCode>`)
    }
    if (g.laboratoryConfirmedIndicator === 0 || g.laboratoryConfirmedIndicator === 1) {
      const boolVal = g.laboratoryConfirmedIndicator === 1 ? 'true' : 'false'
      innerParts.push(`${gInner}<smsdo:LaboratoryConfirmedIndicator>${boolVal}</smsdo:LaboratoryConfirmedIndicator>`)
    }
    innerParts.push(`${inner}</smcdo:PatientGroupDetails>`)
  }

  if (data.detectionPlace) {
    const placeParts: string[] = []
    exportDetectionPlace(placeParts, data.detectionPlace, inner)
    innerParts.push(...placeParts)
  }

  if (disease?.crossborderSpreadRiskIndicator === 0 || disease?.crossborderSpreadRiskIndicator === 1) {
    const boolVal = disease.crossborderSpreadRiskIndicator === 1 ? 'true' : 'false'
    innerParts.push(`${inner}<smsdo:CrossborderSpreadRiskIndicator>${boolVal}</smsdo:CrossborderSpreadRiskIndicator>`)
  }

  for (const zone of zones) {
    const zoneParts: string[] = []
    exportSpreadingZone(zoneParts, zone, inner)
    innerParts.push(...zoneParts)
  }

  if (innerParts.length === 0) return

  xmlParts.push(`${indent}<smcdo:PublicHealthIncidentDetails>`)
  xmlParts.push(...innerParts)
  xmlParts.push(`${indent}</smcdo:PublicHealthIncidentDetails>`)
}
