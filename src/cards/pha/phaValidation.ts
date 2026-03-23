/**
 * Логический контроль карты PHA (исходящие) по регламенту контролей.
 * Формат XSD — отдельно: collectPhaFormatValidationErrors / cardValidation.
 */
import type { CardData, DetectionPlaceData, AddressDetails, PhaCauseNotificationItem, PhaPathogenDetails } from '@/types/card'
import { validateFieldValue } from '@/constants/xsdFieldConstraints'
import { collectFormatValidationErrors, type ValidationResult } from '@/utils/cardValidation'

export type { ValidationResult }

function empty(s: string | undefined | null): boolean {
  return s == null || String(s).trim() === ''
}

const CAUSE_INCIDENT_KIND_CODES = new Set([
  '1',
  '2',
  '3',
  '4',
  '7',
  '8',
  '10',
  '11',
  '13',
  '14',
  '16',
  '17',
  '19',
])

function kindNumeric(kind: string | undefined): number | null {
  if (!kind || !String(kind).trim()) return null
  const n = parseInt(String(kind).trim(), 10)
  return Number.isFinite(n) ? n : null
}

function addressHasCityOrSettlement(a: AddressDetails): boolean {
  return !empty(a.cityName) || !empty(a.settlementName)
}

function objectAddressHasMinimum(a: AddressDetails | undefined): boolean {
  if (!a) return false
  return !empty(a.country) || addressHasCityOrSettlement(a) || !empty(a.fullAddress)
}

function hasPlaceAnyBlock(place: DetectionPlaceData | undefined): boolean {
  if (!place) return false
  const o = place.organization
  if (o && (o.country?.trim() || o.businessEntityName?.trim() || (o.addresses && o.addresses.length > 0) || o.businessEntityId?.trim()))
    return true
  const bc = place.borderCheckpoint
  if (bc && (bc.checkpointCode?.trim() || bc.checkpointName?.trim())) return true
  if (place.address && objectAddressHasMinimum(place.address)) return true
  if (place.geoCoordinates?.some((g) => (g.longitude ?? '').trim() || (g.latitude ?? '').trim())) return true
  return false
}

/**
 * Замечания по блоку места (обнаружение или зона распространения).
 */
