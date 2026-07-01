import { useState, useEffect } from 'react'
import { getEaueCountryOptions, type CountryOption } from '@/utils/referenceDataApi'

/**
 * Справочник стран ЕАЭС (COUNTRYGRSET.COUNTRYGRCODE = 'EAUE') для полей csdo:UnifiedCountryCode.
 */
export function useEaueCountryOptions() {
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getEaueCountryOptions()
      .then((data) => {
        setCountryOptions(data)
        setError(null)
      })
      .catch((err) => {
        console.error('Ошибка загрузки справочника стран ЕАЭС:', err)
        setCountryOptions([])
        setError(err instanceof Error ? err.message : 'Ошибка загрузки справочника стран ЕАЭС')
      })
      .finally(() => setLoading(false))
  }, [])

  const normalizeCountryCode = (country: string | undefined): string | undefined => {
    if (!country) return undefined
    if (country.includes('-')) {
      return country.split('-')[0].trim()
    }
    return country.trim()
  }

  const getDisplayLabel = (code: string | undefined): string => {
    if (!code || !code.trim()) return '-'
    const normalized = code.includes('-') ? code.split('-')[0].trim() : code.trim()
    const opt = countryOptions.find((o) => (o.code || '').toUpperCase() === normalized.toUpperCase())
    return opt ? `${opt.code} - ${opt.name}` : normalized
  }

  const getSelectOptions = () =>
    countryOptions.map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }))

  return {
    countryOptions,
    loading,
    error,
    normalizeCountryCode,
    getDisplayLabel,
    getSelectOptions,
  }
}
