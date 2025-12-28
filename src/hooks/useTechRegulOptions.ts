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
   * Преобразует список технических регламентов в опции для Select
   * value - код, label - "код - название"
   */
  const getSelectOptions = () => {
    return options.map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }))
  }

  return {
    options,
    loading,
    getNameByCode,
    getRegNumByCode,
    getSelectOptions,
  }
}

