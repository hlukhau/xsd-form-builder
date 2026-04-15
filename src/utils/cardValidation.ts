/**
 * Валидация карты исходящих сведений об опасной продукции.
 * Проверка по перечню контролей; результат — отчёт по разделам с замечаниями или успех.
 */
import type {
  CardData,
  ProductData,
  ProductDetails,
  TechnicalDocument,
  TSDData,
  ProductBatchDetails,
  ShippingDocument,
  ComplianceDocument,
  ViolationsData,
  ViolatedRequirement,
  AddressDetails,
  SupplyChainPartyDetails,
  DetectionPlaceData,
  MeasuresData,
  SanitaryMeasure,
  MeasureInitiationBasisItem,
  MeasureImplementationItem,
} from '@/types/card'
import { mergeComplianceDocumentsFromBatches } from '@/utils/xmlParser'
import { getAddressListFromParty } from '@/utils/addressFormatUtils'
import { validateFieldValue } from '@/constants/xsdFieldConstraints'
import { exportCardDataToXML } from '@/utils/xmlExporter'
import { fetchSchemaValidationErrors } from '@/utils/schemaValidationApi'

export interface ValidationResult {
  success: boolean
  sections: { sectionName: string; remarks: string[] }[]
}

function empty(s: string | undefined | null): boolean {
  return s == null || String(s).trim() === ''
}

function hasAtLeastOneAddress(party: { registrationAddress?: unknown; actualAddress?: unknown; mailingAddress?: unknown }): boolean {
  return !!(party?.registrationAddress || party?.actualAddress || party?.mailingAddress)
}

function hasAtLeastOneAddressFromArray(addresses: unknown[] | undefined): boolean {
  return !!(addresses && addresses.length > 0)
}

