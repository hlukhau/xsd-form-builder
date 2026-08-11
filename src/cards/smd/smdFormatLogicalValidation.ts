/**
 * Форматно-логические контроли карты исходящих сведений о временной санитарной мере (SMD / SS.09).
 */
import type {
  AddressDetails,
  BusinessEntityDetails,
  CardData,
  ContactDetails,
  DetectionPlaceData,
  DocumentReferenceDetails,
  MeasureImplementationItem,
  PhaDiseaseDetails,
  PhaPathogenDetails,
  ProductBatchDetails,
  SanitaryMeasure,
  SubjectDetails,
  ViolationsData,
} from '@/types/card'
import type { ValidationResult } from '@/utils/cardValidation'
import { getAddressListFromParty, getAddressListFromSubject } from '@/utils/addressFormatUtils'
import { remarkContactsIncomplete } from '@/utils/contactValidation'
import { businessEntityIdMethodPairRemarks } from '@/utils/businessEntityIdentificationValidation'
import { hasMeasureImplementationEntryContent, hasIdentityDocV3Content, hasSupplyChainPartyContent } from '@/utils/xmlExporter'
import { hasPhaPatientGroupExportContent } from '@/cards/pha/phaPatientGroupXml'
import { hasMeasureDocDetailsContent } from './smdXmlExporter'
import { getSmdPrimaryMeasure } from './smdSanitaryMeasureModel'
import { resolveSmdMeasureStartDate } from './smdMeasureDates'

function empty(s: string | undefined | null): boolean {
  return s == null || String(s).trim() === ''
}

function hasAtLeastOneAddress(party: {
  registrationAddress?: unknown
  actualAddress?: unknown
  mailingAddress?: unknown
}): boolean {
  return !!(party?.registrationAddress || party?.actualAddress || party?.mailingAddress)
}

function getAddresses(party: {
  registrationAddress?: { country?: string; cityName?: string; settlementName?: string }
  actualAddress?: { country?: string; cityName?: string; settlementName?: string }
  mailingAddress?: { country?: string; cityName?: string; settlementName?: string }
}): Array<{ country?: string; cityName?: string; settlementName?: string }> {
  const out: Array<{ country?: string; cityName?: string; settlementName?: string }> = []
  if (party.registrationAddress) out.push(party.registrationAddress)
  if (party.actualAddress) out.push(party.actualAddress)
  if (party.mailingAddress) out.push(party.mailingAddress)
  return out
}

function normalizeBatchViolations(batch: ProductBatchDetails): ViolationsData[] {
  const v = batch.violations
  if (v == null) return []
  return Array.isArray(v) ? v : [v as ViolationsData]
}

function measureExecutorAddressRowHasContent(addr: AddressDetails | undefined): boolean {
  if (!addr) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(
    s(addr.country) ||
    s(addr.fullAddress) ||
    s(addr.addressKindCode) ||
    s(addr.territoryCode) ||
    s(addr.postCode) ||
    s(addr.regionName) ||
    s(addr.districtName) ||
    s(addr.cityName) ||
    s(addr.settlementName) ||
    s(addr.streetName) ||
    s(addr.buildingNumberId) ||
    s(addr.roomNumberId) ||
    s(addr.postOfficeBoxId)
  )
}

function measureExecutorSubjectCountry(sd: SubjectDetails): string | undefined {
  const v = sd.businessEntity?.country ?? sd.country
  if (v == null || String(v).trim() === '') return undefined
  return String(v).trim()
}

function measureExecutorSubjectName(sd: SubjectDetails): string | undefined {
  const v = sd.businessEntity?.businessEntityName ?? sd.subjectName
  if (v == null || String(v).trim() === '') return undefined
  return String(v).trim()
}

function getMeasureExecutorSubjectAddressList(sd: SubjectDetails): AddressDetails[] {
  const be = sd.businessEntity
  if (be?.addresses && be.addresses.length > 0) return [...be.addresses]
  return getAddressListFromSubject(sd)
}

function getMeasureSubjectContacts(sd: SubjectDetails): ContactDetails[] {
  const be = sd.businessEntity
  if (be?.contacts && be.contacts.length > 0) return be.contacts
  return sd.contacts ?? []
}

function getAuthorities(impl: MeasureImplementationItem) {
  return impl.authorities && impl.authorities.length > 0
    ? impl.authorities
    : impl.authority
      ? [impl.authority]
      : []
}

function getSubjects(impl: MeasureImplementationItem) {
  return impl.subjectDetailsList && impl.subjectDetailsList.length > 0
    ? impl.subjectDetailsList
    : impl.subjectDetails
      ? [impl.subjectDetails]
      : []
}

