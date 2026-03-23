import { Descriptions, Tag, Table } from 'antd'
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
 * Уведомление PHA (R.SM.SS.08.001):
 * - smcdo:PublicHealthAlertDetails — уведомление о случае обнаружения болезни (страна, рег. номер, вид, даты, УО).
 * - smcdo:IncidentAlertIdDetails — уведомления, являющиеся причиной данного случая (справочник incidentalertkind: 1,2,3,4,7,8,10,11,13,14,16,17,19).
 */
const NotificationTab: React.FC<NotificationTabProps> = ({ data }) => {
  const n = data.notification
  const causeList = data.phaCauseNotifications ?? []
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

  const kindLabel = (code: string) =>
    code ? (getIncidentAlertKindNameByCode(code) ? `${code} — ${getIncidentAlertKindNameByCode(code)}` : code) : '-'

  const version = data.version ?? 1
  const infectiousFlag = data.phaFirstDiseaseInfectiousFlag

  return (
    <div>
      <Descriptions column={1} bordered title="Уведомление о случае обнаружения болезни">
        <Descriptions.Item label="Страна">{renderCountry(n.country, countryValid)}</Descriptions.Item>
        <Descriptions.Item label="Регистрационный номер">{n.registrationNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="Вид">
          {kindLabel(n.type)}
          {version > 1 && infectiousFlag != null && (
            <span>
              {' '}
              (признак болезни: {infectiousFlag === 1 ? 'инфекционная' : 'неинфекционная'})
            </span>
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Дата формирования">{formatDate(n.formationDate)}</Descriptions.Item>
        <Descriptions.Item label="Дата закрытия">{n.endDate ? formatDate(n.endDate) : '—'}</Descriptions.Item>
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
        <div style={{ marginBottom: 8 }}>
          <strong>Информация по уведомлениям, являющимся причиной</strong>
        </div>
        {causeList.length > 0 ? (
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={causeList}
            columns={[
              { title: 'Страна', dataIndex: 'country', key: 'country', render: (c: string) => getCountryDisplayLabel(c) || c || '-' },
              { title: 'Регистрационный номер', dataIndex: 'registrationNumber', key: 'registrationNumber' },
              { title: 'Вид', dataIndex: 'type', key: 'type', render: (t: string) => kindLabel(t) },
              { title: 'Дата формирования', dataIndex: 'formationDate', key: 'formationDate', render: (d: string) => formatDate(d) },
            ]}
            pagination={false}
          />
        ) : (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Сведения">Нет данных.</Descriptions.Item>
          </Descriptions>
        )}
      </div>
    </div>
  )
}

export default NotificationTab
