import type {
  CardData,
  ProductData,
  ProductDetails,
  SupplyChainPartyDetails,
  AddressDetails,
  ContactDetails,
  TechnicalDocument,
  TSDData,
  ProductBatchDetails,
  ShippingDocument,
  ViolationsData,
  ViolatedRequirement,
  ViolatedIndicator,
  DetectionPlaceData,
  BusinessEntityDetails,
  BorderCheckpointDetails,
  GeoCoordinateDetails,
  MeasuresData,
  SanitaryMeasure,
  MeasureDocDetails,
  MeasureInitiationBasisItem,
  MeasureImplementationItem,
  SubjectDetails,
  DocumentReferenceDetails,
  MeasurePlaceDetails,
  UnifiedAuthorityDetails,
  ComplianceDocumentsData,
  ComplianceDocument,
  IdentityDocDetails,
} from '@/types/card'
import type { DprParsedBundle, DprResultDocRow } from '@/types/dprCard'
import type { SmrParsedBundle, SmrMeasureDocDetails, SmrResultDocRow } from '@/types/smrCard'
import type { SmaParsedBundle, SmarResponseKind } from '@/types/smaCard'
import { SANITARY_MEASURE_START_DATE_XML_PLACEHOLDER } from '@/constants/measureXml'
import { dprResultDocRowToMeasureDocDetails, hasDprResultDocRowContent } from '@/utils/dprResultDocMapping'
import {
  smrResultDocRowToMeasureDocDetails,
  hasSmrResultDocRowContent,
} from '@/utils/smrResultDocMapping'
import { getAddressListFromSubject } from '@/utils/addressFormatUtils'

/**
 * Нормализует строку даты-времени к формату для XML: yyyy-MM-ddThh:mm:ss или с дробной частью секунд.
 * Если значение уже в ISO-виде (содержит 'T'), возвращает как есть; иначе парсит и форматирует.
 */
function toISODateTimeForXml(dateTime: string | null | undefined): string {
  if (!dateTime || !dateTime.trim()) return ''
  const s = dateTime.trim()
  if (s.includes('T')) return s
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toISOString().replace('Z', '')
}

/**
 * Возвращает предупреждения о пустых элементах, которые не включаются в XML при экспорте.
 * Результат можно добавить в warnings при сравнении.
 */
export function getEmptyTagsWarnings(data: CardData): string[] {
  const warnings: string[] = []
  if (data.tsd?.batches) {
    let emptyShippingCount = 0
    let emptyBatchDetailsCount = 0
    let unifiedCommodityMeasureOmittedCount = 0
    let commodityMeasureOmittedCount = 0
    let emptyBatchesCount = 0
    for (const batch of data.tsd.batches) {
      const withoutContent = batch.shippingDocuments?.filter(doc => !hasShippingDocumentContent(doc)) ?? []
      emptyShippingCount += withoutContent.length
      if (!hasBatchDetailsContent(batch)) emptyBatchDetailsCount++
      if (batch.commodityMeasure && !(batch.commodityMeasure.value ?? '').trim()) unifiedCommodityMeasureOmittedCount++
      if (batch.batchCommodityMeasure && !(batch.batchCommodityMeasure.value ?? '').trim()) commodityMeasureOmittedCount++
      if (!hasBatchContent(batch)) emptyBatchesCount++
    }
    if (emptyShippingCount > 0) {
      warnings.push(`Обнаружены пустые товаросопроводительные документы (${emptyShippingCount}): они не включены в XML и при сравнении будут удалены.`)
    }
    if (emptyBatchDetailsCount > 0) {
      warnings.push(`Обнаружены партии без сведений о серии/партии (BatchDetails) (${emptyBatchDetailsCount}): тег smcdo:BatchDetails не включён в XML.`)
    }
    if (unifiedCommodityMeasureOmittedCount > 0) {
      warnings.push(`Количество товара не указано у ${unifiedCommodityMeasureOmittedCount} партий: тег csdo:UnifiedCommodityMeasure не включён в XML и при сравнении будет удалён.`)
    }
    if (commodityMeasureOmittedCount > 0) {
      warnings.push(`Количество товара в партии не указано у ${commodityMeasureOmittedCount} партий: тег csdo:CommodityMeasure не включён в XML и при сравнении будет удалён.`)
    }
    if (emptyBatchesCount > 0) {
      warnings.push(`Обнаружены пустые партии (${emptyBatchesCount}): тег smcdo:NonCompliantSanitaryProductBatchDetails не включён в XML и при сравнении будет удалён.`)
    }
  }
  // Нарушения: при заполненном значении показателя обязательно указывать единицу измерения (csdo:UnifiedMeasurementUnitCode)
  if (data.violations?.violatedIndicators?.length) {
    const missingUnit = data.violations.violatedIndicators.filter(
      ind => (ind.indicatorValue?.trim() ?? '') !== '' && !(ind.unitCode?.trim() ?? '')
    )
    if (missingUnit.length > 0) {
      warnings.push(`Перечень нарушенных показателей: при указании значения показателя необходимо заполнить единицу измерения (показателей без единицы: ${missingUnit.length}).`)
    }
  }
  return warnings
}

/**
 * Экспортирует CardData в XML формат с полной структурой
 */