function documentReferenceTouched(doc: DocumentReferenceDetails | undefined): boolean {
  if (!doc) return false
  return !!(
    doc.docKindCode?.trim() ||
    doc.docKindName?.trim() ||
    doc.docName?.trim() ||
    doc.docId?.trim() ||
    doc.docCreationDate?.trim() ||
    doc.docStartDate?.trim()
  )
}

function subjectAddressTouched(sd: SubjectDetails): boolean {
  return getMeasureExecutorSubjectAddressList(sd).some((a) => measureExecutorAddressRowHasContent(a))
}

function subjectTouched(sd: SubjectDetails | undefined): boolean {
  if (!sd) return false
  return !!(
    measureExecutorSubjectCountry(sd) ||
    measureExecutorSubjectName(sd) ||
    subjectAddressTouched(sd) ||
    hasIdentityDocV3Content(sd.identityDoc) ||
    (sd.businessEntity?.businessEntityId ?? '').trim() ||
    (sd.businessEntity?.identificationMethod ?? '').trim() ||
    (getMeasureSubjectContacts(sd).length ?? 0) > 0
  )
}

function organizationAnyFieldTouched(o: BusinessEntityDetails): boolean {
  return !!(
    o.country?.trim() ||
    o.businessEntityName?.trim() ||
    o.businessEntityId?.trim() ||
    o.identificationMethod?.trim() ||
    (o.addresses ?? []).some((a) => measureExecutorAddressRowHasContent(a)) ||
    (o.contacts ?? []).some((c) => remarkContactsIncomplete([c]) != null)
  )
}

function organizationTrioComplete(o: BusinessEntityDetails): boolean {
  if (empty(o.country) || empty(o.businessEntityName)) return false
  return (o.addresses ?? []).some((a) => measureExecutorAddressRowHasContent(a))
}

function addressHasCityOrSettlement(addr: AddressDetails | undefined): boolean {
  return !empty(addr?.cityName) || !empty(addr?.settlementName)
}

function objectAddressHasMinimum(addr: AddressDetails | undefined): boolean {
  if (!addr) return false
  return !!(
    addr.country?.trim() ||
    addr.cityName?.trim() ||
    addr.settlementName?.trim() ||
    addr.regionName?.trim() ||
    addr.streetName?.trim() ||
    addr.fullAddress?.trim()
  )
}

function hasPlaceAnyBlock(place: DetectionPlaceData | undefined): boolean {
  if (!place) return false
  const o = place.organization
  if (o && organizationAnyFieldTouched(o)) return true
  const bc = place.borderCheckpoint
  if (bc && (bc.checkpointCode?.trim() || bc.checkpointName?.trim())) return true
  if (place.address && objectAddressHasMinimum(place.address)) return true
  if (place.geoCoordinates?.some((g) => (g.longitude ?? '').trim() || (g.latitude ?? '').trim())) return true
  return false
}

function pathogenDetailsTouched(p: PhaPathogenDetails): boolean {
  return !empty(p.pathogenName) || !empty(p.pathogenKindName)
}

function spreadingZoneTouched(place: DetectionPlaceData | undefined): boolean {
  if (!place) return false
  if (place.organization && organizationAnyFieldTouched(place.organization)) return true
  return !!(
    place.borderCheckpoint ||
    place.address ||
    (place.geoCoordinates && place.geoCoordinates.length > 0) ||
    place.description?.trim()
  )
}

function spreadingZonesList(data: CardData): DetectionPlaceData[] {
  if (data.spreadingZones && data.spreadingZones.length > 0) return data.spreadingZones
  if (data.spreadingZone) return [data.spreadingZone]
  return []
}

function getMeasureImplementationSubjectEntries(impl: MeasureImplementationItem): SubjectDetails[] {
  if (impl.subjectDetailsList && impl.subjectDetailsList.length > 0) return impl.subjectDetailsList
  if (impl.subjectDetails) return [impl.subjectDetails]
  return []
}

function smdAuxiliaryPublicHealthIncidentFields(data: CardData): boolean {
  const d = data.phaDisease
  if (d?.crossborderSpreadRiskIndicator === 0 || d?.crossborderSpreadRiskIndicator === 1) return true
  if ((data.detectionPlace?.description ?? '').trim()) return true
  if ((data.phaPatientGroups ?? []).some(hasPhaPatientGroupExportContent)) return true
  return spreadingZonesList(data).some((z) => (z.description ?? '').trim())
}

function smdPublicHealthIncidentCoreSpecified(data: CardData): boolean {
  const d = data.phaDisease
  if (d?.diseaseName?.trim()) return true
  if (d?.firstCaseDate?.trim() || d?.lastCaseDate?.trim()) return true
  if (d?.pathogens?.some(pathogenDetailsTouched)) return true
  if (hasPlaceAnyBlock(data.detectionPlace)) return true
  if (spreadingZonesList(data).some(spreadingZoneTouched)) return true
  return false
}

