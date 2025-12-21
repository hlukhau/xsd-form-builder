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
} from '@/types/card'

/**
 * Экспортирует CardData в XML формат с полной структурой
 */
export function exportCardDataToXML(data: CardData): string {
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
    xmlParts.push(`        <csdo:EDocDateTime>${escapeXML(data.electronicDocument.documentDate)}</csdo:EDocDateTime>`)
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
      // Преобразуем type в IncidentKindCode (нужно будет улучшить)
      xmlParts.push(`        <smsdo:IncidentKindCode>${escapeXML(data.notification.type)}</smsdo:IncidentKindCode>`)
    }
    if (data.notification.formationDate) {
      xmlParts.push(`        <csdo:DocCreationDate>${escapeXML(data.notification.formationDate)}</csdo:DocCreationDate>`)
    }
  }
  
  // UnifiedAuthorityDetails (из Notification)
  if (data.notification && data.notification.authorizedBody) {
    xmlParts.push('        <ccdo:UnifiedAuthorityDetails>')
    xmlParts.push(`            <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(data.notification.authorizedBody.country)}</csdo:UnifiedCountryCode>`)
    xmlParts.push(`            <csdo:AuthorityName>${escapeXML(data.notification.authorizedBody.name)}</csdo:AuthorityName>`)
    xmlParts.push('        </ccdo:UnifiedAuthorityDetails>')
  }
  
  // Product
  if (data.product) {
    xmlParts.push('        <smcdo:NonCompliantSanitaryProductDetails>')
    xmlParts.push(`            <smsdo:SanitaryProductTypeCode codeListId="1025">${escapeXML(data.product.typeCode)}</smsdo:SanitaryProductTypeCode>`)
    
    // ProductDetails
    xmlParts.push('            <smcdo:ProductDetails>')
    exportProductDetails(xmlParts, data.product.productDetails, '                ')
    xmlParts.push('            </smcdo:ProductDetails>')
    
    // Manufacturer
    if (data.product.manufacturer) {
      exportSupplyChainParty(xmlParts, data.product.manufacturer, '41', '            ')
    }
  
    // TSD (внутри NonCompliantSanitaryProductDetails)
    if (data.tsd && data.tsd.batches.length > 0) {
      data.tsd.batches.forEach(batch => {
        xmlParts.push('            <smcdo:NonCompliantSanitaryProductBatchDetails>')
        // BatchDetails
        xmlParts.push('                <smcdo:BatchDetails>')
        if (batch.batchId) {
          xmlParts.push(`                    <smsdo:BatchId>${escapeXML(batch.batchId)}</smsdo:BatchId>`)
        }
        if (batch.manufactureDate) {
          xmlParts.push(`                    <csdo:ManufactureDate>${escapeXML(batch.manufactureDate)}</csdo:ManufactureDate>`)
        }
        if (batch.productShelfLifeEndDate) {
          xmlParts.push(`                    <csdo:ProductShelfLifeEndDate>${escapeXML(batch.productShelfLifeEndDate)}</csdo:ProductShelfLifeEndDate>`)
        }
        if (batch.commodityMeasure) {
          const unitAttrs = batch.commodityMeasure.unitCode ? ` measurementUnitCode="${escapeXML(batch.commodityMeasure.unitCode)}"` : ''
          const unitListId = batch.commodityMeasure.unitCodeListId ? ` measurementUnitCodeListId="${escapeXML(batch.commodityMeasure.unitCodeListId)}"` : ''
          xmlParts.push(`                    <csdo:UnifiedCommodityMeasure${unitAttrs}${unitListId}>${escapeXML(batch.commodityMeasure.value)}</csdo:UnifiedCommodityMeasure>`)
        }
        xmlParts.push('                </smcdo:BatchDetails>')
        
        if (batch.consignmentId) {
          xmlParts.push(`                <smsdo:ConsignmentId>${escapeXML(batch.consignmentId)}</smsdo:ConsignmentId>`)
        }
        if (batch.batchCommodityMeasure) {
          const unitAttrs = batch.batchCommodityMeasure.unitCode ? ` measurementUnitCode="${escapeXML(batch.batchCommodityMeasure.unitCode)}"` : ''
          xmlParts.push(`                <csdo:CommodityMeasure${unitAttrs}>${escapeXML(batch.batchCommodityMeasure.value)}</csdo:CommodityMeasure>`)
        }
        
        // ShippingDocuments
        if (batch.shippingDocuments && batch.shippingDocuments.length > 0) {
          batch.shippingDocuments.forEach(doc => {
            exportShippingDocument(xmlParts, doc, '                ')
          })
        }
        
        // ComplianceDocuments (внутри BatchDetails)
        if (data.complianceDocuments) {
          exportComplianceDocuments(xmlParts, data.complianceDocuments, '                ')
        }
        
        // Violations (внутри BatchDetails)
        if (data.violations) {
          exportViolations(xmlParts, data.violations, '                ')
        }
        
        xmlParts.push('            </smcdo:NonCompliantSanitaryProductBatchDetails>')
      })
    }
    
    xmlParts.push('        </smcdo:NonCompliantSanitaryProductDetails>')
  }
  
  // DetectionPlace (на уровне DangerousProductAlertDetails)
  if (data.detectionPlace) {
    exportDetectionPlace(xmlParts, data.detectionPlace, '        ')
  }
  
  // Measures (на уровне DangerousProductAlertDetails)
  if (data.measures && data.measures.measures.length > 0) {
    data.measures.measures.forEach(measure => {
      exportSanitaryMeasure(xmlParts, measure, '        ')
    })
  }
  
  // ResourceItemStatusDetails (если есть данные о validityPeriod)
  if (data.electronicDocument && data.electronicDocument.validityPeriod) {
    xmlParts.push('        <ccdo:ResourceItemStatusDetails>')
    xmlParts.push('            <ccdo:ValidityPeriodDetails>')
    if (data.electronicDocument.validityPeriod.start) {
      xmlParts.push(`                <csdo:StartDateTime>${escapeXML(data.electronicDocument.validityPeriod.start)}</csdo:StartDateTime>`)
    }
    xmlParts.push('            </ccdo:ValidityPeriodDetails>')
    xmlParts.push('        </ccdo:ResourceItemStatusDetails>')
  }
  
  xmlParts.push('    </smcdo:DangerousProductAlertDetails>')
  xmlParts.push('</doc:DangerousProductAlertDetails>')
  
  return xmlParts.join('\n')
}

