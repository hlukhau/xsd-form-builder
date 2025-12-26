import { useState, useEffect } from 'react'
import { getAuthorityOptions, type AuthorityOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником уполномоченных органов
 */
export function useAuthorityOptions(countryCode?: string) {
  const [options, setOptions] = useState<AuthorityOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAuthorityOptions(countryCode)
      .then((data) => {
        console.log(`[useAuthorityOptions] Загружено ${data.length} уполномоченных органов для страны: ${countryCode || 'все'}`)
        setOptions(data)
      })
      .catch((error) => {
        console.error('Ошибка загрузки справочника уполномоченных органов:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [countryCode])

  /**
   * Получить уполномоченный орган по UID
   */
  const getAuthorityByUid = (uid: string | undefined): AuthorityOption | undefined => {
    if (!uid) return undefined
    return options.find(opt => opt.uid === uid)
  }

  /**
   * Преобразует список уполномоченных органов в опции для Select
   * value - UID, label - "название (краткое наименование)"
   */
  const getSelectOptions = () => {
    return options.map((opt) => ({
      value: opt.uid, // Используем UID как значение
      label: opt.briefName 
        ? `${opt.name} (${opt.briefName})`
        : opt.name, // Показываем название и краткое наименование
    }))
  }

  return {
    options,
    loading,
    getAuthorityByUid,
    getSelectOptions,
  }
}


