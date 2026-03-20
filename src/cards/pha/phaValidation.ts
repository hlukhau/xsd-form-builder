/**
 * Форматно-логический контроль карты PHA (исходящие), по аналогии с DPA.
 */
import type { CardData, DetectionPlaceData, SupplyChainPartyDetails } from '@/types/card'
import { collectFormatValidationErrors, type ValidationResult } from '@/utils/cardValidation'

export type { ValidationResult }

function empty(s: string | undefined | null): boolean {
  return s == null || String(s).trim() === ''
}

function hasAtLeastOneAddress(party: { registrationAddress?: unknown; actualAddress?: unknown; mailingAddress?: unknown }): boolean {
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

function checkDetectionPlaceSection(section: { sectionName: string; remarks: string[] }, place: DetectionPlaceData | undefined, label: string) {
  const add = (msg: string) => section.remarks.push(msg)
  if (!place) {
    add(`Раздел «${label}» не заполнен`)
    return
  }
  if (place.organization) {
    const org = place.organization as unknown as SupplyChainPartyDetails
    if (empty(org.country)) add(`${label} → организация: укажите страну`)
    if ((org.addresses?.length ?? 0) === 0 && !hasAtLeastOneAddress(org)) {
      add(`${label} → организация: укажите хотя бы один адрес`)
    } else {
      for (const a of getAddresses(org)) {
        if (empty(a.country) && (empty(a.cityName) || empty(a.settlementName))) {
          add(`${label} → организация: в адресе укажите страну и населённый пункт (или город)`)
        }
      }
    }
  }
  if (!empty(place.description)) {
    /* ok */
  }
}

/**
 * Контроль заполненности ключевых разделов исходящей карты PHA перед направлением/сохранением.
 */
export function validatePhaOutgoingCard(data: CardData): ValidationResult {
  const sections: { sectionName: string; remarks: string[] }[] = []
  const n = (name: string) => ({ sectionName: name, remarks: [] as string[] })
  const add = (s: { sectionName: string; remarks: string[] }, msg: string) => {
    s.remarks.push(msg)
  }

  const sectionNotification = n('Уведомление')
  const notif = data.notification
  const version = data.version ?? 1
  const incidentKind = notif?.type?.trim()

  if (empty(notif?.country)) {
    add(sectionNotification, 'Код страны уполномоченного органа должен быть указан')
  }
  if (empty(notif?.registrationNumber) && empty(data.registrationNumber)) {
    add(sectionNotification, 'Регистрационный номер должен быть указан')
  }
  if (empty(incidentKind)) {
    add(sectionNotification, 'Вид уведомления должен быть указан')
  } else {
    const infect = data.phaFirstDiseaseInfectiousFlag
    if (infect === 1) {
      if (!/^([1-3]|5)$/.test(incidentKind)) {
        add(sectionNotification, 'При инфекционной болезни допустимы коды вида уведомления 1–3 или 5')
      }
    } else if (infect === 0) {
      if (!/^([46])$/.test(incidentKind)) {
        add(sectionNotification, 'При неинфекционной болезни допустимы коды вида уведомления 4 или 6')
      }
    }
    if (version === 1 && incidentKind !== '7' && infect == null) {
      add(sectionNotification, 'Укажите признак инфекционной болезни для проверки вида уведомления')
    }
  }
  if (empty(notif?.formationDate)) {
    add(sectionNotification, 'Дата формирования уведомления должна быть указана')
  }
  const auth = notif?.authorizedBody
  if (empty(auth?.country)) {
    add(sectionNotification, 'Страна уполномоченного органа должна быть указана')
  }
  if (empty(auth?.name)) {
    add(sectionNotification, 'Наименование уполномоченного органа должно быть указано')
  }
  if (sectionNotification.remarks.length) sections.push(sectionNotification)

  const sectionDisease = n('Болезнь')
  const d = data.phaDisease
  if (!d || (empty(d.diseaseName) && empty(d.diseaseCode))) {
    add(sectionDisease, 'Укажите наименование или код болезни')
  }
  if (d && empty(d.firstCaseDate)) {
    add(sectionDisease, 'Дата первого случая должна быть указана')
  }
  if (sectionDisease.remarks.length) sections.push(sectionDisease)

  const sectionPatients = n('Группа пациентов')
  const groups = data.phaPatientGroups
  if (!groups?.length) {
    add(sectionPatients, 'Добавьте хотя бы одну группу пациентов')
  } else {
    groups.forEach((g, i) => {
      if (empty(g.personQuantity)) add(sectionPatients, `Группа ${i + 1}: укажите количество человек`)
      if (empty(g.ageGroupCode)) add(sectionPatients, `Группа ${i + 1}: укажите возрастную группу`)
      if (empty(g.diseaseOutcomeCode)) add(sectionPatients, `Группа ${i + 1}: укажите исход болезни`)
    })
  }
  if (sectionPatients.remarks.length) sections.push(sectionPatients)

  const sectionPlace = n('Место обнаружения')
  checkDetectionPlaceSection(sectionPlace, data.detectionPlace, 'Место обнаружения')
  if (sectionPlace.remarks.length) sections.push(sectionPlace)

  const sectionSpread = n('Зона распространения')
  checkDetectionPlaceSection(sectionSpread, data.spreadingZone, 'Зона распространения')
  if (sectionSpread.remarks.length) sections.push(sectionSpread)

  const sectionMeasures = n('Санитарные меры')
  const measures = data.measures?.measures
  if (!measures?.length) {
    add(sectionMeasures, 'Добавьте хотя бы одну санитарную меру')
  }
  if (sectionMeasures.remarks.length) sections.push(sectionMeasures)

  const success = sections.length === 0
  return { success, sections }
}

/** Ошибки формата полей (XSD) для PHA: общие правила + детектор места / мер из cardValidation. */
export function collectPhaFormatValidationErrors(data: CardData): string[] {
  return collectFormatValidationErrors(data).errors
}
