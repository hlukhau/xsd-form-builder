import { Descriptions } from 'antd'
import type { CardData } from '@/types/card'

interface SanitaryMeasuresTabProps {
  data: CardData
}

/**
 * Санитарные меры — сведения о принятых санитарных мерах.
 */
const SanitaryMeasuresTab: React.FC<SanitaryMeasuresTabProps> = ({ data }) => {
  const measures = data.measures
  return (
    <Descriptions column={1} bordered>
      {measures?.measures?.length ? (
        <>
          <Descriptions.Item label="Количество мероприятий">{measures.measures.length}</Descriptions.Item>
          {measures.measures.map((m, idx) => (
            <Descriptions.Item key={idx} label={`Мероприятие ${idx + 1}`}>
              {m.measureName ?? m.measureCode ?? '-'}
            </Descriptions.Item>
          ))}
        </>
      ) : (
        <Descriptions.Item label="Сведения о санитарных мерах">
          Данные по схеме PublicHealthAlert будут добавлены при реализации парсера и формы.
        </Descriptions.Item>
      )}
    </Descriptions>
  )
}

export default SanitaryMeasuresTab