export function exportCardDataToXML(data: CardData): string {
  console.log('[exportCardDataToXML] Начинаем экспорт, data.notification:', data.notification)
  console.log('[exportCardDataToXML] data.notification?.authorizedBody:', data.notification?.authorizedBody)
  console.log('[exportCardDataToXML] data.product:', data.product)
  console.log('[exportCardDataToXML] data.tsd:', data.tsd)
  
  const xmlParts: string[] = []
  
  // XML заголовок и корневой элемент с правильными namespace (как в исходном XML)
  xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>')
  xmlParts.push('<doc:DangerousProductAlertDetails xmlns:ccdo="urn:EEC:M:ComplexDataObjects:v0.4.12"')
  xmlParts.push(' xmlns:csdo="urn:EEC:M:SimpleDataObjects:v0.4.12"')
  xmlParts.push(' xmlns:bdt="urn:EEC:M:BaseDataTypes:v0.4.12"')
  xmlParts.push(' xmlns:smcdo="urn:EEC:M:SM:ComplexDataObjects:v0.3.9"')
  xmlParts.push(' xmlns:smsdo="urn:EEC:M:SM:SimpleDataObjects:v0.3.9"')
  xmlParts.push(' xmlns:doc="urn:EEC:R:SM:SS:08:DangerousProductAlert:v1.0.0"')
  xmlParts.push(' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
  xmlParts.push(' xsi:schemaLocation="urn:EEC:R:SM:SS:08:DangerousProductAlert:v1.0.0 EEC_R_SM_SS_08_DangerousProductAlert_v1.0.0.xsd">')
  
  // EDocHeader (только поля из ElectronicDocument, как в исходном XML)
  xmlParts.push('    <ccdo:EDocHeader>')
  if (data.electronicDocument) {
    xmlParts.push(`        <csdo:InfEnvelopeCode>${escapeXML(data.electronicDocument.messageCode)}</csdo:InfEnvelopeCode>`)
    xmlParts.push(`        <csdo:EDocCode>${escapeXML(data.electronicDocument.documentCode)}</csdo:EDocCode>`)
    xmlParts.push(`        <csdo:EDocId>${escapeXML(data.electronicDocument.documentId)}</csdo:EDocId>`)
    xmlParts.push(`        <csdo:EDocDateTime>${escapeXML(toISODateTimeForXml(data.electronicDocument.documentDate))}</csdo:EDocDateTime>`)
    xmlParts.push(`        <csdo:LanguageCode>${escapeXML(data.electronicDocument.language)}</csdo:LanguageCode>`)
  }
  xmlParts.push('    </ccdo:EDocHeader>')
  
  // DangerousProductAlertDetails (основной контент)
  xmlParts.push('    <smcdo:DangerousProductAlertDetails>')
  
  // Поля на уровне DangerousProductAlertDetails (из Notification и метаданных)
  xmlParts.push(`        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(data.country)}</csdo:UnifiedCountryCode>`)
  if (data.notification) {
    // Используем registrationNumber из метаданных как IncidentId
    xmlParts.push(`        <smsdo:IncidentId>${escapeXML(data.registrationNumber)}</smsdo:IncidentId>`)
    if (data.notification.type) {
      xmlParts.push(`        <smsdo:IncidentKindCode>${escapeXML(data.notification.type)}</smsdo:IncidentKindCode>`)
    }
    if (data.notification.formationDate) {
      const formationDateOnly = data.notification.formationDate.trim().slice(0, 10)
      if (formationDateOnly) xmlParts.push(`        <csdo:DocCreationDate>${escapeXML(formationDateOnly)}</csdo:DocCreationDate>`)
    }
    // EndDate (IncidentAlertDetailsType) — дата закрытия уведомления
    if (data.notification.endDate) {
      xmlParts.push(`        <csdo:EndDate>${escapeXML(data.notification.endDate)}</csdo:EndDate>`)
    }
  }
  
  // UnifiedAuthorityDetails (из Notification). csdo:AuthorityId в XML не экспортируем.
  if (data.notification && data.notification.authorizedBody) {
    console.log('[exportCardDataToXML] Экспортируем UnifiedAuthorityDetails:', data.notification.authorizedBody)
    xmlParts.push('        <ccdo:UnifiedAuthorityDetails>')
    if (data.notification.authorizedBody.country) {
      xmlParts.push(`            <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(data.notification.authorizedBody.country)}</csdo:UnifiedCountryCode>`)
    }
    if (data.notification.authorizedBody.name) {
      xmlParts.push(`            <csdo:AuthorityName>${escapeXML(data.notification.authorizedBody.name)}</csdo:AuthorityName>`)
    }
    if (data.notification.authorizedBody.shortName) {
      xmlParts.push(`            <csdo:AuthorityBriefName>${escapeXML(data.notification.authorizedBody.shortName)}</csdo:AuthorityBriefName>`)
    }
    xmlParts.push('        </ccdo:UnifiedAuthorityDetails>')
  } else {
    console.warn('[exportCardDataToXML] UnifiedAuthorityDetails не экспортируется: notification или authorizedBody отсутствует')
  }
  
  // Product и/или партии с нарушениями (по XSD блок один: продукция + партии)
  exportNonCompliantSanitaryProductDetailsBlock(
    xmlParts,
    data.product,
    data.tsd?.batches ?? [],
    '        '
  )
  
  // DetectionPlace (на уровне DangerousProductAlertDetails)
  if (data.detectionPlace) {
    exportDetectionPlace(xmlParts, data.detectionPlace, '        ')
  }
  
  // Measures (на уровне DangerousProductAlertDetails)
  console.log('[exportCardDataToXML] measures:', data.measures)
  const measuresWithContent = (data.measures?.measures ?? []).filter(hasMeasureContent)
  if (measuresWithContent.length > 0) {
    console.log('[exportCardDataToXML] Экспортируем SanitaryMeasureBaseDetails, количество:', measuresWithContent.length)
    measuresWithContent.forEach((measure, index) => {
      console.log(`[exportCardDataToXML] Мера ${index}:`, measure)
      exportSanitaryMeasure(xmlParts, measure, '        ')
    })
  } else {
    console.warn('[exportCardDataToXML] SanitaryMeasureBaseDetails не экспортируются: measures отсутствует, пуст или все меры без контента')
  }
  
  // ResourceItemStatusDetails (если есть данные о validityPeriod)
  console.log('[exportCardDataToXML] electronicDocument:', data.electronicDocument)
  console.log('[exportCardDataToXML] validityPeriod:', data.electronicDocument?.validityPeriod)
  if (data.electronicDocument && data.electronicDocument.validityPeriod) {
    console.log('[exportCardDataToXML] Экспортируем ResourceItemStatusDetails, start:', data.electronicDocument.validityPeriod.start)
    xmlParts.push('        <ccdo:ResourceItemStatusDetails>')
    xmlParts.push('            <ccdo:ValidityPeriodDetails>')
    if (data.electronicDocument.validityPeriod.start) {
      xmlParts.push(`                <csdo:StartDateTime>${escapeXML(toISODateTimeForXml(data.electronicDocument.validityPeriod.start))}</csdo:StartDateTime>`)
    } else {
      console.warn('[exportCardDataToXML] StartDateTime отсутствует в validityPeriod')
    }
    xmlParts.push('            </ccdo:ValidityPeriodDetails>')
    xmlParts.push('        </ccdo:ResourceItemStatusDetails>')
  } else {
    console.warn('[exportCardDataToXML] ResourceItemStatusDetails не экспортируется: electronicDocument или validityPeriod отсутствует')
  }
  
  xmlParts.push('    </smcdo:DangerousProductAlertDetails>')
  xmlParts.push('</doc:DangerousProductAlertDetails>')
  
  return xmlParts.join('\n')
}

function exportProductDetails(xmlParts: string[], details: ProductDetails, indent: string) {
  console.log('[exportProductDetails] Экспортируем ProductDetails:', details)
  console.log('[exportProductDetails] technicalDocs:', details.technicalDocs)
  
  if (details.productId) xmlParts.push(`${indent}<csdo:ProductId>${escapeXML(details.productId)}</csdo:ProductId>`)
  if (details.productName?.trim()) {
    xmlParts.push(`${indent}<csdo:ProductName>${escapeXML(details.productName.trim())}</csdo:ProductName>`)
  }
  const tradeNames = details.tradeNames?.length ? details.tradeNames : (details.tradeName ? [details.tradeName] : [])
  tradeNames.filter(Boolean).forEach((name) => {
    xmlParts.push(`${indent}<smsdo:ProductTradeName>${escapeXML(name)}</smsdo:ProductTradeName>`)
  })
  if (details.description) xmlParts.push(`${indent}<csdo:DescriptionText>${escapeXML(details.description)}</csdo:DescriptionText>`)
  if (details.commodityCode) xmlParts.push(`${indent}<csdo:CommodityCode>${escapeXML(details.commodityCode)}</csdo:CommodityCode>`)
  if (details.productPurpose) xmlParts.push(`${indent}<smsdo:ProductPurposeText>${escapeXML(details.productPurpose)}</smsdo:ProductPurposeText>`)
  if (details.applicationMethod) xmlParts.push(`${indent}<smsdo:ProductApplicationMethodText>${escapeXML(details.applicationMethod)}</smsdo:ProductApplicationMethodText>`)
  if (details.releaseForm) xmlParts.push(`${indent}<smsdo:ReleaseFormText>${escapeXML(details.releaseForm)}</smsdo:ReleaseFormText>`)
  if (details.storageCondition) xmlParts.push(`${indent}<smsdo:StorageConditionText>${escapeXML(details.storageCondition)}</smsdo:StorageConditionText>`)
  if (details.labelText) xmlParts.push(`${indent}<smsdo:ProductLabelText>${escapeXML(details.labelText)}</smsdo:ProductLabelText>`)
  
  const technicalDocsWithContent = (details.technicalDocs ?? []).filter(hasTechnicalDocContent)
  if (technicalDocsWithContent.length > 0) {
    console.log('[exportProductDetails] Экспортируем technicalDocs, количество:', technicalDocsWithContent.length)
    technicalDocsWithContent.forEach((doc, index) => {
      console.log(`[exportProductDetails] Doc ${index}:`, doc)
      xmlParts.push(`${indent}<ccdo:DocReferenceDetails>`)
      if (doc.docKindCode) {
        const codeListIdAttr = ' codeListId="2009"'
        xmlParts.push(`${indent}  <csdo:DocKindCode${codeListIdAttr}>${escapeXML(doc.docKindCode)}</csdo:DocKindCode>`)
      }
      if (doc.docName) xmlParts.push(`${indent}  <csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
      if (doc.docId) xmlParts.push(`${indent}  <csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
      if (doc.docCreationDate) xmlParts.push(`${indent}  <csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
      if (doc.docStartDate) xmlParts.push(`${indent}  <csdo:DocStartDate>${escapeXML(doc.docStartDate)}</csdo:DocStartDate>`)
      xmlParts.push(`${indent}</ccdo:DocReferenceDetails>`)
    })
  } else {
    console.warn('[exportProductDetails] technicalDocs отсутствуют или пусты')
  }
}

/** Справочник LEGALFORM (организационно-правовая форма), codeListId в XML. */
const LEGAL_FORM_CODE_LIST_ID = '2049'

/**
 * ОПФ: либо csdo:BusinessEntityTypeCode с codeListId=2049 (выбор из справочника), либо csdo:BusinessEntityTypeName (свободный текст) — не оба.
 */
function appendBusinessEntityLegalFormToXml(
  xmlParts: string[],
  indent: string,
  params: {
    businessEntityTypeCode?: string
    businessEntityTypeCodeListId?: string
    /** SupplyChainPartyDetails */
    organizationalForm?: string
    /** BusinessEntityDetails */
    businessEntityTypeName?: string
  }
): void {
  const code = params.businessEntityTypeCode?.trim()
  const listId = params.businessEntityTypeCodeListId?.trim()
  const freeText = (params.organizationalForm?.trim() || params.businessEntityTypeName?.trim()) || ''
  const fromLegalFormDictionary = !!(code && listId === LEGAL_FORM_CODE_LIST_ID)
  if (fromLegalFormDictionary) {
    xmlParts.push(
      `${indent}<csdo:BusinessEntityTypeCode codeListId="${escapeXML(LEGAL_FORM_CODE_LIST_ID)}">${escapeXML(code)}</csdo:BusinessEntityTypeCode>`
    )
    return
  }
  if (freeText) {
    xmlParts.push(`${indent}<csdo:BusinessEntityTypeName>${escapeXML(freeText)}</csdo:BusinessEntityTypeName>`)
    return
  }
  if (code) {
    const codeListIdAttr = listId ? ` codeListId="${escapeXML(listId)}"` : ''
    xmlParts.push(`${indent}<csdo:BusinessEntityTypeCode${codeListIdAttr}>${escapeXML(code)}</csdo:BusinessEntityTypeCode>`)
  }
}

function exportSupplyChainParty(xmlParts: string[], party: SupplyChainPartyDetails, kindCode: string | undefined, indent: string) {
  xmlParts.push(`${indent}<ccdo:SupplyChainPartyDetails>`)
  // Порядок по XSD: сначала все элементы BusinessEntityDetailsType, затем SupplyChainPartyKindCode (расширение типа).
  if (party.country) xmlParts.push(`${indent}  <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(party.country)}</csdo:UnifiedCountryCode>`)
  if (party.businessEntityName) xmlParts.push(`${indent}  <csdo:BusinessEntityName>${escapeXML(party.businessEntityName)}</csdo:BusinessEntityName>`)
  if (party.shortName) xmlParts.push(`${indent}  <csdo:BusinessEntityBriefName>${escapeXML(party.shortName)}</csdo:BusinessEntityBriefName>`)
  appendBusinessEntityLegalFormToXml(xmlParts, `${indent}  `, {
    businessEntityTypeCode: party.businessEntityTypeCode,
    businessEntityTypeCodeListId: party.businessEntityTypeCodeListId,
    organizationalForm: party.organizationalForm,
  })
  // BusinessEntityId в XSD с обязательным атрибутом kindId — без метода идентификации элемент не формируем
  if (party.subjectIdentifier?.trim() && party.identificationMethod?.trim()) {
    xmlParts.push(
      `${indent}  <csdo:BusinessEntityId kindId="${escapeXML(party.identificationMethod.trim())}">${escapeXML(party.subjectIdentifier.trim())}</csdo:BusinessEntityId>`
    )
  }
  if (party.customsNumber) xmlParts.push(`${indent}  <csdo:UniqueCustomsNumberId>${escapeXML(party.customsNumber)}</csdo:UniqueCustomsNumberId>`)
  if (party.taxpayerId) xmlParts.push(`${indent}  <csdo:TaxpayerId>${escapeXML(party.taxpayerId)}</csdo:TaxpayerId>`)
  if (party.taxRegistrationReasonCode) xmlParts.push(`${indent}  <csdo:TaxRegistrationReasonCode>${escapeXML(party.taxRegistrationReasonCode)}</csdo:TaxRegistrationReasonCode>`)
  
  const addrs = party.addresses ?? []
  if (addrs.length > 0) {
    addrs.filter(hasAddressContent).forEach((addr) => exportAddress(xmlParts, addr, addr.addressKindCode || '1', `${indent}  `))
  } else {
    if (hasAddressContent(party.registrationAddress)) exportAddress(xmlParts, party.registrationAddress!, '1', `${indent}  `)
    if (hasAddressContent(party.actualAddress)) exportAddress(xmlParts, party.actualAddress!, '2', `${indent}  `)
    if (hasAddressContent(party.mailingAddress)) exportAddress(xmlParts, party.mailingAddress!, '3', `${indent}  `)
  }

  const contactsWithContent = (party.contacts ?? []).filter(hasContactContent)
  if (contactsWithContent.length > 0) {
    contactsWithContent.forEach((contact) => exportCommunicationDetailsBlock(xmlParts, contact, `${indent}  `))
  }

  if ((kindCode ?? '').trim()) {
    xmlParts.push(`${indent}  <csdo:SupplyChainPartyKindCode>${escapeXML(kindCode!)}</csdo:SupplyChainPartyKindCode>`)
  }

  xmlParts.push(`${indent}</ccdo:SupplyChainPartyDetails>`)
}

function exportAddress(
  xmlParts: string[],
  address: AddressDetails,
  kindCode: string,
  indent: string,
  opts?: { wrapperTag?: 'SubjectAddressDetails' | 'ObjectAddressDetails' }
) {
  const wrapper = opts?.wrapperTag ?? 'SubjectAddressDetails'
  xmlParts.push(`${indent}<ccdo:${wrapper}>`)
  if (wrapper === 'SubjectAddressDetails') {
    xmlParts.push(`${indent}    <csdo:AddressKindCode>${escapeXML(kindCode)}</csdo:AddressKindCode>`)
  }
  if (address.country) {
    xmlParts.push(`${indent}    <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(address.country)}</csdo:UnifiedCountryCode>`)
  }
  if (address.territoryCode) xmlParts.push(`${indent}    <csdo:TerritoryCode>${escapeXML(address.territoryCode)}</csdo:TerritoryCode>`)
  if (address.regionName) xmlParts.push(`${indent}    <csdo:RegionName>${escapeXML(address.regionName)}</csdo:RegionName>`)
  if (address.districtName) xmlParts.push(`${indent}    <csdo:DistrictName>${escapeXML(address.districtName)}</csdo:DistrictName>`)
  // Только один из двух: Город или Населенный пункт (взаимоисключающие атрибуты)
  if (address.cityName?.trim()) {
    xmlParts.push(`${indent}    <csdo:CityName>${escapeXML(address.cityName)}</csdo:CityName>`)
  } else if (address.settlementName?.trim()) {
    xmlParts.push(`${indent}    <csdo:SettlementName>${escapeXML(address.settlementName)}</csdo:SettlementName>`)
  }
  if (address.streetName) xmlParts.push(`${indent}    <csdo:StreetName>${escapeXML(address.streetName)}</csdo:StreetName>`)
  if (address.buildingNumberId) xmlParts.push(`${indent}    <csdo:BuildingNumberId>${escapeXML(address.buildingNumberId)}</csdo:BuildingNumberId>`)
  if (address.roomNumberId) xmlParts.push(`${indent}    <csdo:RoomNumberId>${escapeXML(address.roomNumberId)}</csdo:RoomNumberId>`)
  // SubjectAddressDetailsType: … RoomNumberId → PostCode → PostOfficeBoxId (только для SubjectAddressDetails)
  if (wrapper === 'SubjectAddressDetails') {
    if (address.postCode?.trim()) {
      xmlParts.push(`${indent}    <csdo:PostCode>${escapeXML(address.postCode.trim())}</csdo:PostCode>`)
    }
    if (address.postOfficeBoxId?.trim()) {
      xmlParts.push(`${indent}    <csdo:PostOfficeBoxId>${escapeXML(address.postOfficeBoxId.trim())}</csdo:PostOfficeBoxId>`)
    }
    if (address.fullAddress?.trim()) {
      xmlParts.push(`${indent}    <csdo:FullAddress>${escapeXML(address.fullAddress.trim())}</csdo:FullAddress>`)
    }
  }
  xmlParts.push(`${indent}</ccdo:${wrapper}>`)
}

/**
 * ccdo:CommunicationDetails по XSD (CommunicationDetailsType): CommunicationChannelCode?, CommunicationChannelName?,
 * затем один или несколько CommunicationChannelId (по схеме обязателен хотя бы один).
 * Внутреннее поле формы contactValue при экспорте мапится на элемент csdo:CommunicationChannelId (отдельное имя в TS, не в XSD).
 * <p>Если указаны только код/имя канала без идентификатора — блок всё равно выводим: отсутствие обязательного
 * {@code CommunicationChannelId} должно выявляться структурной проверкой XSD, а не молчаливо отбрасываться при экспорте.
 */
function exportCommunicationDetailsBlock(xmlParts: string[], contact: ContactDetails, indent: string): void {
  const code = (contact.communicationChannelCode ?? '').trim()
  const name = (contact.communicationChannelName ?? '').trim()
  const idChannel = (contact.communicationChannelId ?? '').trim()
  const idFromValue = (contact.contactValue ?? '').trim()
  if (!code && !name && !idChannel && !idFromValue) return

  const child = `${indent}  `
  xmlParts.push(`${indent}<ccdo:CommunicationDetails>`)
  if (code) xmlParts.push(`${child}<csdo:CommunicationChannelCode>${escapeXML(code)}</csdo:CommunicationChannelCode>`)
  if (name) xmlParts.push(`${child}<csdo:CommunicationChannelName>${escapeXML(name)}</csdo:CommunicationChannelName>`)
  if (idChannel && idFromValue && idChannel !== idFromValue) {
    xmlParts.push(`${child}<csdo:CommunicationChannelId>${escapeXML(idChannel)}</csdo:CommunicationChannelId>`)
    xmlParts.push(`${child}<csdo:CommunicationChannelId>${escapeXML(idFromValue)}</csdo:CommunicationChannelId>`)
  } else if (idChannel || idFromValue) {
    const single = idChannel || idFromValue
    xmlParts.push(`${child}<csdo:CommunicationChannelId>${escapeXML(single)}</csdo:CommunicationChannelId>`)
  }
  xmlParts.push(`${indent}</ccdo:CommunicationDetails>`)
}

/** Есть ли хотя бы один заполненный атрибут smcdo:BatchDetails (не выводить пустой тег). */
function hasBatchDetailsContent(batch: ProductBatchDetails): boolean {
  if (batch.batchId?.trim()) return true
  if (batch.manufactureDate?.trim()) return true
  if (batch.productShelfLifeEndDate?.trim()) return true
  if (batch.note?.trim()) return true
  if (batch.commodityMeasure?.value?.trim()) return true
  return false
}

/** Есть ли хотя бы одно заполненное поле в товаросопроводительном документе (не выводить пустой тег). Учитываются вложенные продукты и участники с контентом. */
function hasShippingDocumentContent(doc: ShippingDocument): boolean {
  if (doc.docKindCode?.trim()) return true
  if (doc.docName?.trim()) return true
  if (doc.docCreationDate?.trim()) return true
  if (doc.docId?.trim()) return true
  if ((doc.products ?? []).some(hasProductDetailsContent)) return true
  if ((doc.supplyChainParties ?? []).some(hasSupplyChainPartyContent)) return true
  return false
}

/** Есть ли хотя бы одно заполненное поле в документе соответствия (не выводить пустой smcdo:ConformityDocDetails). */
function hasComplianceDocumentContent(doc: ComplianceDocument): boolean {
  if (doc.docKindCode?.trim()) return true
  if (doc.docName?.trim()) return true
  if (doc.docId?.trim()) return true
  if (doc.docCreationDate?.trim()) return true
  if (doc.docStartDate?.trim()) return true
  if (doc.authority && (doc.authority.country?.trim() || doc.authority.authorityName?.trim() || doc.authority.authorityBriefName?.trim())) return true
  return false
}

/** Есть ли контент в блоке нарушений (описание или хотя бы одно требование/показатель с контентом). */
function hasViolationsContent(v: ViolationsData): boolean {
  if (v.generalDescription?.trim()) return true
  if ((v.violatedRequirements ?? []).some(hasRequirementContent)) return true
  if ((v.violatedIndicators ?? []).some(hasIndicatorContent)) return true
  return false
}

/** Партия имеет контент с учётом вложенных элементов: после фильтрации пустых документов/блоков что-то остаётся. */
function hasBatchContent(batch: ProductBatchDetails): boolean {
  if (hasBatchDetailsContent(batch)) return true
  if (batch.consignmentId?.trim()) return true
  if ((batch.batchCommodityMeasure?.value ?? '').trim()) return true
  const docsWithContent = batch.shippingDocuments?.filter(hasShippingDocumentContent) ?? []
  if (docsWithContent.length > 0) return true
  const complianceWithContent = batch.complianceDocuments?.filter(hasComplianceDocumentContent) ?? []
  if (complianceWithContent.length > 0) return true
  const violationsList = Array.isArray(batch.violations) ? batch.violations : (batch.violations ? [batch.violations] : [])
  if (violationsList.some(hasViolationsContent)) return true
  return false
}

function hasProductDataContent(product: ProductData | undefined): boolean {
  if (!product) return false
  return !!(
    product.typeCode?.trim() ||
    product.typeName?.trim() ||
    hasProductDetailsContent(product.productDetails) ||
    hasSupplyChainPartyContent(product.manufacturer)
  )
}

/** smcdo:NonCompliantSanitaryProductDetails — продукция и партии (DPA, SMD). */
export function exportNonCompliantSanitaryProductDetailsBlock(
  xmlParts: string[],
  product: ProductData | undefined,
  batches: ProductBatchDetails[],
  indent: string
): void {
  const hasProduct = hasProductDataContent(product)
  const batchesWithContent = (batches ?? []).filter(hasBatchContent)
  const hasBatches = batchesWithContent.length > 0
  if (!hasProduct && !hasBatches) return

  xmlParts.push(`${indent}<smcdo:NonCompliantSanitaryProductDetails>`)
  const inner = `${indent}    `
  if (hasProduct) {
    if (product!.typeCode?.trim()) {
      xmlParts.push(
        `${inner}<smsdo:SanitaryProductTypeCode codeListId="1025">${escapeXML(product!.typeCode.trim())}</smsdo:SanitaryProductTypeCode>`
      )
    } else if (product!.typeName?.trim()) {
      xmlParts.push(
        `${inner}<smsdo:SanitaryProductTypeName>${escapeXML(product!.typeName.trim())}</smsdo:SanitaryProductTypeName>`
      )
    }
    if (hasProductDetailsContent(product!.productDetails)) {
      xmlParts.push(`${inner}<smcdo:ProductDetails>`)
      exportProductDetails(xmlParts, product!.productDetails ?? {}, `${inner}    `)
      xmlParts.push(`${inner}</smcdo:ProductDetails>`)
    }
    if (product!.manufacturer) {
      exportSupplyChainParty(xmlParts, product!.manufacturer, '41', inner)
    }
  }

  if (hasBatches) {
    for (const batch of batchesWithContent) {
      xmlParts.push(`${inner}<smcdo:NonCompliantSanitaryProductBatchDetails>`)
      const batchInner = `${inner}    `
      if (hasBatchDetailsContent(batch)) {
        xmlParts.push(`${batchInner}<smcdo:BatchDetails>`)
        const detailsInner = `${batchInner}    `
        if (batch.batchId) {
          xmlParts.push(`${detailsInner}<smsdo:BatchId>${escapeXML(batch.batchId)}</smsdo:BatchId>`)
        }
        if (batch.manufactureDate) {
          xmlParts.push(
            `${detailsInner}<csdo:ManufactureDate>${escapeXML(batch.manufactureDate)}</csdo:ManufactureDate>`
          )
        }
        if (batch.productShelfLifeEndDate) {
          xmlParts.push(
            `${detailsInner}<csdo:ProductShelfLifeEndDate>${escapeXML(batch.productShelfLifeEndDate)}</csdo:ProductShelfLifeEndDate>`
          )
        }
        if ((batch.commodityMeasure?.value ?? '').trim()) {
          const unitAttrs = batch.commodityMeasure?.unitCode
            ? ` measurementUnitCode="${escapeXML(batch.commodityMeasure.unitCode)}" measurementUnitCodeListId="2064"`
            : ''
          xmlParts.push(
            `${detailsInner}<csdo:UnifiedCommodityMeasure${unitAttrs}>${escapeXML(batch.commodityMeasure!.value)}</csdo:UnifiedCommodityMeasure>`
          )
        }
        if (batch.note) {
          xmlParts.push(`${detailsInner}<csdo:NoteText>${escapeXML(batch.note)}</csdo:NoteText>`)
        }
        xmlParts.push(`${batchInner}</smcdo:BatchDetails>`)
      }
      if (batch.consignmentId) {
        xmlParts.push(`${batchInner}<smsdo:ConsignmentId>${escapeXML(batch.consignmentId)}</smsdo:ConsignmentId>`)
      }
      if ((batch.batchCommodityMeasure?.value ?? '').trim()) {
        const unitAttrs = batch.batchCommodityMeasure?.unitCode
          ? ` measurementUnitCode="${escapeXML(batch.batchCommodityMeasure.unitCode)}"`
          : ''
        xmlParts.push(
          `${batchInner}<csdo:CommodityMeasure${unitAttrs}>${escapeXML(batch.batchCommodityMeasure!.value)}</csdo:CommodityMeasure>`
        )
      }
      const docsWithContent = batch.shippingDocuments?.filter(hasShippingDocumentContent) ?? []
      for (const doc of docsWithContent) {
        exportShippingDocument(xmlParts, doc, batchInner)
      }
      const complianceWithContent = batch.complianceDocuments?.filter(hasComplianceDocumentContent) ?? []
      if (complianceWithContent.length > 0) {
        exportComplianceDocuments(xmlParts, { documents: complianceWithContent }, batchInner)
      }
      const violationsList = Array.isArray(batch.violations)
        ? batch.violations
        : batch.violations
          ? [batch.violations]
          : []
      for (const v of violationsList.filter(hasViolationsContent)) {
        exportViolations(xmlParts, v, batchInner)
      }
      xmlParts.push(`${inner}</smcdo:NonCompliantSanitaryProductBatchDetails>`)
    }
  }
  xmlParts.push(`${indent}</smcdo:NonCompliantSanitaryProductDetails>`)
}

/**
 * Есть ли в строке адреса хоть какие-то данные (не «полностью пустая» строка).
 * Учитываем вид адреса (addressKindCode): иначе черновик «только вид» или неполный адрес
 * отбрасывался бы при экспорте и не попадал в XML — структурный контроль XSD его не видел.
 * Отфильтровывать на этапе экспорта нужно только полностью пустые строки, не неполные по бизнес-правилам.
 */
function hasAddressContent(addr: AddressDetails | undefined): boolean {
  if (!addr) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(
    s(addr.addressKindCode) ||
    s(addr.country) ||
    s(addr.territoryCode) ||
    s(addr.regionName) ||
    s(addr.districtName) ||
    s(addr.cityName) ||
    s(addr.settlementName) ||
    s(addr.streetName) ||
    s(addr.buildingNumberId) ||
    s(addr.roomNumberId) ||
    s(addr.postOfficeBoxId) ||
    s(addr.postCode) ||
    s(addr.fullAddress)
  )
}

/** Есть ли контент в контакте (хотя бы одно поле). */
function hasContactContent(contact: ContactDetails | undefined): boolean {
  if (!contact) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(s(contact.contactKind) || s(contact.contactValue) || s(contact.communicationChannelCode) || s(contact.communicationChannelName) || s(contact.communicationChannelId))
}

/** Есть ли контент в техническом документе (ProductDetails.technicalDocs). */
function hasTechnicalDocContent(doc: TechnicalDocument | undefined): boolean {
  if (!doc) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(s(doc.docKindCode) || s(doc.docName) || s(doc.docId) || s(doc.docCreationDate) || s(doc.docStartDate))
}

/** Есть ли контент в ProductDetails (собственные поля или технические документы с контентом). */
function hasProductDetailsContent(details: ProductDetails | undefined): boolean {
  if (!details) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  if (s(details.productId) || s(details.productName) || s(details.description) || s(details.commodityCode) || s(details.productPurpose) || s(details.applicationMethod) || s(details.releaseForm) || s(details.storageCondition) || s(details.labelText)) return true
  const tradeNames = details.tradeNames?.length ? details.tradeNames : (details.tradeName ? [details.tradeName] : [])
  if (tradeNames.some(t => (t ?? '').trim())) return true
  const withContent = (details.technicalDocs ?? []).filter(hasTechnicalDocContent)
  return withContent.length > 0
}

/** Есть ли контент у участника цепи поставки (собственные поля или адреса/контакты с контентом). */
function hasSupplyChainPartyContent(party: SupplyChainPartyDetails | undefined): boolean {
  if (!party) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  if (s(party.country) || s(party.businessEntityName) || s(party.shortName) || s(party.organizationalForm) || s(party.businessEntityTypeCode) || s(party.subjectIdentifier) || s(party.customsNumber) || s(party.taxpayerId) || s(party.taxRegistrationReasonCode) || s(party.supplyChainPartyKindCode)) return true
  const addrs = party.addresses ?? []
  if (addrs.length === 0 && (party.registrationAddress || party.actualAddress || party.mailingAddress)) {
    if (hasAddressContent(party.registrationAddress) || hasAddressContent(party.actualAddress) || hasAddressContent(party.mailingAddress)) return true
  }
  if (addrs.some(hasAddressContent)) return true
  if ((party.contacts ?? []).some(hasContactContent)) return true
  return false
}

/** Есть ли контент в нарушенном требовании (RequirementsDocDetails). */
function hasRequirementContent(req: ViolatedRequirement | undefined): boolean {
  if (!req) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  if (s(req.technicalRegulationId) || s(req.technicalRegulationName) || s(req.registrationNumber) || s(req.description)) return true
  if ((req.structuralElements ?? []).some(se => s(se.elementName) || s(se.elementId))) return true
  if (req.approvingDocument && (s(req.approvingDocument.docName) || s(req.approvingDocument.docId) || s(req.approvingDocument.docCreationDate) || s(req.approvingDocument.docStartDate))) return true
  return false
}

/** Есть ли контент в нарушенном показателе (DiscrepancyOfQualityIndexDetails). */
function hasIndicatorContent(ind: ViolatedIndicator | undefined): boolean {
  if (!ind) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(s(ind.indicatorCode) || s(ind.indicatorName) || s(ind.indicatorValue) || s(ind.unitCode) || s(ind.note))
}

/** Есть ли контент у места обнаружения/зоны распространения (с учётом вложенных пустых). */
function hasDetectionPlaceContent(place: DetectionPlaceData | undefined): boolean {
  if (!place) return false
  if (place.organization && hasOrganizationContent(place.organization)) return true
  if (place.borderCheckpoint && (place.borderCheckpoint.checkpointCode?.trim() || place.borderCheckpoint.checkpointName?.trim())) return true
  if (place.address && hasAddressContent(place.address)) return true
  if (place.geoCoordinates?.some(c => (c.longitude ?? '').trim() || (c.latitude ?? '').trim())) return true
  if (place.description?.trim()) return true
  return false
}

/** Есть ли контент в основании применения меры (MeasureInitiationBasisDetails). */
function hasBasisContent(basis: MeasureInitiationBasisItem | undefined): boolean {
  if (!basis) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(s(basis.docKindName) || s(basis.docName) || s(basis.docId) || s(basis.docCreationDate))
}

/** Пустые smcdo:MeasureDocDetails / InitialMeasureDocDetails в XML не выводим. */
function hasMeasureDocDetailsContent(doc: MeasureDocDetails | undefined): boolean {
  if (!doc) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  if (
    s(doc.country) ||
    s(doc.languageCode) ||
    s(doc.docKindCode) ||
    s(doc.docKindName) ||
    s(doc.docName) ||
    s(doc.docSeriesId) ||
    s(doc.docId) ||
    s(doc.docCreationDate) ||
    s(doc.docStartDate) ||
    s(doc.docValidityDate) ||
    s(doc.docValidityDuration) ||
    s(doc.authorityName) ||
    s(doc.description) ||
    s(doc.pageQuantity)
  ) {
    return true
  }
  if (doc.docBinaryText && (s(doc.docBinaryText.content) || s(doc.docBinaryText.mediaTypeCode))) return true
  if (s(doc.xmlDocument)) return true
  return false
}

export function hasUnifiedAuthorityMeasureContent(auth: UnifiedAuthorityDetails | undefined): boolean {
  if (!auth) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(s(auth.country) || s(auth.authorityName) || s(auth.authorityBriefName))
}

export function hasSubjectDetailsContent(sd: SubjectDetails | undefined): boolean {
  if (!sd) return false
  if (sd.businessEntity && hasOrganizationContent(sd.businessEntity)) return true
  const s = (v: string | undefined) => (v ?? '').trim()
  if (s(sd.country) || s(sd.subjectName)) return true
  if (sd.identityDoc) {
    const id = sd.identityDoc
    if (
      s(id.country) ||
      s(id.docKindCode) ||
      s(id.docKindName) ||
      s(id.docSeriesId) ||
      s(id.docId) ||
      s(id.docCreationDate) ||
      s(id.docValidityDate) ||
      s(id.authorityName)
    ) {
      return true
    }
  }
  if ((sd.addresses ?? []).some(hasAddressContent)) return true
  if (sd.registrationAddress && hasAddressContent(sd.registrationAddress)) return true
  if (sd.actualAddress && hasAddressContent(sd.actualAddress)) return true
  if (sd.mailingAddress && hasAddressContent(sd.mailingAddress)) return true
  if ((sd.contacts ?? []).some(hasContactContent)) return true
  return false
}

/**
 * Есть ли контент в блоке реализации меры (MeasureImplementationDetails) — как при отборе к экспорту.
 * Для валидации: пустой черновик строки не требует страны/дат/описания.
 */
export function hasMeasureImplementationEntryContent(impl: MeasureImplementationItem | undefined): boolean {
  if (!impl) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  if (s(impl.country) || s(impl.startDate) || s(impl.endDate) || s(impl.description)) return true
  if (impl.measureAffectedObjectKindCode?.trim()) return true
  if ((impl.authorities ?? []).some(hasUnifiedAuthorityMeasureContent)) return true
  if ((impl.subjectDetailsList ?? []).some(hasSubjectDetailsContent)) return true
  if (hasUnifiedAuthorityMeasureContent(impl.authority)) return true
  if (hasSubjectDetailsContent(impl.subjectDetails)) return true
  if (impl.documentDetails && hasDocumentReferenceContent(impl.documentDetails)) return true
  if (impl.placeDetails && (s(impl.placeDetails.regionName) || s(impl.placeDetails.borderCheckpointCode) || s(impl.placeDetails.borderCheckpointName))) return true
  return false
}

export function hasDocumentReferenceContent(doc: DocumentReferenceDetails | undefined): boolean {
  if (!doc) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(s(doc.docKindCode) || s(doc.docKindName) || s(doc.docName) || s(doc.docId) || s(doc.docCreationDate) || s(doc.docStartDate))
}

export function hasIdentityDocV3Content(id: IdentityDocDetails | undefined): boolean {
  if (!id) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(
    s(id.country) ||
    s(id.docKindCode) ||
    s(id.docKindName) ||
    s(id.docSeriesId) ||
    s(id.docId) ||
    s(id.docCreationDate) ||
    s(id.docValidityDate) ||
    s(id.authorityName)
  )
}

function exportIdentityDocV3Details(xmlParts: string[], idDoc: IdentityDocDetails, indent: string) {
  if (!hasIdentityDocV3Content(idDoc)) return
  xmlParts.push(`${indent}<ccdo:IdentityDocV3Details>`)
  if (idDoc.country) {
    xmlParts.push(`${indent}  <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(idDoc.country)}</csdo:UnifiedCountryCode>`)
  }
  if (idDoc.docKindCode?.trim()) {
    const listId = idDoc.docKindCodeListId?.trim() || '2053'
    xmlParts.push(`${indent}  <csdo:IdentityDocKindCode codeListId="${escapeXML(listId)}">${escapeXML(idDoc.docKindCode.trim())}</csdo:IdentityDocKindCode>`)
  } else if (idDoc.docKindName?.trim()) {
    xmlParts.push(`${indent}  <csdo:DocKindName>${escapeXML(idDoc.docKindName.trim())}</csdo:DocKindName>`)
  }
  if (idDoc.docSeriesId) xmlParts.push(`${indent}  <csdo:DocSeriesId>${escapeXML(idDoc.docSeriesId)}</csdo:DocSeriesId>`)
  if (idDoc.docId) xmlParts.push(`${indent}  <csdo:DocId>${escapeXML(idDoc.docId)}</csdo:DocId>`)
  if (idDoc.docCreationDate) xmlParts.push(`${indent}  <csdo:DocCreationDate>${escapeXML(idDoc.docCreationDate)}</csdo:DocCreationDate>`)
  if (idDoc.docValidityDate) xmlParts.push(`${indent}  <csdo:DocValidityDate>${escapeXML(idDoc.docValidityDate)}</csdo:DocValidityDate>`)
  if (idDoc.authorityName) xmlParts.push(`${indent}  <csdo:AuthorityName>${escapeXML(idDoc.authorityName)}</csdo:AuthorityName>`)
  xmlParts.push(`${indent}</ccdo:IdentityDocV3Details>`)
}

function exportMeasureAuthority(xmlParts: string[], authority: UnifiedAuthorityDetails, indent: string) {
  xmlParts.push(`${indent}<ccdo:UnifiedAuthorityDetails>`)
  if (authority.country) {
    xmlParts.push(`${indent}  <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(authority.country)}</csdo:UnifiedCountryCode>`)
  }
  if (authority.authorityName) xmlParts.push(`${indent}  <csdo:AuthorityName>${escapeXML(authority.authorityName)}</csdo:AuthorityName>`)
  if (authority.authorityBriefName) {
    xmlParts.push(`${indent}  <csdo:AuthorityBriefName>${escapeXML(authority.authorityBriefName)}</csdo:AuthorityBriefName>`)
  }
  xmlParts.push(`${indent}</ccdo:UnifiedAuthorityDetails>`)
}

function exportMeasureSubjectDetails(xmlParts: string[], subject: SubjectDetails, indent: string) {
  const subIndent = `${indent}  `
  xmlParts.push(`${indent}<smcdo:SubjectDetails>`)
  if (subject.businessEntity) {
    const entity = subject.businessEntity
    if (entity.country) xmlParts.push(`${subIndent}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(entity.country)}</csdo:UnifiedCountryCode>`)
    // SubjectDetails по XSD (ccdo:SubjectDetailsType): SubjectName / SubjectBriefName, не BusinessEntityName
    if (entity.businessEntityName?.trim()) {
      xmlParts.push(`${subIndent}<csdo:SubjectName>${escapeXML(entity.businessEntityName.trim())}</csdo:SubjectName>`)
    }
    if (entity.businessEntityBriefName?.trim()) {
      xmlParts.push(`${subIndent}<csdo:SubjectBriefName>${escapeXML(entity.businessEntityBriefName.trim())}</csdo:SubjectBriefName>`)
    }
    appendBusinessEntityLegalFormToXml(xmlParts, subIndent, {
      businessEntityTypeCode: entity.businessEntityTypeCode,
      businessEntityTypeCodeListId: entity.businessEntityTypeCodeListId,
      businessEntityTypeName: entity.businessEntityTypeName,
    })
    const regId = (entity.businessEntityId ?? '').trim()
    const idMethod = (entity.identificationMethod ?? '').trim()
    if (regId && idMethod) {
      xmlParts.push(`${subIndent}<csdo:BusinessEntityId kindId="${escapeXML(idMethod)}">${escapeXML(regId)}</csdo:BusinessEntityId>`)
    }
    if (entity.customsNumber) xmlParts.push(`${subIndent}<csdo:UniqueCustomsNumberId>${escapeXML(entity.customsNumber)}</csdo:UniqueCustomsNumberId>`)
    if (entity.taxpayerId) xmlParts.push(`${subIndent}<csdo:TaxpayerId>${escapeXML(entity.taxpayerId)}</csdo:TaxpayerId>`)
    if (entity.taxRegistrationReasonCode?.trim()) {
      xmlParts.push(
        `${subIndent}<csdo:TaxRegistrationReasonCode>${escapeXML(entity.taxRegistrationReasonCode.trim())}</csdo:TaxRegistrationReasonCode>`
      )
    }
    // SubjectDetailsType: после TaxpayerId — IdentityDocV3Details, затем SubjectAddressDetails, затем CommunicationDetails (EEC_M_ComplexDataObjects SubjectDetailsType).
    if (subject.identityDoc) exportIdentityDocV3Details(xmlParts, subject.identityDoc, subIndent)
    /** Адреса: при юрлице обычно в businessEntity.addresses; если массив пуст, форма может держать строки в subject (регистрационный/фактический/почтовый или addresses) — как в getAddressListFromSubject. */
    const implAddresses =
      entity.addresses && entity.addresses.length > 0 ? entity.addresses : getAddressListFromSubject(subject)
    implAddresses.forEach((addr) => {
      exportAddress(xmlParts, addr, addr.addressKindCode || '1', subIndent)
    })
    const implContacts =
      entity.contacts && entity.contacts.length > 0 ? entity.contacts : (subject.contacts ?? [])
    implContacts.forEach((contact) => exportCommunicationDetailsBlock(xmlParts, contact, subIndent))
  } else {
    // SubjectDetailsType (XSD): UnifiedCountryCode, SubjectName, … IdentityDocV3Details, затем SubjectAddressDetails, CommunicationDetails — порядок не менять.
    if (subject.country) xmlParts.push(`${subIndent}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(subject.country)}</csdo:UnifiedCountryCode>`)
    if (subject.subjectName) xmlParts.push(`${subIndent}<csdo:SubjectName>${escapeXML(subject.subjectName)}</csdo:SubjectName>`)
    if (subject.identityDoc) exportIdentityDocV3Details(xmlParts, subject.identityDoc, subIndent)
    /** Адреса: subject.addresses из формы исполнителя (syncAddresses); иначе рег./факт./почт. Логику identityDoc не затрагивает. */
    getAddressListFromSubject(subject).forEach((addr) => {
      exportAddress(xmlParts, addr, addr.addressKindCode || '1', subIndent)
    })
    if (subject.contacts && subject.contacts.length > 0) {
      subject.contacts.forEach((contact) => exportCommunicationDetailsBlock(xmlParts, contact, subIndent))
    }
  }
  xmlParts.push(`${indent}</smcdo:SubjectDetails>`)
}

/** Есть ли контент у меры (собственные поля или вложенные блоки с контентом). Начальная дата в форме может быть пустой — в XML подставляется плейсхолдер (см. SANITARY_MEASURE_START_DATE_XML_PLACEHOLDER). */
function hasMeasureContent(measure: SanitaryMeasure | undefined): boolean {
  if (!measure) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  if (
    s(measure.languageCode) ||
    s(measure.measureCode) ||
    s(measure.measureName) ||
    s(measure.measureAffectedObjectKindCode) ||
    s(measure.startDate) ||
    s(measure.endDate) ||
    s(measure.measureJustificationText) ||
    s(measure.description)
  ) {
    return true
  }
  if (hasMeasureDocDetailsContent(measure.measureDocDetails)) return true
  if (hasMeasureDocDetailsContent(measure.initialMeasureDocDetails)) return true
  const basisWithContent = (measure.measureInitiationBasisDetails ?? []).filter(hasBasisContent)
  if (basisWithContent.length > 0) return true
  const implWithContent = (measure.measureImplementationDetails ?? []).filter(hasMeasureImplementationEntryContent)
  if (implWithContent.length > 0) return true
  return false
}

function exportShippingDocument(xmlParts: string[], doc: ShippingDocument, indent: string) {
  xmlParts.push(`${indent}<smcdo:ShippingDocumentDetails>`)
  if (doc.docKindCode) {
    xmlParts.push(`${indent}    <csdo:DocKindCode codeListId="2009">${escapeXML(doc.docKindCode)}</csdo:DocKindCode>`)
  }
  if (doc.docName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
  if (doc.docCreationDate) xmlParts.push(`${indent}    <csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
  if (doc.docId) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
  
  const productsWithContent = (doc.products ?? []).filter(hasProductDetailsContent)
  if (productsWithContent.length > 0) {
    productsWithContent.forEach(product => {
      xmlParts.push(`${indent}    <smcdo:ProductDetails>`)
      exportProductDetails(xmlParts, product, `${indent}        `)
      xmlParts.push(`${indent}    </smcdo:ProductDetails>`)
    })
  }

  const partiesWithContent = (doc.supplyChainParties ?? []).filter(hasSupplyChainPartyContent)
  if (partiesWithContent.length > 0) {
    partiesWithContent.forEach((party) => {
      const kindCode = (party.supplyChainPartyKindCode ?? '').trim() || undefined
      exportSupplyChainParty(xmlParts, party, kindCode, `${indent}    `)
    })
  }
  
  xmlParts.push(`${indent}</smcdo:ShippingDocumentDetails>`)
}

