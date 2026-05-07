import { useState, useEffect } from 'react'
import { getBorderCheckpointOptions, type BorderCheckpointOption } from '@/utils/referenceDataApi'

export function useBorderCheckpointOptions() {
  const [options, setOptions] = useState<BorderCheckpointOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getBorderCheckpointOptions()
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [])

  const getSelectOptions = () =>
    options.map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }))

  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    return options.find((o) => o.code === code)?.name
  }

  return { options, loading, getSelectOptions, getNameByCode }
}
