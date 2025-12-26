import { useState, useEffect } from 'react'
import { getMeasurementUnitOptions, type MeasurementUnitOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником единиц измерения
 */
export function useMeasurementUnitOptions() {
  const [options, setOptions] = useState<MeasurementUnitOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getMeasurementUnitOptions()
      .then((data) => {
        console.log(`[useMeasurementUnitOptions] Загружено ${data.length} единиц измерения`)
        setOptions(data)
      })
      .catch((error) => {
        console.error('Ошибка загрузки справочника единиц измерения:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [])

  /**
   * Получить единицу измерения по коду
   */
  const getUnitByCode = (code: string | undefined): MeasurementUnitOption | undefined => {
    if (!code) return undefined
    return options.find(opt => opt.code === code)
  }

  /**
   * Преобразует список единиц измерения в опции для Select
   * value - код, label - "код - название (краткое наименование)"
   */
  const getSelectOptions = () => {
    return options.map((opt) => ({
      value: opt.code,
      label: opt.briefName 
        ? `${opt.code} - ${opt.name} (${opt.briefName})`
        : `${opt.code} - ${opt.name}`,
    }))
  }

  return {
    options,
    loading,
    getUnitByCode,
    getSelectOptions,
  }
}

