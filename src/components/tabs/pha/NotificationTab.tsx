import { Descriptions, Tag } from 'antd'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useState, useEffect } from 'react'
import { checkCountryExists } from '@/utils/referenceDataApi'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'
import type { CardData } from '@/types/card'

interface NotificationTabProps {
  data: CardData
}

/**
 * Уведомление — данные по уведомлению о случае обнаружения болезни
 * и по уведомлениям, являющимся причиной обнаружения данного случая болезни.
 */
const NotificationTab: React.FC<NotificationTabProps> = ({ data }) => {
  const n = data.notification
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const { getNameByCode: getIncidentAlertKindNameByCode } = useIncidentAlertKindOptions()
  const [countryValid, setCountryValid] = useState<boolean | null>(null)
  const [authorizedBodyCountryValid, setAuthorizedBodyCountryValid] = useState<boolean | null>(null)

  useEffect(() => {
    if (n.country) checkCountryExists(n.country).then(setCountryValid)
    if (n.authorizedBody?.country) checkCountryExists(n.authorizedBody.country).then(setAuthorizedBodyCountryValid)
  }, [n.country, n.authorizedBody?.country])

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateOnly = String(date).trim().slice(0, 10)
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
          <Tag color="red" style={{ marginRight: 8 }}>Не найдено в справочнике</Tag>
          {displayLabel}
        </span>
      )
    }
    return displayLabel
  }

  return (
    <div>
      <Descriptions column={1} bordered title="Уведомление о случае обнаружения болезни">
        <Descriptions.Item label="Страна">{renderCountry(n.country, countryValid)}</Descriptions.Item>
        <Descriptions.Item label="Регистрационный номер">{n.registrationNumber || '-'}</Descriptions.Item>
        <Descriptions.Item label="Вид">
          {n.type ? (getIncidentAlertKindNameByCode(n.type) ? `${n.type} — ${getIncidentAlertKindNameByCode(n.type)}` : n.type) : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Дата формирования">{formatDate(n.formationDate)}</Descriptions.Item>
        <Descriptions.Item label="Дата закрытия">{n.endDate ? formatDate(n.endDate) : '-'}</Descriptions.Item>
        <Descriptions.Item label="Уполномоченный орган">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Страна">{renderCountry(n.authorizedBody?.country ?? '', authorizedBodyCountryValid)}</Descriptions.Item>
            <Descriptions.Item label="Идентификатор">{n.authorizedBody?.identifier || '-'}</Descriptions.Item>
            <Descriptions.Item label="Наименование">{n.authorizedBody?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="Краткое наименование">{n.authorizedBody?.shortName || '-'}</Descriptions.Item>
          </Descriptions>
        </Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 16 }}>
        <Descriptions column={1} bordered title="Уведомления, являющиеся причиной обнаружения данного случая болезни">
          <Descriptions.Item label="Сведения">Данные будут добавлены по схеме PublicHealthAlert.</Descriptions.Item>
        </Descriptions>
      </div>
    </div>
  )
}

export default NotificationTab
