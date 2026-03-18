import { useState, useEffect } from 'react'
import { getLegalFormOptions, type LegalFormOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки справочника организационно-правовых форм (SESINT.LEGALFORM, codeListId=2049).
 * @param countryCode - код страны (COUNTRYCODE); при указании список фильтруется по стране
 */
export function useLegalFormOptions(countryCode?: string) {
  const [options, setOptions] = useState<LegalFormOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getLegalFormOptions(countryCode)
      .then(setOptions)
      .catch((error) => {
        console.error('Ошибка загрузки справочника организационно-правовых форм:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [countryCode])

  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    return options.find((opt) => String(opt.code) === String(code))?.name
  }

  /** Опции для Select: value = code, label = "код - наименование" */
  const getSelectOptions = () =>
    options.map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }))

  return {
    options,
    loading,
    getNameByCode,
    getSelectOptions,
  }
}
