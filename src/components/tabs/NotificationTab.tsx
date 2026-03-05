import { Descriptions, Tag } from 'antd'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useState, useEffect } from 'react'
import { checkCountryExists } from '@/utils/referenceDataApi'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import type { Notification } from '@/types/card'

interface NotificationTabProps {
  data: Notification
}

const NotificationTab: React.FC<NotificationTabProps> = ({ data }) => {
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const [countryValid, setCountryValid] = useState<boolean | null>(null)
  const [authorizedBodyCountryValid, setAuthorizedBodyCountryValid] = useState<boolean | null>(null)

  useEffect(() => {
    // Проверка страны при загрузке
    if (data.country) {
      checkCountryExists(data.country).then(setCountryValid)
    }
    if (data.authorizedBody?.country) {
      checkCountryExists(data.authorizedBody.country).then(setAuthorizedBodyCountryValid)
    }
  }, [data.country, data.authorizedBody?.country])

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateOnly = date.trim().slice(0, 10)
    if (dateOnly.length !== 10) return date
    try {
      return format(parseISO(dateOnly), 'dd.MM.yyyy', { locale: ru })
    } catch {
      return date
    }
  }

  const renderCountry = (countryCode: string, isValid: boolean | null) => {
    const displayLabel = getCountryDisplayLabel(countryCode)
    if (isValid === false) {
      return (
        <span>
          <Tag color="red" style={{ marginRight: 8 }}>
            Не найдено в справочнике
          </Tag>
          {displayLabel}
        </span>
      )
    }
    return displayLabel
  }

  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="Страна">
        {renderCountry(data.country, countryValid)}
      </Descriptions.Item>
      <Descriptions.Item label="Регистрационный номер">
        {data.registrationNumber}
      </Descriptions.Item>
      <Descriptions.Item label="Вид">{data.type}</Descriptions.Item>
      <Descriptions.Item label="Дата формирования">
        {formatDate(data.formationDate)}
      </Descriptions.Item>
      <Descriptions.Item label="Дата закрытия">
        {data.endDate ? formatDate(data.endDate) : '-'}
      </Descriptions.Item>
      <Descriptions.Item label="Уполномоченный орган">
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Страна">
            {renderCountry(data.authorizedBody.country, authorizedBodyCountryValid)}
          </Descriptions.Item>
          <Descriptions.Item label="Идентификатор">
            {data.authorizedBody.identifier || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Наименование">
            {data.authorizedBody.name}
          </Descriptions.Item>
          <Descriptions.Item label="Краткое наименование">
            {data.authorizedBody.shortName || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Descriptions.Item>
    </Descriptions>
  )
}

export default NotificationTab

