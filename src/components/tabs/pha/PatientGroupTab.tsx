import { Descriptions, Table } from 'antd'
import type { CardData, PhaPatientGroupItem } from '@/types/card'

const LAB_INDICATOR_LABELS: Record<0 | 1 | null | undefined, string> = {
  0: 'Нет',
  1: 'Да',
  null: 'Не указано',
  undefined: 'Не указано',
}

interface PatientGroupTabProps {
  data: CardData
}

/**
 * Группа пациентов — сведения по группам (R.SM.SS.08.001, smcdo:PatientGroupDetails).
 * Возрастная группа и исход болезни: при наличии справочников — «код — наименование».
 */
const PatientGroupTab: React.FC<PatientGroupTabProps> = ({ data }) => {
  const groups = data.phaPatientGroups ?? []

  const ageGroupDisplay = (code: string | undefined) => {
    if (!code) return '—'
    return code
  }
  const outcomeDisplay = (code: string | undefined) => {
    if (!code) return '—'
    return code
  }
  const labDisplay = (v: 0 | 1 | null | undefined) => LAB_INDICATOR_LABELS[v ?? undefined]

  if (groups.length === 0) {
    return (
      <Descriptions column={1} bordered title="Группа пациентов (smcdo:PatientGroupDetails)">
        <Descriptions.Item label="Сведения">Нет данных о группах пациентов.</Descriptions.Item>
      </Descriptions>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 8, fontSize: 12, color: '#8c8c8c' }}>
        Количество человек — smsdo:PersonQuantity. Возрастная группа — smsdo:AgeGroupCode (справочник agegr). Исход болезни — smsdo:DiseaseOutcomeCode (справочник diseaseoutcome). Наличие лабораторного подтверждения — smsdo:LaboratoryConfirmedIndicator (0 — Нет, 1 — Да, не указано — Не указано).
      </div>
      <Table
        size="small"
        rowKey={(_, i) => String(i)}
        dataSource={groups}
        pagination={false}
        columns={[
          {
            title: 'Количество человек',
            dataIndex: 'personQuantity',
            key: 'personQuantity',
            render: (v: string) => v ?? '—',
          },
          {
            title: 'Возрастная группа',
            dataIndex: 'ageGroupCode',
            key: 'ageGroupCode',
            render: (v: string) => ageGroupDisplay(v),
          },
          {
            title: 'Исход болезни',
            dataIndex: 'diseaseOutcomeCode',
            key: 'diseaseOutcomeCode',
            render: (v: string) => outcomeDisplay(v),
          },
          {
            title: 'Наличие лабораторного подтверждения',
            dataIndex: 'laboratoryConfirmedIndicator',
            key: 'laboratoryConfirmedIndicator',
            render: (v: 0 | 1 | null | undefined) => labDisplay(v),
          },
        ]}
      />
    </div>
  )
}

export default PatientGroupTab
