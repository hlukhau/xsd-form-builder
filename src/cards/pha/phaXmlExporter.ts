/**
 * Экспорт CardData (PHA) в XML по схеме EEC_R_SM_SS_08_PublicHealthAlert_v1.0.0.
 * Корень doc:PublicHealthAlertDetails; дочерние: ccdo:EDocHeader, smcdo:PublicHealthAlertDetails (уведомление + причинные).
 */

import type { CardData } from '@/types/card'
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

function toISODateTimeForXml(dateTime: string | null | undefined): string {
  if (!dateTime || !dateTime.trim()) return ''
  const s = dateTime.trim()
  if (s.includes('T')) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toISOString().replace('Z', '')
}

export function exportPhaCardDataToXML(data: CardData): string {
  const xmlParts: string[] = []
  xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>')
  xmlParts.push('<doc:PublicHealthAlertDetails xmlns:ccdo="urn:EEC:M:ComplexDataObjects:v0.4.12"')
  xmlParts.push(' xmlns:csdo="urn:EEC:M:SimpleDataObjects:v0.4.12"')
  xmlParts.push(' xmlns:smcdo="urn:EEC:M:SM:ComplexDataObjects:v0.3.9"')
  xmlParts.push(' xmlns:smsdo="urn:EEC:M:SM:SimpleDataObjects:v0.3.9"')
  xmlParts.push(' xmlns:doc="urn:EEC:R:SM:SS:08:PublicHealthAlert:v1.0.0"')
  xmlParts.push(' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
  xmlParts.push(' xsi:schemaLocation="urn:EEC:R:SM:SS:08:PublicHealthAlert:v1.0.0 EEC_R_SM_SS_08_PublicHealthAlert_v1.0.0.xsd">')

  xmlParts.push('  <ccdo:EDocHeader>')
  if (data.electronicDocument) {
    xmlParts.push(`    <csdo:InfEnvelopeCode>${escapeXML(data.electronicDocument.messageCode)}</csdo:InfEnvelopeCode>`)
    xmlParts.push(`    <csdo:EDocCode>${escapeXML(data.electronicDocument.documentCode)}</csdo:EDocCode>`)
    xmlParts.push(`    <csdo:EDocId>${escapeXML(data.electronicDocument.documentId)}</csdo:EDocId>`)
    xmlParts.push(`    <csdo:EDocDateTime>${escapeXML(toISODateTimeForXml(data.electronicDocument.documentDate))}</csdo:EDocDateTime>`)
    xmlParts.push(`    <csdo:LanguageCode>${escapeXML(data.electronicDocument.language)}</csdo:LanguageCode>`)
  }
  xmlParts.push('  </ccdo:EDocHeader>')

  const n = data.notification
  xmlParts.push('  <smcdo:PublicHealthAlertDetails>')
  if (n) {
    xmlParts.push(`    <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(n.country)}</csdo:UnifiedCountryCode>`)
    xmlParts.push(`    <smsdo:IncidentId>${escapeXML(n.registrationNumber)}</smsdo:IncidentId>`)
    if (n.type) xmlParts.push(`    <smsdo:IncidentKindCode>${escapeXML(n.type)}</smsdo:IncidentKindCode>`)
    if (n.formationDate) {
      const formationDateOnly = n.formationDate.trim().slice(0, 10)
      if (formationDateOnly) xmlParts.push(`    <csdo:DocCreationDate>${escapeXML(formationDateOnly)}</csdo:DocCreationDate>`)
    }
    if (n.endDate) xmlParts.push(`    <csdo:EndDate>${escapeXML(n.endDate)}</csdo:EndDate>`)
    if (n.authorizedBody) {
      xmlParts.push('    <ccdo:UnifiedAuthorityDetails>')
      if (n.authorizedBody.country) xmlParts.push(`      <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(n.authorizedBody.country)}</csdo:UnifiedCountryCode>`)
      if (n.authorizedBody.identifier) xmlParts.push(`      <csdo:AuthorityId>${escapeXML(n.authorizedBody.identifier)}</csdo:AuthorityId>`)
      if (n.authorizedBody.name) xmlParts.push(`      <csdo:AuthorityName>${escapeXML(n.authorizedBody.name)}</csdo:AuthorityName>`)
      if (n.authorizedBody.shortName) xmlParts.push(`      <csdo:AuthorityBriefName>${escapeXML(n.authorizedBody.shortName)}</csdo:AuthorityBriefName>`)
      xmlParts.push('    </ccdo:UnifiedAuthorityDetails>')
    }
  }
  const causeList = data.phaCauseNotifications ?? []
  for (const c of causeList) {
    xmlParts.push('    <smcdo:IncidentAlertIdDetails>')
    if (c.country) xmlParts.push(`      <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(c.country)}</csdo:UnifiedCountryCode>`)
    if (c.registrationNumber) xmlParts.push(`      <smsdo:IncidentId>${escapeXML(c.registrationNumber)}</smsdo:IncidentId>`)
    if (c.type) xmlParts.push(`      <smsdo:IncidentKindCode>${escapeXML(c.type)}</smsdo:IncidentKindCode>`)
    if (c.formationDate) {
      const formationDateOnly = c.formationDate.trim().slice(0, 10)
      if (formationDateOnly) xmlParts.push(`      <csdo:DocCreationDate>${escapeXML(formationDateOnly)}</csdo:DocCreationDate>`)
    }
    xmlParts.push('    </smcdo:IncidentAlertIdDetails>')
  }

  const disease = data.phaDisease
  const patientGroups = data.phaPatientGroups ?? []
  const hasDisease = disease && (disease.diseaseCode || disease.diseaseName || disease.firstCaseDate || disease.lastCaseDate != null || disease.crossborderSpreadRiskIndicator != null || (disease.pathogens?.length ?? 0) > 0)
  if (hasDisease || patientGroups.length > 0) {
    xmlParts.push('    <smcdo:PublicHealthIncidentDetails>')
    xmlParts.push('      <smcdo:DiseaseHealthProblemDetails>')
    if (disease.diseaseCode) xmlParts.push(`        <smsdo:DiseaseHealthProblemCode>${escapeXML(disease.diseaseCode)}</smsdo:DiseaseHealthProblemCode>`)
    if (disease.diseaseName) xmlParts.push(`        <smsdo:DiseaseHealthProblemName>${escapeXML(disease.diseaseName)}</smsdo:DiseaseHealthProblemName>`)
    const pathogens = disease.pathogens ?? []
    for (const p of pathogens) {
      xmlParts.push('        <smcdo:PathogenDetails>')
      if (p.pathogenKindName) xmlParts.push(`          <smsdo:PathogenKindName>${escapeXML(p.pathogenKindName)}</smsdo:PathogenKindName>`)
      if (p.pathogenName) xmlParts.push(`          <smsdo:PathogenName>${escapeXML(p.pathogenName)}</smsdo:PathogenName>`)
      xmlParts.push('        </smcdo:PathogenDetails>')
    }
    xmlParts.push('      </smcdo:DiseaseHealthProblemDetails>')
    const eventDateStr = disease?.firstCaseDate?.trim().slice(0, 10) || new Date().toISOString().slice(0, 10)
    xmlParts.push(`      <csdo:EventDate>${escapeXML(eventDateStr)}</csdo:EventDate>`)
    if (disease?.lastCaseDate) {
      const d = disease.lastCaseDate.trim().slice(0, 10)
      if (d) xmlParts.push(`      <csdo:EndDate>${escapeXML(d)}</csdo:EndDate>`)
    }
    for (const g of patientGroups) {
      xmlParts.push('      <smcdo:PatientGroupDetails>')
      if (g.personQuantity != null && g.personQuantity !== '') xmlParts.push(`        <smsdo:PersonQuantity>${escapeXML(String(g.personQuantity))}</smsdo:PersonQuantity>`)
      if (g.ageGroupCode) xmlParts.push(`        <smsdo:AgeGroupCode>${escapeXML(g.ageGroupCode)}</smsdo:AgeGroupCode>`)
      if (g.diseaseOutcomeCode) xmlParts.push(`        <smsdo:DiseaseOutcomeCode>${escapeXML(g.diseaseOutcomeCode)}</smsdo:DiseaseOutcomeCode>`)
      if (g.laboratoryConfirmedIndicator === 0 || g.laboratoryConfirmedIndicator === 1) xmlParts.push(`        <smsdo:LaboratoryConfirmedIndicator>${g.laboratoryConfirmedIndicator}</smsdo:LaboratoryConfirmedIndicator>`)
      xmlParts.push('      </smcdo:PatientGroupDetails>')
    }
    if (data.detectionPlace) {
      exportDetectionPlace(xmlParts, data.detectionPlace, '      ')
    }
    if (disease?.crossborderSpreadRiskIndicator === 0 || disease?.crossborderSpreadRiskIndicator === 1) {
      xmlParts.push(`      <smsdo:CrossborderSpreadRiskIndicator>${disease.crossborderSpreadRiskIndicator}</smsdo:CrossborderSpreadRiskIndicator>`)
    }
    if (data.spreadingZone) {
      exportSpreadingZone(xmlParts, data.spreadingZone, '      ')
    }
    xmlParts.push('    </smcdo:PublicHealthIncidentDetails>')
  }

  // smsdo:MeasureCode и smsdo:MeasureName — прямые потомки PublicHealthAlertDetails (сначала все коды, затем все наименования)
  const measureList = data.measures?.measures ?? []
  const measureCodes = measureList.filter((m) => m.measureCode?.trim()).map((m) => m.measureCode!.trim())
  const measureNames = measureList.filter((m) => m.measureName?.trim()).map((m) => m.measureName!.trim())
  for (const code of measureCodes) {
    xmlParts.push(`    <smsdo:MeasureCode>${escapeXML(code)}</smsdo:MeasureCode>`)
  }
  for (const name of measureNames) {
    xmlParts.push(`    <smsdo:MeasureName>${escapeXML(name)}</smsdo:MeasureName>`)
  }

  xmlParts.push('  </smcdo:PublicHealthAlertDetails>')
  xmlParts.push('</doc:PublicHealthAlertDetails>')
  return xmlParts.join('\n')
}