function exportViolations(xmlParts: string[], violations: ViolationsData, indent: string) {
  // По XSD (RequirementViolationDetailsType): RequirementsDocDetails+ → DiscrepancyOfQualityIndexDetails* → DescriptionText?
  const reqsWithContent = (violations.violatedRequirements ?? []).filter(hasRequirementContent)
  const indsWithContent = (violations.violatedIndicators ?? []).filter(hasIndicatorContent)
  const hasGeneralDesc = !!(violations.generalDescription && violations.generalDescription.trim())

  xmlParts.push(`${indent}<smcdo:RequirementViolationDetails>`)
  const inner = indent + '  '

  // 1) Список RequirementsDocDetails (обязателен минимум один по XSD)
  if (reqsWithContent.length > 0) {
    reqsWithContent.forEach((req) => {
      xmlParts.push(`${inner}<smcdo:RequirementsDocDetails>`)
      if (req.technicalRegulationId) xmlParts.push(`${inner}  <smsdo:TechnicalRegulationId>${escapeXML(req.technicalRegulationId)}</smsdo:TechnicalRegulationId>`)
      if (req.technicalRegulationName) xmlParts.push(`${inner}  <csdo:DocName>${escapeXML(req.technicalRegulationName)}</csdo:DocName>`)
      if (req.registrationNumber) xmlParts.push(`${inner}  <csdo:DocId>${escapeXML(req.registrationNumber)}</csdo:DocId>`)
      const structWithContent = (req.structuralElements ?? []).filter(se => (se.elementName ?? '').trim() || (se.elementId ?? '').trim())
      if (structWithContent.length > 0) {
        structWithContent.forEach(structEl => {
          xmlParts.push(`${inner}  <smcdo:DocStructuralElementDetails>`)
          if (structEl.elementName) xmlParts.push(`${inner}    <smsdo:DocStructuralElementName>${escapeXML(structEl.elementName)}</smsdo:DocStructuralElementName>`)
          if (structEl.elementId) xmlParts.push(`${inner}    <smsdo:DocStructuralElementId>${escapeXML(structEl.elementId)}</smsdo:DocStructuralElementId>`)
          xmlParts.push(`${inner}  </smcdo:DocStructuralElementDetails>`)
        })
      }
      if (req.approvingDocument && (req.approvingDocument.docName || req.approvingDocument.docId || req.approvingDocument.docCreationDate || req.approvingDocument.docStartDate)) {
        xmlParts.push(`${inner}  <ccdo:DocReferenceDetails>`)
        if (req.approvingDocument.docName) xmlParts.push(`${inner}    <csdo:DocName>${escapeXML(req.approvingDocument.docName)}</csdo:DocName>`)
        if (req.approvingDocument.docId) xmlParts.push(`${inner}    <csdo:DocId>${escapeXML(req.approvingDocument.docId)}</csdo:DocId>`)
        if (req.approvingDocument.docCreationDate) xmlParts.push(`${inner}    <csdo:DocCreationDate>${escapeXML(req.approvingDocument.docCreationDate)}</csdo:DocCreationDate>`)
        if (req.approvingDocument.docStartDate) xmlParts.push(`${inner}    <csdo:DocStartDate>${escapeXML(req.approvingDocument.docStartDate)}</csdo:DocStartDate>`)
        xmlParts.push(`${inner}  </ccdo:DocReferenceDetails>`)
      }
      if (req.description) {
        xmlParts.push(`${inner}  <csdo:DescriptionText>${escapeXML(req.description)}</csdo:DescriptionText>`)
      }
      xmlParts.push(`${inner}</smcdo:RequirementsDocDetails>`)
    })
  } else {
    xmlParts.push(`${inner}<smcdo:RequirementsDocDetails></smcdo:RequirementsDocDetails>`)
  }

  // 2) DiscrepancyOfQualityIndexDetails. Признак нормативного показателя — true/false. Единица измерения — в csdo:UnifiedMeasurementUnitCode с codeListId=2064.
  indsWithContent.forEach(indicator => {
    const normativeAttr = indicator.isNormative === true ? ' normativeDiscrepancyOfQualityIndexIndicator="true"' : (indicator.isNormative === false ? ' normativeDiscrepancyOfQualityIndexIndicator="false"' : '')
    xmlParts.push(`${inner}<smcdo:DiscrepancyOfQualityIndexDetails${normativeAttr}>`)
    if (indicator.indicatorCode) xmlParts.push(`${inner}  <smsdo:DiscrepancyOfQualityIndexCode>${escapeXML(indicator.indicatorCode)}</smsdo:DiscrepancyOfQualityIndexCode>`)
    if (indicator.indicatorName) xmlParts.push(`${inner}  <smsdo:DiscrepancyOfQualityIndexName>${escapeXML(indicator.indicatorName)}</smsdo:DiscrepancyOfQualityIndexName>`)
    if (indicator.indicatorValue) {
      xmlParts.push(`${inner}  <smsdo:DiscrepancyOfQualityIndexValue>${escapeXML(indicator.indicatorValue)}</smsdo:DiscrepancyOfQualityIndexValue>`)
    }
    if (indicator.unitCode?.trim()) {
      xmlParts.push(`${inner}  <csdo:UnifiedMeasurementUnitCode codeListId="2064">${escapeXML(indicator.unitCode)}</csdo:UnifiedMeasurementUnitCode>`)
    }
    if (indicator.note) {
      xmlParts.push(`${inner}  <csdo:NoteText>${escapeXML(indicator.note)}</csdo:NoteText>`)
    }
    xmlParts.push(`${inner}</smcdo:DiscrepancyOfQualityIndexDetails>`)
  })

  // 3) Описание нарушения на уровне RequirementViolationDetails — только после требований и показателей (XSD sequence)
  if (hasGeneralDesc) {
    xmlParts.push(`${inner}<csdo:DescriptionText>${escapeXML(violations.generalDescription!)}</csdo:DescriptionText>`)
  }

  xmlParts.push(`${indent}</smcdo:RequirementViolationDetails>`)
}

