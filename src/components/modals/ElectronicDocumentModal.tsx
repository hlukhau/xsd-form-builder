import { useState } from 'react'
import { Modal, Descriptions, Button, Select, Spin } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ElectronicDocument } from '@/types/card'

interface ElectronicDocumentModalProps {
  visible: boolean
  /** Один документ (из XML/карточки) или несколько (из БД по DPAID) */
  data: ElectronicDocument | ElectronicDocument[]
  onClose: () => void
  loading?: boolean
}

const ElectronicDocumentModal: React.FC<ElectronicDocumentModalProps> = ({
  visible,
  data,
  onClose,
  loading = false,
}) => {
  const list = Array.isArray(data) ? data : [data]
  const [selectedIndex, setSelectedIndex] = useState(0)
  const current = list[selectedIndex]

  const formatDateTime = (dateTime: string | null | undefined) => {
    if (!dateTime) return '-'
    const date = new Date(dateTime)
    if (isNaN(date.getTime())) return dateTime
    return format(date, 'dd.MM.yyyy HH:mm:ss', { locale: ru })
  }

  const formatDate = (dateTime: string | null | undefined) => {
    if (!dateTime) return '-'
    const date = new Date(dateTime)
    if (isNaN(date.getTime())) return dateTime
    return format(date, 'dd.MM.yyyy', { locale: ru })
  }

  return (
    <Modal
      title="Просмотр сведений о соответствующем электронном документе и записи общего ресурса"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Закрыть
        </Button>,
      ]}
      width={800}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="Загрузка сведений об электронных документах..." />
        </div>
      ) : list.length === 0 ? (
        <div style={{ color: '#8c8c8c' }}>Нет данных об электронных документах (исходящие сведения могут не содержать документ до отправки).</div>
      ) : (
        <>
          {list.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <span style={{ marginRight: 8 }}>Электронный документ:</span>
              <Select
                value={selectedIndex}
                onChange={setSelectedIndex}
                options={list.map((doc, i) => ({
                  label: `${doc.documentCode || doc.documentId || 'Документ'} ${i + 1}`,
                  value: i,
                }))}
                style={{ minWidth: 280 }}
              />
            </div>
          )}
          {current && (
            <Descriptions column={1} bordered>
              <Descriptions.Item label="Код сообщения ОП">{current.messageCode ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Код электронного документа">{current.documentCode ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Идентификатор электронного документа">{current.documentId ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Дата электронного документа">{formatDate(current.documentDate)}</Descriptions.Item>
              <Descriptions.Item label="Язык">{current.language ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Исходный электронный документ">{current.sourceDocumentId ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Действие записи общего ресурса. С">
                {current.validityPeriod?.start || current.validityPeriod?.end ? (
                  <>
                    {formatDateTime(current.validityPeriod.start)} по {formatDateTime(current.validityPeriod.end)}
                  </>
                ) : (
                  '-'
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Дата обновления записи общего ресурса">
                {formatDateTime(current.updateDateTime)}
              </Descriptions.Item>
            </Descriptions>
          )}
        </>
      )}
    </Modal>
  )
}

export default ElectronicDocumentModal

