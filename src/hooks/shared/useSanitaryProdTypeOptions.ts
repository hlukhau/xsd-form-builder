import { useState, useEffect } from 'react'
import { getSanitaryProdTypeOptions, type SanitaryProdTypeOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником типов санитарной продукции
 */
export function useSanitaryProdTypeOptions() {
  const [options, setOptions] = useState<SanitaryProdTypeOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSanitaryProdTypeOptions()
      .then((data) => {
        console.log(`[useSanitaryProdTypeOptions] Загружено ${data.length} типов санитарной продукции`)
        setOptions(data)
      })
      .catch((error) => {
        console.error('Ошибка загрузки справочника типов санитарной продукции:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Получить название типа по коду
   */
  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    const option = options.find(opt => opt.code === code)
    return option?.name
  }

  /**
   * Преобразует список типов санитарной продукции в опции для Select
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
    getSelectOptions,
  }
}