function smdPublicHealthIncidentSpecified(data: CardData): boolean {
  if (data.detectionPlace?.organization !== undefined) return true
  if (spreadingZonesList(data).some((z) => z.organization !== undefined)) return true
  return smdPublicHealthIncidentCoreSpecified(data) || smdAuxiliaryPublicHealthIncidentFields(data)
}

function validateOrganizationInDiseasePlace(
  o: BusinessEntityDetails | undefined,
  add: (msg: string) => void,
  contactScopePhrase: 'организации места обнаружения' | 'организации зоны распространения'
): void {
  if (o === undefined) return

  if (organizationAnyFieldTouched(o)) {
    for (const msg of businessEntityIdMethodPairRemarks(o, { legacyHozyaystvuyushchegoSubektaWording: true })) {
      add(msg)
    }
  }
  if (!organizationTrioComplete(o)) {
    add('Должны быть заполнены Страна, Наименование субъекта, Адрес')
  }
  for (const addr of o.addresses ?? []) {
    if (measureExecutorAddressRowHasContent(addr)) {
      if (empty(addr.country)) add('В адресе должна быть указана страна')
      if (!addressHasCityOrSettlement(addr)) add('В адресе должен быть указан город или населенный пункт')
    }
  }
  const cr = remarkContactsIncomplete(o.contacts)
  if (cr) {
    add(
      contactScopePhrase === 'организации места обнаружения'
        ? 'Для контактного реквизита организации места обнаружения должно быть указано значение'
        : 'Для контактного реквизита организации зоны распространения должно быть указано значение'
    )
  }
}

function collectDiseasePlaceRemarks(
  place: DetectionPlaceData | undefined,
  contactScopePhrase: string
): string[] {
  const remarks: string[] = []
  const add = (msg: string) => remarks.push(msg)

  // Кейс 4: тег OrganizationDetails есть (в т.ч. пустой {}) — проверяем до early-return.
  const o = place?.organization
  if (o !== undefined) {
    validateOrganizationInDiseasePlace(
      o,
      add,
      contactScopePhrase as 'организации места обнаружения' | 'организации зоны распространения'
    )
  }

  if (!hasPlaceAnyBlock(place)) {
    // Если организация уже заявлена тегом, замечание кейса 4 выше достаточно.
    if (o === undefined) {
      add(
        'Должен быть заполнен хотя бы один из  следующих реквизитов: Организация, Пункт пропуска, Адрес или Географические координаты'
      )
    }
    return remarks
  }

  const bc = place?.borderCheckpoint
  if (bc && (bc.checkpointCode?.trim() || bc.checkpointName?.trim())) {
    if (empty(bc.checkpointCode) || empty(bc.checkpointName)) {
      add('Код и наименование пункта пропуска должны быть заполнены')
    }
  }

  const objAddr = place?.address
  if (objAddr && (objectAddressHasMinimum(objAddr) || !empty(objAddr.country))) {
    if (empty(objAddr.country)) add('В адресе должна быть указана страна')
    if (!addressHasCityOrSettlement(objAddr)) add('В адресе должен быть указан город или населенный пункт')
  }

  return remarks
}