function normalizeBatchViolations(batch: ProductBatchDetails): ViolationsData[] {
  const v = batch.violations
  if (v == null) return []
  return Array.isArray(v) ? v : [v as ViolationsData]
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

/**
 * В ТТН при непустых полях продукта (кроме наименования) блок ProductDetails попадёт в XML, а по XSD в нём обязателен ProductName.
 */
function shippingProductDetailsHasContentAsideFromName(p: ProductDetails | undefined): boolean {
  if (!p) return false
  const s = (v: string | undefined) => (v ?? '').trim()
  if (
    s(p.productId) ||
    s(p.description) ||
    s(p.commodityCode) ||
    s(p.productPurpose) ||
    s(p.applicationMethod) ||
    s(p.releaseForm) ||
    s(p.storageCondition) ||
    s(p.labelText)
  ) {
    return true
  }
  const tradeNames = p.tradeNames?.length ? p.tradeNames : p.tradeName ? [p.tradeName] : []
  if (tradeNames.some((t) => s(t))) return true
  return (p.technicalDocs ?? []).some((d) => {
    if (!d) return false
    return !!(s(d.docKindCode) || s(d.docName) || s(d.docId) || s(d.docCreationDate) || s(d.docStartDate))
  })
}

export function validateOutgoingCard(data: CardData): ValidationResult {
  const sections: { sectionName: string; remarks: string[] }[] = []
  const n = (name: string) => ({ sectionName: name, remarks: [] as string[] })
  const add = (s: { sectionName: string; remarks: string[] }, msg: string) => {
    s.remarks.push(msg)
  }

  const sectionNotification = n('Уведомление')
  const sectionProduct = n('Продукция')
  const sectionTsd = n('ТСД')
  const sectionCompliance = n('Документы соответствия')
  const sectionViolations = n('Нарушения')
  const sectionDetectionPlace = n('Место обнаружения')
  const sectionMeasures = n('Принятые меры')

  const notif = data.notification
  const version = data.version ?? 1
  const incidentKind = notif?.type?.trim()

  // —— Уведомление ——
  if (empty(notif?.country)) {
    add(sectionNotification, 'Код страны, уполномоченный орган которой направил уведомление должен быть указан')
  }
  if (empty(notif?.registrationNumber)) {
    add(sectionNotification, 'Регистрационный номер уведомления должен быть указан')
  }
  if (empty(incidentKind)) {
    add(sectionNotification, 'Вид уведомления должен быть указан')
  } else {
    if (version === 1 && incidentKind !== '7') {
      add(sectionNotification, 'Неверно указан вид уведомления')
    }
    if (version !== 1 && incidentKind !== '8' && incidentKind !== '9') {
      add(sectionNotification, 'Неверно указан вид уведомления')
    }
  }
  if (empty(notif?.formationDate)) {
    add(sectionNotification, 'Дата формирования уведомления должна быть указана')
  }
  if (incidentKind === '7' && notif?.endDate != null && String(notif.endDate).trim() !== '') {
    add(sectionNotification, 'Дата закрытия (архивации) не должна быть указана, если вид уведомления «7» – обнаружение продукции, опасной для жизни, здоровья человека и среды его обитания')
  }
  const auth = notif?.authorizedBody
  if (empty(auth?.country)) {
    add(sectionNotification, 'Страна уполномоченного органа должна быть указана')
  }
  if (empty(auth?.name)) {
    add(sectionNotification, 'Наименование уполномоченного органа должно быть указано')
  }
  if (sectionNotification.remarks.length) sections.push(sectionNotification)

  // —— Продукция ——
  const product = data.product
  if (!product) {
    add(sectionProduct, 'Раздел «Продукция» не заполнен. Необходимо указать сведения о продукции.')
  } else {
    const pd = product.productDetails
    if (empty(pd?.productName)) {
      add(sectionProduct, 'Наименование продукции, присвоенное производителем (изготовителем) и отличающее данную продукцию от аналогичной продукции других производителей должно быть указано')
    }
    if (empty(pd?.description)) {
      add(sectionProduct, 'Сведения о продукции, обеспечивающие ее идентификацию должны быть указаны')
    }
    const mfr = product.manufacturer
    if (empty(mfr?.country)) {
      add(sectionProduct, 'Код страны регистрации изготовителя продукции должен быть указан')
    }
    if (empty(mfr?.businessEntityName)) {
      add(sectionProduct, 'Наименование изготовителя продукции должно быть указано')
    }
    if (mfr && !hasAtLeastOneAddress(mfr)) {
      add(sectionProduct, 'Должен быть указан хотя бы один адрес изготовителя продукции')
    } else if (mfr) {
      const addrs = getAddresses(mfr)
      for (const addr of addrs) {
        if (empty(addr?.country)) {
          add(sectionProduct, 'Для каждого адреса изготовителя продукции должна быть указана страна')
        }
      }
      let noCityOrSettlement = false
      for (const addr of addrs) {
        const hasCity = !empty(addr?.cityName)
        const hasSettlement = !empty(addr?.settlementName)
        if (!hasCity && !hasSettlement) {
          noCityOrSettlement = true
          break
        }
      }
      if (noCityOrSettlement) {
        add(sectionProduct, 'В составе каждого адреса изготовителя продукции должен быть указан или город, или населенный пункт')
      }
    }
    if (mfr?.subjectIdentifier != null && String(mfr.subjectIdentifier).trim() !== '' && empty(mfr?.identificationMethod)) {
      add(sectionProduct, 'Если по изготовителю продукции указан идентификатор хозяйствующего субъекта, то метод идентификации должен быть указан обязательно')
    }
  }
  if (sectionProduct.remarks.length) sections.push(sectionProduct)

  // —— ТСД (по партиям) —— smcdo:NonCompliantSanitaryProductBatchDetails в составе DangerousProductAlertDetails
  const batches = data.tsd?.batches ?? []
  if (batches.length === 0) {
    add(
      sectionTsd,
      'В составе сведений об обнаружении опасной продукции должны быть указаны хотя бы одни сведения о серии или партии продукции'
    )
  }
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const docs = batch?.shippingDocuments ?? []
    if (docs.length === 0) {
      add(
        sectionTsd,
        'В каждом составе сведений о серии или партии продукции должен быть указан хотя бы один товаросопроводительный документ'
      )
      continue
    }
    for (const d of docs) {
      if (empty(d?.docName)) {
        add(sectionTsd, 'Для каждого товаросопроводительного документа должно быть указано его Наименование')
      }
    }
    for (const d of docs) {
      if (empty(d?.docId)) {
        add(sectionTsd, 'Для каждого товаросопроводительного документа должен быть указан его номер')
      }
    }
    for (const d of docs) {
      if (empty(d?.docCreationDate)) {
        add(sectionTsd, 'Для каждого товаросопроводительного документа должна быть указана его дата')
      }
    }
    for (let di = 0; di < docs.length; di++) {
      const d = docs[di]
      ;(d.products ?? []).forEach((p, pi) => {
        if (shippingProductDetailsHasContentAsideFromName(p) && empty(p?.productName)) {
          add(
            sectionTsd,
            `Партия ${i + 1}, товаросопроводительный документ ${di + 1}, продукт ${pi + 1}: по схеме XSD в сведениях о продукции обязательно наименование продукции — укажите наименование в детализации документа.`
          )
        }
      })
    }
  }

  /** Участники цепи поставки в ТСД (ShippingDocumentDetails → SupplyChainPartyDetails): контроли как для изготовителя на вкладке «Продукция». */
  let tsdSupplyChainPartyMissingCountry = false
  let tsdSupplyChainPartyMissingBusinessName = false
  let tsdSupplyChainPartyMissingAddress = false
  let tsdSupplyChainAddressMissingCountry = false
  let tsdSupplyChainAddressMissingCityOrSettlement = false
  let tsdSupplyChainPartyIdWithoutIdentificationMethod = false

  for (const batch of batches) {
    for (const doc of batch?.shippingDocuments ?? []) {
      for (const party of doc.supplyChainParties ?? []) {
        if (empty(party.country)) tsdSupplyChainPartyMissingCountry = true
        if (empty(party.businessEntityName)) tsdSupplyChainPartyMissingBusinessName = true

        const addrList = getAddressListFromParty(party)
        if (addrList.length === 0) {
          tsdSupplyChainPartyMissingAddress = true
        } else {
          for (const addr of addrList) {
            if (empty(addr.country)) tsdSupplyChainAddressMissingCountry = true
            if (empty(addr.cityName) && empty(addr.settlementName)) {
              tsdSupplyChainAddressMissingCityOrSettlement = true
            }
          }
        }

        if (
          party.subjectIdentifier != null &&
          String(party.subjectIdentifier).trim() !== '' &&
          empty(party.identificationMethod)
        ) {
          tsdSupplyChainPartyIdWithoutIdentificationMethod = true
        }
      }
    }
  }

  const hasAnyTsdSupplyChainParty = batches.some((b) =>
    (b.shippingDocuments ?? []).some((d) => (d.supplyChainParties ?? []).length > 0)
  )
  if (hasAnyTsdSupplyChainParty) {
    if (tsdSupplyChainPartyMissingCountry) {
      add(
        sectionTsd,
        'Код страны регистрации изготовителя продукции в составе данных по ТСД должен быть указан'
      )
    }
    if (tsdSupplyChainPartyMissingBusinessName) {
      add(
        sectionTsd,
        'Наименование изготовителя продукции в составе данных по ТСД должен быть указан'
      )
    }
    if (tsdSupplyChainPartyMissingAddress) {
      add(
        sectionTsd,
        'Должен быть указан хотя бы один адрес изготовителя продукции в составе данных по ТСД'
      )
    }
  }

  const hasAnyTsdSupplyChainAddress = batches.some((b) =>
    (b.shippingDocuments ?? []).some((d) =>
      (d.supplyChainParties ?? []).some((p) => getAddressListFromParty(p).length > 0)
    )
  )
  if (hasAnyTsdSupplyChainAddress) {
    if (tsdSupplyChainAddressMissingCountry) {
      add(
        sectionTsd,
        'Для каждого адреса изготовителя продукции в составе данных по ТСД должна быть указана страна'
      )
    }
    if (tsdSupplyChainAddressMissingCityOrSettlement) {
      add(
        sectionTsd,
        'Для каждого адреса изготовителя продукции в составе данных по ТСД должен быть указан или город, или населенный пункт'
      )
    }
  }

  if (hasAnyTsdSupplyChainParty && tsdSupplyChainPartyIdWithoutIdentificationMethod) {
    add(
      sectionTsd,
      'Если по изготовителю продукции в составе данных по ТСД указан идентификатор хозяйствующего субъекта, то метод идентификации должен быть указан обязательно'
    )
  }

  if (sectionTsd.remarks.length) sections.push(sectionTsd)

  // —— Документы соответствия (по XSD только в tsd.batches[]) ——
  const complianceList = mergeComplianceDocumentsFromBatches(data.tsd)?.documents ?? []
  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi]
    const batchCompliance = batch?.complianceDocuments ?? []
    if (batchCompliance.length === 0) {
      add(
        sectionCompliance,
        'В каждом составе сведений о серии или партии продукции должен быть указан хотя бы один документ об оценке соответствия продукции'
      )
    }
  }
  for (const doc of complianceList) {
    if (empty(doc?.docKindCode)) {
      add(sectionCompliance, 'Для каждого документа об оценке соответствия продукции должен быть указан код вида документа')
    }
  }
  for (const doc of complianceList) {
    if (empty(doc?.docName)) {
      add(sectionCompliance, 'Для каждого документа об оценке соответствия продукции должно быть указано его наименование')
    }
  }
  for (const doc of complianceList) {
    if (empty(doc?.docId)) {
      add(sectionCompliance, 'Для каждого документа об оценке соответствия продукции должен быть указан его номер')
    }
  }
  for (const doc of complianceList) {
    if (empty(doc?.docCreationDate)) {
      add(sectionCompliance, 'Для каждого документа об оценке соответствия продукции должна быть указана его дата')
    }
  }
  for (const doc of complianceList) {
    if (empty(doc?.authority?.country)) {
      add(sectionCompliance, 'Для каждого документа об оценке соответствия продукции должна быть указана страна уполномоченного органа')
    }
  }
  for (const doc of complianceList) {
    if (empty(doc?.authority?.authorityName)) {
      add(sectionCompliance, 'Для каждого документа об оценке соответствия продукции должно быть указано наименование уполномоченного органа')
    }
  }
  if (sectionCompliance.remarks.length) sections.push(sectionCompliance)

  // —— Нарушения (по XSD только в tsd.batches[]) ——
  if (batches.length > 0) {
    const allViolations: ViolationsData[] = batches.flatMap((b) => normalizeBatchViolations(b))
    for (const batch of batches) {
      const batchViol = normalizeBatchViolations(batch)
      if (batchViol.length === 0) {
        add(sectionViolations, 'В каждом составе сведений о серии или партии продукции должно быть указано хотя бы одно нарушение')
      }
      for (const v of batchViol) {
        if ((v?.violatedRequirements?.length ?? 0) === 0) {
          add(sectionViolations, 'В каждом составе сведений о нарушении должны быть указаны сведения хотя бы об одном нарушенном требовании')
        }
      }
    }
    const reqs = allViolations.flatMap((v) => v?.violatedRequirements ?? [])
    for (const r of reqs) {
      if (empty(r?.technicalRegulationId)) {
        add(sectionViolations, 'В каждом составе сведении о нарушенных требованиях должен быть указан номер техрегламента')
      }
      // Наименование обязательно только при выборе из справочника (оба поля подставляются вместе). Вручную — достаточно номера.
      const fromTechRegulDict = (r?.techRegulDictionaryCode ?? '').trim() !== ''
      if (fromTechRegulDict && !empty(r?.technicalRegulationId) && empty(r?.technicalRegulationName)) {
        add(sectionViolations, 'При выборе техрегламента из справочника должно быть указано наименование (подставьте запись заново при пустом наименовании)')
      }
    }
    const inds = allViolations.flatMap((v) => v?.violatedIndicators ?? [])
    for (const ind of inds) {
      if (ind?.isNormative === undefined || ind?.isNormative === null) {
        add(sectionViolations, 'В каждом составе сведении о нарушенных показателях должен быть указан признак нормативного показателя')
      }
      if (empty(ind?.indicatorName)) {
        add(sectionViolations, 'В каждом составе сведении о нарушенных показателях должно быть указано наименование показателя')
      }
      if (empty(ind?.indicatorValue)) {
        add(sectionViolations, 'В каждом составе сведении о нарушенных показателях должно быть указано значение показателя')
      }
    }
  }
  if (sectionViolations.remarks.length) sections.push(sectionViolations)

  // —— Место обнаружения ——
  const place = data.detectionPlace
  if (!place) {
    add(sectionDetectionPlace, 'Раздел «Место обнаружения» не заполнен. Необходимо указать сведения о месте обнаружения продукции.')
  } else {
    const hasOrg = !!place.organization
    const hasCheckpoint = !!place.borderCheckpoint
    const hasAddr = !!place.address
    const hasGeo = !!place.geoCoordinates
    if (!hasOrg && !hasCheckpoint && !hasAddr && !hasGeo) {
      add(sectionDetectionPlace, 'В составе сведений о месте обнаружения должен быть указан хотя бы один из следующих реквизитов: "Организация", "Пункт пропуска", "Адрес" или "Географические координаты"')
    }
    const org = place.organization
    if (org) {
      if (empty(org.country)) {
        add(sectionDetectionPlace, 'В составе сведений о месте обнаружения - организация должна быть указана ее страна регистрации')
      }
      if (empty(org.businessEntityName)) {
        add(sectionDetectionPlace, 'В составе сведений о месте обнаружения - организация должно быть указано ее наименование')
      }
      const orgAddresses = org.addresses ?? []
      if (!hasAtLeastOneAddressFromArray(orgAddresses)) {
        add(sectionDetectionPlace, 'В составе сведений о месте обнаружения - организация должен быть указан хотя бы один адрес организации')
      } else {
        for (const addr of orgAddresses) {
          if (empty(addr?.country)) {
            add(sectionDetectionPlace, 'Для каждого адреса организации-места обнаружения должна быть указана страна')
          }
        }
        let noCityOrSettlement = false
        for (const addr of orgAddresses) {
          if (!empty(addr?.cityName) || !empty(addr?.settlementName)) continue
          noCityOrSettlement = true
          break
        }
        if (noCityOrSettlement) {
          add(sectionDetectionPlace, 'В составе каждого адреса организации-места обнаружения должен быть указан или город, или населенный пункт')
        }
      }
      if (org.businessEntityId != null && String(org.businessEntityId).trim() !== '' && empty(org.identificationMethod)) {
        add(sectionDetectionPlace, 'Если для организации, указанной в качестве места обнаружения определен идентификатор хозяйствующего субъекта, то также должен быть указан метод идентификации')
      }
    }
    const addr = place.address
    if (addr) {
      if (empty(addr.country)) {
        add(sectionDetectionPlace, 'Если в качестве места обнаружения указан адрес, то в его составе должна быть указана страна')
      }
      if (empty(addr.cityName) && empty(addr.settlementName)) {
        add(sectionDetectionPlace, 'Если в качестве места обнаружения указан адрес, то в его составе должен быть указан или город, или населенный пункт')
      }
    }
    const cp = place.borderCheckpoint
    if (cp) {
      const hasCheckpointCode = !empty(cp.checkpointCode)
      const hasCheckpointName = !empty(cp.checkpointName)
      if (hasCheckpointCode !== hasCheckpointName) {
        add(sectionDetectionPlace, 'В блоке «Пункт пропуска» должны быть указаны оба атрибута: код вида пункта пропуска и наименование пункта пропуска (или оба пусты).')
      }
    }
    const geoList = place.geoCoordinates ?? []
    for (let i = 0; i < geoList.length; i++) {
      const c = geoList[i]
      const hasLon = !empty(c?.longitude)
      const hasLat = !empty(c?.latitude)
      if (!hasLon && !hasLat) {
        add(sectionDetectionPlace, `В блоке «Географические координаты» запись ${i + 1}: заполните обе координаты (широту и долготу). Пустые записи сохранять нельзя.`)
      } else if (hasLon !== hasLat) {
        add(sectionDetectionPlace, `В блоке «Географические координаты» для записи ${i + 1} укажите и широту, и долготу.`)
      }
    }
  }
  if (sectionDetectionPlace.remarks.length) sections.push(sectionDetectionPlace)

  // —— Принятые меры ——
  const measuresList = data.measures?.measures ?? []
  for (const m of measuresList) {
    if (empty(m?.startDate)) {
      add(sectionMeasures, 'В составе каждого набора сведений о принятой мере должна быть указана Начальная дата')
    }
    const basisList = m?.measureInitiationBasisDetails
    if (basisList && basisList.length > 0) {
      const anyBasisIncomplete = basisList.some(
        (basis) =>
          empty(basis?.docKindName) ||
          empty(basis?.docName) ||
          empty(basis?.docId) ||
          empty(basis?.docCreationDate)
      )
      if (anyBasisIncomplete) {
        add(
          sectionMeasures,
          'В составе каждого набора основания для введения меры должны быть указаны Наименование вида документа, Наименование документа, Номер документа, Дата документа'
        )
      }
    }
  }
  for (const m of measuresList) {
    if (empty(m?.measureCode) && empty(m?.measureName)) {
      add(sectionMeasures, 'В составе каждого набора сведений о принятой мере должен быть указан или Код принятой меры, или ее Наименование')
    }
  }
  for (const m of measuresList) {
    if (!m?.measureDocDetails) {
      add(sectionMeasures, 'В составе каждого набора сведений о принятой мере должен быть указан хотя один документ, регламентирующий введение (отмену) меры')
    }
  }
  for (const m of measuresList) {
    const docDetails = m?.measureDocDetails
    if (docDetails) {
      if (empty(docDetails.country)) {
        add(sectionMeasures, 'Для документа, регламентирующего введение (отмену) меры должна быть указана страна')
      }
      if (empty(docDetails.docName)) {
        add(sectionMeasures, 'Для документа, регламентирующего введение (отмену) меры должно быть указано его наименование')
      }
      if (empty(docDetails.docId)) {
        add(sectionMeasures, 'Для документа, регламентирующего введение (отмену) меры должен быть указано его номер')
      }
      if (empty(docDetails.docCreationDate)) {
        add(sectionMeasures, 'Для документа, регламентирующего введение (отмену) меры должна быть указано его дата')
      }
    }
  }
  for (const m of measuresList) {
    if (empty(m?.measureAffectedObjectKindCode)) {
      add(sectionMeasures, 'В составе каждого набора сведений о принятой мере должен быть указан хотя один вид объекта действия меры')
    }
  }
  const implList = measuresList.flatMap((m) => m?.measureImplementationDetails ?? [])
  const getAuthorities = (impl: MeasureImplementationItem) =>
    (impl.authorities && impl.authorities.length > 0 ? impl.authorities : (impl.authority ? [impl.authority] : []))
  const getSubjects = (impl: MeasureImplementationItem) =>
    (impl.subjectDetailsList && impl.subjectDetailsList.length > 0 ? impl.subjectDetailsList : (impl.subjectDetails ? [impl.subjectDetails] : []))
  for (const impl of implList) {
    const hasEntity = getAuthorities(impl).length > 0 || getSubjects(impl).length > 0
    const hasDoc = !!impl?.documentDetails
    if (!hasEntity || !hasDoc) {
      add(sectionMeasures, 'В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должны быть указаны сведения об исполнителе и документ, устанавливающий мероприятие')
    }
  }
  for (const impl of implList) {
    const hasAuthority = getAuthorities(impl).length > 0
    const hasSubject = getSubjects(impl).length > 0
    if (!hasAuthority && !hasSubject) {
      add(sectionMeasures, 'В составе каждого набора сведений об исполнителе мероприятия, обеспечивающего соблюдение меры, должен быть указан один из следующих реквизитов: "Уполномоченный орган", "Субъект"')
    }
  }
  for (const impl of implList) {
    for (const authority of getAuthorities(impl)) {
      if (empty(authority.country)) {
        add(sectionMeasures, 'Страна уполномоченного органа, обеспечивающего соблюдение меры должна быть указана')
      }
      if (empty(authority.authorityName)) {
        add(sectionMeasures, 'Наименование уполномоченного органа, обеспечивающего соблюдение меры должно быть указано')
      }
    }
  }
  for (const impl of implList) {
    for (const subj of getSubjects(impl)) {
      const identityDoc = subj?.identityDoc ?? (subj as { identityDoc?: { docId?: string } })?.identityDoc
      if (identityDoc && empty(identityDoc?.docId)) {
        add(sectionMeasures, 'В составе сведений об удостоверении личности субъекта, обеспечивающего соблюдение меры должен быть указан номер документа')
      }
    }
  }
  for (const impl of implList) {
    for (const subj of getSubjects(impl)) {
      if (!subj) continue
      const subjAddrs = getAddresses(subj)
      if (subjAddrs.length === 0) continue
      for (const addr of subjAddrs) {
        if (empty(addr?.country)) {
          add(sectionMeasures, 'Для каждого адреса субъекта-исполнителя мероприятия должна быть указана страна')
        }
      }
      let noCityOrSettlement = false
      for (const addr of subjAddrs) {
        if (!empty(addr?.cityName) || !empty(addr?.settlementName)) continue
        noCityOrSettlement = true
        break
      }
      if (noCityOrSettlement) {
        add(sectionMeasures, 'В составе каждого адреса субъекта-исполнителя мероприятия должен быть указан или город, или населенный пункт')
      }
    }
  }
  for (const impl of implList) {
    const docRef = impl?.documentDetails
    if (docRef) {
      if (empty(docRef?.docName)) {
        add(sectionMeasures, 'В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должно быть указано его наименование')
      }
      if (empty(docRef?.docId)) {
        add(sectionMeasures, 'В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должен быть указан его номер')
      }
      if (empty(docRef?.docCreationDate)) {
        add(sectionMeasures, 'В составе сведений о документе, устанавливающем мероприятие, обеспечивающее соблюдение меры должна быть указана его дата')
      }
    }
  }
  if (sectionMeasures.remarks.length) sections.push(sectionMeasures)

  const totalRemarks = sections.reduce((sum, s) => sum + s.remarks.length, 0)
  return {
    success: totalRemarks === 0,
    sections: sections.filter((s) => s.remarks.length > 0),
  }
}

