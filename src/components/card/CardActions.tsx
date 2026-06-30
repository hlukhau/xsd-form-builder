import { Button, Space, Tooltip } from 'antd'
import { DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import type { CardData } from '@/types/card'
import { visibleStatusButton, type StatusButtonConfig } from '@/utils/statusButtonConfig'

interface CardActionsProps {
  data: CardData
  onDefineAccess: () => void
  onOpenAllVersions: () => void
  /** Конфигурация кнопки смены статуса (название и действие по текущему статусу и правам) */
  statusButton: StatusButtonConfig | null
  /** Подсказка к кнопке статуса, если у конфигурации нет hint */
  statusButtonComment?: string
  /** Вторая кнопка (например «Закрытие карты»), когда допустимы оба действия */
  closeButton?: StatusButtonConfig | null
  onStatusAction: (action: string) => void
  onElectronicDocumentClick: () => void
  /** Показать кнопку «Удалить» (исходящая карта в статусе Черновик при наличии права редактирования) */
  showDeleteButton?: boolean
  onDelete?: () => void
  /** Показать кнопку «Сделать копию» (исходящая карта в статусе Доставлено при наличии права редактирования) */
  showCopyButton?: boolean
  onCopy?: () => void
}

const CardActions: React.FC<CardActionsProps> = ({
  data,
  onDefineAccess,
  onOpenAllVersions,
  statusButton,
  statusButtonComment,
  closeButton,
  onStatusAction,
  onElectronicDocumentClick,
  showDeleteButton,
  onDelete,
  showCopyButton,
  onCopy,
}) => {
  const activeStatusButton = visibleStatusButton(statusButton)
  const activeCloseButton = visibleStatusButton(closeButton)

  const statusButtonNode = activeStatusButton ? (
    <Tooltip title={activeStatusButton.hint ?? statusButtonComment}>
      <Button
        size="small"
        type="primary"
        onClick={() => onStatusAction(activeStatusButton.action)}
      >
        {activeStatusButton.label}
      </Button>
    </Tooltip>
  ) : null

  const closeButtonNode = activeCloseButton ? (
    <Tooltip title={activeCloseButton.hint}>
      <Button
        size="small"
        onClick={() => onStatusAction(activeCloseButton.action)}
      >
        {activeCloseButton.label}
      </Button>
    </Tooltip>
  ) : null

  return (
    <div style={{ marginTop: 0, marginBottom: 4 }} className="card-actions-row">
      <Space size="small" wrap>
        <Button size="small" onClick={onDefineAccess}>Определить доступ</Button>
        <Button size="small" onClick={onOpenAllVersions}>Открыть все версии</Button>
        {statusButtonNode}
        {closeButtonNode}
        {showDeleteButton && onDelete && (
          <Button size="small" type="primary" danger icon={<DeleteOutlined />} onClick={onDelete}>
            Удалить
          </Button>
        )}
        {showCopyButton && onCopy && (
          <Button size="small" icon={<CopyOutlined />} onClick={onCopy}>
            Сделать копию
          </Button>
        )}
        <a onClick={onElectronicDocumentClick} style={{ cursor: 'pointer', fontSize: 13 }}>
          Электронный документ
        </a>
      </Space>
    </div>
  )
}

export default CardActions









