import { Descriptions, Table } from 'antd'
import type { CardData } from '@/types/card'
import { useAgeGroupOptions } from '@/hooks/shared/useAgeGroupOptions'
import { useDiseaseOutcomeOptions } from '@/hooks/shared/useDiseaseOutcomeOptions'

const LAB_INDICATOR_LABELS: Record<0 | 1 | null | undefined, string> = {
  0: 'Нет',
  1: 'Да',
  null: 'Не указано',
  undefined: 'Не указано',
}

interface PatientGroupTabProps {
  data: CardData
}

function formatCodeName(
  code: string | undefined,
  getName: (c: string | undefined) => string | null
): string {
  const c = (code ?? '').trim()
  if (!c) return '—'
  const name = getName(c)
  return name ? `${c} — ${name}` : c
}

/**
 * Группа пациентов — сведения по группам (R.SM.SS.08.001, smcdo:PatientGroupDetails).
 * Возрастная группа и исход болезни: при наличии справочников — «код — наименование».
 */
const PatientGroupTab: React.FC<PatientGroupTabProps> = ({ data }) => {
  const groups = data.phaPatientGroups ?? []
  const { getNameByCode: getAgeGroupNameByCode } = useAgeGroupOptions()
  const { getNameByCode: getDiseaseOutcomeNameByCode } = useDiseaseOutcomeOptions()

  const labDisplay = (v: 0 | 1 | null | undefined) => LAB_INDICATOR_LABELS[v ?? undefined]

  if (groups.length === 0) {
    return (
      <Descriptions column={1} bordered title="Группа пациентов">
        <Descriptions.Item label="Сведения">Нет данных о группах пациентов.</Descriptions.Item>
      </Descriptions>
    )
  }

  return (
    <div>
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
            render: (v: string) => formatCodeName(v, getAgeGroupNameByCode),
          },
          {
            title: 'Исход болезни',
            dataIndex: 'diseaseOutcomeCode',
            key: 'diseaseOutcomeCode',
            render: (v: string) => formatCodeName(v, getDiseaseOutcomeNameByCode),
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
