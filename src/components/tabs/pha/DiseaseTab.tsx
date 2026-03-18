import { Descriptions } from 'antd'
import type { CardData } from '@/types/card'

interface DiseaseTabProps {
  data: CardData
}

/**
 * Болезнь — общие данные по болезни.
 */
const DiseaseTab: React.FC<DiseaseTabProps> = ({ data }) => {
  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="Сведения о болезни">
        Данные по схеме EEC_R_SM_SS_08_PublicHealthAlert_v1.0.0 будут добавлены при реализации парсера и формы.
      </Descriptions.Item>
    </Descriptions>
  )
}

export default DiseaseTab
