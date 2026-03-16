import type { AddressDetails } from '@/types/card'

/**
 * Формирует одну строку адреса для ccdo:ObjectAddressDetails (адрес места обнаружения).
 * Без типа адреса, без почтового индекса и без полного адреса одной строкой — этих атрибутов нет в ObjectAddressDetails.
 */
export function formatAddressLineObjectAddress(
  address: AddressDetails,
  getCountryName: (countryCode?: string) => string
): string {
  if (!address) return ''
  const parts: string[] = []
  const countryName = address.country ? getCountryName(address.country) : ''
  if (countryName && countryName !== '-') parts.push(countryName)
  if (address.territoryCode?.trim()) parts.push(address.territoryCode.trim())
  if (address.regionName?.trim()) parts.push(address.regionName.trim())
  if (address.districtName?.trim()) parts.push(address.districtName.trim())
  const cityOrSettlement = address.cityName?.trim() || address.settlementName?.trim()
  if (cityOrSettlement) parts.push(cityOrSettlement)
  if (address.streetName?.trim()) parts.push(address.streetName.trim())
  const building = address.buildingNumberId?.trim()
  const room = address.roomNumberId?.trim()
  if (building && room) parts.push(`${building} - ${room}`)
  else if (building) parts.push(building)
  else if (room) parts.push(room)
  if (address.postOfficeBoxId?.trim()) parts.push(address.postOfficeBoxId.trim())
  return parts.filter(Boolean).join(', ') || ''
}

/**
 * Формирует одну строку адреса по правилам ccdo:SubjectAddressDetails (CR-VIEW-02).
 * Порядок: <Вид адреса> - <Почтовый индекс>, <Страна>, <Код территории>, <Регион>, <Район>, <Город или Населенный пункт>, <Улица>, <Номер дома> - <Номер помещения>, <Номер абонентского ящика>.
 * Если код вида адреса не указан — «вид адреса не определен». Пустые элементы не выводятся, без двойных запятых и без ведущих/замыкающих разделителей.
 */
export function formatAddressLine(
  address: AddressDetails,
  getAddressKindName: (code?: string) => string,
  getCountryName: (countryCode?: string) => string
): string {
  if (!address) return ''

  const kindName = address.addressKindCode != null && address.addressKindCode !== ''
    ? getAddressKindName(address.addressKindCode)
    : 'вид адреса не определен'

  const parts: string[] = []

  if (address.postCode?.trim()) parts.push(address.postCode.trim())
  const countryName = address.country ? getCountryName(address.country) : ''
  if (countryName && countryName !== '-') parts.push(countryName)
  if (address.territoryCode?.trim()) parts.push(address.territoryCode.trim())
  if (address.regionName?.trim()) parts.push(address.regionName.trim())
  if (address.districtName?.trim()) parts.push(address.districtName.trim())
  const cityOrSettlement = address.cityName?.trim() || address.settlementName?.trim()
  if (cityOrSettlement) parts.push(cityOrSettlement)
  if (address.streetName?.trim()) parts.push(address.streetName.trim())

  const building = address.buildingNumberId?.trim()
  const room = address.roomNumberId?.trim()
  if (building && room) {
    parts.push(`${building} - ${room}`)
  } else if (building) {
    parts.push(building)
  } else if (room) {
    parts.push(room)
  }

  if (address.postOfficeBoxId?.trim()) parts.push(address.postOfficeBoxId.trim())

  const rest = parts.filter(Boolean).join(', ')
  if (!rest) return kindName
  return `${kindName} - ${rest}`
}

/** Дефолтное имя вида адреса по коду (справочник sesint.addresskind). */
export function getDefaultAddressKindName(code?: string): string {
  if (code == null || code === '') return ''
  const map: Record<string, string> = {
    '1': 'адрес регистрации',
    '2': 'фактический адрес',
    '3': 'почтовый адрес',
  }
  return map[code] || `вид адреса (код: ${code})`
}

/** Дефолтное наименование страны по коду (для fallback). */
export function getDefaultCountryName(code?: string): string {
  if (!code) return ''
  const map: Record<string, string> = {
    RU: 'Россия',
    BY: 'Беларусь',
    KZ: 'Казахстан',
    AM: 'Армения',
    KG: 'Киргизия',
  }
  return map[code] || code
}

/** Список адресов из SupplyChainPartyDetails. Если задан addresses — возвращаем его; иначе собираем из регистрационный/фактический/почтовый. */
export function getAddressListFromParty(party: {
  addresses?: AddressDetails[]
  registrationAddress?: AddressDetails
  actualAddress?: AddressDetails
  mailingAddress?: AddressDetails
}): AddressDetails[] {
  if (party.addresses && party.addresses.length > 0) {
    return party.addresses.map((a) => ({ ...a, addressKindCode: a.addressKindCode || undefined }))
  }
  const list: AddressDetails[] = []
  if (party.registrationAddress) list.push({ ...party.registrationAddress, addressKindCode: party.registrationAddress.addressKindCode || '1' })
  if (party.actualAddress) list.push({ ...party.actualAddress, addressKindCode: party.actualAddress.addressKindCode || '2' })
  if (party.mailingAddress) list.push({ ...party.mailingAddress, addressKindCode: party.mailingAddress.addressKindCode || '3' })
  return list
}

/** Список адресов из организации (addresses[]). */
export function getAddressListFromOrganization(org: { addresses?: AddressDetails[] }): AddressDetails[] {
  return org.addresses && org.addresses.length > 0 ? [...org.addresses] : []
}

/** Список адресов из SubjectDetails (физлицо/юрлицо — addresses или регистрационный, фактический, почтовый). */
export function getAddressListFromSubject(subject: {
  addresses?: AddressDetails[]
  registrationAddress?: AddressDetails
  actualAddress?: AddressDetails
  mailingAddress?: AddressDetails
}): AddressDetails[] {
  if (subject.addresses && subject.addresses.length > 0) return [...subject.addresses]
  return getAddressListFromParty(subject)
}

/**
 * Форматирует список адресов в массив строк для отображения списком «Адреса».
 */
export function formatAddressList(
  addresses: AddressDetails[],
  getAddressKindName: (code?: string) => string,
  getCountryName: (countryCode?: string) => string
): string[] {
  return addresses
    .map((addr) => formatAddressLine(addr, getAddressKindName, getCountryName))
    .filter((line) => line.length > 0)
}
