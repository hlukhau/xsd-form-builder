/**
 * Логический контроль карты PHA по регламенту контролей (обязательность, согласованность блоков).
 * Используется в «Валидация карты» и перед направлением ОП 57 (validatePhaOutgoingCardFull).
 * Перед сохранением в БД блокируются только несоответствия формата заполненных полей (collectPhaFormatValidationErrors).
 */
import type {
  CardData,
  BusinessEntityDetails,
  ContactDetails,
  DetectionPlaceData,
  AddressDetails,
  PhaCauseNotificationItem,
  PhaPathogenDetails,
} from '@/types/card'
import { validateFieldValue } from '@/constants/xsdFieldConstraints'
import { businessEntityIdMethodPairRemarks } from '@/utils/businessEntityIdentificationValidation'
import { collectFormatValidationErrors, type ValidationResult } from '@/utils/cardValidation'
import { exportPhaCardDataToXML } from '@/cards/pha/phaXmlExporter'
import { fetchSchemaValidationErrors } from '@/utils/schemaValidationApi'
import { phaShouldExportPublicHealthIncident } from '@/cards/pha/phaXmlExporter'
import { remarkContactsIncomplete } from '@/utils/contactValidation'

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

/** Хотя бы одно поле строки адреса субъекта (ccdo:SubjectAddressDetails). */
function subjectAddressRowHasContent(a: AddressDetails): boolean {
  const s = (v: string | undefined) => (v ?? '').trim()
  return !!(
    s(a.country) ||
    s(a.territoryCode) ||
    s(a.regionName) ||
    s(a.districtName) ||
    s(a.cityName) ||
    s(a.settlementName) ||
    s(a.streetName) ||
    s(a.buildingNumberId) ||
    s(a.roomNumberId) ||
    s(a.postOfficeBoxId) ||
    s(a.postCode) ||
    s(a.fullAddress)
  )
}

/**
 * Пользователь начал заполнять блок организации (в т.ч. только ОПФ / код вида / краткое наименование / контакты).
 */
function organizationAnyFieldTouched(o: BusinessEntityDetails | undefined): boolean {
  if (!o) return false
  return !!(
    o.country?.trim() ||
    o.businessEntityName?.trim() ||
    o.businessEntityBriefName?.trim() ||
    o.businessEntityTypeCode?.trim() ||
    o.businessEntityTypeCodeListId?.trim() ||
    o.businessEntityTypeName?.trim() ||
    (o.addresses && o.addresses.length > 0) ||
    (o.contacts && o.contacts.length > 0) ||
    o.businessEntityId?.trim() ||
    o.identificationMethod?.trim() ||
    o.customsNumber?.trim() ||
    o.taxRegistrationReasonCode?.trim() ||
    o.taxpayerId?.trim()
  )
}

/** Страна, наименование субъекта и хотя бы один заполненный адрес субъекта. */
function organizationTrioComplete(o: BusinessEntityDetails): boolean {
  if (empty(o.country) || empty(o.businessEntityName)) return false
  return (o.addresses ?? []).some(subjectAddressRowHasContent)
}

