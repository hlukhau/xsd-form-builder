import { Button, Space, Tooltip } from 'antd'
import { InfoCircleOutlined, DeleteOutlined, CopyOutlined } from '@ant-design/icons'
import type { CardData } from '@/types/card'
import type { StatusButtonConfig } from '@/utils/statusButtonConfig'

interface CardActionsProps {
  data: CardData
  onDefineAccess: () => void
  onOpenAllVersions: () => void
  /** Конфигурация кнопки смены статуса (название и действие по текущему статусу и правам) */
  statusButton: StatusButtonConfig | null
  /** Комментарий: при наличии кнопки — что она выполнит; при отсутствии — почему кнопки нет (для подсказки по иконке «i») */
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
  /** Отладочная кнопка: просмотр карты прав доступа по GUID */
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
  showCopyButton,
  onCopy,
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
        <Button size="small" onClick={onDefineAccess}>Определить доступ</Button>
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









