import { Modal, Table, Button, Spin } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { StatusHistoryItem } from '@/types/card'
import { DATE_TIME_DISPLAY_FORMAT_DATEFNS } from '@/constants/dateFormat'

interface StatusHistoryModalProps {
  visible: boolean
  data: StatusHistoryItem[]
  onClose: () => void
  loading?: boolean
}

const StatusHistoryModal: React.FC<StatusHistoryModalProps> = ({
  visible,
  data,
  onClose,
  loading = false,
}) => {
  const isResolution = (status: string | undefined) =>
    status != null && status.trim().toLowerCase().startsWith('резолюция')

  const columns = [
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) =>
        isResolution(status) ? (
          <span style={{ paddingLeft: 16, color: '#595959' }}>{status}</span>
        ) : (
          status
        ),
    },
    {
      title: 'Дата и время',
      dataIndex: 'dateTime',
      key: 'dateTime',
      render: (dateTime: string) => {
        if (!dateTime) return '-'
        const date = new Date(dateTime)
        if (isNaN(date.getTime())) return dateTime // Возвращаем исходное значение, если дата невалидна
        return format(date, DATE_TIME_DISPLAY_FORMAT_DATEFNS, { locale: ru })
      },
    },
    {
      title: 'Сотрудник',
      dataIndex: 'employee',
      key: 'employee',
      render: (employee: string | null) =>
        employee?.trim() ? employee : 'Автоматически',
    },
  ]

  return (
    <Modal
      title="История смены статусов"
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
          <Spin tip="Загрузка истории статусов..." />
        </div>
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey={(record, index) => index?.toString() || ''}
          pagination={false}
          rowClassName={(record) =>
            isResolution(record.status) ? 'status-history-modal-resolution-row' : ''
          }
        />
      )}
    </Modal>
  )
}

export default StatusHistoryModal

