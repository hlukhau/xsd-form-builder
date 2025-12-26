import { Button, Space } from 'antd'
import type { CardData } from '@/types/card'

interface CardActionsProps {
  data: CardData
  onDefineAccess: () => void
  onOpenAllVersions: () => void
  onCompleteProcessing: () => void
  onElectronicDocumentClick: () => void
}

const CardActions: React.FC<CardActionsProps> = ({
  data,
  onDefineAccess,
  onOpenAllVersions,
  onCompleteProcessing,
  onElectronicDocumentClick,
}) => {
  // Логика отображения кнопок в зависимости от статуса и прав
  const showCompleteProcessing = 
    data.source === 'входящие' && 
    data.status === 'в обработке'

  return (
    <div style={{ marginBottom: '16px' }}>
      <Space>
        <Button onClick={onDefineAccess}>Определить доступ</Button>
        <Button onClick={onOpenAllVersions}>Открыть все версии</Button>
        {showCompleteProcessing && (
          <Button type="primary" onClick={onCompleteProcessing}>
            Завершить обработку
          </Button>
        )}
        <a onClick={onElectronicDocumentClick} style={{ cursor: 'pointer' }}>
          Электронный документ
        </a>
      </Space>
    </div>
  )
}

export default CardActions