/** Результат проверки данных на соответствие форматам XSD (длина, шаблоны). */
export interface FormatValidationErrors {
  errors: string[]
}

const ADDRESS_FIELD_KEYS: (keyof AddressDetails)[] = [
  'territoryCode', 'postCode', 'postOfficeBoxId', 'regionName', 'districtName',
  'cityName', 'settlementName', 'streetName', 'buildingNumberId', 'roomNumberId',
]

/** Русские наименования полей для сообщений об ошибках (без англоязычных имён атрибутов). */
const FIELD_LABEL: Record<string, string> = {
  territoryCode: 'Код территории',
  postCode: 'Почтовый индекс',
  postOfficeBoxId: 'Номер абонентского ящика',
  regionName: 'Регион',
  districtName: 'Район',
  cityName: 'Населённый пункт (город)',
  settlementName: 'Населённый пункт',
  streetName: 'Улица',
  buildingNumberId: 'Номер здания',
  roomNumberId: 'Номер помещения',
}

function getFieldLabel(fieldKey: string): string {
  return FIELD_LABEL[fieldKey] ?? fieldKey
}

function pushFormatError(errors: string[], path: string, fieldKey: string, value: string | undefined): void {
  const msg = validateFieldValue(fieldKey, value ?? '')
  if (!msg) return
  // Не дублировать название поля: если путь уже заканчивается им (например «→ Почтовый индекс»), убрать его из начала сообщения
  const lastSegment = path.split(' → ').pop()?.trim() ?? ''
  const prefix = lastSegment ? `${lastSegment}: ` : ''
  const displayMsg = prefix && msg.startsWith(prefix) ? msg.slice(prefix.length) : msg
  errors.push(path ? `${path}: ${displayMsg}` : displayMsg)
}