function validateSanitaryMeasureSection(
  measure: SanitaryMeasure,
  data: CardData,
  add: (msg: string) => void
): void {
  if (!resolveSmdMeasureStartDate(data)) {
    add('В составе сведений о  временной санитарной мере должна быть указана дата начала')
  }

  if (empty(measure.measureCode) && empty(measure.measureName)) {
    add(
      'В составе каждого набора сведений о  временной санитарной мере должен быть указан или Код принятой меры, или ее Наименование'
    )
  }

  const doc = measure.measureDocDetails
  if (hasMeasureDocDetailsContent(doc)) {
    const d = doc!
    if (empty(d.docKindName)) {
      add('Для документа, регламентирующего введение (отмену) меры должно быть указано наименование вида документа')
    }
    if (empty(d.docName)) {
      add('Для документа, регламентирующего введение (отмену) меры должно быть указано его наименование')
    }
    if (empty(d.docSeriesId)) {
      add('Для документа, регламентирующего введение (отмену) меры должна быть указана его серия')
    }
    if (empty(d.docStartDate)) {
      add('Для документа, регламентирующего введение (отмену) меры должна быть указана дата начала срока действия')
    }
    if (empty(d.docValidityDate)) {
      add('Для документа, регламентирующего введение (отмену) меры должна быть указана дата  истечения срока действия')
    }
    if (empty(d.docValidityDuration)) {
      add('Для документа, регламентирующего введение (отмену) меры должен быть указан срок действия документа')
    }
    if (empty(d.description)) {
      add('Для документа, регламентирующего введение (отмену) меры должно быть указано описание')
    }
    if (empty(d.pageQuantity)) {
      add('Для документа, регламентирующего введение (отмену) меры должно быть указано количество листов')
    }
    if (empty(d.authorityName)) {
      add('Для документа, регламентирующего введение (отмену) меры должен быть указан уполномоченный орган')
    }
  }

  const initial = measure.initialMeasureDocDetails
  if (hasMeasureDocDetailsContent(initial)) {
    const id = initial!
    if (empty(id.country)) {
      add('Для документа, регламентирующего введение исходной меры должна быть указана страна')
    }
    if (empty(id.docKindName)) {
      add('Для документа, регламентирующего введение исходной меры должно быть указано наименование вида документа')
    }
    if (empty(id.docName)) {
      add('Для документа, регламентирующего введение исходной меры должно быть указано его наименование')
    }
    if (empty(id.docSeriesId)) {
      add('Для документа, регламентирующего введение исходной меры должна быть указана его серия')
    }
    if (empty(id.docId)) {
      add('Для документа, регламентирующего введение исходной меры должен быть указан его номер')
    }
    if (empty(id.docCreationDate)) {
      add('Для документа, регламентирующего введение исходной меры должна быть указана его дата')
    }
    if (empty(id.docStartDate)) {
      add('Для документа, регламентирующего введение исходной меры должна быть указана дата начала срока действия')
    }
    if (empty(id.docValidityDate)) {
      add('Для документа, регламентирующего введение исходной меры должна быть указана дата  истечения срока действия')
    }
    if (empty(id.docValidityDuration)) {
      add('Для документа, регламентирующего введение исходной меры должен быть указан срок действия документа')
    }
    if (empty(id.description)) {
      add('Для документа, регламентирующего введение исходной меры должно быть указано описание')
    }
    if (empty(id.pageQuantity)) {
      add('Для документа, регламентирующего введение исходной меры должно быть указано количество листов')
    }
    if (empty(id.authorityName)) {
      add('Для документа, регламентирующего введение исходной меры должен быть указан уполномоченный орган')
    }
  }

  const reasonCode = (measure.measureReasonCode ?? '').trim()
  if (
    reasonCode === '4' &&
    !smdPublicHealthIncidentCoreSpecified(data) &&
    !smdAuxiliaryPublicHealthIncidentFields(data)
  ) {
    add(
      'В случае причины введения меры "ухудшение санитарно-эпидемиологической ситуации на территории государства-члена" должны быть указаны сведения об обнаружении болезни на закладке "Болезнь"'
    )
  }
  if (reasonCode === '1' && !(data.smdProductBatches?.length ?? 0)) {
    add(
      'В случае причины введения меры "выявление подконтрольной государственному санитарно-эпидемиологическому надзору (контролю) продукции (товаров), не соответствующей Единым санитарным требованиям или требованиям технического регламента (технических регламентов) Союза (Таможенного союза)" должны быть указаны сведения об обнаружении опасной продукции на закладке "Продукция"'
    )
  }

}

