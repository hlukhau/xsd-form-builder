/**
 * Экспорт CardData (SMD) в XML по схеме EEC_R_SM_SS_09_SanitaryMeasureDetails_v1.0.0.
 */

import type {
  CardData,
  MeasureDocDetails,
  MeasureInitiationBasisItem,
  MeasureImplementationItem,
  PhaCauseNotificationItem,
  SanitaryMeasure,
} from '@/types/card'
import {
  hasMeasureImplementationEntryContent,
  exportNonCompliantSanitaryProductDetailsBlock,
} from '@/utils/xmlExporter'
import { exportPublicHealthIncidentDetails } from '@/cards/shared/publicHealthIncidentXml'
import { resolveSmdMeasureEndDate, resolveSmdMeasureStartDate } from './smdMeasureDates'
import { getSmdRegulatoryMeasureDoc } from './smdMeasureDoc'
import { getSmdPrimaryMeasure } from './smdSanitaryMeasureModel'

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

export function hasMeasureDocDetailsContent(doc: MeasureDocDetails | undefined): boolean {
  if (!doc) return false
  return !!(
    doc.country?.trim() ||
    doc.languageCode?.trim() ||
    doc.docKindCode?.trim() ||
    doc.docKindName?.trim() ||
    doc.docName?.trim() ||
    doc.docSeriesId?.trim() ||
    doc.docId?.trim() ||
    doc.docCreationDate?.trim() ||
    doc.docStartDate?.trim() ||
    doc.docValidityDate?.trim() ||
    doc.docValidityDuration?.trim() ||
    doc.authorityName?.trim() ||
    doc.description?.trim() ||
    doc.pageQuantity?.trim() ||
    doc.xmlDocument?.trim() ||
    doc.docBinaryText?.content?.trim() ||
    doc.docBinaryText?.mediaTypeCode?.trim()
  )
}

function hasBasisContent(basis: MeasureInitiationBasisItem): boolean {
  return !!(
    basis.docKindName?.trim() ||
    basis.docName?.trim() ||
    basis.docId?.trim() ||
    basis.docCreationDate?.trim()
  )
}