/** Убирает повторы одной и той же строки (один и тот же путь и текст — без двойного показа в модалке). */
function dedupeFormatErrorsPreservingOrder(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

function addressHasContent(addr: AddressDetails): boolean {
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(s(addr.country) || s(addr.territoryCode) || s(addr.regionName) || s(addr.districtName) || s(addr.cityName) || s(addr.settlementName) || s(addr.streetName) || s(addr.buildingNumberId) || s(addr.roomNumberId) || s(addr.postOfficeBoxId) || s(addr.postCode) || s(addr.fullAddress))
}

function checkAddress(
  errors: string[],
  path: string,
  addr: AddressDetails | undefined,
  options?: { requireCountryAndCitySettlement?: boolean }
): void {
  if (!addr) return
  const requireCountryAndCitySettlement = options?.requireCountryAndCitySettlement ?? true
  if (addressHasContent(addr)) {
    if (requireCountryAndCitySettlement && !(addr.country ?? '').trim()) {
      errors.push(`${path}: при заполнении адреса обязательно укажите Страну.`)
    }
    const hasCity = (addr.cityName ?? '').trim() !== ''
    const hasSettlement = (addr.settlementName ?? '').trim() !== ''
    if (hasCity && hasSettlement) {
      errors.push(`${path}: укажите только один атрибут — Город или Населенный пункт.`)
    } else if (requireCountryAndCitySettlement && !hasCity && !hasSettlement) {
      errors.push(`${path}: при заполнении адреса обязательно укажите Город или Населенный пункт.`)
    }
  }
  for (const key of ADDRESS_FIELD_KEYS) {
    const v = addr[key]
    if (v !== undefined && v !== '') pushFormatError(errors, `${path} → ${getFieldLabel(key)}`, key, v)
  }
}

function checkAddressList(
  errors: string[],
  path: string,
  list: AddressDetails[] | undefined,
  options?: { requireCountryAndCitySettlement?: boolean }
): void {
  if (!list?.length) return
  list.forEach((addr, i) => checkAddress(errors, `${path} (адрес ${i + 1})`, addr, options))
}

function checkParty(
  errors: string[],
  path: string,
  party: SupplyChainPartyDetails | undefined,
  options?: { requireAddressCountryAndCitySettlement?: boolean }
): void {
  if (!party) return
  if (
    party.businessEntityTypeCodeListId === '2049' &&
    (party.businessEntityTypeCode ?? '').trim() &&
    (party.organizationalForm ?? '').trim()
  ) {
    errors.push(
      `${path}: нельзя одновременно задавать код ОПФ из справочника (codeListId=2049) и произвольный текст организационно-правовой формы — оставьте один вариант`
    )
  }
  pushFormatError(errors, `${path} → Наименование`, 'businessEntityName', party.businessEntityName)
  pushFormatError(errors, `${path} → Краткое наименование`, 'shortName', party.shortName)
  if (!(party.businessEntityTypeCodeListId === '2049' && (party.businessEntityTypeCode ?? '').trim())) {
    pushFormatError(errors, `${path} → ОПФ`, 'organizationalForm', party.organizationalForm)
  }
  pushFormatError(errors, `${path} → Идентификатор`, 'subjectIdentifier', party.subjectIdentifier)
  pushFormatError(errors, `${path} → ИНН`, 'taxpayerId', party.taxpayerId)
  pushFormatError(errors, `${path} → Таможенный номер`, 'customsNumber', party.customsNumber)
  pushFormatError(errors, `${path} → Код причины постановки на учёт`, 'taxRegistrationReasonCode', party.taxRegistrationReasonCode)
  const addressOptions = { requireCountryAndCitySettlement: options?.requireAddressCountryAndCitySettlement ?? true }
  const addrList = party.addresses ?? []
  if (addrList.length) checkAddressList(errors, `${path} → Адрес`, addrList, addressOptions)
  else {
    checkAddress(errors, `${path} → Регистрационный адрес`, party.registrationAddress, addressOptions)
    checkAddress(errors, `${path} → Фактический адрес`, party.actualAddress, addressOptions)
    checkAddress(errors, `${path} → Почтовый адрес`, party.mailingAddress, addressOptions)
  }
  party.contacts?.forEach((c, i) => {
    pushFormatError(errors, `${path} → Контакт ${i + 1}`, 'communicationChannelId', c.communicationChannelId)
    pushFormatError(errors, `${path} → Контакт ${i + 1} (наименование)`, 'communicationChannelName', c.communicationChannelName)
  })
}

function checkTechnicalDocs(errors: string[], path: string, docs: TechnicalDocument[] | undefined): void {
  if (!docs?.length) return
  docs.forEach((d, i) => {
    pushFormatError(errors, `${path} → Документ ${i + 1} → Наименование`, 'docName500', d.docName)
    pushFormatError(errors, `${path} → Документ ${i + 1} → Номер`, 'docId', d.docId)
  })
}

/** Одно место / зона (Место обнаружения PHA или smcdo:SpreadingZoneDetails) — форматы полей по XSD. */
function pushDetectionPlaceFormatErrors(errors: string[], pathLabel: string, place: DetectionPlaceData | undefined): void {
  if (!place) return
  pushFormatError(errors, `${pathLabel} → Описание`, 'descriptionPlace', place.description)
  if (place.organization) {
    checkParty(errors, `${pathLabel} → Организация`, place.organization as unknown as SupplyChainPartyDetails)
  }
  if (place.borderCheckpoint) {
    const hasCheckpointCode = (place.borderCheckpoint.checkpointCode ?? '').trim() !== ''
    const hasCheckpointName = (place.borderCheckpoint.checkpointName ?? '').trim() !== ''
    if (hasCheckpointCode !== hasCheckpointName) {
      errors.push(
        `${pathLabel} → Пункт пропуска: укажите оба атрибута (код вида пункта пропуска и наименование пункта пропуска) или оставьте оба пустыми.`
      )
    }
    pushFormatError(errors, `${pathLabel} → Пункт пропуска → Код`, 'checkpointCode', place.borderCheckpoint.checkpointCode)
    pushFormatError(errors, `${pathLabel} → Пункт пропуска → Наименование`, 'checkpointName', place.borderCheckpoint.checkpointName)
  }
  if (place.address) checkAddress(errors, `${pathLabel} → Адрес`, place.address)
  ;(place.geoCoordinates ?? []).forEach((g, i) => {
    const hasLon = (g?.longitude ?? '').trim() !== ''
    const hasLat = (g?.latitude ?? '').trim() !== ''
    if (!hasLon && !hasLat) {
      errors.push(
        `${pathLabel} → Географические координаты → Запись ${i + 1}: заполните обе координаты (широту и долготу). Пустые записи сохранять нельзя.`
      )
    } else if (hasLon !== hasLat) {
      errors.push(
        `${pathLabel} → Географические координаты → Запись ${i + 1}: укажите обе координаты (широту и долготу).`
      )
    }
    const v = g.longitude ?? g.latitude ?? ''
    pushFormatError(errors, `${pathLabel} → Координата ${i + 1}`, 'geoCoordinate', v)
  })
}

function phaSpreadingZonesList(data: CardData): DetectionPlaceData[] {
  if (data.spreadingZones && data.spreadingZones.length > 0) return data.spreadingZones
  if (data.spreadingZone) return [data.spreadingZone]
  return []
}

/**
 * Собирает все несоответствия данных формату (длина, шаблоны) по полям с валидацией XSD.
 * Используется перед сохранением: если список не пуст, сохранение блокируется.
 */
export function collectFormatValidationErrors(data: CardData): FormatValidationErrors {
  const errors: string[] = []

  const product: ProductData | undefined = data.product
  if (product) {
    pushFormatError(
      errors,
      'Продукция → Наименование вида продукции',
      'sanitaryProductTypeName',
      product.typeName
    )
  }
  if (product?.productDetails) {
    const pd = product.productDetails
    const base = 'Продукция'
    pushFormatError(errors, `${base} → Идентификатор продукции`, 'productId', pd.productId)
    pushFormatError(errors, `${base} → Наименование`, 'productName', pd.productName)
    pushFormatError(errors, `${base} → Торговое наименование`, 'tradeName', pd.tradeName)
    ;(pd.tradeNames ?? []).forEach((t, i) => pushFormatError(errors, `${base} → Торговое наименование ${i + 1}`, 'tradeName', t))
    pushFormatError(errors, `${base} → Описание`, 'description', pd.description)
    pushFormatError(errors, `${base} → Код ТН ВЭД`, 'commodityCode', pd.commodityCode)
    pushFormatError(errors, `${base} → Назначение`, 'productPurpose', pd.productPurpose)
    pushFormatError(errors, `${base} → Способ применения`, 'applicationMethod', pd.applicationMethod)
    pushFormatError(errors, `${base} → Форма выпуска`, 'releaseForm', pd.releaseForm)
    pushFormatError(errors, `${base} → Условия хранения`, 'storageCondition', pd.storageCondition)
    pushFormatError(errors, `${base} → Информация на этикетке`, 'labelText', pd.labelText)
    checkTechnicalDocs(errors, `${base} → Техническая документация`, pd.technicalDocs)
  }
  if (product?.manufacturer) {
    checkParty(errors, 'Продукция → Изготовитель', product.manufacturer)
  }

  const tsd: TSDData | undefined = data.tsd
  /** Код ТН ВЭД с вкладки «Продукция»: те же значения во вложенных продуктах ТСД не считаем второй раз (избегаем дубля в отчёте). */
  const mainCommodityTrimmed = (data.product?.productDetails?.commodityCode ?? '').trim()
  if (tsd?.batches?.length) {
    tsd.batches.forEach((batch, bi) => {
      const batchPath = `ТСД → Партия ${bi + 1}`
      pushFormatError(errors, `${batchPath} → Номер серии`, 'batchId', batch.batchId)
      pushFormatError(errors, `${batchPath} → Примечание`, 'note', batch.note)
      pushFormatError(errors, `${batchPath} → Номер товарной партии`, 'consignmentId', batch.consignmentId)
      pushFormatError(errors, `${batchPath} → Количество товара (значение)`, 'measureValue', batch.commodityMeasure?.value)
      if ((batch.commodityMeasure?.value ?? '').trim() && !(batch.commodityMeasure?.unitCode ?? '').trim()) {
        errors.push(`${batchPath}: при указании «Количество товара» необходимо указать «Единица измерения»`)
      }
      pushFormatError(errors, `${batchPath} → Количество товара в партии (значение)`, 'measureValue', batch.batchCommodityMeasure?.value)
      if ((batch.batchCommodityMeasure?.value ?? '').trim() && !(batch.batchCommodityMeasure?.unitCode ?? '').trim()) {
        errors.push(`${batchPath}: при указании «Количество товара в партии» необходимо указать «Единица измерения»`)
      }
      ;(batch.complianceDocuments ?? []).forEach((d, i) => {
        pushFormatError(errors, `${batchPath} → Документ соответствия ${i + 1} → Наименование`, 'docName', d.docName)
        pushFormatError(errors, `${batchPath} → Документ соответствия ${i + 1} → Номер`, 'docId', d.docId)
      })
      ;(batch.shippingDocuments ?? []).forEach((doc, di) => {
        const docPath = `${batchPath} → Товаросопроводительный документ ${di + 1}`
        pushFormatError(errors, `${docPath} → Наименование`, 'docName500', doc.docName)
        pushFormatError(errors, `${docPath} → Номер`, 'docId', doc.docId)
        ;(doc.products ?? []).forEach((p, pi) => {
          const pCc = (p.commodityCode ?? '').trim()
          const sameAsMainProductTab =
            mainCommodityTrimmed !== '' && pCc === mainCommodityTrimmed
          if (!sameAsMainProductTab) {
            pushFormatError(
              errors,
              `${docPath} → Продукт ${pi + 1}`,
              'commodityCode',
              p.commodityCode
            )
          }
          checkTechnicalDocs(errors, `${docPath} → Продукт ${pi + 1} → Техническая документация`, p.technicalDocs)
        })
        ;(doc.supplyChainParties ?? []).forEach((party, pi) => {
          checkParty(errors, `${docPath} → Участник цепи поставки ${pi + 1}`, party)
        })
      })
      ;(batch.violations ?? []).forEach((v, vi) => {
        const vPath = `${batchPath} → Нарушение ${vi + 1}`
        pushFormatError(errors, `${vPath} → Описание`, 'violationDescription', v.generalDescription)
        ;(v.violatedRequirements ?? []).forEach((r, ri) => {
          const idTrim = (r.technicalRegulationId ?? '').trim()
          const fromDict = (r.techRegulDictionaryCode ?? '').trim() !== ''
          if (idTrim && !fromDict) {
            const manualMsg = validateFieldValue('technicalRegulationManualRegNum', idTrim)
            if (manualMsg) {
              errors.push(`${vPath} → Требование ${ri + 1} → Номер техрегламента: ${manualMsg}`)
            }
          }
          pushFormatError(errors, `${vPath} → Требование ${ri + 1} → Номер техрегламента`, 'technicalRegulationId', r.technicalRegulationId)
          pushFormatError(
            errors,
            `${vPath} → Требование ${ri + 1} → Наименование техрегламента`,
            'violationTechnicalRegulationName',
            r.technicalRegulationName
          )
          pushFormatError(errors, `${vPath} → Требование ${ri + 1} → Регистрационный номер`, 'registrationNumber', r.registrationNumber)
          pushFormatError(errors, `${vPath} → Требование ${ri + 1} → Описание`, 'description', r.description)
          ;(r.structuralElements ?? []).forEach((se, si) => {
            pushFormatError(
              errors,
              `${vPath} → Требование ${ri + 1} → Структурный элемент ${si + 1} → Вид структурного документа`,
              'docStructuralElementName',
              se.elementName
            )
            pushFormatError(
              errors,
              `${vPath} → Требование ${ri + 1} → Структурный элемент ${si + 1} → Номер структурного элемента`,
              'docStructuralElementId',
              se.elementId
            )
          })
        })
        ;(v.violatedIndicators ?? []).forEach((ind, ii) => {
          pushFormatError(errors, `${vPath} → Показатель ${ii + 1} → Наименование`, 'indicatorName', ind.indicatorName)
          pushFormatError(errors, `${vPath} → Показатель ${ii + 1} → Значение`, 'indicatorValue', ind.indicatorValue)
          if ((ind.indicatorValue ?? '').trim() && !(ind.unitCode ?? '').trim()) {
            errors.push(`${vPath} → Показатель ${ii + 1}: при заполненном значении показателя обязательно указывать единицу измерения.`)
          }
          pushFormatError(errors, `${vPath} → Показатель ${ii + 1} → Примечание`, 'noteText', ind.note)
        })
      })
    })
  }

  pushDetectionPlaceFormatErrors(errors, 'Место обнаружения', data.detectionPlace)

  const measures: MeasuresData | undefined = data.measures
  if (measures?.measures?.length) {
    measures.measures.forEach((m, mi) => {
      const mPath = `Принятые меры → Мера ${mi + 1}`
      pushFormatError(errors, `${mPath} → Обоснование`, 'measureJustification', m.measureJustificationText)
      pushFormatError(errors, `${mPath} → Описание`, 'description', m.description)
      if (m.measureDocDetails) {
        pushFormatError(errors, `${mPath} → Документ меры → Наименование`, 'docName', m.measureDocDetails.docName)
        pushFormatError(errors, `${mPath} → Документ меры → Номер`, 'docId', m.measureDocDetails.docId)
      }
      ;(m.measureInitiationBasisDetails ?? []).forEach((b, i) => {
        pushFormatError(errors, `${mPath} → Основание ${i + 1} → Вид`, 'measureInitiationBasisDocKind', b.docKindName)
        pushFormatError(errors, `${mPath} → Основание ${i + 1} → Наименование`, 'measureInitiationBasisDocName', b.docName)
        pushFormatError(errors, `${mPath} → Основание ${i + 1} → Номер`, 'docId', b.docId)
      })
      ;(m.measureImplementationDetails ?? []).forEach((impl, i) => {
        const doc = impl.documentDetails
        if (doc) {
          pushFormatError(errors, `${mPath} → Реализация ${i + 1} → Наименование документа`, 'docName500', doc.docName)
          pushFormatError(errors, `${mPath} → Реализация ${i + 1} → Номер`, 'docId', doc.docId)
        }
      })
    })
  }

  pushPhaXsdFormatErrors(errors, data)

  return { errors: dedupeFormatErrorsPreservingOrder(errors) }
}

/** Карта PHA (R.SM.SS.08.001): дополнительные проверки типов smsdo/csdo по XSD (не путать с DPA R.SM.SS.08.002). */
function isPhaCardData(data: CardData): boolean {
  const code = (data.electronicDocument?.documentCode ?? '').trim()
  if (code === 'R.SM.SS.08.002') return false
  if (code === 'R.SM.SS.08.001') return true

  const kind = (data.notification?.type ?? '').trim()
  if (kind === '7' || kind === '8' || kind === '9') return false
  if (kind !== '' && /^[1-6]$/.test(kind)) return true

  return (
    data.phaDisease != null ||
    (data.phaPatientGroups?.length ?? 0) > 0 ||
    (data.phaCauseNotifications?.length ?? 0) > 0 ||
    data.phaFirstDiseaseInfectiousFlag != null ||
    (data.spreadingZones?.length ?? 0) > 0 ||
    data.spreadingZone != null
  )
}

function pushPhaXsdFormatErrors(errors: string[], data: CardData): void {
  if (!isPhaCardData(data)) return

  const notif = data.notification
  if (notif?.authorizedBody) {
    const auth = notif.authorizedBody
    pushFormatError(errors, 'Уведомление → Уполномоченный орган → Наименование', 'authorityName', auth.name)
    pushFormatError(errors, 'Уведомление → Уполномоченный орган → Краткое наименование', 'authorityBriefName', auth.shortName)
    pushFormatError(errors, 'Уведомление → Уполномоченный орган → Идентификатор', 'authorityId', auth.identifier)
  }
  if (notif?.registrationNumber !== undefined && notif.registrationNumber !== '') {
    pushFormatError(errors, 'Уведомление → Регистрационный номер', 'phaIncidentId', notif.registrationNumber)
  }

  ;(data.phaCauseNotifications ?? []).forEach((c, i) => {
    if ((c.registrationNumber ?? '').trim() !== '') {
      pushFormatError(
        errors,
        `Уведомление → Причинное уведомление ${i + 1} → Рег. номер`,
        'phaIncidentId',
        c.registrationNumber
      )
    }
  })

  const d = data.phaDisease
  if (d?.diseaseName != null && String(d.diseaseName).trim() !== '') {
    pushFormatError(errors, 'Болезнь → Наименование', 'phaDiseaseHealthProblemName', d.diseaseName)
  }

  ;(d?.pathogens ?? []).forEach((p, i) => {
    if ((p.pathogenKindName ?? '').trim() !== '') {
      pushFormatError(errors, `Болезнь → Возбудитель ${i + 1} → Тип`, 'pathogenKindName', p.pathogenKindName)
    }
    if ((p.pathogenName ?? '').trim() !== '') {
      pushFormatError(errors, `Болезнь → Возбудитель ${i + 1} → Наименование`, 'pathogenName', p.pathogenName)
    }
  })

  ;(data.phaPatientGroups ?? []).forEach((g, i) => {
    const pq = g.personQuantity != null && g.personQuantity !== '' ? String(g.personQuantity) : undefined
    if (pq !== undefined && pq.trim() !== '') {
      pushFormatError(errors, `Группа пациентов ${i + 1} → Количество человек`, 'personQuantity', pq)
    }
    if ((g.ageGroupCode ?? '').trim() !== '') {
      pushFormatError(errors, `Группа пациентов ${i + 1} → Возрастная группа`, 'ageGroupCode', g.ageGroupCode)
    }
    if ((g.diseaseOutcomeCode ?? '').trim() !== '') {
      pushFormatError(errors, `Группа пациентов ${i + 1} → Исход болезни`, 'diseaseOutcomeCode', g.diseaseOutcomeCode)
    }
  })

  ;(data.measures?.measures ?? []).forEach((m, i) => {
    if (m.measureName != null && String(m.measureName).trim() !== '' && (m.measureCode == null || m.measureCode === '')) {
      pushFormatError(errors, `Санитарные меры → Мера ${i + 1} → Наименование`, 'phaMeasureName', m.measureName)
    }
  })

  phaSpreadingZonesList(data).forEach((zone, i) => {
    pushDetectionPlaceFormatErrors(errors, `Зона распространения ${i + 1}`, zone)
  })
}

/**
 * Логические контроли и формат полей + проверка XML по XSD на сервере (кнопка «Валидация карты», направление сведений).
 */
export async function validateOutgoingCardWithSchema(data: CardData): Promise<ValidationResult> {
  const base = validateOutgoingCard(data)
  let xsdRemarks: string[] = []
  try {
    xsdRemarks = await fetchSchemaValidationErrors(exportCardDataToXML(data), 'dpa')
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    xsdRemarks = [`Не удалось выполнить проверку по XSD: ${msg}`]
  }
  const sections = [...base.sections]
  if (xsdRemarks.length > 0) {
    sections.push({ sectionName: 'Проверка по схеме XSD', remarks: xsdRemarks })
  }
  return {
    success: base.success && xsdRemarks.length === 0,
    sections,
  }
}
