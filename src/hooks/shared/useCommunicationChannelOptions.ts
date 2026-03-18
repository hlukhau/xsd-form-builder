import { useEffect, useState } from 'react'
import { getCommunicationChannelOptions, type CommunicationChannelOption } from '@/utils/referenceDataApi'

export function useCommunicationChannelOptions() {
  const [options, setOptions] = useState<CommunicationChannelOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getCommunicationChannelOptions()
      .then(setOptions)
      .catch((error) => {
        console.error('Ошибка загрузки справочника видов контакта:', error)
        setOptions([])
      })
      .finally(() => setLoading(false))
  }, [])

  const getNameByCode = (code: string | undefined): string | undefined => {
    if (!code) return undefined
    return options.find((opt) => String(opt.code) === String(code))?.name
  }

  const getSelectOptions = () =>
    options.map((opt) => ({
      value: opt.code,
      label: `${opt.code} - ${opt.name}`,
    }))

  return {
    options,
    loading,
    getNameByCode,
    getSelectOptions,
  }
}