function validateMeasuresSection(measure: SanitaryMeasure, add: (msg: string) => void): void {
  const implList = (measure.measureImplementationDetails ?? []).filter(hasMeasureImplementationEntryContent)

  let anyImplMissingCore = false
  let anyImplMissingCountry = false
  let anyImplMissingStartDate = false
  let anyImplMissingDescription = false
  let anyImplMissingExecutorChoice = false
  let anyImplMissingCountryOnSubject = false
  let anyImplMissingNameOnSubject = false
  let anyImplMissingAddressOnSubject = false

  for (const impl of implList) {
    const hasEntity = getAuthorities(impl).length > 0 || getSubjects(impl).length > 0
    const hasDoc = documentReferenceTouched(impl.documentDetails)
    const hasKind = !empty(impl.measureAffectedObjectKindCode)
    const hasRegion = !empty(impl.placeDetails?.regionName)
    if (!hasEntity || !hasDoc || !hasKind || !hasRegion) {
      anyImplMissingCore = true
    }
    if (empty(impl.country)) anyImplMissingCountry = true
    if (empty(impl.startDate)) anyImplMissingStartDate = true
    if (empty(impl.description)) anyImplMissingDescription = true

    const hasAuthority = getAuthorities(impl).length > 0
    const hasSubject = getSubjects(impl).length > 0
    if (!hasAuthority && !hasSubject) anyImplMissingExecutorChoice = true

    for (const subj of getMeasureImplementationSubjectEntries(impl)) {
      if (empty(measureExecutorSubjectCountry(subj))) anyImplMissingCountryOnSubject = true
      if (empty(measureExecutorSubjectName(subj))) anyImplMissingNameOnSubject = true
      if (!getMeasureExecutorSubjectAddressList(subj).some((a) => measureExecutorAddressRowHasContent(a))) {
        anyImplMissingAddressOnSubject = true
      }
    }
  }

  if (anyImplMissingCore) {
    add(
      'В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должны быть указаны сведения об исполнителе, документ, устанавливающий мероприятие, вид объекта действия меры и регион'
    )
  }
  if (anyImplMissingCountry) {
    add('В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должна быть указана страна')
  }
  if (anyImplMissingStartDate) {
    add('В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должна быть указана дата начала мероприятия')
  }
  if (anyImplMissingDescription) {
    add('В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должно быть указано описание')
  }
  if (anyImplMissingExecutorChoice) {
    add(
      'В составе каждого набора сведений об исполнителе мероприятия, обеспечивающего соблюдение меры, должен быть указан один из следующих реквизитов: "Уполномоченный орган", "Субъект"'
    )
  }

  for (const impl of implList) {
    const docRef = impl.documentDetails
    if (documentReferenceTouched(docRef)) {
      if (empty(docRef?.docName)) {
        add('В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должно быть указано его наименование')
      }
      if (empty(docRef?.docId)) {
        add('В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должен быть указан его номер')
      }
      if (empty(docRef?.docCreationDate)) {
        add('В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должна быть указана его дата')
      }
    }

    for (const authority of getAuthorities(impl)) {
      if (empty(authority.country)) {
        add('Страна уполномоченного органа, обеспечивающего соблюдение меры должна быть указана')
      }
      if (empty(authority.authorityName)) {
        add('Наименование уполномоченного органа, обеспечивающего соблюдение меры должно быть указано')
      }
    }

    for (const subj of getMeasureImplementationSubjectEntries(impl)) {
      if (subjectTouched(subj)) {
        for (const msg of businessEntityIdMethodPairRemarks(subj.businessEntity, { legacyHozyaystvuyushchegoSubektaWording: true })) {
          add(msg)
        }
        const identityDoc = subj.identityDoc
        if (hasIdentityDocV3Content(identityDoc)) {
          if (empty(identityDoc?.country)) {
            add('В составе сведений об удостоверении личности субъекта, обеспечивающего соблюдение меры должна быть указана страна')
          }
          if (empty(identityDoc?.docId)) {
            add('В составе сведений об удостоверении личности субъекта, обеспечивающего соблюдение меры должен быть указан номер документа')
          }
        }
        const cr = remarkContactsIncomplete(getMeasureSubjectContacts(subj))
        if (cr) add(cr)
      }
      const subjAddrs = getMeasureExecutorSubjectAddressList(subj).filter((a) => measureExecutorAddressRowHasContent(a))
      if (subjAddrs.length > 0) {
        for (const addr of subjAddrs) {
          if (empty(addr.country)) {
            add('Для каждого адреса субъекта-исполнителя мероприятия должна быть указана страна')
          }
        }
        let noCityOrSettlement = false
        for (const addr of subjAddrs) {
          if (!empty(addr.cityName) || !empty(addr.settlementName)) continue
          noCityOrSettlement = true
          break
        }
        if (noCityOrSettlement) {
          add('В составе каждого адреса субъекта-исполнителя мероприятия должен быть указан или город, или населенный пункт')
        }
      }
    }

    const place = impl.placeDetails
    if (place?.borderCheckpointCode?.trim() || place?.borderCheckpointName?.trim()) {
      if (empty(place.borderCheckpointCode)) {
        add('В составе сведений о пункте пропуска, в котором проводится мероприятие должен быть указан код вида пункта пропуска')
      }
      if (empty(place.borderCheckpointName)) {
        add('В составе сведений о пункте пропуска, в котором проводится мероприятие должно быть указано наименование пункта пропуска')
      }
    }
  }

  if (anyImplMissingCountryOnSubject) {
    add('Код страны регистрации субъекта, обеспечивающего соблюдение меры должен быть указан')
  }
  if (anyImplMissingNameOnSubject) {
    add('Наименование субъекта, обеспечивающего соблюдение меры должно быть указано')
  }
  if (anyImplMissingAddressOnSubject) {
    add('Должен быть указан хотя бы один адрес в субъекта, обеспечивающего соблюдение меры')
  }

}

