import { useState, useEffect } from 'react'
import { getDiseaseOutcomeOptions, type DiseaseOutcomeOption } from '@/utils/referenceDataApi'

export function useDiseaseOutcomeOptions() {
  const [options, setOptions] = useState<DiseaseOutcomeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await getDiseaseOutcomeOptions()
        if (!cancelled) {
          const sorted = [...data].sort((a, b) =>
            String(a.code).localeCompare(String(b.code), undefined, { numeric: true, sensitivity: 'base' })
          )
          setOptions(sorted)
        }
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

  /** Для Select: «код - наименование», список уже отсортирован по коду. */
  const getSelectOptions = () =>
    options.map((opt) => ({
      value: opt.code,
      label: opt.name ? `${opt.code} - ${opt.name}` : opt.code,
    }))

  return { options, loading, error, getNameByCode, getSelectOptions }
}
