import { useState, useEffect } from 'react'
import { getSupplyChainPartyKindOptions, type SupplyChainPartyKindOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником видов участников цепи поставки
 */
export function useSupplyChainPartyKindOptions() {
  const [options, setOptions] = useState<SupplyChainPartyKindOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getSupplyChainPartyKindOptions()
      .then((data) => {
        console.log(`[useSupplyChainPartyKindOptions] Загружено ${data.length} видов участников цепи поставки`)
        setOptions(data)
      })
      .catch((error) => {
        console.error('Ошибка загрузки справочника видов участников цепи поставки:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Получить название вида участника по коду
   */
  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    const option = options.find(opt => opt.code === code)
    return option?.name
  }

  /**
   * Преобразует список видов участников в опции для Select
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

