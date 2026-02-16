import { Button, Space, Tooltip } from 'antd'
import type { CardData } from '@/types/card'
import type { StatusButtonConfig } from '@/utils/statusButtonConfig'

interface CardActionsProps {
  data: CardData
  onDefineAccess: () => void
  onOpenAllVersions: () => void
  /** Конфигурация кнопки смены статуса (название и действие по текущему статусу и правам) */
  statusButton: StatusButtonConfig | null
  onStatusAction: (action: string) => void
  onElectronicDocumentClick: () => void
}

const CardActions: React.FC<CardActionsProps> = ({
  data,
  onDefineAccess,
  onOpenAllVersions,
  statusButton,
  onStatusAction,
  onElectronicDocumentClick,
}) => {
  const statusButtonNode = statusButton ? (
    statusButton.hint ? (
      <Tooltip title={statusButton.hint}>
        <span>
          <Button
            type="primary"
            disabled={statusButton.disabled}
            onClick={() => !statusButton.disabled && onStatusAction(statusButton.action)}
          >
            {statusButton.label}
          </Button>
        </span>
      </Tooltip>
    ) : (
      <Button type="primary" onClick={() => onStatusAction(statusButton.action)}>
        {statusButton.label}
      </Button>
    )
  ) : null

  return (
    <div style={{ marginBottom: '16px' }}>
      <Space>
        <Button onClick={onDefineAccess}>Определить доступ</Button>
        <Button onClick={onOpenAllVersions}>Открыть все версии</Button>
        {statusButtonNode}
        <a onClick={onElectronicDocumentClick} style={{ cursor: 'pointer' }}>
          Электронный документ
        </a>
      </Space>
    </div>
  )
}

export default CardActions