function hasOrganizationContent(org: BusinessEntityDetails | undefined): boolean {
  if (!org) return false
  const party = org as unknown as SupplyChainPartyDetails
  if (org.country?.trim()) return true
  if (org.businessEntityName?.trim()) return true
  if (org.businessEntityBriefName?.trim()) return true
  if (org.businessEntityTypeCode?.trim()) return true
  if (org.businessEntityTypeName?.trim()) return true
  if (party.organizationalForm?.trim()) return true
  if (org.businessEntityId?.trim()) return true
  if (party.subjectIdentifier?.trim()) return true
  if (org.identificationMethod?.trim()) return true
  if (org.customsNumber?.trim()) return true
  if (org.taxRegistrationReasonCode?.trim()) return true
  if (org.taxpayerId?.trim()) return true
  if ((org.addresses ?? []).some(hasAddressContent)) return true
  if ((org.contacts ?? []).some(hasContactContent)) return true
  return false
}

/** Экспорт LocationDetailsType (место обнаружения или зона распространения). wrapperTag — имя элемента smcdo. Пустой блок не выводится. */
export function exportDetectionPlace(
  xmlParts: string[],
  place: DetectionPlaceData,
  indent: string,
  wrapperTag: 'DetectionPlaceDetails' | 'SpreadingZoneDetails' = 'DetectionPlaceDetails'
) {
  if (!hasDetectionPlaceContent(place)) return
  xmlParts.push(`${indent}<smcdo:${wrapperTag}>`)
  // Порядок по XSD LocationDetailsType: OrganizationDetails, BorderCheckpointDetails, ObjectAddressDetails, GeoCoordinateDetails, DescriptionText
  if (place.organization && hasOrganizationContent(place.organization)) {
    xmlParts.push(`${indent}    <smcdo:OrganizationDetails>`)
    if (place.organization.country) {
      xmlParts.push(`${indent}        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(place.organization.country)}</csdo:UnifiedCountryCode>`)
    }
    if (place.organization.businessEntityName) xmlParts.push(`${indent}        <csdo:BusinessEntityName>${escapeXML(place.organization.businessEntityName)}</csdo:BusinessEntityName>`)
    if (place.organization.businessEntityBriefName) xmlParts.push(`${indent}        <csdo:BusinessEntityBriefName>${escapeXML(place.organization.businessEntityBriefName)}</csdo:BusinessEntityBriefName>`)
    appendBusinessEntityLegalFormToXml(xmlParts, `${indent}        `, {
      businessEntityTypeCode: place.organization.businessEntityTypeCode,
      businessEntityTypeCodeListId: place.organization.businessEntityTypeCodeListId,
      organizationalForm: (place.organization as unknown as SupplyChainPartyDetails).organizationalForm,
      businessEntityTypeName: place.organization.businessEntityTypeName,
    })
    const orgParty = place.organization as unknown as SupplyChainPartyDetails
    const businessEntityIdValue =
      (place.organization.businessEntityId ?? orgParty.subjectIdentifier)?.trim() || ''
    const idMethod = (place.organization.identificationMethod ?? '').trim()
    if (businessEntityIdValue && idMethod) {
      xmlParts.push(
        `${indent}        <csdo:BusinessEntityId kindId="${escapeXML(idMethod)}">${escapeXML(businessEntityIdValue)}</csdo:BusinessEntityId>`
      )
    }
    if (place.organization.customsNumber) {
      xmlParts.push(`${indent}        <csdo:UniqueCustomsNumberId>${escapeXML(place.organization.customsNumber)}</csdo:UniqueCustomsNumberId>`)
    }
    if (place.organization.taxpayerId) xmlParts.push(`${indent}        <csdo:TaxpayerId>${escapeXML(place.organization.taxpayerId)}</csdo:TaxpayerId>`)
    if (place.organization.taxRegistrationReasonCode) {
      xmlParts.push(`${indent}        <csdo:TaxRegistrationReasonCode>${escapeXML(place.organization.taxRegistrationReasonCode)}</csdo:TaxRegistrationReasonCode>`)
    }
    const addrsWithContent = (place.organization.addresses ?? []).filter(hasAddressContent)
    if (addrsWithContent.length > 0) {
      addrsWithContent.forEach(addr => {
        exportAddress(xmlParts, addr, addr.addressKindCode || '1', `${indent}        `)
      })
    }
    const contactsWithContent = (place.organization.contacts ?? []).filter(hasContactContent)
    if (contactsWithContent.length > 0) {
      contactsWithContent.forEach((contact) =>
        exportCommunicationDetailsBlock(xmlParts, contact, `${indent}        `)
      )
    }
    xmlParts.push(`${indent}    </smcdo:OrganizationDetails>`)
  }
  if (place.borderCheckpoint && (place.borderCheckpoint.checkpointCode?.trim() || place.borderCheckpoint.checkpointName?.trim())) {
    xmlParts.push(`${indent}    <smcdo:BorderCheckpointDetails>`)
    // BorderCheckpointCodeType в XSD — простой тип без codeListId; у Unified*Code / DocKindCode и т.п. codeListId по схеме нужен
    if (place.borderCheckpoint.checkpointCode) xmlParts.push(`${indent}        <csdo:BorderCheckpointCode>${escapeXML(place.borderCheckpoint.checkpointCode)}</csdo:BorderCheckpointCode>`)
    if (place.borderCheckpoint.checkpointName) xmlParts.push(`${indent}        <csdo:BorderCheckpointName>${escapeXML(place.borderCheckpoint.checkpointName)}</csdo:BorderCheckpointName>`)
    xmlParts.push(`${indent}    </smcdo:BorderCheckpointDetails>`)
  }
  if (place.address && hasAddressContent(place.address)) {
    exportAddress(xmlParts, place.address, '1', `${indent}    `, { wrapperTag: 'ObjectAddressDetails' })
  }
  
  if (place.geoCoordinates && place.geoCoordinates.length > 0) {
    for (const coord of place.geoCoordinates) {
      if (coord.longitude || coord.latitude) {
        xmlParts.push(`${indent}    <ccdo:GeoCoordinateDetails>`)
        if (coord.longitude) xmlParts.push(`${indent}        <csdo:LongitudeMeasure>${escapeXML(coord.longitude)}</csdo:LongitudeMeasure>`)
        if (coord.latitude) xmlParts.push(`${indent}        <csdo:LatitudeMeasure>${escapeXML(coord.latitude)}</csdo:LatitudeMeasure>`)
        xmlParts.push(`${indent}    </ccdo:GeoCoordinateDetails>`)
      }
    }
  }
  
  if (place.description) {
    xmlParts.push(`${indent}    <csdo:DescriptionText>${escapeXML(place.description)}</csdo:DescriptionText>`)
  }
  
  xmlParts.push(`${indent}</smcdo:${wrapperTag}>`)
}

/** Экспорт зоны распространения (smcdo:SpreadingZoneDetails). Используется в PHA. */
export function exportSpreadingZone(xmlParts: string[], place: DetectionPlaceData, indent: string) {
  exportDetectionPlace(xmlParts, place, indent, 'SpreadingZoneDetails')
}

function exportSanitaryMeasure(xmlParts: string[], measure: SanitaryMeasure, indent: string) {
  xmlParts.push(`${indent}<smcdo:SanitaryMeasureBaseDetails>`)
  // Порядок по XSD SanitaryMeasureBaseDetailsType: LanguageCode, MeasureCode, MeasureName, MeasureDocDetails (обязателен),
  // InitialMeasureDocDetails, StartDate, EndDate, MeasureInitiationBasisDetails*, MeasureJustificationText, DescriptionText?,
  // MeasureAffectedObjectKindCode*, MeasureImplementationDetails*
  if (measure.languageCode) xmlParts.push(`${indent}  <csdo:LanguageCode>${escapeXML(measure.languageCode)}</csdo:LanguageCode>`)
  if (measure.measureCode?.trim()) {
    const listId = measure.measureCodeListId?.trim() || '1067'
    xmlParts.push(`${indent}  <smsdo:MeasureCode codeListId="${escapeXML(listId)}">${escapeXML(measure.measureCode.trim())}</smsdo:MeasureCode>`)
  }
  if (measure.measureName?.trim()) {
    xmlParts.push(`${indent}  <smsdo:MeasureName>${escapeXML(measure.measureName.trim())}</smsdo:MeasureName>`)
  }
  if (hasMeasureDocDetailsContent(measure.measureDocDetails)) {
    exportMeasureDocDetails(xmlParts, measure.measureDocDetails!, 'MeasureDocDetails', `${indent}  `)
  } else {
    xmlParts.push(`${indent}  <smcdo:MeasureDocDetails></smcdo:MeasureDocDetails>`)
  }

  if (hasMeasureDocDetailsContent(measure.initialMeasureDocDetails)) {
    exportMeasureDocDetails(xmlParts, measure.initialMeasureDocDetails!, 'InitialMeasureDocDetails', `${indent}  `)
  }

  const startDateForXml =
    measure.startDate?.trim() || SANITARY_MEASURE_START_DATE_XML_PLACEHOLDER
  xmlParts.push(`${indent}  <csdo:StartDate>${escapeXML(startDateForXml)}</csdo:StartDate>`)
  if (measure.endDate) xmlParts.push(`${indent}  <csdo:EndDate>${escapeXML(measure.endDate)}</csdo:EndDate>`)

  const basisWithContent = (measure.measureInitiationBasisDetails ?? []).filter(hasBasisContent)
  if (basisWithContent.length > 0) {
    basisWithContent.forEach(basis => {
      xmlParts.push(`${indent}  <smcdo:MeasureInitiationBasisDetails>`)
      if (basis.docKindName) xmlParts.push(`${indent}    <csdo:DocKindName>${escapeXML(basis.docKindName)}</csdo:DocKindName>`)
      if (basis.docName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(basis.docName)}</csdo:DocName>`)
      if (basis.docId) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(basis.docId)}</csdo:DocId>`)
      if (basis.docCreationDate) xmlParts.push(`${indent}    <csdo:DocCreationDate>${escapeXML(basis.docCreationDate)}</csdo:DocCreationDate>`)
      xmlParts.push(`${indent}  </smcdo:MeasureInitiationBasisDetails>`)
    })
  }

  if (measure.measureJustificationText) {
    xmlParts.push(`${indent}  <smsdo:MeasureJustificationText>${escapeXML(measure.measureJustificationText)}</smsdo:MeasureJustificationText>`)
  }
  if (measure.description?.trim()) {
    xmlParts.push(`${indent}  <csdo:DescriptionText>${escapeXML(measure.description.trim())}</csdo:DescriptionText>`)
  }
  if (measure.measureAffectedObjectKindCode) {
    const codes = measure.measureAffectedObjectKindCode.split(';').map((c) => c.trim()).filter(Boolean)
    codes.forEach((code) =>
      xmlParts.push(`${indent}  <smsdo:MeasureAffectedObjectKindCode>${escapeXML(code)}</smsdo:MeasureAffectedObjectKindCode>`)
    )
  }

  const implWithContent = (measure.measureImplementationDetails ?? []).filter(hasMeasureImplementationEntryContent)
  if (implWithContent.length > 0) {
    implWithContent.forEach(impl => {
      exportMeasureImplementation(xmlParts, impl, `${indent}  `)
    })
  }

  xmlParts.push(`${indent}</smcdo:SanitaryMeasureBaseDetails>`)
}

