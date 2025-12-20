import { Descriptions } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { Notification } from '@/types/card'

interface NotificationTabProps {
  data: Notification
}

const NotificationTab: React.FC<NotificationTabProps> = ({ data }) => {
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date // Возвращаем исходное значение, если дата невалидна
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="Страна">{data.country}</Descriptions.Item>
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
            {data.authorizedBody.country}
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

