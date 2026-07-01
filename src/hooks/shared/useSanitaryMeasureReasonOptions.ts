import { useState, useEffect } from 'react'
import {
  getSanitaryMeasureReasonOptions,
  type SanitaryMeasureReasonOption,
} from '@/utils/referenceDataApi'

export function useSanitaryMeasureReasonOptions() {
  const [options, setOptions] = useState<SanitaryMeasureReasonOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      try {
        setLoading(true)
        setError(null)
        const data = await getSanitaryMeasureReasonOptions()
        if (!cancelled) {
          setOptions(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          console.error('[useSanitaryMeasureReasonOptions] Ошибка загрузки:', err)
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
    const option = options.find((opt) => opt.code === code)
    return option ? option.name : null
  }

  const getSelectOptions = () =>
    options.map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }))

  return {
    options,
    loading,
    error,
    getNameByCode,
    getSelectOptions,
  }
}