function validateProductSection(data: CardData, add: (msg: string) => void): void {
  const items = data.smdProductBatches ?? []
  if (!items.length) return

  let missingProductName = false
  let missingDescription = false
  let missingMfrCountry = false
  let missingMfrName = false
  let missingMfrAddress = false
  let missingMfrAddressCountry = false
  let missingMfrCityOrSettlement = false
  let missingMfrIdMethodPair = false

  for (const item of items) {
    const product = item.product
    if (!product) continue
    const pd = product.productDetails
    if (empty(pd?.productName)) missingProductName = true
    if (empty(pd?.description)) missingDescription = true
    const mfr = product.manufacturer
    if (empty(mfr?.country)) missingMfrCountry = true
    if (empty(mfr?.businessEntityName)) missingMfrName = true
    if (mfr && !hasAtLeastOneAddress(mfr)) {
      missingMfrAddress = true
    } else if (mfr) {
      for (const addr of getAddresses(mfr)) {
        if (empty(addr.country)) missingMfrAddressCountry = true
        if (empty(addr.cityName) && empty(addr.settlementName)) missingMfrCityOrSettlement = true
      }
    }
    if (businessEntityIdMethodPairRemarks(mfr, { legacyHozyaystvuyushchegoSubektaWording: true }).length > 0) {
      missingMfrIdMethodPair = true
    }
  }

  if (missingProductName) {
    add('Наименование продукции, присвоенное производителем (изготовителем) и отличающее данную продукцию от аналогичной продукции других производителей должно быть указано')
  }
  if (missingDescription) {
    add('Сведения о продукции, обеспечивающие ее идентификацию должны быть указаны')
  }
  if (missingMfrCountry) {
    add('Код страны регистрации изготовителя продукции должен быть указан')
  }
  if (missingMfrName) {
    add('Наименование изготовителя продукции должно быть указано')
  }
  if (missingMfrAddress) {
    add('Должен быть указан хотя бы один адрес изготовителя продукции')
  }
  if (missingMfrAddressCountry) {
    add('Для каждого адреса изготовителя продукции должна быть указана страна')
  }
  if (missingMfrCityOrSettlement) {
    add('В составе каждого адреса изготовителя продукции должен быть указан или город, или населенный пункт')
  }
  if (missingMfrIdMethodPair) {
    add('Идентификатор субъекта и метод идентификации изготовителя продукции должны быть указаны одновременно или оба отсутствовать')
  }

}

function getAllSmdProductBatches(data: CardData): ProductBatchDetails[] {
  return (data.smdProductBatches ?? []).flatMap((item) => item.tsd?.batches ?? [])
}

function validateTsdSection(data: CardData, add: (msg: string) => void): void {
  const smdItems = data.smdProductBatches ?? []
  if (!smdItems.length) return

  const batches = getAllSmdProductBatches(data)
  if (batches.length === 0) {
    add('В составе сведений об обнаружении опасной продукции должны быть указаны хотя бы одни сведения о серии или партии продукции')
    return
  }

  for (const batch of batches) {
    const docs = batch.shippingDocuments ?? []
    if (docs.length === 0) {
      add('В каждом составе сведений о серии или партии продукции должен быть указан хотя бы один товаросопроводительный документ')
      continue
    }
    for (const d of docs) {
      if (empty(d.docName)) add('Для каждого товаросопроводительного документа должно быть указано его Наименование')
      if (empty(d.docId)) add('Для каждого товаросопроводительного документа должен быть указан его номер')
      if (empty(d.docCreationDate)) add('Для каждого товаросопроводительного документа должна быть указана его дата')
    }
  }

  let tsdPartyMissingCountry = false
  let tsdPartyMissingName = false
  let tsdPartyMissingAddress = false
  let tsdAddressMissingCountry = false
  let tsdAddressMissingCityOrSettlement = false
  let tsdPartyIdMethodPairInvalid = false

  let tsdPartyMissingKind = false
  let tsdPartyContactIncomplete = false

  for (const batch of batches) {
    for (const doc of batch.shippingDocuments ?? []) {
      for (const party of doc.supplyChainParties ?? []) {
        if (!hasSupplyChainPartyContent(party)) continue
        if (empty(party.supplyChainPartyKindCode)) tsdPartyMissingKind = true
        if (remarkContactsIncomplete(party.contacts)) tsdPartyContactIncomplete = true
        if (empty(party.country)) tsdPartyMissingCountry = true
        if (empty(party.businessEntityName)) tsdPartyMissingName = true
        const addrList = getAddressListFromParty(party)
        if (addrList.length === 0) tsdPartyMissingAddress = true
        else {
          for (const addr of addrList) {
            if (empty(addr.country)) tsdAddressMissingCountry = true
            if (empty(addr.cityName) && empty(addr.settlementName)) tsdAddressMissingCityOrSettlement = true
          }
        }
        if (businessEntityIdMethodPairRemarks(party, { legacyHozyaystvuyushchegoSubektaWording: true }).length > 0) {
          tsdPartyIdMethodPairInvalid = true
        }
      }
    }
  }

  const hasAnyParty = batches.some((b) =>
    (b.shippingDocuments ?? []).some((d) =>
      (d.supplyChainParties ?? []).some((p) => hasSupplyChainPartyContent(p))
    )
  )
  if (hasAnyParty) {
    if (tsdPartyMissingKind) {
      add('Вид участника цепи поставки в составе данных по ТСД должен быть указан')
    }
    if (tsdPartyContactIncomplete) {
      add('Для контактного реквизита участника цепи поставки в составе данных по ТСД должно быть указано значение')
    }
    if (tsdPartyMissingCountry) {
      add('Код страны регистрации изготовителя продукции в составе данных по ТСД должен быть указан')
    }
    if (tsdPartyMissingName) {
      add('Наименование изготовителя продукции в составе данных по ТСД должен быть указан')
    }
    if (tsdPartyMissingAddress) {
      add('Должен быть указан хотя бы один адрес изготовителя продукции в составе данных по ТСД')
    }
  }
  const hasAnyPartyAddress = batches.some((b) =>
    (b.shippingDocuments ?? []).some((d) =>
      (d.supplyChainParties ?? []).some(
        (p) => hasSupplyChainPartyContent(p) && getAddressListFromParty(p).length > 0
      )
    )
  )
  if (hasAnyPartyAddress) {
    if (tsdAddressMissingCountry) {
      add('Для каждого адреса изготовителя продукции изготовителя продукции в составе данных по ТСД должна быть указана страна')
    }
    if (tsdAddressMissingCityOrSettlement) {
      add('Для каждого адреса изготовителя продукции изготовителя продукции в составе данных по ТСД должен быть указан или город, или населенный пункт')
    }
  }
  if (hasAnyParty && tsdPartyIdMethodPairInvalid) {
    add('Идентификатор субъекта и метод идентификации изготовителя продукции в составе данных по ТСД должны быть указаны одновременно или оба отсутствовать')
  }

}

