import { useMemo } from 'react'
import { Modal, Button, Table, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ElectronicDocument } from '@/types/card'
import { DATE_TIME_DISPLAY_FORMAT_DATEFNS } from '@/constants/dateFormat'

interface ElectronicDocumentModalProps {
  visible: boolean
  /** Один документ (из XML/карточки) или несколько (из БД по DPAID) */
  data: ElectronicDocument | ElectronicDocument[]
  onClose: () => void
  loading?: boolean
}

const formatDateTimeUi = (dateTime: string | null | undefined): string => {
  if (!dateTime) return ''
  const date = new Date(dateTime)
  if (isNaN(date.getTime())) return dateTime
  return format(date, DATE_TIME_DISPLAY_FORMAT_DATEFNS, { locale: ru })
}

const ElectronicDocumentModal: React.FC<ElectronicDocumentModalProps> = ({
  visible,
  data,
  onClose,
  loading = false,
}) => {
  const list = Array.isArray(data) ? data : [data]

  const sortedRows = useMemo(() => {
    const withKey = list.map((doc, i) => ({ ...doc, _key: `${doc.documentId || i}-${i}` }))
    return [...withKey].sort((a, b) => {
      const ta = a.documentDate ? new Date(a.documentDate).getTime() : 0
      const tb = b.documentDate ? new Date(b.documentDate).getTime() : 0
      return tb - ta
    })
  }, [list])

  const columns: ColumnsType<ElectronicDocument & { _key: string }> = [
    {
      title: 'Дата и время создания электронного документа',
      key: 'documentDate',
      width: 200,
      render: (_, row) => formatDateTimeUi(row.documentDate) || '',
    },
    {
      title: 'Код сообщения ОП',
      dataIndex: 'messageCode',
      key: 'messageCode',
      width: 160,
      ellipsis: true,
      render: (t: string) => t || '',
    },
    {
      title: 'Код электронного документа',
      dataIndex: 'documentCode',
      key: 'documentCode',
      width: 160,
      ellipsis: true,
      render: (t: string) => t || '',
    },
    {
      title: 'Идентификатор электронного документа',
      dataIndex: 'documentId',
      key: 'documentId',
      width: 280,
      ellipsis: true,
      render: (t: string) => t || '',
    },
    {
      title: 'Идентификатор исходного электронного документа',
      dataIndex: 'sourceDocumentId',
      key: 'sourceDocumentId',
      width: 280,
      ellipsis: true,
      render: (t: string) => t || '',
    },
    {
      title: 'Язык',
      dataIndex: 'language',
      key: 'language',
      width: 160,
      ellipsis: true,
      render: (t: string) => t || '',
    },
    {
      title: 'Действие записи общего ресурса. С',
      key: 'validityStart',
      width: 200,
      render: (_, row) => formatDateTimeUi(row.validityPeriod?.start) || '',
    },
    {
      title: 'Действие записи общего ресурса. По',
      key: 'validityEnd',
      width: 200,
      render: (_, row) => formatDateTimeUi(row.validityPeriod?.end) || '',
    },
    {
      title: 'Дата обновления записи общего ресурса',
      key: 'updateDateTime',
      width: 220,
      render: (_, row) => formatDateTimeUi(row.updateDateTime) || '',
    },
  ]

  return (
    <Modal
      title="Сведения об электронных документах"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          Закрыть
        </Button>,
      ]}
      width="min(1200px, 96vw)"
      styles={{ body: { maxHeight: '70vh', overflow: 'auto' } }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spin tip="Загрузка сведений об электронных документах..." />
        </div>
      ) : sortedRows.length === 0 ? (
        <div style={{ color: '#8c8c8c' }}>
          Нет данных об электронных документах (исходящие сведения могут не содержать документ до отправки).
        </div>
      ) : (
        <Table<ElectronicDocument & { _key: string }>
          columns={columns}
          dataSource={sortedRows}
          rowKey="_key"
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 'max-content' }}
        />
      )}
    </Modal>
  )
}

export default ElectronicDocumentModal
