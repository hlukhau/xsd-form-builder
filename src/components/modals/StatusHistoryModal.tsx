import { Modal, Table, Button } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { StatusHistoryItem } from '@/types/card'

interface StatusHistoryModalProps {
  visible: boolean
  data: StatusHistoryItem[]
  onClose: () => void
}

const StatusHistoryModal: React.FC<StatusHistoryModalProps> = ({
  visible,
  data,
  onClose,
}) => {
  const columns = [
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
    },
    {
      title: 'Дата и время',
      dataIndex: 'dateTime',
      key: 'dateTime',
      render: (dateTime: string) => {
        if (!dateTime) return '-'
        const date = new Date(dateTime)
        if (isNaN(date.getTime())) return dateTime // Возвращаем исходное значение, если дата невалидна
        return format(date, 'dd.MM.yyyy HH:mm:ss', { locale: ru })
      },
    },
    {
      title: 'Сотрудник',
      dataIndex: 'employee',
      key: 'employee',
      render: (employee: string | null) => employee || '-',
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
      <Table
        dataSource={data}
        columns={columns}
        rowKey={(record, index) => index?.toString() || ''}
        pagination={false}
      />
    </Modal>
  )
}

export default StatusHistoryModal

