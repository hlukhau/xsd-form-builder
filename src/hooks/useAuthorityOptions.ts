import { useState, useEffect } from 'react'
import { getAuthorityOptions, type AuthorityOption } from '@/utils/referenceDataApi'

/**
 * Хук для загрузки и работы со справочником уполномоченных органов
 * @param countryCode - код страны для фильтрации
 * @param forOutgoingCreation - если true, запрашивать только УО из карты прав create (передаётся authorityIds)
 * @param allowedAuthorityIds - список AUTHORITYID из dangerousProductOut.create; при forOutgoingCreation показываются только эти УО
 */
export function useAuthorityOptions(
  countryCode?: string,
  forOutgoingCreation?: boolean,
  allowedAuthorityIds?: string[]
) {
  const [options, setOptions] = useState<AuthorityOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    const ids = forOutgoingCreation ? allowedAuthorityIds : undefined
    getAuthorityOptions(countryCode, forOutgoingCreation, ids)
      .then((data) => {
        setOptions(data)
      })
      .catch((error) => {
        console.error('Ошибка загрузки справочника уполномоченных органов:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [countryCode, forOutgoingCreation, allowedAuthorityIds?.join(',')])

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


