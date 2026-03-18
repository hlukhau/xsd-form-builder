import { useState, useEffect } from 'react'
import { getAgeGroupOptions, type AgeGroupOption } from '@/utils/referenceDataApi'

export function useAgeGroupOptions() {
  const [options, setOptions] = useState<AgeGroupOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await getAgeGroupOptions()
        if (!cancelled) setOptions(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setOptions([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const getNameByCode = (code: string | undefined): string | null => {
    if (!code) return null
    const opt = options.find(o => o.code === code)
    return opt ? opt.name : null
  }

  const getSelectOptions = () =>
    options.map(opt => ({ value: opt.code, label: opt.name || opt.code }))

  return { options, loading, error, getNameByCode, getSelectOptions }
}
