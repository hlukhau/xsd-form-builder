import { useState, useEffect } from 'react'
import { getConformityDocKindOptions, type ConformityDocKindOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки справочника видов документов об оценке соответствия (CONFDOCKIND, codeListId=2001)
 */
export function useConformityDocKindOptions() {
  const [options, setOptions] = useState<ConformityDocKindOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getConformityDocKindOptions()
      .then(setOptions)
      .catch((error) => {
        console.error('Ошибка загрузки справочника видов документов об оценке соответствия:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [])

  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    return options.find((opt) => String(opt.code) === String(code))?.name
  }

  /** Для отображения: «код — наименование» из справочника */
  const getDisplayLabel = (code: string | undefined): string => {
    if (!code) return ''
    const opt = options.find((o) => String(o.code) === String(code))
    if (!opt) return code
    return opt.name ? `${opt.code} - ${opt.name}` : opt.code
  }

  const getSelectOptions = () =>
    options.map((opt) => ({
      value: opt.code,
      label: opt.name ? `${opt.code} - ${opt.name}` : opt.code,
    }))

  return {
    options,
    loading,
    getNameByCode,
    getDisplayLabel,
    getSelectOptions,
  }
}
