import { useState, useEffect } from 'react'
import { getIncidentAlertKindOptions, type IncidentAlertKindOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником видов уведомлений
 */
export function useIncidentAlertKindOptions() {
  const [options, setOptions] = useState<IncidentAlertKindOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getIncidentAlertKindOptions()
      .then(setOptions)
      .catch((error) => {
        console.error('Ошибка загрузки справочника видов уведомлений:', error)
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Получить название вида уведомления по коду
   */
  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    const option = options.find(opt => opt.code === code)
    return option ? option.name : undefined
  }

  /**
   * Преобразует список видов уведомлений в опции для Select
   * value - код, label - "код - название"
   */
  const getSelectOptions = () => {
    return options.map((opt) => ({
      value: opt.code, // Используем код как значение
      label: `${opt.code} - ${opt.name}`, // Показываем код и название
    }))
  }

  return {
    options,
    loading,
    getNameByCode,
    getSelectOptions,
  }
}

