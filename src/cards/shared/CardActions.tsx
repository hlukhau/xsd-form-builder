import { Button, Space, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import type { CardData } from '@/types/card'
import { visibleStatusButton, type StatusButtonConfig } from '@/utils/statusButtonConfig'

interface CardActionsProps {
  /** Не используется в разметке; оставлен для совместимости с картами DPA/PHA. */
  data?: CardData
  /** Определить доступ (DPA). При отсутствии кнопка не показывается. */
  onDefineAccess?: () => void
  /** DPA/PHA: открыть реестр всех версий по случаю. В PPV не используется — не передавать. */
  onOpenAllVersions?: () => void
  statusButton: StatusButtonConfig | null
  /** Подсказка к активной кнопке статуса (если у кнопки нет своего hint) */
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
  /** Кнопки сразу после кнопки смены статуса (например PPV: «Открыть ответ», «Подготовить ответ»). */
  nextToStatusButtons?: ReactNode
  onShowRightsDebug?: () => void
  /** Индикатор загрузки на кнопках смены статуса (основная и дополнительная). */
  statusButtonsLoading?: boolean
}

const CardActions: React.FC<CardActionsProps> = ({
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
  nextToStatusButtons,
  onShowRightsDebug,
  statusButtonsLoading,
}) => {
  const activeStatusButton = visibleStatusButton(statusButton)
  const activeCloseButton = visibleStatusButton(closeButton)

  const statusButtonNode = activeStatusButton ? (
    <Tooltip title={activeStatusButton.hint ?? statusButtonComment}>
      <Button
        size="small"
        type="primary"
        loading={statusButtonsLoading}
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
        loading={statusButtonsLoading}
        onClick={() => onStatusAction(activeCloseButton.action)}
      >
        {activeCloseButton.label}
      </Button>
    </Tooltip>
  ) : null

  return (
    <div style={{ marginTop: 0, marginBottom: 4 }} className="card-actions-row">
      <Space size="small" wrap>
        {onDefineAccess != null && (
          <Button size="small" onClick={onDefineAccess}>Определить доступ</Button>
        )}
        {onOpenAllVersions != null && (
          <Button size="small" onClick={onOpenAllVersions}>Открыть все версии</Button>
        )}
        {onShowRightsDebug && (
          <Tooltip title="Отладка: JSON карты прав доступа по текущему GUID">
            <Button size="small" onClick={onShowRightsDebug}>
              Просмотр прав
            </Button>
          </Tooltip>
        )}
        {statusButtonNode}
        {nextToStatusButtons}
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