function collectPlaceRemarks(place: DetectionPlaceData | undefined): string[] {
  const remarks: string[] = []
  const add = (msg: string) => remarks.push(msg)

  if (!hasPlaceAnyBlock(place)) {
    add(
      'Должен быть заполнен хотя бы один из  следующих реквизитов: Организация, Пункт пропуска, Адрес или Географические координаты'
    )
    return remarks
  }

  const o = place?.organization
  if (o) {
    const orgTouched =
      !empty(o.country) ||
      !empty(o.businessEntityName) ||
      (o.addresses && o.addresses.length > 0) ||
      !empty(o.businessEntityId)
    if (orgTouched) {
      if (empty(o.country) || empty(o.businessEntityName) || !(o.addresses && o.addresses.length > 0)) {
        add('Должны быть заполнены Страна, Наименование субъекта, Адрес')
      }
      if (!empty(o.businessEntityId) && empty(o.identificationMethod)) {
        add('Если указан идентификатор хозяйствующего субъекта, то метод идентификации должен быть указан обязательно')
      }
      for (const addr of o.addresses ?? []) {
        if (!empty(addr.country) || addressHasCityOrSettlement(addr) || !empty(addr.fullAddress)) {
          if (empty(addr.country)) add('В адресе должна быть указана страна')
          if (!addressHasCityOrSettlement(addr)) add('В адресе должен быть указан город или населенный пункт')
        }
      }
    }
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

function spreadingZoneTouched(place: DetectionPlaceData | undefined): boolean {
  if (!place) return false
  return !!(
    place.organization ||
    place.borderCheckpoint ||
    place.address ||
    (place.geoCoordinates && place.geoCoordinates.length > 0) ||
    place.description?.trim()
  )
}

/** Заполнен блок IncidentAlertIdDetails (хотя бы одно поле). */
function causeIncidentAlertFilled(c: PhaCauseNotificationItem): boolean {
  return (
    !empty(c.country) ||
    !empty(c.registrationNumber) ||
    !empty(c.type) ||
    !empty(c.formationDate)
  )
}

/** PathogenDetails считается заполненным, если указано имя или тип возбудителя. */
function pathogenDetailsTouched(p: PhaPathogenDetails): boolean {
  return !empty(p.pathogenName) || !empty(p.pathogenKindName)
}

export function validatePhaOutgoingCard(data: CardData): ValidationResult {
  const sections: { sectionName: string; remarks: string[] }[] = []
  const mk = (name: string) => ({ sectionName: name, remarks: [] as string[] })
  const add = (s: { sectionName: string; remarks: string[] }, msg: string) => {
    s.remarks.push(msg)
  }

  const notif = data.notification
  const version = data.version ?? 1
  const incidentKind = notif?.type?.trim() ?? ''
  const kn = kindNumeric(incidentKind)

  const sectionNotification = mk('Уведомление')

  if (empty(notif?.country) && empty(data.country)) {
    add(
      sectionNotification,
      'Код страны, уполномоченный орган которой направил уведомление должен быть указан'
    )
  }
  if (empty(notif?.registrationNumber) && empty(data.registrationNumber)) {
    add(sectionNotification, 'Регистрационный номер уведомления должен быть указан')
  }
  if (empty(incidentKind)) {
    add(sectionNotification, 'Вид уведомления должен быть указан')
  } else if (kn != null) {
    const badV1 = version === 1 && kn > 2
    const badV2 = version > 1 && (kn < 3 || kn > 6)
    if (badV1 || badV2) {
      add(sectionNotification, 'Неверно указан вид уведомления')
    }
  }

  if (empty(notif?.formationDate)) {
    add(sectionNotification, 'Дата формирования уведомления должна быть указана')
  }

  const endDateStr = notif?.endDate?.trim() ?? ''
  const hasEnd = !empty(endDateStr)
  if (kn != null) {
    if ((kn === 5 || kn === 6) && !hasEnd) {
      add(
        sectionNotification,
        'Дата закрытия (архивации) должна быть указана, если вид уведомления «5» – завершение мероприятий по локализации и ликвидации инфекционной болезни или «6» – завершение мероприятий по локализации и ликвидации массовой неинфекционной болезни (отравления)'
      )
    }
    if ((kn === 1 || kn === 2) && hasEnd) {
      add(
        sectionNotification,
        'Дата закрытия (архивации) не должна быть указана, если вид уведомления «1» – обнаружение инфекционной болезни или «2» – обнаружение массовой неинфекционной болезни (отравления)'
      )
    }
  }

  const auth = notif?.authorizedBody
  if (empty(auth?.country)) {
    add(sectionNotification, 'Код страны уполномоченного органа должен быть указан')
  }
  if (empty(auth?.name)) {
    add(sectionNotification, 'Наименование уполномоченного органа должно быть указано')
  }

  const causes = data.phaCauseNotifications ?? []
  for (const c of causes) {
    if (!causeIncidentAlertFilled(c)) continue
    const ct = (c.type ?? '').trim()
    if (!ct) continue
    if (!CAUSE_INCIDENT_KIND_CODES.has(ct)) {
      add(
        sectionNotification,
        'Неверно указан вид уведомления для уведомления, являющегося причиной обнаружения случая'
      )
      break
    }
  }

  if (sectionNotification.remarks.length) sections.push(sectionNotification)

  const sectionDisease = mk('Болезнь')
  const d = data.phaDisease

  if (!d || empty(d.diseaseName)) {
    add(sectionDisease, 'Наименование болезни должно быть указано')
  }

  ;(d?.pathogens ?? []).forEach((p) => {
    if (pathogenDetailsTouched(p) && empty(p.pathogenKindName)) {
      add(sectionDisease, 'Наименование типа возбудителя должно быть указано')
    }
  })

  if (sectionDisease.remarks.length) sections.push(sectionDisease)

  const sectionPatients = mk('Группа пациентов')
  const groups = data.phaPatientGroups
  if (!groups?.length) {
    add(sectionPatients, 'Группа пациентов должна быть заполнена')
  } else {
    groups.forEach((g, i) => {
      const pq = g.personQuantity != null ? String(g.personQuantity).trim() : ''
      if (empty(pq)) {
        add(sectionPatients, `Группа ${i + 1}: укажите количество человек (smsdo:PersonQuantity)`)
      } else {
        const fmt = validateFieldValue('personQuantity', pq)
        if (fmt) add(sectionPatients, `Группа ${i + 1}: количество — ${fmt}`)
      }
    })
  }
  if (sectionPatients.remarks.length) sections.push(sectionPatients)

  const sectionPlace = mk('Место обнаружения')
  sectionPlace.remarks.push(...collectPlaceRemarks(data.detectionPlace))
  if (sectionPlace.remarks.length) sections.push(sectionPlace)

  const spreadList =
    data.spreadingZones && data.spreadingZones.length > 0
      ? data.spreadingZones
      : data.spreadingZone
        ? [data.spreadingZone]
        : []

  const sectionSpread = mk('Зона распространения')
  for (let zi = 0; zi < spreadList.length; zi++) {
    const z = spreadList[zi]
    if (!spreadingZoneTouched(z)) continue
    const sub = collectPlaceRemarks(z)
    const prefix = spreadList.length > 1 ? `Зона ${zi + 1}: ` : ''
    for (const msg of sub) {
      sectionSpread.remarks.push(prefix + msg)
    }
  }
  if (sectionSpread.remarks.length) sections.push(sectionSpread)

  const sectionMeasures = mk('Санитарные меры')
  const measureList = data.measures?.measures ?? []
  const hasSanitary =
    measureList.length > 0 && measureList.some((m) => !empty(m.measureCode) || !empty(m.measureName))
  if (!hasSanitary) {
    add(sectionMeasures, 'Не указана санитарная мера')
  }
  if (sectionMeasures.remarks.length) sections.push(sectionMeasures)

  const success = sections.length === 0
  return { success, sections }
}

/** Логические контроли + ошибки формата XSD (как при «Валидация карты» и перед направлением ОП 57). */
export function validatePhaOutgoingCardFull(data: CardData): ValidationResult {
  const vr = validatePhaOutgoingCard(data)
  const fmt = collectPhaFormatValidationErrors(data)
  const sections = [...vr.sections]
  if (fmt.length > 0) {
    sections.push({ sectionName: 'Формат данных (XSD)', remarks: fmt })
  }
  return { success: vr.success && fmt.length === 0, sections }
}

export function collectPhaFormatValidationErrors(data: CardData): string[] {
  return collectFormatValidationErrors(data).errors
}
