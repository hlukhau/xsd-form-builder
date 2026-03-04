/**
 * Валидация карты исходящих сведений об опасной продукции.
 * Проверка по перечню контролей; результат — отчёт по разделам с замечаниями или успех.
 */
import type { CardData } from '@/types/card'
import { mergeComplianceDocumentsFromBatches, mergeViolationsFromBatches } from '@/utils/xmlParser'

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

  // —— ТСД (по партиям) ——
  const batches = data.tsd?.batches ?? []
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const docs = batch?.shippingDocuments ?? []
    if (docs.length === 0) {
      add(sectionTsd, 'В каждом составе сведений о серии или партии продукции должен быть указан хотя бы один товаросопроводительный документ')
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
  }
  if (sectionTsd.remarks.length) sections.push(sectionTsd)

  // —— Документы соответствия (по XSD только в tsd.batches[]) ——
  const complianceList = mergeComplianceDocumentsFromBatches(data.tsd)?.documents ?? []
  if (batches.length > 0 && complianceList.length === 0) {
    add(sectionCompliance, 'В каждом составе сведений о серии или партии продукции должен быть указан хотя бы один документ об оценке соответствия продукции')
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
  const violations = mergeViolationsFromBatches(data.tsd)
  if (batches.length > 0) {
    const reqs = violations?.violatedRequirements ?? []
    const inds = violations?.violatedIndicators ?? []
    if (reqs.length === 0) {
      add(sectionViolations, 'В каждом составе сведений о серии или партии продукции должно быть указано хотя бы одно нарушение')
    }
    const hasReqDetails = reqs.some((r) => !empty(r?.technicalRegulationId))
    if (reqs.length > 0 && !hasReqDetails) {
      add(sectionViolations, 'В каждом составе сведении о нарушенных требованиях должен быть указан номер техрегламента')
    }
    const hasNormative = inds.some((i) => i?.isNormative !== undefined && i?.isNormative !== null)
    if (inds.length > 0 && !hasNormative) {
      add(sectionViolations, 'В каждом составе сведении о нарушенных показателях должен быть указан признак нормативного показателя')
    }
    const hasIndicatorName = inds.some((i) => !empty(i?.indicatorName))
    if (inds.length > 0 && !hasIndicatorName) {
      add(sectionViolations, 'В каждом составе сведении о нарушенных показателях должно быть указано наименование показателя')
    }
    const hasIndicatorValue = inds.some((i) => !empty(i?.indicatorValue))
    if (inds.length > 0 && !hasIndicatorValue) {
      add(sectionViolations, 'В каждом составе сведении о нарушенных показателях должно быть указано значение показателя')
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
  }
  if (sectionDetectionPlace.remarks.length) sections.push(sectionDetectionPlace)

  // —— Принятые меры ——
  const measuresList = data.measures?.measures ?? []
  if (measuresList.length === 0) {
    add(sectionMeasures, 'Раздел «Принятые меры» не заполнен. Необходимо указать хотя бы одну принятую меру.')
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
  for (const impl of implList) {
    const hasEntity = !!(impl?.authority || impl?.subjectDetails)
    const hasDoc = !!impl?.documentDetails
    if (!hasEntity || !hasDoc) {
      add(sectionMeasures, 'В составе каждого набора сведений о мероприятии, обеспечивающем соблюдение меры должны быть указаны сведения об исполнителе и документ, устанавливающий мероприятие')
    }
  }
  for (const impl of implList) {
    const hasAuthority = !!impl?.authority
    const hasSubject = !!impl?.subjectDetails
    if (!hasAuthority && !hasSubject) {
      add(sectionMeasures, 'В составе каждого набора сведений об исполнителе мероприятия, обеспечивающего соблюдение меры, должен быть указан один из следующих реквизитов: "Уполномоченный орган", "Субъект"')
    }
  }
  for (const impl of implList) {
    if (impl?.authority) {
      if (empty(impl.authority.country)) {
        add(sectionMeasures, 'Страна уполномоченного органа, обеспечивающего соблюдение меры должна быть указана')
      }
      if (empty(impl.authority.authorityName)) {
        add(sectionMeasures, 'Наименование уполномоченного органа, обеспечивающего соблюдение меры должно быть указано')
      }
    }
  }
  for (const impl of implList) {
    const subj = impl?.subjectDetails
    const identityDoc = subj?.identityDoc ?? (subj as { identityDoc?: { docId?: string } })?.identityDoc
    if (identityDoc && empty(identityDoc?.docId)) {
      add(sectionMeasures, 'В составе сведений об удостоверении личности субъекта, обеспечивающего соблюдение меры должен быть указан номер документа')
    }
  }
  for (const impl of implList) {
    const subj = impl?.subjectDetails
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
