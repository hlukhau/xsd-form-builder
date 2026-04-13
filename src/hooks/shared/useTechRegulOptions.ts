import { useState, useEffect } from 'react'
import { getTechRegulOptions, type TechRegulOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником технических регламентов
 */
export function useTechRegulOptions() {
  const [options, setOptions] = useState<TechRegulOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getTechRegulOptions()
      .then((data) => {
        console.log(`[useTechRegulOptions] Загружено ${data.length} технических регламентов`)
        setOptions(data)
      })
      .catch((error) => {
        console.error('Ошибка загрузки справочника технических регламентов:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Получить название технического регламента по коду
   */
  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    const option = options.find(opt => opt.code === code)
    return option?.name
  }

  /**
   * Получить регистрационный номер по коду
   */
  const getRegNumByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    const option = options.find(opt => opt.code === code)
    return option?.regNum
  }

  /**
   * Опции Select: value — TECHREGULCODE, label — только TECHREGULREGNUM (при отсутствии — код записи).
   */
  const getSelectOptions = () => {
    return options.map((opt) => {
      const reg = (opt.regNum ?? '').trim()
      const label = reg || opt.code
      return { value: opt.code, label }
    })
  }

  return {
    options,
    loading,
    getNameByCode,
    getRegNumByCode,
    getSelectOptions,
  }
}

