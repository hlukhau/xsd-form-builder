import { Modal, Descriptions, Button } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ElectronicDocument } from '@/types/card'

interface ElectronicDocumentModalProps {
  visible: boolean
  data: ElectronicDocument
  onClose: () => void
}

const ElectronicDocumentModal: React.FC<ElectronicDocumentModalProps> = ({
  visible,
  data,
  onClose,
}) => {
  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return '-'
    const date = new Date(dateTime)
    if (isNaN(date.getTime())) return dateTime // Возвращаем исходное значение, если дата невалидна
    return format(date, 'dd.MM.yyyy HH:mm:ss', { locale: ru })
  }

  const formatDate = (dateTime: string | null | undefined) => {
    if (!dateTime) return '-'
    const date = new Date(dateTime)
    if (isNaN(date.getTime())) return dateTime // Возвращаем исходное значение, если дата невалидна
    return format(date, 'dd.MM.yyyy', { locale: ru })
  }

  return (
    <Modal
      title="Электронный документ"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Закрыть
        </Button>,
      ]}
      width={800}
    >
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Код сообщения ОП">
          {data.messageCode}
        </Descriptions.Item>
        <Descriptions.Item label="Код электронного документа">
          {data.documentCode}
        </Descriptions.Item>
        <Descriptions.Item label="Идентификатор электронного документа">
          {data.documentId}
        </Descriptions.Item>
        <Descriptions.Item label="Дата электронного документа">
          {formatDate(data.documentDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Язык">{data.language}</Descriptions.Item>
        <Descriptions.Item label="Исходный электронный документ">
          {data.sourceDocumentId}
        </Descriptions.Item>
        <Descriptions.Item label="Действие записи общего ресурса. С">
          {data.validityPeriod.start || data.validityPeriod.end ? (
            <>
              {formatDateTime(data.validityPeriod.start)} по{' '}
              {formatDateTime(data.validityPeriod.end)}
            </>
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="Дата обновления записи общего ресурса">
          {formatDateTime(data.updateDateTime)}
        </Descriptions.Item>
      </Descriptions>
    </Modal>
  )
}

export default ElectronicDocumentModal

