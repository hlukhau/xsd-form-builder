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
   * Опции Select: value — TECHREGULCODE; label — только REGNUM (так отображается выбранное значение);
   * searchText — «REGNUM - наименование» для поиска и для отрисовки строки в выпадающем списке (optionRender).
   */
  const getSelectOptions = () => {
    return options.map((opt) => {
      const reg = (opt.regNum ?? '').trim() || opt.code
      const name = (opt.name ?? '').trim()
      const searchText = name ? `${reg} - ${name}` : reg
      return { value: opt.code, label: reg, searchText }
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

