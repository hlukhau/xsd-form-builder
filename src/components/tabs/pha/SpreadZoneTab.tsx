import { Descriptions } from 'antd'
import type { CardData } from '@/types/card'

interface SpreadZoneTabProps {
  data: CardData
}

/**
 * Зона распространения — сведения по зонам распространения болезни.
 */
const SpreadZoneTab: React.FC<SpreadZoneTabProps> = ({ data }) => {
  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="Сведения о зонах распространения">
        Данные по схеме PublicHealthAlert будут добавлены при реализации парсера и формы.
      </Descriptions.Item>
    </Descriptions>
  )
}

export default SpreadZoneTab