function validateComplianceSection(data: CardData, add: (msg: string) => void): void {
  const batches = getAllSmdProductBatches(data)
  if (!batches.length) return

  for (const batch of batches) {
    if ((batch.complianceDocuments ?? []).length === 0) {
      add('В каждом составе сведений о серии или партии продукции должен быть указан хотя бы один документ об оценке соответствия продукции')
    }
  }

  const complianceList = batches.flatMap((b) => b.complianceDocuments ?? [])
  for (const doc of complianceList) {
    if (empty(doc.docKindCode)) {
      add('Для каждого документа об оценке соответствия продукции должен быть указан код вида документа')
    }
    if (empty(doc.docName)) {
      add('Для каждого документа об оценке соответствия продукции должно быть указано его наименование')
    }
    if (empty(doc.docId)) {
      add('Для каждого документа об оценке соответствия продукции должен быть указан его номер')
    }
    if (empty(doc.docCreationDate)) {
      add('Для каждого документа об оценке соответствия продукции должна быть указана его дата')
    }
    if (empty(doc.authority?.country)) {
      add('Для каждого документа об оценке соответствия продукции должна быть указана страна уполномоченного органа')
    }
    if (empty(doc.authority?.authorityName)) {
      add('Для каждого документа об оценке соответствия продукции должно быть указано наименование уполномоченного органа')
    }
  }

}

function validateViolationsSection(data: CardData, add: (msg: string) => void): void {
  const batches = getAllSmdProductBatches(data)
  if (!batches.length) return

  const allViolations = batches.flatMap((b) => normalizeBatchViolations(b))
  for (const batch of batches) {
    if (normalizeBatchViolations(batch).length === 0) {
      add('В каждом составе сведений о серии или партии продукции должно быть указано хотя бы одно нарушение')
    }
  }
  for (const v of allViolations) {
    if ((v.violatedRequirements ?? []).length === 0) {
      add('В каждом составе сведений о нарушении должны быть указаны сведения хотя бы об одном нарушенном требовании')
    }
  }
  for (const r of allViolations.flatMap((v) => v.violatedRequirements ?? [])) {
    if (empty(r.technicalRegulationId)) {
      add('В каждом составе сведении о нарушенных требованиях должен быть указан номер техрегламента')
    }
  }
  for (const ind of allViolations.flatMap((v) => v.violatedIndicators ?? [])) {
    if (ind.isNormative === undefined || ind.isNormative === null) {
      add('В каждом составе сведении о нарушенных показателях должен быть указан признак нормативного показателя')
    }
    if (empty(ind.indicatorName)) {
      add('В каждом составе сведении о нарушенных показателях должно быть указано наименование показателя')
    }
    if (empty(ind.indicatorValue)) {
      add('В каждом составе сведении о нарушенных показателях должно быть указано значение показателя')
    }
  }

}

