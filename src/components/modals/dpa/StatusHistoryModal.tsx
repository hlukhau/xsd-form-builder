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
  /** Заголовок модального окна */
  title?: string
  /**
   * Если true — при отсутствии сотрудника (автоматическая смена статуса / резолюция) ячейка пустая.
   * Если false (по умолчанию) — показывается «Автоматически» (как для DPA/PPV).
   */
  hideEmployeeWhenMissing?: boolean
  /** Подпись колонки сотрудника (например, для DPR: ФИО / код) */
  employeeColumnTitle?: string
}

const StatusHistoryModal: React.FC<StatusHistoryModalProps> = ({
  visible,
  data,
  onClose,
  loading = false,
  title = 'История смены статусов',
  hideEmployeeWhenMissing = false,
  employeeColumnTitle = 'Сотрудник',
}) => {
  const isResolution = (status: string | undefined) => {
    const t = (status ?? '').trim().toLowerCase()
    return t.startsWith('резолюция')
  }

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
      title: employeeColumnTitle,
      dataIndex: 'employee',
      key: 'employee',
      render: (employee: string | null) => {
        if (employee?.trim()) return employee.trim()
        if (hideEmployeeWhenMissing) return ''
        return 'Автоматически'
      },
    },
  ]

  return (
    <Modal
      title={title}
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

