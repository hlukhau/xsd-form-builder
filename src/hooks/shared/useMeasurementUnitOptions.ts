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
    return options.find((opt) => String(opt.code) === String(code))
  }

  /**
   * Условное обозначение единицы измерения из справочника (briefName || name || code).
   * Для отображения в полях «Количество товара», «Единица измерения» и т.д.
   */
  const getDisplayLabel = (code: string | undefined): string => {
    const unit = getUnitByCode(code)
    if (!unit) return code ?? ''
    return (unit.briefName || unit.name || unit.code) ?? ''
  }

  /**
   * Преобразует список единиц измерения в опции для Select
   * value - код, label - "код - условное обозначение (наименование)"
   */
  const getSelectOptions = () => {
    return options.map((opt) => ({
      value: opt.code,
      label: opt.briefName
        ? `${opt.code} - ${opt.briefName}${opt.name ? ` (${opt.name})` : ''}`
        : `${opt.code} - ${opt.name}`,
    }))
  }

  return {
    options,
    loading,
    getUnitByCode,
    getDisplayLabel,
    getSelectOptions,
  }
}

