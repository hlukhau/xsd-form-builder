import { useState, useEffect } from 'react'
import { getIdentityDocKindOptions, type IdentityDocKindOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки справочника видов документов, удостоверяющих личность (SESINT.IDENTITYDOCKIND, codeListId=2053)
 */
export function useIdentityDocKindOptions() {
  const [options, setOptions] = useState<IdentityDocKindOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getIdentityDocKindOptions()
      .then(setOptions)
      .catch((error) => {
        console.error('Ошибка загрузки справочника видов документов, удостоверяющих личность:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [])

  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    return options.find((o) => String(o.code) === String(code))?.name
  }

  /** Опции для Select: код как value, «код — наименование» как label */
  const getSelectOptions = () =>
    options.map((opt) => ({
      value: opt.code,
      label: opt.name ? `${opt.code} — ${opt.name}` : String(opt.code),
    }))

  return {
    options,
    loading,
    getNameByCode,
    getSelectOptions,
  }
}
