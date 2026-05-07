import { useState, useEffect } from 'react'
import { getShipDocKindOptions, type ShipDocKindOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником видов товаросопроводительных документов
 */
export function useShipDocKindOptions() {
  const [options, setOptions] = useState<ShipDocKindOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getShipDocKindOptions()
      .then((data) => {
        console.log(`[useShipDocKindOptions] Загружено ${data.length} видов товаросопроводительных документов`)
        setOptions(data)
        setError(null)
      })
      .catch((error) => {
        console.error('Ошибка загрузки справочника видов товаросопроводительных документов:', error)
        setOptions([])
        setError(error instanceof Error ? error.message : 'Ошибка загрузки справочника SHIPDOCKIND')
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Получить название вида документа по коду
   */
  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    const option = options.find((opt) => String(opt.code) === String(code))
    return option?.name
  }

  /**
   * Для отображения: «код — наименование» из справочника (codeListId=2009), иначе пустая строка
   */
  const getDisplayLabel = (code: string | undefined): string => {
    if (!code) return ''
    const name = getNameByCode(code)
    return name ? `${code} - ${name}` : code
  }

  /**
   * Преобразует список видов документов в опции для Select
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
    error,
    getNameByCode,
    getDisplayLabel,
    getSelectOptions,
  }
}

