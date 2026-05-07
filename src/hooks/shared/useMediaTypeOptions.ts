import { useState, useEffect } from 'react'
import { getMediaTypeOptions, type MediaTypeOption } from '@/utils/referenceDataApi'

export function useMediaTypeOptions() {
  const [options, setOptions] = useState<MediaTypeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      try {
        setLoading(true)
        setError(null)
        const data = await getMediaTypeOptions()
        if (!cancelled) {
          setOptions(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          console.error('[useMediaTypeOptions] Ошибка загрузки:', err)
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

  /** MEDIATYPECODE (расширение) по MEDIATYPENAME (MIME) — поле name в API */
  const getCodeByName = (mediatypeName: string | undefined): string | null => {
    if (!mediatypeName?.trim()) return null
    const t = mediatypeName.trim()
    const option = options.find((opt) => (opt.name?.trim() ?? '') === t)
    return option?.code ?? null
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
    getCodeByName,
    getSelectOptions,
  }
}

