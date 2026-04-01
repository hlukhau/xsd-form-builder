import { Descriptions } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CardData } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { DATE_TIME_DISPLAY_FORMAT_DATEFNS } from '@/constants/dateFormat'

interface CardHeaderProps {
  data: CardData
  onStatusClick: () => void
}

const CardHeader: React.FC<CardHeaderProps> = ({ data, onStatusClick }) => {
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return '-'
    const date = new Date(dateTime)
    if (isNaN(date.getTime())) return dateTime // Возвращаем исходное значение, если дата невалидна
    return format(date, DATE_TIME_DISPLAY_FORMAT_DATEFNS, { locale: ru })
  }

  return (
    <Descriptions
      column={{ xxl: 4, xl: 4, lg: 4, md: 3, sm: 2, xs: 1 }}
      bordered
      size="small"
      style={{ margin: 0 }}
      className="card-header-descriptions"
    >
      <Descriptions.Item label="Регистрационный номер">
        {data.registrationNumber || '—'}
      </Descriptions.Item>
      <Descriptions.Item label="Страна">{getCountryDisplayLabel(data.country)}</Descriptions.Item>
      <Descriptions.Item label="Версия">{data.version ?? '—'}</Descriptions.Item>
      {!data.source?.includes('ЕЭК') ? (
        <Descriptions.Item label="Статус">
          <a onClick={onStatusClick} style={{ cursor: 'pointer' }}>
            {data.status || '—'}
          </a>
        </Descriptions.Item>
      ) : (
        <Descriptions.Item label="Статус">—</Descriptions.Item>
      )}
      <Descriptions.Item label="Источник">{data.source || '-'}</Descriptions.Item>
      <Descriptions.Item label="Дата создания">
        {formatDateTime(data.createdAt)}
      </Descriptions.Item>
      <Descriptions.Item label="Дата изменения">
        {formatDateTime(data.modifiedAt)}
      </Descriptions.Item>
    </Descriptions>
  )
}

export default CardHeader