function validateDiseaseSection(data: CardData, add: (msg: string) => void): void {
  if (!smdPublicHealthIncidentSpecified(data)) return

  const remarks: string[] = []
  const push = (msg: string) => {
    if (!remarks.includes(msg)) remarks.push(msg)
  }

  const d: PhaDiseaseDetails | undefined = data.phaDisease
  if (!d?.diseaseName?.trim()) {
    push('Наименование болезни должно быть указано')
  }

  if (empty(d?.firstCaseDate)) {
    push('Дата первого случая должна быть указана')
  }

  ;(d?.pathogens ?? []).forEach((p) => {
    if (pathogenDetailsTouched(p) && empty(p.pathogenKindName)) {
      push('Наименование типа возбудителя должно быть указано')
    }
  })

  if (!hasPlaceAnyBlock(data.detectionPlace)) {
    push('Должно быть заполнено место обнаружения болезни')
  }

  for (const g of data.phaPatientGroups ?? []) {
    if (!hasPhaPatientGroupExportContent(g)) continue
    const pq = g.personQuantity != null ? String(g.personQuantity).trim() : ''
    if (empty(pq)) {
      push('Для каждой группы пациентов должно быть указано количество')
      break
    }
  }

  const detectionPlaceTouched =
    hasPlaceAnyBlock(data.detectionPlace) ||
    !!(data.detectionPlace?.description ?? '').trim() ||
    data.detectionPlace?.organization !== undefined
  if (detectionPlaceTouched) {
    for (const msg of collectDiseasePlaceRemarks(
      data.detectionPlace,
      'организации места обнаружения'
    )) {
      push(msg)
    }
  }

  for (const zone of spreadingZonesList(data)) {
    if (zone.organization !== undefined) {
      validateOrganizationInDiseasePlace(zone.organization, push, 'организации зоны распространения')
    }
    if (!spreadingZoneTouched(zone)) continue
    const bc = zone.borderCheckpoint
    if (bc && (bc.checkpointCode?.trim() || bc.checkpointName?.trim())) {
      if (empty(bc.checkpointCode) || empty(bc.checkpointName)) {
        push('Код и наименование пункта пропуска должны быть заполнены')
      }
    }
    const objAddr = zone.address
    if (objAddr && (objectAddressHasMinimum(objAddr) || !empty(objAddr.country))) {
      if (empty(objAddr.country)) push('В адресе должна быть указана страна')
      if (!addressHasCityOrSettlement(objAddr)) push('В адресе должен быть указан город или населенный пункт')
    }
  }

  for (const msg of remarks) add(msg)
}

/** Форматно-логические контроли исходящей карты SMD по регламенту п. 8. */
export function validateSmdFormatLogical(data: CardData): ValidationResult {
  const sections: { sectionName: string; remarks: string[] }[] = []
  const mk = (name: string) => ({ sectionName: name, remarks: [] as string[] })
  const add = (s: { sectionName: string; remarks: string[] }, msg: string) => {
    s.remarks.push(msg)
  }

  const measure = getSmdPrimaryMeasure(data)

  const sectionSanitary = mk('Санитарная мера')
  validateSanitaryMeasureSection(measure, data, (msg) => add(sectionSanitary, msg))
  if (sectionSanitary.remarks.length) sections.push(sectionSanitary)

  const sectionMeasures = mk('Мероприятия')
  validateMeasuresSection(measure, (msg) => add(sectionMeasures, msg))
  if (sectionMeasures.remarks.length) sections.push(sectionMeasures)

  const sectionProduct = mk('Продукция')
  validateProductSection(data, (msg) => add(sectionProduct, msg))
  if (sectionProduct.remarks.length) sections.push(sectionProduct)

  const sectionTsd = mk('Продукция. ТСД')
  validateTsdSection(data, (msg) => add(sectionTsd, msg))
  if (sectionTsd.remarks.length) sections.push(sectionTsd)

  const sectionCompliance = mk('Продукция. Документы соответствия')
  validateComplianceSection(data, (msg) => add(sectionCompliance, msg))
  if (sectionCompliance.remarks.length) sections.push(sectionCompliance)

  const sectionViolations = mk('Нарушения')
  validateViolationsSection(data, (msg) => add(sectionViolations, msg))
  if (sectionViolations.remarks.length) sections.push(sectionViolations)

  const sectionDisease = mk('Болезнь')
  validateDiseaseSection(data, (msg) => add(sectionDisease, msg))
  if (sectionDisease.remarks.length) sections.push(sectionDisease)

  const totalRemarks = sections.reduce((sum, s) => sum + s.remarks.length, 0)
  return {
    success: totalRemarks === 0,
    sections: sections.filter((s) => s.remarks.length > 0),
  }
}