function collectOrgContactRemarks(contacts: ContactDetails[] | undefined): string[] {
  const r = remarkContactsIncomplete(contacts)
  return r ? [r] : []
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
  if (o && organizationAnyFieldTouched(o)) {
    for (const msg of businessEntityIdMethodPairRemarks(o, { legacyHozyaystvuyushchegoSubektaWording: true })) {
      add(msg)
    }
    if (!organizationTrioComplete(o)) {
      add('Должны быть заполнены Страна, Наименование субъекта, Адрес')
    } else {
      for (const addr of o.addresses ?? []) {
        if (!empty(addr.country) || addressHasCityOrSettlement(addr) || !empty(addr.fullAddress)) {
          if (empty(addr.country)) add('В адресе должна быть указана страна')
          if (!addressHasCityOrSettlement(addr)) add('В адресе должен быть указан город или населенный пункт')
        }
      }
    }
    for (const msg of collectOrgContactRemarks(o.contacts)) add(msg)
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
  if (place.organization && organizationAnyFieldTouched(place.organization)) return true
  return !!(
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

/** Все обязательные поля строки причинного уведомления (XSD IncidentAlertIdDetails). */
function causeIncidentAlertComplete(c: PhaCauseNotificationItem): boolean {
  return (
    !empty(c.country) &&
    !empty(c.registrationNumber) &&
    !empty(c.type) &&
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
  for (let i = 0; i < causes.length; i++) {
    const c = causes[i]
    if (!causeIncidentAlertFilled(c)) continue
    if (!causeIncidentAlertComplete(c)) {
      const missing: string[] = []
      if (empty(c.country)) missing.push('страна')
      if (empty(c.registrationNumber)) missing.push('регистрационный номер')
      if (empty(c.type)) missing.push('вид уведомления')
      if (empty(c.formationDate)) missing.push('дата формирования')
      add(
        sectionNotification,
        `Причинное уведомление (строка ${i + 1}): заполните все поля: ${missing.join(', ')}.`
      )
      continue
    }
    const ct = (c.type ?? '').trim()
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

  if (phaShouldExportPublicHealthIncident(data) && empty(d?.firstCaseDate)) {
    add(sectionDisease, 'Дата первого случая должна быть указана')
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
        add(sectionPatients, `Группа ${i + 1}: укажите количество человек`)
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

/** Обязательные поля / логические контроли; при успехе — ограничения полей (без дубля при уже упавшей логике). */
export function validatePhaOutgoingCardFull(data: CardData): ValidationResult {
  const vr = validatePhaOutgoingCard(data)
  if (!vr.success) {
    return vr
  }
  const fmt = collectPhaFormatValidationErrors(data)
  if (fmt.length === 0) {
    return { success: true, sections: [] }
  }
  return {
    success: false,
    sections: [{ sectionName: 'Структурный контроль', remarks: fmt }],
  }
}

/** Как validatePhaOutgoingCardFull, плюс проверка XML по XSD на сервере только при успехе предыдущих шагов. */
export async function validatePhaOutgoingCardFullWithSchema(data: CardData): Promise<ValidationResult> {
  const vr = validatePhaOutgoingCardFull(data)
  if (!vr.success) {
    return vr
  }
  let xsdRemarks: string[] = []
  let schemaRequestFailed = false
  try {
    xsdRemarks = await fetchSchemaValidationErrors(exportPhaCardDataToXML(data), 'pha')
  } catch (e) {
    schemaRequestFailed = true
    const msg = e instanceof Error ? e.message : String(e)
    xsdRemarks = [`Не удалось выполнить структурный контроль: ${msg}`]
  }
  if (schemaRequestFailed || xsdRemarks.length > 0) {
    return {
      success: false,
      sections: [{ sectionName: 'Структурный контроль', remarks: xsdRemarks }],
    }
  }
  return { success: true, sections: [] }
}

export function collectPhaFormatValidationErrors(data: CardData): string[] {
  return collectFormatValidationErrors(data).errors
}

/** Перед сохранением в БД: только незаполненный вид уведомления (без прочих контролей «Валидация карты»). */
export function collectPhaIncidentAlertKindSaveErrors(data: CardData): string[] {
  const kind = data.notification?.type?.trim() ?? ''
  if (kind) return []
  return ['Вид уведомления должен быть указан']
}

/** Для подсветки в форме: в строке причинного уведомления заполнено хотя бы одно поле. */
export function isPhaCauseNotificationRowTouched(c: PhaCauseNotificationItem): boolean {
  return causeIncidentAlertFilled(c)
}

/** Все поля строки причинного уведомления заполнены (соответствие XSD). */
export function isPhaCauseNotificationRowComplete(c: PhaCauseNotificationItem): boolean {
  return causeIncidentAlertComplete(c)
}
