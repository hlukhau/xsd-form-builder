import { useState, useEffect } from 'react'
import {
  getIdentificationMethodOptions,
  type IdentificationMethodOption,
} from '@/utils/referenceDataApi'

/**
 * Хук для загрузки справочника методов идентификации (SESINT.BUSENTKIND, kindId/codeListId=1033).
 * @param countryCode - код страны (COUNTRYCODE); при указании список фильтруется по стране
 */
export function useIdentificationMethodOptions(countryCode?: string) {
  const [options, setOptions] = useState<IdentificationMethodOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getIdentificationMethodOptions(countryCode)
      .then(setOptions)
      .catch((error) => {
        console.error('Ошибка загрузки справочника методов идентификации:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [countryCode])

  const getByCode = (code: string | undefined): IdentificationMethodOption | undefined => {
    if (!code) return undefined
    return options.find((opt) => String(opt.code).trim() === String(code).trim())
  }

  /** Строка для отображения: буквенное обозначение и описание из справочника */
  const getDisplayLabel = (code: string | undefined): string => {
    const opt = getByCode(code)
    if (!opt) return code || ''
    const parts = [opt.letterCode, opt.description].filter(Boolean)
    return parts.length ? parts.join(' — ') : (opt.code || '')
  }

  /** Опции для Select: value = code, label = буквенное обозначение — описание */
  const getSelectOptions = () =>
    options.map((opt) => {
      const label = [opt.letterCode, opt.description].filter(Boolean).join(' — ') || opt.code
      return { value: opt.code, label }
    })

  return {
    options,
    loading,
    getByCode,
    getDisplayLabel,
    getSelectOptions,
  }
}
