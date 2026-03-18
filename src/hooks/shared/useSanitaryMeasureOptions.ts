import { useState, useEffect } from 'react'
import { getSanitaryMeasureOptions, getSanitaryMeasureNameByCode, type SanitaryMeasureOption } from '@/utils/referenceDataApi'

export function useSanitaryMeasureOptions() {
  const [options, setOptions] = useState<SanitaryMeasureOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      try {
        setLoading(true)
        setError(null)
        const data = await getSanitaryMeasureOptions()
        if (!cancelled) {
          setOptions(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          console.error('[useSanitaryMeasureOptions] Ошибка загрузки:', err)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadOptions()

    return () => {
      cancelled = true
    }
  }, [])

  const getNameByCode = (code: string | undefined): string | null => {
    if (!code) return null
    const option = options.find(opt => opt.code === code)
    return option ? option.name : null
  }

  const getSelectOptions = () => {
    return options.map(opt => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }))
  }

  return {
    options,
    loading,
    error,
    getNameByCode,
    getSelectOptions,
  }
}