function exportProductDetails(xmlParts: string[], details: ProductDetails, indent: string) {
  if (details.productId) xmlParts.push(`${indent}<csdo:ProductId>${escapeXML(details.productId)}</csdo:ProductId>`)
  if (details.productName) xmlParts.push(`${indent}<csdo:ProductName>${escapeXML(details.productName)}</csdo:ProductName>`)
  if (details.tradeName) xmlParts.push(`${indent}<smsdo:ProductTradeName>${escapeXML(details.tradeName)}</smsdo:ProductTradeName>`)
  if (details.description) xmlParts.push(`${indent}<csdo:DescriptionText>${escapeXML(details.description)}</csdo:DescriptionText>`)
  if (details.commodityCode) xmlParts.push(`${indent}<csdo:CommodityCode>${escapeXML(details.commodityCode)}</csdo:CommodityCode>`)
  if (details.productPurpose) xmlParts.push(`${indent}<smsdo:ProductPurposeText>${escapeXML(details.productPurpose)}</smsdo:ProductPurposeText>`)
  if (details.applicationMethod) xmlParts.push(`${indent}<smsdo:ProductApplicationMethodText>${escapeXML(details.applicationMethod)}</smsdo:ProductApplicationMethodText>`)
  if (details.releaseForm) xmlParts.push(`${indent}<smsdo:ReleaseFormText>${escapeXML(details.releaseForm)}</smsdo:ReleaseFormText>`)
  if (details.storageCondition) xmlParts.push(`${indent}<smsdo:StorageConditionText>${escapeXML(details.storageCondition)}</smsdo:StorageConditionText>`)
  if (details.labelText) xmlParts.push(`${indent}<smsdo:ProductLabelText>${escapeXML(details.labelText)}</smsdo:ProductLabelText>`)
  
  if (details.technicalDocs && details.technicalDocs.length > 0) {
    details.technicalDocs.forEach(doc => {
      xmlParts.push(`${indent}<smcdo:TechnicalDocument>`)
      if (doc.docKindCode) xmlParts.push(`${indent}  <csdo:DocKindCode>${escapeXML(doc.docKindCode)}</csdo:DocKindCode>`)
      if (doc.docKindName) xmlParts.push(`${indent}  <csdo:DocKindName>${escapeXML(doc.docKindName)}</csdo:DocKindName>`)
      if (doc.docName) xmlParts.push(`${indent}  <csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
      if (doc.docId) xmlParts.push(`${indent}  <csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
      if (doc.docCreationDate) xmlParts.push(`${indent}  <csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
      if (doc.docStartDate) xmlParts.push(`${indent}  <csdo:DocStartDate>${escapeXML(doc.docStartDate)}</csdo:DocStartDate>`)
      xmlParts.push(`${indent}</smcdo:TechnicalDocument>`)
    })
  }
}

function exportSupplyChainParty(xmlParts: string[], party: SupplyChainPartyDetails, kindCode: string, indent: string) {
  xmlParts.push(`${indent}<ccdo:SupplyChainPartyDetails>`)
  xmlParts.push(`${indent}  <csdo:SupplyChainPartyKindCode>${escapeXML(kindCode)}</csdo:SupplyChainPartyKindCode>`)
  if (party.country) xmlParts.push(`${indent}  <csdo:UnifiedCountryCode>${escapeXML(party.country)}</csdo:UnifiedCountryCode>`)
  if (party.businessEntityName) xmlParts.push(`${indent}  <csdo:BusinessEntityName>${escapeXML(party.businessEntityName)}</csdo:BusinessEntityName>`)
  if (party.shortName) xmlParts.push(`${indent}  <csdo:BusinessEntityBriefName>${escapeXML(party.shortName)}</csdo:BusinessEntityBriefName>`)
  if (party.organizationalForm) xmlParts.push(`${indent}  <csdo:BusinessEntityTypeName>${escapeXML(party.organizationalForm)}</csdo:BusinessEntityTypeName>`)
  if (party.subjectIdentifier) xmlParts.push(`${indent}  <csdo:BusinessEntityId>${escapeXML(party.subjectIdentifier)}</csdo:BusinessEntityId>`)
  if (party.taxpayerId) xmlParts.push(`${indent}  <csdo:TaxpayerId>${escapeXML(party.taxpayerId)}</csdo:TaxpayerId>`)
  
  if (party.registrationAddress) exportAddress(xmlParts, party.registrationAddress, '1', `${indent}  `)
  if (party.actualAddress) exportAddress(xmlParts, party.actualAddress, '2', `${indent}  `)
  if (party.mailingAddress) exportAddress(xmlParts, party.mailingAddress, '3', `${indent}  `)
  
  if (party.contacts && party.contacts.length > 0) {
    party.contacts.forEach(contact => {
      xmlParts.push(`${indent}  <ccdo:CommunicationDetails>`)
      if (contact.contactKind) xmlParts.push(`${indent}    <csdo:ContactKind>${escapeXML(contact.contactKind)}</csdo:ContactKind>`)
      if (contact.contactValue) xmlParts.push(`${indent}    <csdo:ContactValue>${escapeXML(contact.contactValue)}</csdo:ContactValue>`)
      xmlParts.push(`${indent}  </ccdo:CommunicationDetails>`)
    })
  }
  
  xmlParts.push(`${indent}</ccdo:SupplyChainPartyDetails>`)
}

function exportAddress(xmlParts: string[], address: AddressDetails, kindCode: string, indent: string) {
  xmlParts.push(`${indent}<ccdo:SubjectAddressDetails>`)
  xmlParts.push(`${indent}    <csdo:AddressKindCode>${escapeXML(kindCode)}</csdo:AddressKindCode>`)
  if (address.country) {
    xmlParts.push(`${indent}    <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(address.country)}</csdo:UnifiedCountryCode>`)
  }
  if (address.cityName) xmlParts.push(`${indent}    <csdo:CityName>${escapeXML(address.cityName)}</csdo:CityName>`)
  if (address.streetName) xmlParts.push(`${indent}    <csdo:StreetName>${escapeXML(address.streetName)}</csdo:StreetName>`)
  if (address.buildingNumberId) xmlParts.push(`${indent}    <csdo:BuildingNumberId>${escapeXML(address.buildingNumberId)}</csdo:BuildingNumberId>`)
  if (address.fullAddress) xmlParts.push(`${indent}    <csdo:FullAddress>${escapeXML(address.fullAddress)}</csdo:FullAddress>`)
  xmlParts.push(`${indent}</ccdo:SubjectAddressDetails>`)
}

function exportShippingDocument(xmlParts: string[], doc: ShippingDocument, indent: string) {
  xmlParts.push(`${indent}<smcdo:ShippingDocumentDetails>`)
  if (doc.docKindCode) {
    const codeListId = doc.docKindCodeListId ? ` codeListId="${escapeXML(doc.docKindCodeListId)}"` : ''
    xmlParts.push(`${indent}    <csdo:DocKindCode${codeListId}>${escapeXML(doc.docKindCode)}</csdo:DocKindCode>`)
  }
  if (doc.docName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
  if (doc.docCreationDate) xmlParts.push(`${indent}    <csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
  if (doc.docId) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
  
  if (doc.products && doc.products.length > 0) {
    doc.products.forEach(product => {
      xmlParts.push(`${indent}    <smcdo:ProductDetails>`)
      exportProductDetails(xmlParts, product, `${indent}        `)
      xmlParts.push(`${indent}    </smcdo:ProductDetails>`)
    })
  }
  
  if (doc.supplyChainParties && doc.supplyChainParties.length > 0) {
    doc.supplyChainParties.forEach((party, index) => {
      exportSupplyChainParty(xmlParts, party, party.subjectIdentifier || String(index), `${indent}    `)
    })
  }
  
  xmlParts.push(`${indent}</smcdo:ShippingDocumentDetails>`)
}

function exportViolations(xmlParts: string[], violations: ViolationsData, indent: string) {
  if (violations.generalDescription) {
    xmlParts.push(`${indent}<smcdo:RequirementViolationDetails>`)
    xmlParts.push(`${indent}  <csdo:DescriptionText>${escapeXML(violations.generalDescription)}</csdo:DescriptionText>`)
    xmlParts.push(`${indent}</smcdo:RequirementViolationDetails>`)
  }
  
  if (violations.violatedRequirements && violations.violatedRequirements.length > 0) {
    violations.violatedRequirements.forEach(req => {
      xmlParts.push(`${indent}<smcdo:RequirementViolationDetails>`)
      xmlParts.push(`${indent}  <smcdo:RequirementsDocDetails>`)
      if (req.technicalRegulationId) xmlParts.push(`${indent}    <smsdo:TechnicalRegulationId>${escapeXML(req.technicalRegulationId)}</smsdo:TechnicalRegulationId>`)
      if (req.technicalRegulationName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(req.technicalRegulationName)}</csdo:DocName>`)
      if (req.registrationNumber) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(req.registrationNumber)}</csdo:DocId>`)
      if (req.description) xmlParts.push(`${indent}    <csdo:DescriptionText>${escapeXML(req.description)}</csdo:DescriptionText>`)
      xmlParts.push(`${indent}  </smcdo:RequirementsDocDetails>`)
      xmlParts.push(`${indent}</smcdo:RequirementViolationDetails>`)
    })
  }
  
  if (violations.violatedIndicators && violations.violatedIndicators.length > 0) {
    violations.violatedIndicators.forEach(indicator => {
      xmlParts.push(`${indent}<smcdo:RequirementViolationDetails>`)
      xmlParts.push(`${indent}  <smcdo:DiscrepancyOfQualityIndexDetails${indicator.isNormative ? ' normativeDiscrepancyOfQualityIndexIndicator="1"' : ''}>`)
      if (indicator.indicatorCode) xmlParts.push(`${indent}    <smsdo:DiscrepancyOfQualityIndexCode>${escapeXML(indicator.indicatorCode)}</smsdo:DiscrepancyOfQualityIndexCode>`)
      if (indicator.indicatorName) xmlParts.push(`${indent}    <smsdo:DiscrepancyOfQualityIndexName>${escapeXML(indicator.indicatorName)}</smsdo:DiscrepancyOfQualityIndexName>`)
      if (indicator.indicatorValue) {
        const unitAttrs = indicator.unitCode ? ` measurementUnitCode="${escapeXML(indicator.unitCode)}"` : ''
        xmlParts.push(`${indent}    <smsdo:DiscrepancyOfQualityIndexValue${unitAttrs}>${escapeXML(indicator.indicatorValue)}</smsdo:DiscrepancyOfQualityIndexValue>`)
      }
      if (indicator.note) xmlParts.push(`${indent}    <csdo:NoteText>${escapeXML(indicator.note)}</csdo:NoteText>`)
      xmlParts.push(`${indent}  </smcdo:DiscrepancyOfQualityIndexDetails>`)
      xmlParts.push(`${indent}</smcdo:RequirementViolationDetails>`)
    })
  }
}

function exportDetectionPlace(xmlParts: string[], place: DetectionPlaceData, indent: string) {
  xmlParts.push(`${indent}<smcdo:DetectionPlaceDetails>`)
  
  if (place.borderCheckpoint) {
    xmlParts.push(`${indent}    <smcdo:BorderCheckpointDetails>`)
    if (place.borderCheckpoint.checkpointCode) xmlParts.push(`${indent}        <csdo:BorderCheckpointCode>${escapeXML(place.borderCheckpoint.checkpointCode)}</csdo:BorderCheckpointCode>`)
    if (place.borderCheckpoint.checkpointName) xmlParts.push(`${indent}        <csdo:BorderCheckpointName>${escapeXML(place.borderCheckpoint.checkpointName)}</csdo:BorderCheckpointName>`)
    xmlParts.push(`${indent}    </smcdo:BorderCheckpointDetails>`)
  }
  
  if (place.organization) {
    xmlParts.push(`${indent}    <smcdo:OrganizationDetails>`)
    if (place.organization.country) {
      xmlParts.push(`${indent}        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(place.organization.country)}</csdo:UnifiedCountryCode>`)
    }
    if (place.organization.businessEntityName) xmlParts.push(`${indent}        <csdo:BusinessEntityName>${escapeXML(place.organization.businessEntityName)}</csdo:BusinessEntityName>`)
    if (place.organization.businessEntityBriefName) xmlParts.push(`${indent}        <csdo:BusinessEntityBriefName>${escapeXML(place.organization.businessEntityBriefName)}</csdo:BusinessEntityBriefName>`)
    if (place.organization.addresses && place.organization.addresses.length > 0) {
      place.organization.addresses.forEach(addr => {
        exportAddress(xmlParts, addr, addr.addressKindCode || '1', `${indent}        `)
      })
    }
    xmlParts.push(`${indent}    </smcdo:OrganizationDetails>`)
  }
  
  if (place.address) {
    exportAddress(xmlParts, place.address, '1', `${indent}    `)
  }
  
  if (place.geoCoordinates) {
    xmlParts.push(`${indent}    <ccdo:GeoCoordinateDetails>`)
    if (place.geoCoordinates.longitude) xmlParts.push(`${indent}        <ccdo:LongitudeMeasure>${escapeXML(place.geoCoordinates.longitude)}</ccdo:LongitudeMeasure>`)
    if (place.geoCoordinates.latitude) xmlParts.push(`${indent}        <ccdo:LatitudeMeasure>${escapeXML(place.geoCoordinates.latitude)}</ccdo:LatitudeMeasure>`)
    xmlParts.push(`${indent}    </ccdo:GeoCoordinateDetails>`)
  }
  
  if (place.description) {
    xmlParts.push(`${indent}    <csdo:DescriptionText>${escapeXML(place.description)}</csdo:DescriptionText>`)
  }
  
  xmlParts.push(`${indent}</smcdo:DetectionPlaceDetails>`)
}

function exportSanitaryMeasure(xmlParts: string[], measure: SanitaryMeasure, indent: string) {
  xmlParts.push(`${indent}<smcdo:SanitaryMeasureBaseDetails>`)
  if (measure.languageCode) xmlParts.push(`${indent}  <csdo:LanguageCode>${escapeXML(measure.languageCode)}</csdo:LanguageCode>`)
  if (measure.measureCode) {
    const codeListId = measure.measureCodeListId ? ` codeListId="${escapeXML(measure.measureCodeListId)}"` : ''
    xmlParts.push(`${indent}  <smsdo:MeasureCode${codeListId}>${escapeXML(measure.measureCode)}</smsdo:MeasureCode>`)
  }
  if (measure.measureName) xmlParts.push(`${indent}  <smsdo:MeasureName>${escapeXML(measure.measureName)}</smsdo:MeasureName>`)
  if (measure.measureAffectedObjectKindCode) xmlParts.push(`${indent}  <smsdo:MeasureAffectedObjectKindCode>${escapeXML(measure.measureAffectedObjectKindCode)}</smsdo:MeasureAffectedObjectKindCode>`)
  if (measure.startDate) xmlParts.push(`${indent}  <csdo:StartDate>${escapeXML(measure.startDate)}</csdo:StartDate>`)
  if (measure.endDate) xmlParts.push(`${indent}  <csdo:EndDate>${escapeXML(measure.endDate)}</csdo:EndDate>`)
  if (measure.measureJustificationText) xmlParts.push(`${indent}  <smsdo:MeasureJustificationText>${escapeXML(measure.measureJustificationText)}</smsdo:MeasureJustificationText>`)
  if (measure.description) xmlParts.push(`${indent}  <csdo:DescriptionText>${escapeXML(measure.description)}</csdo:DescriptionText>`)
  
  if (measure.measureDocDetails) {
    exportMeasureDocDetails(xmlParts, measure.measureDocDetails, 'MeasureDocDetails', `${indent}  `)
  }
  
  if (measure.initialMeasureDocDetails) {
    exportMeasureDocDetails(xmlParts, measure.initialMeasureDocDetails, 'InitialMeasureDocDetails', `${indent}  `)
  }
  
  if (measure.measureInitiationBasisDetails && measure.measureInitiationBasisDetails.length > 0) {
    measure.measureInitiationBasisDetails.forEach(basis => {
      xmlParts.push(`${indent}  <smcdo:MeasureInitiationBasisDetails>`)
      if (basis.docKindName) xmlParts.push(`${indent}    <csdo:DocKindName>${escapeXML(basis.docKindName)}</csdo:DocKindName>`)
      if (basis.docName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(basis.docName)}</csdo:DocName>`)
      if (basis.docId) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(basis.docId)}</csdo:DocId>`)
      if (basis.docCreationDate) xmlParts.push(`${indent}    <csdo:DocCreationDate>${escapeXML(basis.docCreationDate)}</csdo:DocCreationDate>`)
      xmlParts.push(`${indent}  </smcdo:MeasureInitiationBasisDetails>`)
    })
  }
  
  if (measure.measureImplementationDetails && measure.measureImplementationDetails.length > 0) {
    measure.measureImplementationDetails.forEach(impl => {
      exportMeasureImplementation(xmlParts, impl, `${indent}  `)
    })
  }
  
  xmlParts.push(`${indent}</smcdo:SanitaryMeasureBaseDetails>`)
}

function exportMeasureDocDetails(xmlParts: string[], doc: MeasureDocDetails, tagName: string, indent: string) {
  xmlParts.push(`${indent}<smcdo:${tagName}>`)
  if (doc.country) {
    xmlParts.push(`${indent}        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(doc.country)}</csdo:UnifiedCountryCode>`)
  }
  if (doc.docName) xmlParts.push(`${indent}        <csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
  if (doc.docId) xmlParts.push(`${indent}        <csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
  if (doc.docCreationDate) xmlParts.push(`${indent}        <csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
  if (doc.description) xmlParts.push(`${indent}        <csdo:DescriptionText>${escapeXML(doc.description)}</csdo:DescriptionText>`)
  xmlParts.push(`${indent}    </smcdo:${tagName}>`)
}

function exportMeasureImplementation(xmlParts: string[], impl: MeasureImplementationItem, indent: string) {
  xmlParts.push(`${indent}<smcdo:MeasureImplementationDetails>`)
  if (impl.country) xmlParts.push(`${indent}  <csdo:UnifiedCountryCode>${escapeXML(impl.country)}</csdo:UnifiedCountryCode>`)
  if (impl.startDate) xmlParts.push(`${indent}  <csdo:StartDate>${escapeXML(impl.startDate)}</csdo:StartDate>`)
  if (impl.endDate) xmlParts.push(`${indent}  <csdo:EndDate>${escapeXML(impl.endDate)}</csdo:EndDate>`)
  if (impl.description) xmlParts.push(`${indent}  <csdo:DescriptionText>${escapeXML(impl.description)}</csdo:DescriptionText>`)
  
  if (impl.authority) {
    xmlParts.push(`${indent}  <ccdo:UnifiedAuthorityDetails>`)
    if (impl.authority.country) xmlParts.push(`${indent}    <csdo:UnifiedCountryCode>${escapeXML(impl.authority.country)}</csdo:UnifiedCountryCode>`)
    if (impl.authority.authorityId) xmlParts.push(`${indent}    <csdo:AuthorityId>${escapeXML(impl.authority.authorityId)}</csdo:AuthorityId>`)
    if (impl.authority.authorityName) xmlParts.push(`${indent}    <csdo:AuthorityName>${escapeXML(impl.authority.authorityName)}</csdo:AuthorityName>`)
    if (impl.authority.authorityBriefName) xmlParts.push(`${indent}    <csdo:AuthorityBriefName>${escapeXML(impl.authority.authorityBriefName)}</csdo:AuthorityBriefName>`)
    xmlParts.push(`${indent}  </ccdo:UnifiedAuthorityDetails>`)
  }
  
  if (impl.subjectDetails) {
    xmlParts.push(`${indent}  <smcdo:SubjectDetails>`)
    if (impl.subjectDetails.businessEntity) {
      const entity = impl.subjectDetails.businessEntity
      if (entity.country) xmlParts.push(`${indent}    <csdo:UnifiedCountryCode>${escapeXML(entity.country)}</csdo:UnifiedCountryCode>`)
      if (entity.businessEntityName) xmlParts.push(`${indent}    <csdo:BusinessEntityName>${escapeXML(entity.businessEntityName)}</csdo:BusinessEntityName>`)
      if (entity.businessEntityBriefName) xmlParts.push(`${indent}    <csdo:BusinessEntityBriefName>${escapeXML(entity.businessEntityBriefName)}</csdo:BusinessEntityBriefName>`)
      if (entity.businessEntityId) xmlParts.push(`${indent}    <csdo:BusinessEntityId>${escapeXML(entity.businessEntityId)}</csdo:BusinessEntityId>`)
      if (entity.addresses && entity.addresses.length > 0) {
        entity.addresses.forEach(addr => {
          exportAddress(xmlParts, addr, addr.addressKindCode || '1', `${indent}    `)
        })
      }
    } else {
      if (impl.subjectDetails.country) xmlParts.push(`${indent}    <csdo:UnifiedCountryCode>${escapeXML(impl.subjectDetails.country)}</csdo:UnifiedCountryCode>`)
      if (impl.subjectDetails.subjectName) xmlParts.push(`${indent}    <csdo:SubjectName>${escapeXML(impl.subjectDetails.subjectName)}</csdo:SubjectName>`)
      if (impl.subjectDetails.identityDoc) {
        xmlParts.push(`${indent}    <ccdo:IdentityDocV3Details>`)
        const idDoc = impl.subjectDetails.identityDoc
        if (idDoc.country) xmlParts.push(`${indent}      <csdo:UnifiedCountryCode>${escapeXML(idDoc.country)}</csdo:UnifiedCountryCode>`)
        if (idDoc.docKindCode) xmlParts.push(`${indent}      <csdo:IdentityDocKindCode>${escapeXML(idDoc.docKindCode)}</csdo:IdentityDocKindCode>`)
        if (idDoc.docKindName) xmlParts.push(`${indent}      <csdo:DocKindName>${escapeXML(idDoc.docKindName)}</csdo:DocKindName>`)
        if (idDoc.docSeriesId) xmlParts.push(`${indent}      <csdo:DocSeriesId>${escapeXML(idDoc.docSeriesId)}</csdo:DocSeriesId>`)
        if (idDoc.docId) xmlParts.push(`${indent}      <csdo:DocId>${escapeXML(idDoc.docId)}</csdo:DocId>`)
        if (idDoc.docCreationDate) xmlParts.push(`${indent}      <csdo:DocCreationDate>${escapeXML(idDoc.docCreationDate)}</csdo:DocCreationDate>`)
        if (idDoc.docValidityDate) xmlParts.push(`${indent}      <csdo:DocValidityDate>${escapeXML(idDoc.docValidityDate)}</csdo:DocValidityDate>`)
        xmlParts.push(`${indent}    </ccdo:IdentityDocV3Details>`)
      }
      if (impl.subjectDetails.registrationAddress) exportAddress(xmlParts, impl.subjectDetails.registrationAddress, '1', `${indent}    `)
      if (impl.subjectDetails.actualAddress) exportAddress(xmlParts, impl.subjectDetails.actualAddress, '2', `${indent}    `)
      if (impl.subjectDetails.mailingAddress) exportAddress(xmlParts, impl.subjectDetails.mailingAddress, '3', `${indent}    `)
    }
    xmlParts.push(`${indent}  </smcdo:SubjectDetails>`)
  }
  
  if (impl.documentDetails) {
    xmlParts.push(`${indent}  <ccdo:DocReferenceDetails>`)
    if (impl.documentDetails.docKindCode) xmlParts.push(`${indent}    <csdo:DocKindCode>${escapeXML(impl.documentDetails.docKindCode)}</csdo:DocKindCode>`)
    if (impl.documentDetails.docKindName) xmlParts.push(`${indent}    <csdo:DocKindName>${escapeXML(impl.documentDetails.docKindName)}</csdo:DocKindName>`)
    if (impl.documentDetails.docName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(impl.documentDetails.docName)}</csdo:DocName>`)
    if (impl.documentDetails.docId) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(impl.documentDetails.docId)}</csdo:DocId>`)
    if (impl.documentDetails.docCreationDate) xmlParts.push(`${indent}    <csdo:DocCreationDate>${escapeXML(impl.documentDetails.docCreationDate)}</csdo:DocCreationDate>`)
    if (impl.documentDetails.docStartDate) xmlParts.push(`${indent}    <csdo:DocStartDate>${escapeXML(impl.documentDetails.docStartDate)}</csdo:DocStartDate>`)
    xmlParts.push(`${indent}  </ccdo:DocReferenceDetails>`)
  }
  
  if (impl.placeDetails) {
    xmlParts.push(`${indent}  <smcdo:MeasurePlaceDetails>`)
    if (impl.placeDetails.regionName) xmlParts.push(`${indent}    <smcdo:RegionName>${escapeXML(impl.placeDetails.regionName)}</smcdo:RegionName>`)
    if (impl.placeDetails.borderCheckpointCode) xmlParts.push(`${indent}    <smcdo:BorderCheckpointCode>${escapeXML(impl.placeDetails.borderCheckpointCode)}</smcdo:BorderCheckpointCode>`)
    if (impl.placeDetails.borderCheckpointName) xmlParts.push(`${indent}    <smcdo:BorderCheckpointName>${escapeXML(impl.placeDetails.borderCheckpointName)}</smcdo:BorderCheckpointName>`)
    xmlParts.push(`${indent}  </smcdo:MeasurePlaceDetails>`)
  }
  
  xmlParts.push(`${indent}</smcdo:MeasureImplementationDetails>`)
}

function exportComplianceDocuments(xmlParts: string[], compliance: ComplianceDocumentsData, indent: string) {
  if (compliance.documents && compliance.documents.length > 0) {
    compliance.documents.forEach(doc => {
      xmlParts.push(`${indent}<smcdo:ConformityDocDetails>`)
      if (doc.docKindCode) {
        const codeListId = doc.docKindCodeListId ? ` codeListId="${escapeXML(doc.docKindCodeListId)}"` : ''
        xmlParts.push(`${indent}    <csdo:DocKindCode${codeListId}>${escapeXML(doc.docKindCode)}</csdo:DocKindCode>`)
      }
      if (doc.docName) xmlParts.push(`${indent}    <csdo:DocName>${escapeXML(doc.docName)}</csdo:DocName>`)
      if (doc.docId) xmlParts.push(`${indent}    <csdo:DocId>${escapeXML(doc.docId)}</csdo:DocId>`)
      if (doc.docCreationDate) xmlParts.push(`${indent}    <csdo:DocCreationDate>${escapeXML(doc.docCreationDate)}</csdo:DocCreationDate>`)
      if (doc.authority) {
        xmlParts.push(`${indent}    <ccdo:UnifiedAuthorityDetails>`)
        if (doc.authority.country) {
          xmlParts.push(`${indent}        <csdo:UnifiedCountryCode codeListId="2021">${escapeXML(doc.authority.country)}</csdo:UnifiedCountryCode>`)
        }
        if (doc.authority.authorityName) xmlParts.push(`${indent}        <csdo:AuthorityName>${escapeXML(doc.authority.authorityName)}</csdo:AuthorityName>`)
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
 * Сравнивает два XML документа и возвращает результат сравнения
 */
export function compareXML(originalXML: string, exportedXML: string): {
  isIdentical: boolean
  differences: string[]
  warnings: string[]
} {
  const differences: string[] = []
  const warnings: string[] = []
  
  try {
    const parser = new DOMParser()
    const originalDoc = parser.parseFromString(originalXML, 'text/xml')
    const exportedDoc = parser.parseFromString(exportedXML, 'text/xml')
    
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
    
    // Сравниваем дочерние элементы корневого элемента (EDocHeader и DangerousProductAlertDetails)
    const originalChildren = Array.from(originalRoot.children)
    const exportedChildren = Array.from(exportedRoot.children)
    
    // Группируем по именам
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
    
    // Сравниваем EDocHeader
    const originalEDocHeader = originalMap.get('edocheader')?.[0] || null
    const exportedEDocHeader = exportedMap.get('edocheader')?.[0] || null
    compareElements(originalEDocHeader, exportedEDocHeader, differences, warnings, 'DangerousProductAlertDetails')
    
    // Сравниваем DangerousProductAlertDetails
    const originalDetails = originalMap.get('dangerousproductalertdetails')?.[0] || null
    const exportedDetails = exportedMap.get('dangerousproductalertdetails')?.[0] || null
    compareElements(originalDetails, exportedDetails, differences, warnings, 'DangerousProductAlertDetails')
    
    return {
      isIdentical: differences.length === 0,
      differences: [...new Set(differences)], // Убираем дубликаты
      warnings: [...new Set(warnings)], // Убираем дубликаты
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

/**
 * Сравнивает два XML элемента
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
  
  // Сравнение текстового содержимого
  const originalText = original.textContent?.trim() || ''
  const exportedText = exported.textContent?.trim() || ''
  
  if (originalText && exportedText && originalText !== exportedText) {
    // Проверяем, не является ли это просто разницей в форматировании дат
    if (!isDateDifference(originalText, exportedText)) {
      warnings.push(`Разное содержимое на пути ${currentPath}: "${originalText}" vs "${exportedText}"`)
    }
  }
  
  // Сравнение дочерних элементов
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
      warnings.push(`Разное количество элементов ${name} на пути ${currentPath}: ${originalGroup.length} vs ${exportedGroup.length}`)
    }
    
    const maxLength = Math.max(originalGroup.length, exportedGroup.length)
    for (let i = 0; i < maxLength; i++) {
      compareElements(originalGroup[i], exportedGroup[i], differences, warnings, currentPath)
    }
  })
}

/**
 * Проверяет, является ли разница просто форматированием даты
 */
function isDateDifference(text1: string, text2: string): boolean {
  // Простая проверка - если оба текста выглядят как даты
  const datePattern = /^\d{4}-\d{2}-\d{2}/
  return datePattern.test(text1) && datePattern.test(text2)
}
