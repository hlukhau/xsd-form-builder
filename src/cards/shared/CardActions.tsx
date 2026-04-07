import { Button, Space, Tooltip } from 'antd'
import { InfoCircleOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import type { CardData } from '@/types/card'
import type { StatusButtonConfig } from '@/utils/statusButtonConfig'

interface CardActionsProps {
  data: CardData
  /** Определить доступ (DPA). При отсутствии кнопка не показывается. */
  onDefineAccess?: () => void
  onOpenAllVersions: () => void
  statusButton: StatusButtonConfig | null
  statusButtonComment?: string
  closeButton?: StatusButtonConfig | null
  onStatusAction: (action: string) => void
  onElectronicDocumentClick: () => void
  showDeleteButton?: boolean
  onDelete?: () => void
  /** Показывать «Удалить» как неактивную и дать причину блокировки. */
  deleteButtonDisabled?: boolean
  deleteButtonHint?: string
  showCopyButton?: boolean
  onCopy?: () => void
  /** Неактивна (например, пока проверка API или условия не выполнены) — title с причиной. */
  copyButtonDisabled?: boolean
  copyButtonHint?: string
  onShowRightsDebug?: () => void
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
  deleteButtonDisabled,
  deleteButtonHint,
  showCopyButton,
  onCopy,
  copyButtonDisabled,
  copyButtonHint,
  onShowRightsDebug,
}) => {
  const statusButtonNode = statusButton ? (
    <Tooltip title={statusButton.hint ?? statusButtonComment}>
      <span>
        <Button
          size="small"
          type="primary"
          disabled={statusButton.disabled}
          onClick={() => !statusButton.disabled && onStatusAction(statusButton.action)}
        >
          {statusButton.label}
        </Button>
      </span>
    </Tooltip>
  ) : statusButtonComment ? (
    <Tooltip title={statusButtonComment}>
      <span style={{ display: 'inline-flex', alignItems: 'center', color: '#8c8c8c' }}>
        <InfoCircleOutlined style={{ fontSize: 14 }} />
        <span style={{ marginLeft: 4, fontSize: 12 }}>Смена статуса</span>
      </span>
    </Tooltip>
  ) : null

  const closeButtonNode = closeButton ? (
    <Tooltip title={closeButton.hint}>
      <span>
        <Button
          size="small"
          disabled={closeButton.disabled}
          onClick={() => !closeButton.disabled && onStatusAction(closeButton.action)}
        >
          {closeButton.label}
        </Button>
      </span>
    </Tooltip>
  ) : null

  return (
    <div style={{ marginTop: 0, marginBottom: 4 }} className="card-actions-row">
      <Space size="small" wrap>
        {onDefineAccess != null && (
          <Button size="small" onClick={onDefineAccess}>Определить доступ</Button>
        )}
        <Button size="small" onClick={onOpenAllVersions}>Открыть все версии</Button>
        {onShowRightsDebug && (
          <Tooltip title="Отладка: JSON карты прав доступа по текущему GUID">
            <Button size="small" onClick={onShowRightsDebug}>
              Просмотр прав
            </Button>
          </Tooltip>
        )}
        {statusButtonNode}
        {closeButtonNode}
        {showDeleteButton && (
          <Tooltip title={deleteButtonHint}>
            <span>
              <Button
                size="small"
                type="primary"
                danger
                icon={<DeleteOutlined />}
                disabled={deleteButtonDisabled}
                onClick={() => !deleteButtonDisabled && onDelete?.()}
              >
                Удалить
              </Button>
            </span>
          </Tooltip>
        )}
        {showCopyButton && onCopy && (
          <Tooltip title={copyButtonHint}>
            <span>
              <Button
                size="small"
                icon={<CopyOutlined />}
                disabled={copyButtonDisabled}
                onClick={() => !copyButtonDisabled && onCopy()}
              >
                Создать новую версию
              </Button>
            </span>
          </Tooltip>
        )}
        <a onClick={onElectronicDocumentClick} style={{ cursor: 'pointer', fontSize: 13 }}>
          Электронный документ
        </a>
      </Space>
    </div>
  )
}

export default CardActions
