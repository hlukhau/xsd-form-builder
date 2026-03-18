import { useState, useEffect } from 'react'
import { getCountryOptions, type CountryOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником стран
 */
export function useCountryOptions() {
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getCountryOptions()
      .then(setCountryOptions)
      .catch((error) => {
        console.error('Ошибка загрузки справочника стран:', error)
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Нормализует код страны - извлекает только код, если значение в формате "CODE-NAME"
   */
  const normalizeCountryCode = (country: string | undefined): string | undefined => {
    if (!country) return undefined
    // Если формат "CODE-NAME", извлекаем только код (первые символы до дефиса)
    if (country.includes('-')) {
      return country.split('-')[0].trim()
    }
    return country.trim()
  }

  /**
   * Стандартный вид для отображения: «код — наименование», например "BY - Беларусь".
   * Если страна не найдена в справочнике, возвращает код.
   */
  const getDisplayLabel = (code: string | undefined): string => {
    if (!code || !code.trim()) return '-'
    const normalized = code.includes('-') ? code.split('-')[0].trim() : code.trim()
    const opt = countryOptions.find((o) => (o.code || '').toUpperCase() === normalized.toUpperCase())
    return opt ? `${opt.code} - ${opt.name}` : normalized
  }

  /**
   * Преобразует список стран в опции для Select (label: "код — наименование")
   */
  const getSelectOptions = () => {
    return countryOptions.map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }))
  }

  return {
    countryOptions,
    loading,
    normalizeCountryCode,
    getDisplayLabel,
    getSelectOptions,
  }
}





