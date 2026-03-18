import { Descriptions } from 'antd'
import type { CardData } from '@/types/card'

interface PatientGroupTabProps {
  data: CardData
}

/**
 * Группа пациентов — сведения по группам пациентов.
 */
const PatientGroupTab: React.FC<PatientGroupTabProps> = ({ data }) => {
  return (
    <Descriptions column={1} bordered>
      <Descriptions.Item label="Сведения о группах пациентов">
        Данные по схеме PublicHealthAlert будут добавлены при реализации парсера и формы.
      </Descriptions.Item>
    </Descriptions>
  )
}

export default PatientGroupTab