/**
 * Только элементы smcdo:SanitaryMeasureBaseDetails (для патча XML DPR при сохранении).
 * Пустая строка — удалить все меры на сервере.
 */
export function exportSanitaryMeasuresXmlFragment(
  measures: MeasuresData | null | undefined,
  indent = '        '
): string {
  const xmlParts: string[] = []
  const measuresWithContent = (measures?.measures ?? []).filter(hasMeasureContent)
  measuresWithContent.forEach((measure) => {
    exportSanitaryMeasure(xmlParts, measure, indent)
  })
  return xmlParts.join('\n')
}

/** Элементы ccdo:DocContentDetails для DPR (тот же состав полей, что DocContentDetailsType / документ меры). */
function exportDocContentDetailsBlock(xmlParts: string[], doc: MeasureDocDetails, indent: string) {
  const inner = `${indent}    `
  xmlParts.push(`${indent}<ccdo:DocContentDetails>`)
  if (doc.country) {
    xmlParts.push(`${inner}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(doc.country)}</csdo:UnifiedCountryCode>`)
  }
  if (doc.languageCode) xmlParts.push(`${inner}<csdo:LanguageCode>${escapeXML(doc.languageCode)}</csdo:LanguageCode>`)
  if (doc.docKindCode?.trim()) {
    const listId = doc.docKindCodeListId?.trim() || '2009'
    xmlParts.push(`${inner}<csdo:DocKindCode codeListId="${escapeXML(listId)}">${escapeXML(doc.docKindCode.trim())}</csdo:DocKindCode>`)
  } else if (doc.docKindName?.trim()) {
    xmlParts.push(`${inner}<csdo:DocKindName>${escapeXML(doc.docKindName.trim())}</csdo:DocKindName>`)
  }
  if (doc.docName) xmlParts.push(`${inner}<csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
  if (doc.docSeriesId) xmlParts.push(`${inner}<csdo:DocSeriesId>${escapeXML(doc.docSeriesId)}</csdo:DocSeriesId>`)
  if (doc.docId) xmlParts.push(`${inner}<csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
  if (doc.docCreationDate) xmlParts.push(`${inner}<csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
  if (doc.docStartDate) xmlParts.push(`${inner}<csdo:DocStartDate>${escapeXML(doc.docStartDate)}</csdo:DocStartDate>`)
  if (doc.docValidityDate) xmlParts.push(`${inner}<csdo:DocValidityDate>${escapeXML(doc.docValidityDate)}</csdo:DocValidityDate>`)
  if (doc.docValidityDuration) xmlParts.push(`${inner}<csdo:DocValidityDuration>${escapeXML(doc.docValidityDuration)}</csdo:DocValidityDuration>`)
  if (doc.authorityId?.trim()) {
    xmlParts.push(`${inner}<csdo:AuthorityId>${escapeXML(doc.authorityId.trim())}</csdo:AuthorityId>`)
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
    xmlParts.push(`${inner}<csdo:DocBinaryText${mediaAttr}>${escapeXML(doc.docBinaryText.content || '')}</csdo:DocBinaryText>`)
  }
  xmlParts.push(`${indent}</ccdo:DocContentDetails>`)
}

export function exportDprDocContentDetailsXmlFragment(
  documents: DprResultDocRow[] | null | undefined,
  indent = '        '
): string {
  const xmlParts: string[] = []
  for (const row of documents ?? []) {
    if (!hasDprResultDocRowContent(row)) continue
    exportDocContentDetailsBlock(xmlParts, dprResultDocRowToMeasureDocDetails(row), indent)
  }
  return xmlParts.join('\n')
}

function exportMeasureDocDetails(xmlParts: string[], doc: MeasureDocDetails, tagName: string, indent: string) {
  if (!hasMeasureDocDetailsContent(doc)) return
  const inner = `${indent}        `
  xmlParts.push(`${indent}<smcdo:${tagName}>`)
  if (doc.country) {
    xmlParts.push(`${inner}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(doc.country)}</csdo:UnifiedCountryCode>`)
  }
  if (doc.languageCode) xmlParts.push(`${inner}<csdo:LanguageCode>${escapeXML(doc.languageCode)}</csdo:LanguageCode>`)
  if (doc.docKindCode?.trim()) {
    const listId = doc.docKindCodeListId?.trim() || '2009'
    xmlParts.push(`${inner}<csdo:DocKindCode codeListId="${escapeXML(listId)}">${escapeXML(doc.docKindCode.trim())}</csdo:DocKindCode>`)
  } else if (doc.docKindName?.trim()) {
    xmlParts.push(`${inner}<csdo:DocKindName>${escapeXML(doc.docKindName.trim())}</csdo:DocKindName>`)
  }
  if (doc.docName) xmlParts.push(`${inner}<csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
  if (doc.docSeriesId) xmlParts.push(`${inner}<csdo:DocSeriesId>${escapeXML(doc.docSeriesId)}</csdo:DocSeriesId>`)
  if (doc.docId) xmlParts.push(`${inner}<csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
  if (doc.docCreationDate) xmlParts.push(`${inner}<csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
  if (doc.docStartDate) xmlParts.push(`${inner}<csdo:DocStartDate>${escapeXML(doc.docStartDate)}</csdo:DocStartDate>`)
  if (doc.docValidityDate) xmlParts.push(`${inner}<csdo:DocValidityDate>${escapeXML(doc.docValidityDate)}</csdo:DocValidityDate>`)
  if (doc.docValidityDuration) xmlParts.push(`${inner}<csdo:DocValidityDuration>${escapeXML(doc.docValidityDuration)}</csdo:DocValidityDuration>`)
  // csdo:AuthorityId в XML не экспортируем
  if (doc.authorityName) xmlParts.push(`${inner}<csdo:AuthorityName>${escapeXML(doc.authorityName)}</csdo:AuthorityName>`)
  if (doc.description) xmlParts.push(`${inner}<csdo:DescriptionText>${escapeXML(doc.description)}</csdo:DescriptionText>`)
  if (doc.pageQuantity) xmlParts.push(`${inner}<csdo:PageQuantity>${escapeXML(doc.pageQuantity)}</csdo:PageQuantity>`)
  // Порядок по XSD DocContentDetailsType: … DescriptionText, PageQuantity, AnyDetails, DocBinaryText
  if (doc.xmlDocument) {
    // Внутренний XML (ccdo:DocDetails и вложенная структура) выводим без экранирования — это фрагмент XML
    xmlParts.push(`${inner}<ccdo:AnyDetails>${doc.xmlDocument}</ccdo:AnyDetails>`)
  }
  if (doc.docBinaryText && (doc.docBinaryText.content || doc.docBinaryText.mediaTypeCode)) {
    const mediaAttr = doc.docBinaryText.mediaTypeCode
      ? ` mediaTypeCode="${escapeXML(doc.docBinaryText.mediaTypeCode)}"`
      : ''
    xmlParts.push(`${inner}<csdo:DocBinaryText${mediaAttr}>${escapeXML(doc.docBinaryText.content || '')}</csdo:DocBinaryText>`)
  }
  xmlParts.push(`${indent}    </smcdo:${tagName}>`)
}

function exportMeasureImplementation(xmlParts: string[], impl: MeasureImplementationItem, indent: string) {
  xmlParts.push(`${indent}<smcdo:MeasureImplementationDetails>`)
  // Порядок по XSD MeasureImplementationDetailsType: UnifiedCountryCode, StartDate, EndDate?, DescriptionText?,
  // ImplementingEntityDetails*, MeasureAffectedObjectKindCode*, DocReferenceDetails?, RegionName?, BorderCheckpointDetails?
  // DescriptionText не выводим, если на форме поле пустое (без placeholder-пробела в XML).
  if (impl.country) {
    xmlParts.push(`${indent}  <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(impl.country)}</csdo:UnifiedCountryCode>`)
  }
  if (impl.startDate) xmlParts.push(`${indent}  <csdo:StartDate>${escapeXML(impl.startDate)}</csdo:StartDate>`)
  if (impl.endDate) xmlParts.push(`${indent}  <csdo:EndDate>${escapeXML(impl.endDate)}</csdo:EndDate>`)
  const desc = (impl.description ?? '').trim()
  if (desc) {
    xmlParts.push(`${indent}  <csdo:DescriptionText>${escapeXML(desc)}</csdo:DescriptionText>`)
  }

  const authList = (impl.authorities ?? []).filter(hasUnifiedAuthorityMeasureContent)
  if (authList.length === 0 && hasUnifiedAuthorityMeasureContent(impl.authority)) authList.push(impl.authority!)
  const subjectList = (impl.subjectDetailsList ?? []).filter(hasSubjectDetailsContent)
  if (subjectList.length === 0 && hasSubjectDetailsContent(impl.subjectDetails)) subjectList.push(impl.subjectDetails!)
  if (authList.length > 0 || subjectList.length > 0) {
    // По XSD: в одном ImplementingEntityDetails максимум один УО и один Субъект.
    const entityCount = Math.max(authList.length, subjectList.length)
    for (let i = 0; i < entityCount; i++) {
      xmlParts.push(`${indent}  <smcdo:ImplementingEntityDetails>`)
      const entityAuthority = authList[i]
      if (entityAuthority) exportMeasureAuthority(xmlParts, entityAuthority, `${indent}    `)
      const entitySubject = subjectList[i]
      if (entitySubject) exportMeasureSubjectDetails(xmlParts, entitySubject, `${indent}    `)
      xmlParts.push(`${indent}  </smcdo:ImplementingEntityDetails>`)
    }
  }

  if (impl.measureAffectedObjectKindCode) {
    const codes = impl.measureAffectedObjectKindCode.split(';').map((c) => c.trim()).filter(Boolean)
    codes.forEach((code) =>
      xmlParts.push(`${indent}  <smsdo:MeasureAffectedObjectKindCode>${escapeXML(code)}</smsdo:MeasureAffectedObjectKindCode>`)
    )
  }

  if (impl.documentDetails && hasDocumentReferenceContent(impl.documentDetails)) {
    xmlParts.push(`${indent}  <ccdo:DocReferenceDetails>`)
    if (impl.documentDetails.docKindCode?.trim()) {
      const listId = impl.documentDetails.docKindCodeListId?.trim() || '2009'
      xmlParts.push(`${indent}    <csdo:DocKindCode codeListId="${escapeXML(listId)}">${escapeXML(impl.documentDetails.docKindCode.trim())}</csdo:DocKindCode>`)
    } else if (impl.documentDetails.docKindName?.trim()) {
      xmlParts.push(`${indent}    <csdo:DocKindName>${escapeXML(impl.documentDetails.docKindName.trim())}</csdo:DocKindName>`)
    }
    if (impl.documentDetails.docName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(impl.documentDetails.docName)}</csdo:DocName>`)
    if (impl.documentDetails.docId) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(impl.documentDetails.docId)}</csdo:DocId>`)
    if (impl.documentDetails.docCreationDate) xmlParts.push(`${indent}    <csdo:DocCreationDate>${escapeXML(impl.documentDetails.docCreationDate)}</csdo:DocCreationDate>`)
    if (impl.documentDetails.docStartDate) xmlParts.push(`${indent}    <csdo:DocStartDate>${escapeXML(impl.documentDetails.docStartDate)}</csdo:DocStartDate>`)
    xmlParts.push(`${indent}  </ccdo:DocReferenceDetails>`)
  }

  const place = impl.placeDetails
  if (place?.regionName?.trim()) {
    xmlParts.push(`${indent}  <csdo:RegionName>${escapeXML(place.regionName.trim())}</csdo:RegionName>`)
  }
  if (
    place &&
    ((place.borderCheckpointCode ?? '').trim() || (place.borderCheckpointName ?? '').trim())
  ) {
    xmlParts.push(`${indent}  <smcdo:BorderCheckpointDetails>`)
    if (place.borderCheckpointCode?.trim()) {
      xmlParts.push(
        `${indent}    <csdo:BorderCheckpointCode>${escapeXML(place.borderCheckpointCode.trim())}</csdo:BorderCheckpointCode>`
      )
    }
    if (place.borderCheckpointName?.trim()) {
      xmlParts.push(
        `${indent}    <csdo:BorderCheckpointName>${escapeXML(place.borderCheckpointName.trim())}</csdo:BorderCheckpointName>`
      )
    }
    xmlParts.push(`${indent}  </smcdo:BorderCheckpointDetails>`)
  }

  xmlParts.push(`${indent}</smcdo:MeasureImplementationDetails>`)
}

function exportComplianceDocuments(xmlParts: string[], compliance: ComplianceDocumentsData, indent: string) {
  const docsWithContent = (compliance.documents ?? []).filter(hasComplianceDocumentContent)
  if (docsWithContent.length > 0) {
    docsWithContent.forEach(doc => {
      xmlParts.push(`${indent}<smcdo:ConformityDocDetails>`)
  if (doc.docKindCode) {
    xmlParts.push(`${indent}    <csdo:DocKindCode codeListId="2001">${escapeXML(doc.docKindCode)}</csdo:DocKindCode>`)
  }
  if (doc.docName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
  if (doc.docId) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
  if (doc.docCreationDate) xmlParts.push(`${indent}    <csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
  if (doc.docStartDate) xmlParts.push(`${indent}    <csdo:DocStartDate>${escapeXML(doc.docStartDate)}</csdo:DocStartDate>`)
  if (doc.authority) {
    xmlParts.push(`${indent}    <ccdo:UnifiedAuthorityDetails>`)
        if (doc.authority.country) {
          xmlParts.push(`${indent}        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(doc.authority.country)}</csdo:UnifiedCountryCode>`)
        }
        if (doc.authority.authorityName) xmlParts.push(`${indent}        <csdo:AuthorityName>${escapeXML(doc.authority.authorityName)}</csdo:AuthorityName>`)
        if (doc.authority.authorityBriefName) xmlParts.push(`${indent}        <csdo:AuthorityBriefName>${escapeXML(doc.authority.authorityBriefName)}</csdo:AuthorityBriefName>`)
        xmlParts.push(`${indent}    </ccdo:UnifiedAuthorityDetails>`)
      }
      xmlParts.push(`${indent}</smcdo:ConformityDocDetails>`)
    })
  }
}

/**
 * Экранирует специальные символы XML
 */
function escapeXML(str: string | undefined | null): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Удаляет из XML пустые элементы (без дочерних элементов и без текста).
 * Возвращает очищенный XML и список имён удалённых тегов для предупреждения.
 */
export function stripEmptyTagsFromXML(xml: string): { xml: string; strippedTagNames: string[] } {
  const stripped: string[] = []
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return { xml, strippedTagNames: [] }

  let changed = true
  while (changed) {
    changed = false
    const all: Element[] = []
    doc.querySelectorAll('*').forEach(el => all.push(el))
    const byDepth = (a: Element, b: Element) => {
      let d = 0; let e: Element | null = b; while (e) { d++; e = e.parentElement }
      let d2 = 0; e = a; while (e) { d2++; e = e.parentElement }
      return d - d2
    }
    all.sort(byDepth)
    for (const el of all) {
      if (el.children.length === 0 && !el.textContent?.trim()) {
        const name = el.localName || el.tagName || ''
        if (name) stripped.push(name)
        el.remove()
        changed = true
      }
    }
  }

  const serializer = new XMLSerializer()
  return { xml: serializer.serializeToString(doc), strippedTagNames: [...new Set(stripped)] }
}

/**
 * Сравнивает два XML документа и возвращает результат сравнения.
 * В экспортированном XML пустые теги удаляются перед сравнением; при их наличии добавляется предупреждение.
 */
export function compareXML(originalXML: string, exportedXML: string): {
  isIdentical: boolean
  differences: string[]
  warnings: string[]
} {
  const differences: string[] = []
  const warnings: string[] = []
  
  try {
    const { xml: cleanedExportedXML, strippedTagNames } = stripEmptyTagsFromXML(exportedXML)
    if (strippedTagNames.length > 0) {
      warnings.push(`В экспортированном XML обнаружены пустые теги (${strippedTagNames.join(', ')}). Они удалены для корректного сравнения.`)
    }

    const parser = new DOMParser()
    const originalDoc = parser.parseFromString(originalXML, 'text/xml')
    const exportedDoc = parser.parseFromString(cleanedExportedXML, 'text/xml')
    
    // Проверка на ошибки парсинга
    const originalError = originalDoc.querySelector('parsererror')
    const exportedError = exportedDoc.querySelector('parsererror')
    
    if (originalError) {
      differences.push(`Ошибка парсинга исходного XML: ${originalError.textContent}`)
      return { isIdentical: false, differences, warnings }
    }
    
    if (exportedError) {
      differences.push(`Ошибка парсинга экспортированного XML: ${exportedError.textContent}`)
      return { isIdentical: false, differences, warnings }
    }
    
    // Находим корневые элементы
    const originalRoot = originalDoc.documentElement
    const exportedRoot = exportedDoc.documentElement
    
    if (!originalRoot || !exportedRoot) {
      differences.push('Не удалось найти корневой элемент в одном из XML документов')
      return { isIdentical: false, differences, warnings }
    }
    
    console.log('[compareXML] Корневой элемент originalRoot:', originalRoot.tagName, 'localName:', originalRoot.localName)
    console.log('[compareXML] Корневой элемент exportedRoot:', exportedRoot.tagName, 'localName:', exportedRoot.localName)
    
    // Сравниваем дочерние элементы корневого элемента (EDocHeader и DangerousProductAlertDetails)
    const originalChildren = Array.from(originalRoot.children)
    const exportedChildren = Array.from(exportedRoot.children)
    
    console.log('[compareXML] originalRoot.tagName:', originalRoot.tagName)
    console.log('[compareXML] originalRoot.localName:', originalRoot.localName)
    console.log('[compareXML] originalChildren.length:', originalChildren.length)
    console.log('[compareXML] originalChildren:', originalChildren.map(c => `${c.localName || c.tagName} (${c.tagName})`).join(', '))
    
    // Группируем по именам (проверяем и localName, и tagName)
    const originalMap = new Map<string, Element[]>()
    const exportedMap = new Map<string, Element[]>()
    
    originalChildren.forEach(child => {
      const localName = child.localName || ''
      const tagName = child.tagName || ''
      const nameFromTag = tagName.split(':').pop()?.toLowerCase() || ''
      const name = localName.toLowerCase() || nameFromTag
      console.log(`[compareXML] original child: localName="${localName}", tagName="${tagName}", name="${name}"`)
      if (!originalMap.has(name)) originalMap.set(name, [])
      originalMap.get(name)!.push(child)
    })
    
    exportedChildren.forEach(child => {
      const localName = child.localName || ''
      const tagName = child.tagName || ''
      const nameFromTag = tagName.split(':').pop()?.toLowerCase() || ''
      const name = localName.toLowerCase() || nameFromTag
      console.log(`[compareXML] exported child: localName="${localName}", tagName="${tagName}", name="${name}"`)
      if (!exportedMap.has(name)) exportedMap.set(name, [])
      exportedMap.get(name)!.push(child)
    })
    
    console.log('[compareXML] originalMap keys:', Array.from(originalMap.keys()))
    console.log('[compareXML] exportedMap keys:', Array.from(exportedMap.keys()))
    
    // Сравниваем EDocHeader
    const originalEDocHeader = originalMap.get('edocheader')?.[0] || null
    const exportedEDocHeader = exportedMap.get('edocheader')?.[0] || null
    compareElementsSimple(originalEDocHeader, exportedEDocHeader, differences, warnings, 'EDocHeader')
    
    // Сравниваем DangerousProductAlertDetails (внутренний элемент, не корневой!)
    // Ищем элемент с localName "DangerousProductAlertDetails" или tagName содержащий "DangerousProductAlertDetails"
    let originalDetails = originalMap.get('dangerousproductalertdetails')?.[0] || null
    let exportedDetails = exportedMap.get('dangerousproductalertdetails')?.[0] || null
    
    // Если не нашли по localName, ищем по tagName (исключая корневой элемент с префиксом doc:)
    if (!originalDetails) {
      originalDetails = originalChildren.find(child => {
        const tagName = child.tagName || ''
        const localName = child.localName || ''
        return (localName.toLowerCase() === 'dangerousproductalertdetails' || 
                tagName.toLowerCase().includes('dangerousproductalertdetails')) && 
               !tagName.toLowerCase().startsWith('doc:')
      }) || null
    }
    
    if (!exportedDetails) {
      exportedDetails = exportedChildren.find(child => {
        const tagName = child.tagName || ''
        const localName = child.localName || ''
        return (localName.toLowerCase() === 'dangerousproductalertdetails' || 
                tagName.toLowerCase().includes('dangerousproductalertdetails')) && 
               !tagName.toLowerCase().startsWith('doc:')
      }) || null
    }
    console.log('[compareXML] Начинаем сравнение DangerousProductAlertDetails')
    console.log('[compareXML] originalDetails:', originalDetails ? `${originalDetails.localName || originalDetails.tagName}, дочерних: ${originalDetails.children.length}` : 'null')
    console.log('[compareXML] exportedDetails:', exportedDetails ? `${exportedDetails.localName || exportedDetails.tagName}, дочерних: ${exportedDetails.children.length}` : 'null')
    if (originalDetails) {
      console.log('[compareXML] Дочерние элементы originalDetails:', Array.from(originalDetails.children).map(c => c.localName || c.tagName).join(', '))
    }
    if (exportedDetails) {
      console.log('[compareXML] Дочерние элементы exportedDetails:', Array.from(exportedDetails.children).map(c => c.localName || c.tagName).join(', '))
    }
    compareElementsSimple(originalDetails, exportedDetails, differences, warnings, 'DangerousProductAlertDetails')
    console.log('[compareXML] Завершили сравнение DangerousProductAlertDetails, различий:', differences.length, 'предупреждений:', warnings.length)
    
    return {
      isIdentical: differences.length === 0 && warnings.length === 0,
      differences: [...new Set(differences)], // Убираем дубликаты
      warnings: [...new Set(warnings)], // Убираем дубликаты
    }
  } catch (error) {
    differences.push(`Ошибка при сравнении: ${error instanceof Error ? error.message : String(error)}`)
    return { isIdentical: false, differences, warnings }
  }
}

/**
 * Сравнивает два полных XML карты DPR (корень DangerousProductAlertResponseDetails).
 * Пустые теги в экспортируемом XML удаляются перед сравнением (как в compareXML для DPA).
 */
export function compareDprResponseXml(originalXML: string, exportedXML: string): {
  isIdentical: boolean
  differences: string[]
  warnings: string[]
} {
  const differences: string[] = []
  const warnings: string[] = []
  try {
    const { xml: cleanedExportedXML, strippedTagNames } = stripEmptyTagsFromXML(exportedXML)
    if (strippedTagNames.length > 0) {
      warnings.push(
        `В экспортированном XML обнаружены пустые теги (${strippedTagNames.join(', ')}). Они удалены для корректного сравнения.`
      )
    }

    const parser = new DOMParser()
    const originalDoc = parser.parseFromString(originalXML, 'text/xml')
    const exportedDoc = parser.parseFromString(cleanedExportedXML, 'text/xml')

    const originalError = originalDoc.querySelector('parsererror')
    const exportedError = exportedDoc.querySelector('parsererror')
    if (originalError) {
      differences.push(`Ошибка парсинга исходного XML: ${originalError.textContent}`)
      return { isIdentical: false, differences, warnings }
    }
    if (exportedError) {
      differences.push(`Ошибка парсинга экспортированного XML: ${exportedError.textContent}`)
      return { isIdentical: false, differences, warnings }
    }

    const originalRoot = originalDoc.documentElement
    const exportedRoot = exportedDoc.documentElement
    if (!originalRoot || !exportedRoot) {
      differences.push('Не удалось найти корневой элемент в одном из XML документов')
      return { isIdentical: false, differences, warnings }
    }

    compareElementsSimple(originalRoot, exportedRoot, differences, warnings, 'DangerousProductAlertResponseDetails')

    return {
      isIdentical: differences.length === 0 && warnings.length === 0,
      differences: [...new Set(differences)],
      warnings: [...new Set(warnings)],
    }
  } catch (error) {
    differences.push(`Ошибка при сравнении: ${error instanceof Error ? error.message : String(error)}`)
    return { isIdentical: false, differences, warnings }
  }
}

/**
 * Нормализует XML документ для сравнения
 */
function normalizeXML(doc: Document): string {
  // Удаляем пробелы, нормализуем namespace и т.д.
  return doc.documentElement.outerHTML
}

function getFirstChildTextByLocalName(element: Element, localName: string): string {
  const lower = localName.toLowerCase()
  return (
    Array.from(element.getElementsByTagName('*')).find((el) => {
      const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return ln === lower
    })?.textContent?.trim() || ''
  )
}

function getRequirementsDocStructuralSignature(element: Element): string {
  const rows: string[] = []
  const directChildren = Array.from(element.children)
  directChildren.forEach((child) => {
    const ln = (child.localName || child.tagName.split(':').pop()?.toLowerCase() || '').toLowerCase()
    if (ln !== 'docstructuralelementdetails') return
    const name = getFirstChildTextByLocalName(child, 'DocStructuralElementName')
    const id = getFirstChildTextByLocalName(child, 'DocStructuralElementId')
    rows.push(`${name}|${id}`)
  })
  return rows.join('||')
}

/**
 * Упрощенная функция сравнения XML элементов - рекурсивно проходит по всем элементам
 */
function compareElementsSimple(
  original: Element | null,
  exported: Element | null,
  differences: string[],
  warnings: string[],
  path: string
) {
  // Логируем все вызовы для отладки
  if (path.includes('DangerousProductAlertDetails') || path.includes('NonCompliant') || path.includes('Requirement')) {
    console.log(`[compareElementsSimple] ВХОД: path="${path}", original=${original ? (original.localName || original.tagName) : 'null'}, exported=${exported ? (exported.localName || exported.tagName) : 'null'}`)
  }
  
  if (!original && !exported) return
  if (!original) {
    warnings.push(`Отсутствует элемент в исходном XML: ${path}`)
    return
  }
  if (!exported) {
    warnings.push(`Отсутствует элемент в экспортированном XML: ${path}`)
    return
  }
  
  const originalLocalName = original.localName || original.tagName.split(':').pop()?.toLowerCase() || ''
  const exportedLocalName = exported.localName || exported.tagName.split(':').pop()?.toLowerCase() || ''
  
  if (originalLocalName !== exportedLocalName) {
    warnings.push(`Разные имена элементов на пути ${path}: ${originalLocalName} vs ${exportedLocalName}`)
    return
  }
  
  const currentPath = path ? `${path}/${originalLocalName}` : originalLocalName
  
  // Логируем все элементы на пути к нарушениям
  const importantPaths = ['dangerousproductalertdetails', 'noncompliantsanitaryproductdetails', 
                         'noncompliantsanitaryproductbatchdetails', 'requirementviolationdetails',
                         'requirementsdocdetails', 'technicalregulationid', 'docname']
  if (importantPaths.some(p => currentPath.toLowerCase().includes(p))) {
    console.log(`[compareElementsSimple] Путь: ${currentPath}, дочерних: ${original.children.length} vs ${exported.children.length}`)
  }
  
  // Сравниваем текстовое содержимое (если нет дочерних элементов)
  if (original.children.length === 0 && exported.children.length === 0) {
    const originalText = original.textContent?.trim() || ''
    const exportedText = exported.textContent?.trim() || ''
    
    if (originalText !== exportedText) {
      if (!isDateDifference(originalText, exportedText)) {
        const warning = `Разное содержимое на пути ${currentPath}: "${originalText}" vs "${exportedText}"`
        warnings.push(warning)
        if (originalLocalName === 'technicalregulationid' || originalLocalName === 'docname') {
          console.log(`[compareElementsSimple] ${warning}`)
        }
      }
    }
    return
  }
  
  // Сравниваем дочерние элементы
  const originalChildren = Array.from(original.children)
  const exportedChildren = Array.from(exported.children)
  
  // Для RequirementViolationDetails сравниваем по содержимому, а не по порядку
  if (originalLocalName === 'requirementviolationdetails') {
    console.log(`[compareElementsSimple] RequirementViolationDetails: оригинал ${originalChildren.length} элементов, экспорт ${exportedChildren.length} элементов`)
    // Создаем "отпечатки" для каждого элемента
    const originalFps = originalChildren.map(el => getElementFingerprint(el))
    const exportedFps = exportedChildren.map(el => getElementFingerprint(el))
    
    // Для каждого экспортированного элемента ищем соответствующий в исходном
    exportedChildren.forEach((exportedEl, exportedIndex) => {
      const exportedFp = exportedFps[exportedIndex]
      const matchingIndex = originalFps.findIndex(fp => fp === exportedFp)
      
      console.log(`[compareElementsSimple] Экспортированный элемент ${exportedIndex}, отпечаток: ${exportedFp.substring(0, 150)}`)
      
      if (matchingIndex === -1) {
        console.log(`[compareElementsSimple] Точное совпадение не найдено, ищем лучший матч`)
        // Ищем лучший матч
        const bestMatch = findBestMatch(exportedEl, originalChildren)
        if (bestMatch) {
          console.log(`[compareElementsSimple] Найден лучший матч, сравниваем детально`)
          // Сравниваем детально
          compareElementsSimple(bestMatch, exportedEl, differences, warnings, currentPath)
        } else {
          const warning = `Новый элемент RequirementViolationDetails на пути ${currentPath}: ${exportedFp.substring(0, 100)}`
          warnings.push(warning)
          console.log(`[compareElementsSimple] ${warning}`)
        }
      } else {
        console.log(`[compareElementsSimple] Найдено точное совпадение на индексе ${matchingIndex}, сравниваем детально`)
        // Точное совпадение - сравниваем детально
        compareElementsSimple(originalChildren[matchingIndex], exportedEl, differences, warnings, currentPath)
      }
    })
    
    // Проверяем удаленные элементы
    originalChildren.forEach((originalEl, originalIndex) => {
      const originalFp = originalFps[originalIndex]
      const matchingIndex = exportedFps.findIndex(fp => fp === originalFp)
      
      if (matchingIndex === -1) {
        const bestMatch = findBestMatch(originalEl, exportedChildren)
        if (!bestMatch) {
          const warning = `Удален элемент RequirementViolationDetails на пути ${currentPath}: ${originalFp.substring(0, 100)}`
          warnings.push(warning)
          console.log(`[compareElementsSimple] ${warning}`)
        }
      }
    })
  } else {
    // Для остальных элементов группируем по именам и сравниваем группы
    const originalGroups = new Map<string, Element[]>()
    const exportedGroups = new Map<string, Element[]>()
    
    originalChildren.forEach(child => {
      const name = (child.localName || child.tagName.split(':').pop() || '').toLowerCase()
      if (!originalGroups.has(name)) originalGroups.set(name, [])
      originalGroups.get(name)!.push(child)
    })
    
    exportedChildren.forEach(child => {
      const name = (child.localName || child.tagName.split(':').pop() || '').toLowerCase()
      if (!exportedGroups.has(name)) exportedGroups.set(name, [])
      exportedGroups.get(name)!.push(child)
    })
    
    // Сравниваем группы с одинаковыми именами
    const allNames = new Set([...originalGroups.keys(), ...exportedGroups.keys()])
    allNames.forEach(name => {
      const originalGroup = originalGroups.get(name) || []
      const exportedGroup = exportedGroups.get(name) || []
      
      // Сравниваем элементы по порядку, но только если они есть в обеих группах
      const maxLength = Math.max(originalGroup.length, exportedGroup.length)
      for (let i = 0; i < maxLength; i++) {
        const originalEl = originalGroup[i]
        const exportedEl = exportedGroup[i]
        
        // Сравниваем только если оба элемента существуют
        if (originalEl && exportedEl) {
          compareElementsSimple(originalEl, exportedEl, differences, warnings, currentPath)
        } else if (originalEl && !exportedEl) {
          // Элемент есть в оригинале, но отсутствует в экспорте
          warnings.push(`Отсутствует элемент в экспортированном XML: ${currentPath}/${name}`)
        } else if (!originalEl && exportedEl) {
          // Элемент есть в экспорте, но отсутствует в оригинале
          warnings.push(`Отсутствует элемент в исходном XML: ${currentPath}/${name}`)
        }
      }
    })
  }
  
  // Дополнительно: для RequirementsDocDetails сравниваем значения полей напрямую
  if (originalLocalName === 'requirementsdocdetails') {
    const origTechRegId = getFirstChildTextByLocalName(original, 'TechnicalRegulationId')
    const expTechRegId = getFirstChildTextByLocalName(exported, 'TechnicalRegulationId')
    const origDocName = getFirstChildTextByLocalName(original, 'DocName')
    const expDocName = getFirstChildTextByLocalName(exported, 'DocName')
    const origStructural = getRequirementsDocStructuralSignature(original)
    const expStructural = getRequirementsDocStructuralSignature(exported)
    
    // Сравниваем ключевые поля
    if (origTechRegId !== expTechRegId) {
      const warning = `Разное значение TechnicalRegulationId на пути ${currentPath}: "${origTechRegId}" vs "${expTechRegId}"`
      warnings.push(warning)
      console.log(`[compareElementsSimple] ${warning}`)
    }
    
    if (origDocName !== expDocName) {
      const warning = `Разное значение DocName на пути ${currentPath}: "${origDocName}" vs "${expDocName}"`
      warnings.push(warning)
      console.log(`[compareElementsSimple] ${warning}`)
    }
    if (origStructural !== expStructural) {
      const warning = `Разные структурные элементы документа на пути ${currentPath}: "${origStructural}" vs "${expStructural}"`
      warnings.push(warning)
      console.log(`[compareElementsSimple] ${warning}`)
    }
    // Продолжаем сравнение всех остальных полей (не делаем return)
  }
}

/**
 * Старая функция сравнения (оставляем для совместимости, но не используем)
 */
function compareElements(
  original: Element | null,
  exported: Element | null,
  differences: string[],
  warnings: string[],
  path: string
) {
  if (!original && !exported) return
  if (!original) {
    differences.push(`Отсутствует элемент в исходном XML: ${path}`)
    return
  }
  if (!exported) {
    differences.push(`Отсутствует элемент в экспортированном XML: ${path}`)
    return
  }
  
  const originalLocalName = original.localName || original.tagName.split(':').pop()?.toLowerCase()
  const exportedLocalName = exported.localName || exported.tagName.split(':').pop()?.toLowerCase()
  
  if (originalLocalName !== exportedLocalName) {
    differences.push(`Разные имена элементов на пути ${path}: ${originalLocalName} vs ${exportedLocalName}`)
    return
  }
  
  const currentPath = path ? `${path}/${originalLocalName}` : originalLocalName
  
  // Логируем все вызовы для важных элементов
  const importantPaths = ['dangerousproductalertdetails', 'noncompliantsanitaryproductdetails', 
                         'noncompliantsanitaryproductbatchdetails', 'requirementviolationdetails']
  if (importantPaths.some(p => currentPath.toLowerCase().includes(p))) {
    console.log(`[compareElements] ВХОД: ${originalLocalName} на пути ${currentPath}, дочерних: ${original.children.length}`)
  }
  
  // Логируем сравнение важных элементов и их дочерних элементов
  const importantElements = ['noncompliantsanitaryproductbatchdetails', 'noncompliantsanitaryproductdetails',
                            'requirementviolationdetails', 'requirementsdocdetails', 
                            'technicalregulationid', 'docname', 'productdetails', 'batchdetails']
  
  if (importantElements.includes(originalLocalName)) {
    console.log(`[compareElements] Сравниваем ${originalLocalName} на пути ${currentPath}, дочерних элементов: ${original.children.length} vs ${exported.children.length}`)
    
    // Для RequirementsDocDetails логируем значения полей
    if (originalLocalName === 'requirementsdocdetails') {
      const origTechRegId = Array.from(original.getElementsByTagName('*')).find(el => {
        const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        return ln === 'technicalregulationid'
      })?.textContent?.trim()
      const expTechRegId = Array.from(exported.getElementsByTagName('*')).find(el => {
        const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        return ln === 'technicalregulationid'
      })?.textContent?.trim()
      console.log(`[compareElements] RequirementsDocDetails TechnicalRegulationId: "${origTechRegId}" vs "${expTechRegId}"`)
      
      const origDocName = Array.from(original.getElementsByTagName('*')).find(el => {
        const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        return ln === 'docname'
      })?.textContent?.trim()
      const expDocName = Array.from(exported.getElementsByTagName('*')).find(el => {
        const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
        return ln === 'docname'
      })?.textContent?.trim()
      console.log(`[compareElements] RequirementsDocDetails DocName: "${origDocName}" vs "${expDocName}"`)
      
      if (origTechRegId !== expTechRegId || origDocName !== expDocName) {
        console.log(`[compareElements] НАЙДЕНЫ РАЗЛИЧИЯ в RequirementsDocDetails!`)
        warnings.push(`Разное значение в RequirementsDocDetails на пути ${currentPath}: TechnicalRegulationId "${origTechRegId}" vs "${expTechRegId}", DocName "${origDocName}" vs "${expDocName}"`)
      }
    }
  }
  
  // Логируем сравнение RequirementsDocDetails для отладки
  if (originalLocalName === 'requirementsdocdetails') {
    console.log(`[compareElements] Сравниваем RequirementsDocDetails на пути ${currentPath}`)
    const origTechRegId = Array.from(original.getElementsByTagName('*')).find(el => {
      const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return ln === 'technicalregulationid'
    })?.textContent?.trim()
    const expTechRegId = Array.from(exported.getElementsByTagName('*')).find(el => {
      const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return ln === 'technicalregulationid'
    })?.textContent?.trim()
    console.log(`[compareElements] TechnicalRegulationId: "${origTechRegId}" vs "${expTechRegId}"`)
    
    const origDocName = Array.from(original.getElementsByTagName('*')).find(el => {
      const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return ln === 'docname'
    })?.textContent?.trim()
    const expDocName = Array.from(exported.getElementsByTagName('*')).find(el => {
      const ln = el.localName || el.tagName.split(':').pop()?.toLowerCase()
      return ln === 'docname'
    })?.textContent?.trim()
    console.log(`[compareElements] DocName: "${origDocName}" vs "${expDocName}"`)
  }
  
  // Сравнение текстового содержимого (только если нет дочерних элементов)
  if (original.children.length === 0 && exported.children.length === 0) {
    const originalText = original.textContent?.trim() || ''
    const exportedText = exported.textContent?.trim() || ''
    
    if (originalText !== exportedText) {
      // Проверяем, не является ли это просто разницей в форматировании дат
      if (!isDateDifference(originalText, exportedText)) {
        console.log(`[compareElements] Разное содержимое на пути ${currentPath}: "${originalText}" vs "${exportedText}"`)
        warnings.push(`Разное содержимое на пути ${currentPath}: "${originalText}" vs "${exportedText}"`)
      }
    }
  } else {
    // Если есть дочерние элементы, сравниваем их по именам и значениям
    // Но только для простых случаев - для сложных структур используем рекурсивное сравнение
    const originalChildMap = new Map<string, string>()
    const exportedChildMap = new Map<string, string>()
    
    // Собираем только простые текстовые значения (без вложенных элементов)
    Array.from(original.children).forEach(child => {
      if (child.children.length === 0) {
        const localName = child.localName || child.tagName.split(':').pop()?.toLowerCase() || ''
        const text = child.textContent?.trim() || ''
        if (text) {
          originalChildMap.set(localName, text)
        }
      }
    })
    
    Array.from(exported.children).forEach(child => {
      if (child.children.length === 0) {
        const localName = child.localName || child.tagName.split(':').pop()?.toLowerCase() || ''
        const text = child.textContent?.trim() || ''
        if (text) {
          exportedChildMap.set(localName, text)
        }
      }
    })
    
    // Сравниваем значения по ключам (только для простых полей)
    if (originalChildMap.size > 0 || exportedChildMap.size > 0) {
      const allKeys = new Set([...originalChildMap.keys(), ...exportedChildMap.keys()])
      allKeys.forEach(key => {
        const originalValue = originalChildMap.get(key) || ''
        const exportedValue = exportedChildMap.get(key) || ''
        
        if (originalValue !== exportedValue) {
          if (!isDateDifference(originalValue, exportedValue)) {
            console.log(`[compareElements] Разное значение поля ${key} на пути ${currentPath}: "${originalValue}" vs "${exportedValue}"`)
            warnings.push(`Разное значение поля ${key} на пути ${currentPath}: "${originalValue}" vs "${exportedValue}"`)
          }
        }
      })
    }
    
    // Также сравниваем дочерние элементы рекурсивно (для сложных структур)
    // Это важно для RequirementsDocDetails, где могут быть вложенные элементы
    const originalChildren = Array.from(original.children)
    const exportedChildren = Array.from(exported.children)
    
    // Логируем для важных элементов
    if (importantElements.includes(originalLocalName)) {
      console.log(`[compareElements] Рекурсивное сравнение дочерних элементов ${originalLocalName} на пути ${currentPath}: ${originalChildren.length} vs ${exportedChildren.length}`)
    }
    
    // Группируем по именам для сравнения
    const originalMap = new Map<string, Element[]>()
    const exportedMap = new Map<string, Element[]>()
    
    originalChildren.forEach(child => {
      const name = child.localName || child.tagName.split(':').pop()?.toLowerCase() || ''
      if (!originalMap.has(name)) originalMap.set(name, [])
      originalMap.get(name)!.push(child)
    })
    
    exportedChildren.forEach(child => {
      const name = child.localName || child.tagName.split(':').pop()?.toLowerCase() || ''
      if (!exportedMap.has(name)) exportedMap.set(name, [])
      exportedMap.get(name)!.push(child)
    })
    
    // Сравниваем группы элементов рекурсивно
    const allNames = new Set([...originalMap.keys(), ...exportedMap.keys()])
    allNames.forEach(name => {
      const originalGroup = originalMap.get(name) || []
      const exportedGroup = exportedMap.get(name) || []
      
      // Для простых элементов сравниваем по порядку
      const maxLength = Math.max(originalGroup.length, exportedGroup.length)
      for (let i = 0; i < maxLength; i++) {
        compareElements(originalGroup[i], exportedGroup[i], differences, warnings, currentPath)
      }
    })
    return // Выходим, так как уже сравнили все дочерние элементы
  }
  
  // Сравнение дочерних элементов (для случаев, когда нет простых текстовых значений)
  const originalChildren = Array.from(original.children)
  const exportedChildren = Array.from(exported.children)
  
  // Группируем по именам для сравнения
  const originalMap = new Map<string, Element[]>()
  const exportedMap = new Map<string, Element[]>()
  
  originalChildren.forEach(child => {
    const name = child.localName || child.tagName.split(':').pop()?.toLowerCase() || ''
    if (!originalMap.has(name)) originalMap.set(name, [])
    originalMap.get(name)!.push(child)
  })
  
  exportedChildren.forEach(child => {
    const name = child.localName || child.tagName.split(':').pop()?.toLowerCase() || ''
    if (!exportedMap.has(name)) exportedMap.set(name, [])
    exportedMap.get(name)!.push(child)
  })
  
  // Сравниваем группы элементов
  const allNames = new Set([...originalMap.keys(), ...exportedMap.keys()])
  allNames.forEach(name => {
    const originalGroup = originalMap.get(name) || []
    const exportedGroup = exportedMap.get(name) || []
    
    if (originalGroup.length !== exportedGroup.length) {
      console.log(`[compareElements] Разное количество элементов ${name} на пути ${currentPath}: ${originalGroup.length} vs ${exportedGroup.length}`)
      warnings.push(`Разное количество элементов ${name} на пути ${currentPath}: ${originalGroup.length} vs ${exportedGroup.length}`)
    }
    
    // Для NonCompliantSanitaryProductBatchDetails сравниваем по порядку (партия 1 ↔ партия 1 и т.д.);
    // внутри каждой партии ConformityDocDetails и RequirementViolationDetails — по содержимому (порядок не важен).
    if (name === 'noncompliantsanitaryproductbatchdetails') {
      console.log(`[compareElements] Сравниваем ${originalGroup.length} исходных и ${exportedGroup.length} экспортированных NonCompliantSanitaryProductBatchDetails на пути ${currentPath}`)
      
      const maxLength = Math.max(originalGroup.length, exportedGroup.length)
      for (let i = 0; i < maxLength; i++) {
        compareElements(originalGroup[i], exportedGroup[i], differences, warnings, currentPath)
      }
    } else if (name === 'conformitydocdetails') {
      // Документы соответствия внутри партии: сопоставление по содержимому (docId, docName), а не по порядку
      exportedGroup.forEach((exportedEl) => {
        const bestMatch = findBestMatch(exportedEl, originalGroup)
        if (bestMatch) {
          compareElements(bestMatch, exportedEl, differences, warnings, currentPath)
        } else {
          const fp = getElementFingerprint(exportedEl)
          warnings.push(`Новый элемент ConformityDocDetails на пути ${currentPath}: ${fp.substring(0, 100)}`)
        }
      })
      originalGroup.forEach((originalEl) => {
        const bestMatch = findBestMatch(originalEl, exportedGroup)
        if (!bestMatch) {
          const fp = getElementFingerprint(originalEl)
          warnings.push(`Удален элемент ConformityDocDetails на пути ${currentPath}: ${fp.substring(0, 100)}`)
        }
      })
    } else if (name === 'requirementviolationdetails') {
      console.log(`[compareElements] Сравниваем ${originalGroup.length} исходных и ${exportedGroup.length} экспортированных RequirementViolationDetails на пути ${currentPath}`)
      
      // Для каждого экспортированного элемента ищем соответствующий в исходном
      exportedGroup.forEach((exportedEl, exportedIndex) => {
        const exportedFp = getElementFingerprint(exportedEl)
        console.log(`[compareElements] Экспортированный элемент ${exportedIndex}:`, exportedFp.substring(0, 100))
        
        // Ищем лучший матч в исходном
        const bestMatch = findBestMatch(exportedEl, originalGroup)
        
        if (bestMatch) {
          const originalFp = getElementFingerprint(bestMatch)
          console.log(`[compareElements] Найден матч:`, originalFp.substring(0, 100))
          
          // Сравниваем детально
          compareElements(bestMatch, exportedEl, differences, warnings, currentPath)
        } else {
          // Не найден похожий элемент - это новое требование
          console.log(`[compareElements] Новый элемент ${name} на пути ${currentPath}:`, exportedFp.substring(0, 100))
          warnings.push(`Новый элемент ${name} на пути ${currentPath}: ${exportedFp.substring(0, 100)}`)
        }
      })
      
      // Проверяем, не удалены ли элементы из исходного
      originalGroup.forEach((originalEl, originalIndex) => {
        const originalFp = getElementFingerprint(originalEl)
        const bestMatch = findBestMatch(originalEl, exportedGroup)
        
        if (!bestMatch) {
          console.log(`[compareElements] Удален элемент ${name} на пути ${currentPath}:`, originalFp.substring(0, 100))
          warnings.push(`Удален элемент ${name} на пути ${currentPath}: ${originalFp.substring(0, 100)}`)
        }
      })
    } else {
      // Для других элементов сравниваем по порядку
      const maxLength = Math.max(originalGroup.length, exportedGroup.length)
      for (let i = 0; i < maxLength; i++) {
        compareElements(originalGroup[i], exportedGroup[i], differences, warnings, currentPath)
      }
    }
  })
}

/**
 * Создает "отпечаток" элемента для сравнения (ключевые поля)
 */
function getElementFingerprint(element: Element): string {
  const parts: string[] = []
  
  // Добавляем ключевые дочерние элементы
  const keyFields = ['technicalregulationid', 'docname', 'docid', 'descriptiontext', 
                     'discrepancyofqualityindexcode', 'discrepancyofqualityindexname', 
                     'discrepancyofqualityindexvalue', 'notetext']
  
  keyFields.forEach(fieldName => {
    const field = Array.from(element.getElementsByTagName('*')).find(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase() || ''
      return localName === fieldName
    })
    if (field) {
      const value = field.textContent?.trim() || ''
      if (value) {
        parts.push(`${fieldName}:${value.substring(0, 50)}`) // Ограничиваем длину для читаемости
      }
    }
  })
  
  return parts.join('|') || element.outerHTML.substring(0, 100)
}

/**
 * Находит наиболее похожий элемент из группы для сравнения
 */
function findBestMatch(target: Element, candidates: Element[]): Element | null {
  let bestMatch: Element | null = null
  let bestScore = 0
  
  // Получаем ключевые поля целевого элемента
  const targetFields = new Map<string, string>()
  Array.from(target.getElementsByTagName('*')).forEach(el => {
    const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase() || ''
    const value = el.textContent?.trim() || ''
    if (value && (localName === 'technicalregulationid' || localName === 'docid')) {
      targetFields.set(localName, value)
    }
  })
  
  candidates.forEach(candidate => {
    let score = 0
    Array.from(candidate.getElementsByTagName('*')).forEach(el => {
      const localName = el.localName || el.tagName.split(':').pop()?.toLowerCase() || ''
      const value = el.textContent?.trim() || ''
      if (value && targetFields.has(localName) && targetFields.get(localName) === value) {
        score++
      }
    })
    
    if (score > bestScore) {
      bestScore = score
      bestMatch = candidate
    }
  })
  
  return bestScore > 0 ? bestMatch : null
}

/**
 * Проверяет, является ли разница просто форматированием даты
 */
function isDateDifference(text1: string, text2: string): boolean {
  // Простая проверка - если оба текста выглядят как даты
  const datePattern = /^\d{4}-\d{2}-\d{2}/
  return datePattern.test(text1) && datePattern.test(text2)
}

const DPR_XML_INDENT = '    '

/**
 * Полный XML карты DPR для записи в DPRXML (EEC_R_SM_SS_08_DangerousProductAlertResponse).
 * Корень doc:DangerousProductAlertResponseDetails: заголовок ЭД, уполномоченный орган, идентификатор исходного уведомления,
 * принятые меры (та же структура, что у DPA), описание результатов, приложенные документы (ccdo:DocContentDetails).
 */
export function exportDprParsedBundleToXml(bundle: DprParsedBundle): string {
  const edoc = bundle.electronicDocument
  const msg = (edoc.messageCode ?? '').trim() || 'P.SS.08.MSG.018'
  const code = (edoc.documentCode ?? '').trim() || 'R.SM.SS.08.003'
  const id = (edoc.documentId ?? '').trim() || `dpr-${Date.now()}`
  const dt = (edoc.documentDate ?? '').trim() ? toISODateTimeForXml(edoc.documentDate) : new Date().toISOString()
  const lang = (edoc.language ?? '').trim() || 'ru'

  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8"?>')
  parts.push('<doc:DangerousProductAlertResponseDetails xmlns:ccdo="urn:EEC:M:ComplexDataObjects:v0.4.12"')
  parts.push(' xmlns:csdo="urn:EEC:M:SimpleDataObjects:v0.4.12"')
  parts.push(' xmlns:smcdo="urn:EEC:M:SM:ComplexDataObjects:v0.3.9"')
  parts.push(' xmlns:smsdo="urn:EEC:M:SM:SimpleDataObjects:v0.3.9"')
  parts.push(' xmlns:doc="urn:EEC:R:SM:SS:08:DangerousProductAlertResponse:v1.0.0"')
  parts.push(' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
  parts.push(
    ' xsi:schemaLocation="urn:EEC:R:SM:SS:08:DangerousProductAlertResponse:v1.0.0 EEC_R_SM_SS_08_DangerousProductAlertResponse_v1.0.0.xsd">'
  )

  parts.push('    <ccdo:EDocHeader>')
  parts.push(`        <csdo:InfEnvelopeCode>${escapeXML(msg)}</csdo:InfEnvelopeCode>`)
  parts.push(`        <csdo:EDocCode>${escapeXML(code)}</csdo:EDocCode>`)
  parts.push(`        <csdo:EDocId>${escapeXML(id)}</csdo:EDocId>`)
  const refId = (edoc.sourceDocumentId ?? '').trim()
  if (refId) {
    parts.push(`        <csdo:EDocRefId>${escapeXML(refId)}</csdo:EDocRefId>`)
  }
  parts.push(`        <csdo:EDocDateTime>${escapeXML(dt)}</csdo:EDocDateTime>`)
  parts.push(`        <csdo:LanguageCode>${escapeXML(lang)}</csdo:LanguageCode>`)
  parts.push('    </ccdo:EDocHeader>')

  parts.push('    <ccdo:UnifiedAuthorityDetails>')
  const authCountry = (bundle.notifyingAuthority.country ?? '').trim()
  if (authCountry) {
    parts.push(`        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(authCountry)}</csdo:UnifiedCountryCode>`)
  }
  const authName = (bundle.notifyingAuthority.name ?? '').trim()
  if (authName) parts.push(`        <csdo:AuthorityName>${escapeXML(authName)}</csdo:AuthorityName>`)
  const authBrief = (bundle.notifyingAuthority.shortName ?? '').trim()
  if (authBrief) {
    parts.push(`        <csdo:AuthorityBriefName>${escapeXML(authBrief)}</csdo:AuthorityBriefName>`)
  }
  parts.push('    </ccdo:UnifiedAuthorityDetails>')

  parts.push('    <smcdo:IncidentAlertIdDetails>')
  const incCountry = (bundle.incidentAlert.country ?? '').trim()
  parts.push(`        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(incCountry)}</csdo:UnifiedCountryCode>`)
  parts.push(`        <smsdo:IncidentId>${escapeXML((bundle.incidentAlert.registrationNumber ?? '').trim())}</smsdo:IncidentId>`)
  parts.push(`        <smsdo:IncidentKindCode>${escapeXML((bundle.incidentAlert.typeCode ?? '').trim())}</smsdo:IncidentKindCode>`)
  const formDate = (bundle.incidentAlert.formationDate ?? '').trim().slice(0, 10)
  parts.push(`        <csdo:DocCreationDate>${escapeXML(formDate)}</csdo:DocCreationDate>`)
  parts.push('    </smcdo:IncidentAlertIdDetails>')

  const measuresXml = exportSanitaryMeasuresXmlFragment(bundle.measures, DPR_XML_INDENT).trim()
  if (measuresXml) parts.push(measuresXml)

  const desc = (bundle.resultDescription ?? '').trim()
  if (desc) {
    parts.push(`    <csdo:DescriptionText>${escapeXML(desc)}</csdo:DescriptionText>`)
  }

  const docsXml = exportDprDocContentDetailsXmlFragment(bundle.resultDocuments, DPR_XML_INDENT).trim()
  if (docsXml) parts.push(docsXml)

  parts.push('</doc:DangerousProductAlertResponseDetails>')
  return parts.join('\n')
}

const SMR_XML_INDENT = '    '

function exportSmrMeasureDocDetailsXml(xmlParts: string[], doc: SmrMeasureDocDetails, indent: string): void {
  const inner = `${indent}    `
  xmlParts.push(`${indent}<smcdo:MeasureDocDetails>`)
  if (doc.country) {
    xmlParts.push(`${inner}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(doc.country)}</csdo:UnifiedCountryCode>`)
  }
  if (doc.languageCode) xmlParts.push(`${inner}<csdo:LanguageCode>${escapeXML(doc.languageCode)}</csdo:LanguageCode>`)
  if (doc.docKindCode?.trim()) {
    const listId = doc.docKindCodeListId?.trim() || '2009'
    xmlParts.push(`${inner}<csdo:DocKindCode codeListId="${escapeXML(listId)}">${escapeXML(doc.docKindCode.trim())}</csdo:DocKindCode>`)
  } else if (doc.docKindName?.trim()) {
    xmlParts.push(`${inner}<csdo:DocKindName>${escapeXML(doc.docKindName.trim())}</csdo:DocKindName>`)
  }
  if (doc.docName) xmlParts.push(`${inner}<csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
  if (doc.docSeriesId) xmlParts.push(`${inner}<csdo:DocSeriesId>${escapeXML(doc.docSeriesId)}</csdo:DocSeriesId>`)
  if (doc.docId) xmlParts.push(`${inner}<smsdo:DocId>${escapeXML(doc.docId)}</smsdo:DocId>`)
  if (doc.messageCode?.trim()) {
    xmlParts.push(`${inner}<smsdo:MessageCode>${escapeXML(doc.messageCode.trim())}</smsdo:MessageCode>`)
  }
  if (doc.docCreationDate) xmlParts.push(`${inner}<csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
  if (doc.docStartDate) xmlParts.push(`${inner}<csdo:DocStartDate>${escapeXML(doc.docStartDate)}</csdo:DocStartDate>`)
  if (doc.docValidityDate) xmlParts.push(`${inner}<csdo:DocValidityDate>${escapeXML(doc.docValidityDate)}</csdo:DocValidityDate>`)
  if (doc.docValidityDuration) xmlParts.push(`${inner}<csdo:DocValidityDuration>${escapeXML(doc.docValidityDuration)}</csdo:DocValidityDuration>`)
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
    xmlParts.push(`${inner}<csdo:DocBinaryText${mediaAttr}>${escapeXML(doc.docBinaryText.content || '')}</csdo:DocBinaryText>`)
  }
  xmlParts.push(`${indent}</smcdo:MeasureDocDetails>`)
}

export function exportMeasureImplementationsXmlFragment(
  items: MeasureImplementationItem[] | null | undefined,
  indent = SMR_XML_INDENT
): string {
  const xmlParts: string[] = []
  for (const impl of items ?? []) {
    if (hasMeasureImplementationEntryContent(impl)) {
      exportMeasureImplementation(xmlParts, impl, indent)
    }
  }
  return xmlParts.join('\n')
}

export function exportSmrDocContentDetailsXmlFragment(
  documents: SmrResultDocRow[] | null | undefined,
  indent = SMR_XML_INDENT
): string {
  const xmlParts: string[] = []
  for (const row of documents ?? []) {
    if (!hasSmrResultDocRowContent(row)) continue
    exportDocContentDetailsBlock(xmlParts, smrResultDocRowToMeasureDocDetails(row), indent)
  }
  return xmlParts.join('\n')
}

/**
 * Полный XML карты SMR (EEC_R_SM_SS_09_SanitaryMeasureConsideration).
 */
export function exportSmrParsedBundleToXml(bundle: SmrParsedBundle): string {
  const edoc = bundle.electronicDocument
  const msg = (edoc.messageCode ?? '').trim() || 'P.SS.09.MSG.018'
  const code = (edoc.documentCode ?? '').trim() || 'R.SM.SS.09.003'
  const id = (edoc.documentId ?? '').trim() || `smr-${Date.now()}`
  const dt = (edoc.documentDate ?? '').trim() ? toISODateTimeForXml(edoc.documentDate) : new Date().toISOString()
  const lang = (edoc.language ?? '').trim() || 'ru'

  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8"?>')
  parts.push('<doc:SanitaryMeasureConsiderationDetails xmlns:ccdo="urn:EEC:M:ComplexDataObjects:v0.4.12"')
  parts.push(' xmlns:csdo="urn:EEC:M:SimpleDataObjects:v0.4.12"')
  parts.push(' xmlns:smcdo="urn:EEC:M:SM:ComplexDataObjects:v0.3.9"')
  parts.push(' xmlns:smsdo="urn:EEC:M:SM:SimpleDataObjects:v0.3.9"')
  parts.push(' xmlns:doc="urn:EEC:R:SM:SS:09:SanitaryMeasureConsideration:v1.0.0"')
  parts.push(' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
  parts.push(
    ' xsi:schemaLocation="urn:EEC:R:SM:SS:09:SanitaryMeasureConsideration:v1.0.0 EEC_R_SM_SS_09_SanitaryMeasureConsideration_v1.0.0.xsd">'
  )

  parts.push('    <ccdo:EDocHeader>')
  parts.push(`        <csdo:InfEnvelopeCode>${escapeXML(msg)}</csdo:InfEnvelopeCode>`)
  parts.push(`        <csdo:EDocCode>${escapeXML(code)}</csdo:EDocCode>`)
  parts.push(`        <csdo:EDocId>${escapeXML(id)}</csdo:EDocId>`)
  const refId = (edoc.sourceDocumentId ?? '').trim()
  if (refId) {
    parts.push(`        <csdo:EDocRefId>${escapeXML(refId)}</csdo:EDocRefId>`)
  }
  parts.push(`        <csdo:EDocDateTime>${escapeXML(dt)}</csdo:EDocDateTime>`)
  parts.push(`        <csdo:LanguageCode>${escapeXML(lang)}</csdo:LanguageCode>`)
  parts.push('    </ccdo:EDocHeader>')

  parts.push('    <ccdo:UnifiedAuthorityDetails>')
  const authCountry = (bundle.respondingAuthority.country ?? '').trim()
  if (authCountry) {
    parts.push(`        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(authCountry)}</csdo:UnifiedCountryCode>`)
  }
  const authName = (bundle.respondingAuthority.name ?? '').trim()
  if (authName) parts.push(`        <csdo:AuthorityName>${escapeXML(authName)}</csdo:AuthorityName>`)
  const authBrief = (bundle.respondingAuthority.shortName ?? '').trim()
  if (authBrief) {
    parts.push(`        <csdo:AuthorityBriefName>${escapeXML(authBrief)}</csdo:AuthorityBriefName>`)
  }
  parts.push('    </ccdo:UnifiedAuthorityDetails>')

  exportSmrMeasureDocDetailsXml(parts, bundle.measureDoc ?? {}, SMR_XML_INDENT)

  const implXml = exportMeasureImplementationsXmlFragment(bundle.measureImplementations, SMR_XML_INDENT).trim()
  if (implXml) parts.push(implXml)

  const desc = (bundle.resultDescription ?? '').trim()
  if (desc) {
    parts.push(`    <csdo:DescriptionText>${escapeXML(desc)}</csdo:DescriptionText>`)
  }

  const docsXml = exportSmrDocContentDetailsXmlFragment(bundle.resultDocuments, SMR_XML_INDENT).trim()
  if (docsXml) parts.push(docsXml)

  parts.push('</doc:SanitaryMeasureConsiderationDetails>')
  return parts.join('\n')
}

const SMA_XML_INDENT = '    '
const SMA_EDOCCODE_INFO = 'R.SM.SS.09.002'
const SMA_EDOCCODE_ABSENT = 'R.006'

function exportSmaMeasureDocReferenceXml(
  xmlParts: string[],
  ref: SmaParsedBundle['measureDocReference'],
  indent: string
): void {
  const country = (ref.country ?? '').trim()
  const docId = (ref.docId ?? '').trim()
  const docDate = (ref.docCreationDate ?? '').trim().slice(0, 10)
  if (!country && !docId && !docDate) return
  const inner = `${indent}    `
  xmlParts.push(`${indent}<smcdo:MeasureDocReferenceDetails>`)
  if (country) {
    xmlParts.push(`${inner}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(country)}</csdo:UnifiedCountryCode>`)
  }
  if (docId) xmlParts.push(`${inner}<smsdo:DocId>${escapeXML(docId)}</smsdo:DocId>`)
  if (docDate) xmlParts.push(`${inner}<csdo:DocCreationDate>${escapeXML(docDate)}</csdo:DocCreationDate>`)
  xmlParts.push(`${indent}</smcdo:MeasureDocReferenceDetails>`)
}

function exportSmaIncidentAlertXml(
  xmlParts: string[],
  alert: SmaParsedBundle['incidentAlert'],
  indent: string
): void {
  const country = (alert.country ?? '').trim()
  const reg = (alert.registrationNumber ?? '').trim()
  const typeCode = (alert.typeCode ?? '').trim()
  const formDate = (alert.formationDate ?? '').trim().slice(0, 10)
  if (!country && !reg && !typeCode && !formDate) return
  const inner = `${indent}    `
  xmlParts.push(`${indent}<smcdo:IncidentAlertIdDetails>`)
  if (country) {
    xmlParts.push(`${inner}<csdo:UnifiedCountryCode codeListId="2021">${escapeXML(country)}</csdo:UnifiedCountryCode>`)
  }
  if (reg) xmlParts.push(`${inner}<smsdo:IncidentId>${escapeXML(reg)}</smsdo:IncidentId>`)
  if (typeCode) xmlParts.push(`${inner}<smsdo:IncidentKindCode>${escapeXML(typeCode)}</smsdo:IncidentKindCode>`)
  if (formDate) xmlParts.push(`${inner}<csdo:DocCreationDate>${escapeXML(formDate)}</csdo:DocCreationDate>`)
  xmlParts.push(`${indent}</smcdo:IncidentAlertIdDetails>`)
}

/**
 * Полный XML карты SMAQ/SMAR (EEC_R_SM_SS_09_AdditionalInfoDetails).
 */
export function exportSmaParsedBundleToXml(
  bundle: SmaParsedBundle,
  options?: { responseKind?: SmarResponseKind }
): string {
  const isAbsent =
    options?.responseKind === 'absent' ||
    (bundle.electronicDocument.documentCode ?? '').trim() === SMA_EDOCCODE_ABSENT

  const edoc = bundle.electronicDocument
  const msg = (edoc.messageCode ?? '').trim() || 'P.SS.09.MSG.019'
  const code = isAbsent
    ? SMA_EDOCCODE_ABSENT
    : (edoc.documentCode ?? '').trim() || SMA_EDOCCODE_INFO
  const id = (edoc.documentId ?? '').trim() || `sma-${Date.now()}`
  const dt = (edoc.documentDate ?? '').trim() ? toISODateTimeForXml(edoc.documentDate) : new Date().toISOString()
  const lang = (edoc.language ?? '').trim() || 'ru'

  const parts: string[] = []
  parts.push('<?xml version="1.0" encoding="UTF-8"?>')
  parts.push('<doc:AdditionalInfoDetails xmlns:ccdo="urn:EEC:M:ComplexDataObjects:v0.4.12"')
  parts.push(' xmlns:csdo="urn:EEC:M:SimpleDataObjects:v0.4.12"')
  parts.push(' xmlns:smcdo="urn:EEC:M:SM:ComplexDataObjects:v0.3.9"')
  parts.push(' xmlns:smsdo="urn:EEC:M:SM:SimpleDataObjects:v0.3.9"')
  parts.push(' xmlns:doc="urn:EEC:R:SM:SS:09:AdditionalInfoDetails:v1.0.0"')
  parts.push(' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
  parts.push(
    ' xsi:schemaLocation="urn:EEC:R:SM:SS:09:AdditionalInfoDetails:v1.0.0 EEC_R_SM_SS_09_AdditionalInfoDetails_v1.0.0.xsd">'
  )

  parts.push('    <ccdo:EDocHeader>')
  parts.push(`        <csdo:InfEnvelopeCode>${escapeXML(msg)}</csdo:InfEnvelopeCode>`)
  parts.push(`        <csdo:EDocCode>${escapeXML(code)}</csdo:EDocCode>`)
  parts.push(`        <csdo:EDocId>${escapeXML(id)}</csdo:EDocId>`)
  const refId = (edoc.sourceDocumentId ?? '').trim()
  if (refId) {
    parts.push(`        <csdo:EDocRefId>${escapeXML(refId)}</csdo:EDocRefId>`)
  }
  parts.push(`        <csdo:EDocDateTime>${escapeXML(dt)}</csdo:EDocDateTime>`)
  parts.push(`        <csdo:LanguageCode>${escapeXML(lang)}</csdo:LanguageCode>`)
  parts.push('    </ccdo:EDocHeader>')

  if (!isAbsent) {
    parts.push('    <ccdo:UnifiedAuthorityDetails>')
    const authCountry = (bundle.authority.country ?? '').trim()
    if (authCountry) {
      parts.push(
        `        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(authCountry)}</csdo:UnifiedCountryCode>`
      )
    }
    const authId = (bundle.authority.identifier ?? '').trim()
    if (authId) parts.push(`        <csdo:AuthorityId>${escapeXML(authId)}</csdo:AuthorityId>`)
    const authName = (bundle.authority.name ?? '').trim()
    if (authName) parts.push(`        <csdo:AuthorityName>${escapeXML(authName)}</csdo:AuthorityName>`)
    const authBrief = (bundle.authority.shortName ?? '').trim()
    if (authBrief) {
      parts.push(`        <csdo:AuthorityBriefName>${escapeXML(authBrief)}</csdo:AuthorityBriefName>`)
    }
    parts.push('    </ccdo:UnifiedAuthorityDetails>')

    exportSmaIncidentAlertXml(parts, bundle.incidentAlert, SMA_XML_INDENT)

    const mcc = (bundle.measureCountryCode ?? '').trim()
    if (mcc) {
      parts.push(`    <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(mcc)}</csdo:UnifiedCountryCode>`)
    }

    exportSmaMeasureDocReferenceXml(parts, bundle.measureDocReference, SMA_XML_INDENT)

    const spt = (bundle.sanitaryProductTypeCode ?? '').trim()
    if (spt) parts.push(`    <smsdo:SanitaryProductTypeCode>${escapeXML(spt)}</smsdo:SanitaryProductTypeCode>`)
    const pn = (bundle.productName ?? '').trim()
    if (pn) parts.push(`    <csdo:ProductName>${escapeXML(pn)}</csdo:ProductName>`)
    const ltm = (bundle.laboratoryTestMethodName ?? '').trim()
    if (ltm) parts.push(`    <smsdo:LaboratoryTestMethodName>${escapeXML(ltm)}</smsdo:LaboratoryTestMethodName>`)

    const docsXml = exportSmrDocContentDetailsXmlFragment(bundle.documents, SMA_XML_INDENT).trim()
    if (docsXml) parts.push(docsXml)
  }

  const desc = (bundle.descriptionText ?? '').trim()
  if (desc) {
    parts.push(`    <csdo:DescriptionText>${escapeXML(desc)}</csdo:DescriptionText>`)
  }

  parts.push('</doc:AdditionalInfoDetails>')
  return parts.join('\n')
}
