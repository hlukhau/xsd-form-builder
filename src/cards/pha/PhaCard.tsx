import { Card, Tabs } from 'antd'
import type { CardData } from '@/types/card'
import { CardHeader } from '@/cards/shared'
import {
  NotificationTab,
  DiseaseTab,
  PatientGroupTab,
  DetectionPlaceTab,
  SpreadZoneTab,
  SanitaryMeasuresTab,
} from '@/components/tabs/pha'

interface PhaCardProps {
  data: CardData
  phaid?: string
  guid?: string
}

const PHA_TABS = [
  { key: 'notification', label: 'Уведомление', children: NotificationTab },
  { key: 'disease', label: 'Болезнь', children: DiseaseTab },
  { key: 'patientGroup', label: 'Группа пациентов', children: PatientGroupTab },
  { key: 'detectionPlace', label: 'Место обнаружения', children: DetectionPlaceTab },
  { key: 'spreadZone', label: 'Зона распространения', children: SpreadZoneTab },
  { key: 'sanitaryMeasures', label: 'Санитарные меры', children: SanitaryMeasuresTab },
]

/**
 * Карта сведений об обнаружении болезней (PHA).
 * Тело карты — вкладки: Уведомление, Болезнь, Группа пациентов, Место обнаружения, Зона распространения, Санитарные меры.
 */
const PhaCard: React.FC<PhaCardProps> = ({ data, phaid, guid }) => {
  return (
    <Card
      title={phaid ? `Карта сведений об обнаружении болезней ${phaid}` : 'Карта сведений об обнаружении болезней'}
      className="pha-card"
    >
      <CardHeader data={data} onStatusClick={() => {}} />
      <Tabs
        style={{ marginTop: 16 }}
        items={PHA_TABS.map(({ key, label, children: TabComponent }) => ({
          key,
          label,
          children: <TabComponent data={data} />,
        }))}
      />
    </Card>
  )
}

export default PhaCard
