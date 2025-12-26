/**
 * API для работы со справочниками
 */

const BASE_URL = import.meta.env.BASE_URL || '/';

export interface Country {
  countryId: number
  countryCode: string
  countrySDate: string
  countryEDate: string
  countryName: string
  eaeuGuid?: string
  seqNum?: number
  cDate: string
}

export interface CountryOption {
  code: string
  name: string
}

export interface IncidentAlertKindOption {
  code: string
  name: string
}

export interface AuthorityOption {
  uid: string
  name: string
  briefName: string
  countryCode: string
}

/**
 * Получить все активные страны
 */
export async function getCountries(): Promise<Country[]> {
  try {
    const response = await fetch(`${BASE_URL}api/countries`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки стран: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки стран:', error)
    throw error
  }
}

/**
 * Получить опции для выпадающего списка стран
 */
export async function getCountryOptions(): Promise<CountryOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/countries/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций стран: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций стран:', error)
    throw error
  }
}

/**
 * Получить страну по коду
 */
export async function getCountryByCode(code: string): Promise<Country | null> {
  try {
    const response = await fetch(`${BASE_URL}api/countries/${code}`)
    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`Ошибка загрузки страны: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки страны:', error)
    return null
  }
}

/**
 * Проверить существование страны по коду
 */
export async function checkCountryExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const response = await fetch(`${BASE_URL}api/countries/${code}/exists`)
    if (!response.ok) {
      return false
    }
    const data = await response.json()
    return data.exists === true
  } catch (error) {
    console.error('Ошибка проверки страны:', error)
    return false
  }
}

/**
 * Получить опции для выпадающего списка видов уведомлений
 */
export async function getIncidentAlertKindOptions(): Promise<IncidentAlertKindOption[]> {
  try {
    const response = await fetch(`${BASE_URL}api/incident-alert-kinds/options`)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций видов уведомлений: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций видов уведомлений:', error)
    throw error
  }
}

/**
 * Проверить существование вида уведомления по коду
 */
export async function checkIncidentAlertKindExists(code: string): Promise<boolean> {
  if (!code || code.trim().length === 0) {
    return false
  }
  try {
    const options = await getIncidentAlertKindOptions()
    return options.some(opt => opt.code === code)
  } catch (error) {
    console.error('Ошибка проверки вида уведомления:', error)
    return false
  }
}

/**
 * Получить название вида уведомления по коду
 */
export async function getIncidentAlertKindNameByCode(code: string): Promise<string | null> {
  if (!code || code.trim().length === 0) {
    return null
  }
  try {
    const options = await getIncidentAlertKindOptions()
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  } catch (error) {
    console.error('Ошибка получения названия вида уведомления:', error)
    return null
  }
}

/**
 * Получить опции для выпадающего списка уполномоченных органов
 * @param countryCode - код страны для фильтрации (опционально)
 */
export async function getAuthorityOptions(countryCode?: string): Promise<AuthorityOption[]> {
  try {
    const url = countryCode 
      ? `${BASE_URL}api/authorities/options?countryCode=${encodeURIComponent(countryCode)}`
      : `${BASE_URL}api/authorities/options`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Ошибка загрузки опций уполномоченных органов: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Ошибка загрузки опций уполномоченных органов:', error)
    throw error
  }
}




