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



