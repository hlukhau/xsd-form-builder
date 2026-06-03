import { Descriptions } from 'antd'
import type { CardData } from '@/types/card'
import { SanitaryMeasuresTab, SanitaryMeasuresTabEdit } from '@/components/tabs/pha'

interface SmdSanitaryMeasureTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
}

/**
 * Санитарная мера (smcdo:SanitaryMeasureDetails) — уведомление + перечень мер (как в PHA).
 */
const SmdSanitaryMeasureTab: React.FC<SmdSanitaryMeasureTabProps> = ({ data, editMode, onChange }) => {
  const n = data.notification
  return (
    <div>
      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Страна документа">{n?.country ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Номер документа">{n?.registrationNumber ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Дата документа">{n?.formationDate ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Вид сообщения">{data.electronicDocument?.messageCode ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Уполномоченный орган" span={2}>
          {n?.authorizedBody?.name ?? '—'}
        </Descriptions.Item>
      </Descriptions>
      {editMode && onChange ? (
        <SanitaryMeasuresTabEdit data={data} onChange={onChange} />
      ) : (
        <SanitaryMeasuresTab data={data} />
      )}
    </div>
  )
}

export default SmdSanitaryMeasureTab