function exportMeasureDocDetails(
  xmlParts: string[],
  doc: MeasureDocDetails,
  tagName: string,
  indent: string
): void {
  if (!hasMeasureDocDetailsContent(doc)) return
  const inner = `${indent}    `
  xmlParts.push(`${indent}<smcdo:${tagName}>`)
  if (doc.country) {
    xmlParts.push(
      `${inner}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(doc.country)}</csdo:UnifiedCountryCode>`
    )
  }
  if (doc.languageCode) xmlParts.push(`${inner}<csdo:LanguageCode>${escapeXML(doc.languageCode)}</csdo:LanguageCode>`)
  if (doc.docKindCode?.trim()) {
    const listId = doc.docKindCodeListId?.trim() || '2009'
    xmlParts.push(
      `${inner}<csdo:DocKindCode codeListId="${escapeXML(listId)}">${escapeXML(doc.docKindCode.trim())}</csdo:DocKindCode>`
    )
  } else if (doc.docKindName?.trim()) {
    xmlParts.push(`${inner}<csdo:DocKindName>${escapeXML(doc.docKindName.trim())}</csdo:DocKindName>`)
  }
  if (doc.docName) xmlParts.push(`${inner}<csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
  if (doc.docSeriesId) xmlParts.push(`${inner}<csdo:DocSeriesId>${escapeXML(doc.docSeriesId)}</csdo:DocSeriesId>`)
  if (doc.docId) xmlParts.push(`${inner}<csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
  if (doc.docCreationDate) {
    xmlParts.push(`${inner}<csdo:DocCreationDate>${escapeXML(doc.docCreationDate.slice(0, 10))}</csdo:DocCreationDate>`)
  }
  if (doc.docStartDate) xmlParts.push(`${inner}<csdo:DocStartDate>${escapeXML(doc.docStartDate)}</csdo:DocStartDate>`)
  if (doc.docValidityDate) {
    xmlParts.push(`${inner}<csdo:DocValidityDate>${escapeXML(doc.docValidityDate)}</csdo:DocValidityDate>`)
  }
  if (doc.docValidityDuration) {
    xmlParts.push(`${inner}<csdo:DocValidityDuration>${escapeXML(doc.docValidityDuration)}</csdo:DocValidityDuration>`)
  }
  if (doc.authorityName) xmlParts.push(`${inner}<csdo:AuthorityName>${escapeXML(doc.authorityName)}</csdo:AuthorityName>`)
  if (doc.description) xmlParts.push(`${inner}<csdo:DescriptionText>${escapeXML(doc.description)}</csdo:DescriptionText>`)
  if (doc.pageQuantity) xmlParts.push(`${inner}<csdo:PageQuantity>${escapeXML(doc.pageQuantity)}</csdo:PageQuantity>`)
  if (doc.xmlDocument) {
    xmlParts.push(`${inner}<ccdo:AnyDetails>${doc.xmlDocument}</ccdo:AnyDetails>`)
  }
  if (doc.docBinaryText && (doc.docBinaryText.content || doc.docBinaryText.mediaTypeCode)) {
    const mediaAttr = doc.docBinaryText.mediaTypeCode
      ? ` mediaTypeCode="${escapeXML(doc.docBinaryText.mediaTypeCode)}"`
      : ''
    xmlParts.push(
      `${inner}<csdo:DocBinaryText${mediaAttr}>${escapeXML(doc.docBinaryText.content || '')}</csdo:DocBinaryText>`
    )
  }
  xmlParts.push(`${indent}</smcdo:${tagName}>`)
}

function exportIncidentAlert(xmlParts: string[], c: PhaCauseNotificationItem, indent: string): void {
  xmlParts.push(`${indent}<smcdo:IncidentAlertIdDetails>`)
  const inner = `${indent}  `
  if (c.country) {
    xmlParts.push(
      `${inner}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(c.country)}</csdo:UnifiedCountryCode>`
    )
  }
  if (c.registrationNumber) {
    xmlParts.push(`${inner}<smsdo:IncidentId>${escapeXML(c.registrationNumber)}</smsdo:IncidentId>`)
  }
  if (c.type) xmlParts.push(`${inner}<smsdo:IncidentKindCode>${escapeXML(c.type)}</smsdo:IncidentKindCode>`)
  if (c.formationDate) {
    xmlParts.push(
      `${inner}<csdo:DocCreationDate>${escapeXML(c.formationDate.slice(0, 10))}</csdo:DocCreationDate>`
    )
  }
  xmlParts.push(`${indent}</smcdo:IncidentAlertIdDetails>`)
}

/** Упрощённый экспорт мероприятия (основные поля SS.09). */
function exportMeasureImplementation(xmlParts: string[], impl: MeasureImplementationItem, indent: string): void {
  xmlParts.push(`${indent}<smcdo:MeasureImplementationDetails>`)
  const inner = `${indent}  `
  if (impl.country) {
    xmlParts.push(
      `${inner}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(impl.country)}</csdo:UnifiedCountryCode>`
    )
  }
  if (impl.startDate) xmlParts.push(`${inner}<csdo:StartDate>${escapeXML(impl.startDate)}</csdo:StartDate>`)
  if (impl.endDate) xmlParts.push(`${inner}<csdo:EndDate>${escapeXML(impl.endDate)}</csdo:EndDate>`)
  if (impl.description?.trim()) {
    xmlParts.push(`${inner}<csdo:DescriptionText>${escapeXML(impl.description.trim())}</csdo:DescriptionText>`)
  }
  if (impl.measureAffectedObjectKindCode) {
    impl.measureAffectedObjectKindCode
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .forEach((code) => {
        xmlParts.push(
          `${inner}<smsdo:MeasureAffectedObjectKindCode>${escapeXML(code)}</smsdo:MeasureAffectedObjectKindCode>`
        )
      })
  }
  xmlParts.push(`${indent}</smcdo:MeasureImplementationDetails>`)
}

function exportTemporaryMeasureDetails(
  xmlParts: string[],
  measure: SanitaryMeasure,
  data: CardData,
  indent: string
): void {
  const lang = (measure.languageCode || data.electronicDocument?.language || 'ru').trim().toLowerCase()
  xmlParts.push(`${indent}<smcdo:SanitaryMeasureDetails>`)
  const inner = `${indent}  `
  xmlParts.push(`${inner}<csdo:LanguageCode>${escapeXML(lang)}</csdo:LanguageCode>`)

  if (measure.measureCode?.trim()) {
    const listId = measure.measureCodeListId?.trim() || '1067'
    xmlParts.push(
      `${inner}<smsdo:MeasureCode codeListId="${escapeXML(listId)}">${escapeXML(measure.measureCode.trim())}</smsdo:MeasureCode>`
    )
  }
  if (measure.measureName?.trim()) {
    xmlParts.push(`${inner}<smsdo:MeasureName>${escapeXML(measure.measureName.trim())}</smsdo:MeasureName>`)
  }

  const doc = getSmdRegulatoryMeasureDoc(data)
  if (hasMeasureDocDetailsContent(doc)) {
    exportMeasureDocDetails(xmlParts, doc, 'MeasureDocDetails', inner)
  } else {
    xmlParts.push(`${inner}<smcdo:MeasureDocDetails></smcdo:MeasureDocDetails>`)
  }

  if (hasMeasureDocDetailsContent(measure.initialMeasureDocDetails)) {
    exportMeasureDocDetails(xmlParts, measure.initialMeasureDocDetails!, 'InitialMeasureDocDetails', inner)
  }

  const startDate = resolveSmdMeasureStartDate(data)
  if (startDate) xmlParts.push(`${inner}<csdo:StartDate>${escapeXML(startDate)}</csdo:StartDate>`)

  const endDate = resolveSmdMeasureEndDate(data)
  if (endDate) xmlParts.push(`${inner}<csdo:EndDate>${escapeXML(endDate)}</csdo:EndDate>`)

  for (const basis of measure.measureInitiationBasisDetails ?? []) {
    if (!hasBasisContent(basis)) continue
    xmlParts.push(`${inner}<smcdo:MeasureInitiationBasisDetails>`)
    const bInner = `${inner}  `
    if (basis.docKindName) {
      xmlParts.push(`${bInner}<csdo:DocKindName>${escapeXML(basis.docKindName)}</csdo:DocKindName>`)
    }
    if (basis.docName) xmlParts.push(`${bInner}<csdo:DocName>${escapeXML(basis.docName)}</csdo:DocName>`)
    if (basis.docId) xmlParts.push(`${bInner}<csdo:DocId>${escapeXML(basis.docId)}</csdo:DocId>`)
    if (basis.docCreationDate) {
      xmlParts.push(`${bInner}<csdo:DocCreationDate>${escapeXML(basis.docCreationDate)}</csdo:DocCreationDate>`)
    }
    xmlParts.push(`${inner}</smcdo:MeasureInitiationBasisDetails>`)
  }

  if (measure.measureJustificationText?.trim()) {
    xmlParts.push(
      `${inner}<smsdo:MeasureJustificationText>${escapeXML(measure.measureJustificationText.trim())}</smsdo:MeasureJustificationText>`
    )
  }
  if (measure.description?.trim()) {
    xmlParts.push(`${inner}<csdo:DescriptionText>${escapeXML(measure.description.trim())}</csdo:DescriptionText>`)
  }

  for (const c of data.smdIncidentAlerts ?? []) {
    if (!c.country?.trim() && !c.registrationNumber?.trim() && !c.type?.trim() && !c.formationDate?.trim()) {
      continue
    }
    exportIncidentAlert(xmlParts, c, inner)
  }

  if (measure.measureAffectedObjectKindCode) {
    measure.measureAffectedObjectKindCode
      .split(';')
      .map((c) => c.trim())
      .filter(Boolean)
      .forEach((code) => {
        xmlParts.push(
          `${inner}<smsdo:MeasureAffectedObjectKindCode>${escapeXML(code)}</smsdo:MeasureAffectedObjectKindCode>`
        )
      })
  }

  if (measure.measureReasonCode?.trim()) {
    xmlParts.push(
      `${inner}<smsdo:MeasureReasonCode>${escapeXML(measure.measureReasonCode.trim())}</smsdo:MeasureReasonCode>`
    )
  }

  for (const impl of measure.measureImplementationDetails ?? []) {
    if (hasMeasureImplementationEntryContent(impl)) {
      exportMeasureImplementation(xmlParts, impl, inner)
    }
  }

  if (measure.measureRepealConditionText?.trim()) {
    xmlParts.push(
      `${inner}<smsdo:MeasureRepealConditionText>${escapeXML(measure.measureRepealConditionText.trim())}</smsdo:MeasureRepealConditionText>`
    )
  }

  exportPublicHealthIncidentDetails(xmlParts, data, inner)

  for (const item of data.smdProductBatches ?? []) {
    exportNonCompliantSanitaryProductDetailsBlock(
      xmlParts,
      item.product,
      item.tsd?.batches ?? [],
      inner
    )
  }

  xmlParts.push(`${indent}</smcdo:SanitaryMeasureDetails>`)
}

export function exportSmdCardDataToXML(data: CardData): string {
  const xmlParts: string[] = []
  xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>')
  xmlParts.push('<doc:SanitaryMeasureDetails xmlns:ccdo="urn:EEC:M:ComplexDataObjects:v0.4.12"')
  xmlParts.push(' xmlns:csdo="urn:EEC:M:SimpleDataObjects:v0.4.12"')
  xmlParts.push(' xmlns:smcdo="urn:EEC:M:SM:ComplexDataObjects:v0.3.9"')
  xmlParts.push(' xmlns:smsdo="urn:EEC:M:SM:SimpleDataObjects:v0.3.9"')
  xmlParts.push(' xmlns:doc="urn:EEC:R:SM:SS:09:SanitaryMeasureDetails:v1.0.0"')
  xmlParts.push(' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
  xmlParts.push(' xsi:schemaLocation="urn:EEC:R:SM:SS:09:SanitaryMeasureDetails:v1.0.0 EEC_R_SM_SS_09_SanitaryMeasureDetails_v1.0.0.xsd">')

  xmlParts.push('  <ccdo:EDocHeader>')
  const ed = data.electronicDocument
  if (ed) {
    if (ed.messageCode) xmlParts.push(`    <csdo:InfEnvelopeCode>${escapeXML(ed.messageCode)}</csdo:InfEnvelopeCode>`)
    if (ed.documentCode) xmlParts.push(`    <csdo:EDocCode>${escapeXML(ed.documentCode)}</csdo:EDocCode>`)
    if (ed.documentId) xmlParts.push(`    <csdo:EDocId>${escapeXML(ed.documentId)}</csdo:EDocId>`)
    if (ed.documentDate) {
      xmlParts.push(`    <csdo:EDocDateTime>${escapeXML(toISODateTimeForXml(ed.documentDate))}</csdo:EDocDateTime>`)
    }
    xmlParts.push(`    <csdo:LanguageCode>${escapeXML(ed.language || 'ru')}</csdo:LanguageCode>`)
  } else {
    xmlParts.push('    <csdo:LanguageCode>ru</csdo:LanguageCode>')
  }
  xmlParts.push('  </ccdo:EDocHeader>')

  exportTemporaryMeasureDetails(xmlParts, getSmdPrimaryMeasure(data), data, '  ')

  xmlParts.push('</doc:SanitaryMeasureDetails>')
  return xmlParts.join('\n')
}
