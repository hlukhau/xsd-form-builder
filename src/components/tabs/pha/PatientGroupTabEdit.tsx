import { InputNumber, Select, Button, Table } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { CardData, PhaPatientGroupItem } from '@/types/card'
import { getFormatHint, validateFieldValue } from '@/constants/xsdFieldConstraints'
import { useAgeGroupOptions } from '@/hooks/shared/useAgeGroupOptions'
import { useDiseaseOutcomeOptions } from '@/hooks/shared/useDiseaseOutcomeOptions'

const LAB_OPTIONS = [
  { value: undefined, label: 'Не указано' },
  { value: 0, label: 'Нет' },
  { value: 1, label: 'Да' },
]

interface PatientGroupTabEditProps {
  data: CardData
  onChange: (data: CardData) => void
}

/**
 * Группа пациентов — редактирование (smcdo:PatientGroupDetails).
 * Справочники agegr и diseaseoutcome — при наличии бэкенда подставить выбор.
 */
const PatientGroupTabEdit: React.FC<PatientGroupTabEditProps> = ({ data, onChange }) => {
  const groups = data.phaPatientGroups ?? []
  const { getSelectOptions: getAgeGroupSelectOptions, loading: ageGroupLoading } = useAgeGroupOptions()
  const { getSelectOptions: getDiseaseOutcomeSelectOptions, loading: diseaseOutcomeLoading } = useDiseaseOutcomeOptions()

  const addGroup = () => {
    onChange({
      ...data,
      phaPatientGroups: [...groups, { personQuantity: '', laboratoryConfirmedIndicator: undefined }],
    })
  }
  const removeGroup = (index: number) => {
    onChange({ ...data, phaPatientGroups: groups.filter((_, i) => i !== index) })
  }
  const updateGroup = (index: number, field: keyof PhaPatientGroupItem, value: string | number | null | undefined) => {
    const next = [...groups]
    next[index] = { ...next[index], [field]: value }
    onChange({ ...data, phaPatientGroups: next })
  }

  return (
    <div>
      <Button type="dashed" icon={<PlusOutlined />} onClick={addGroup} style={{ marginBottom: 8 }}>
        Добавить группу пациентов
      </Button>
      {groups.length > 0 && (
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
              width: 140,
              render: (val: string, __, index) => {
                const raw = String(val ?? '').trim()
                const qtyErr = raw !== '' ? validateFieldValue('personQuantity', raw) : null
                const n =
                  raw === ''
                    ? undefined
                    : /^\d+$/.test(raw)
                      ? Math.min(9999, Math.max(1, parseInt(raw, 10)))
                      : undefined
                return (
                  <InputNumber
                    size="small"
                    min={1}
                    max={9999}
                    step={1}
                    controls
                    placeholder="Количество"
                    style={{ width: '100%' }}
                    status={qtyErr ? 'error' : undefined}
                    title={qtyErr ?? getFormatHint('personQuantity')}
                    value={n}
                    onChange={(v) => {
                      if (v == null || Number.isNaN(v)) updateGroup(index, 'personQuantity', '')
                      else updateGroup(index, 'personQuantity', String(Math.floor(Number(v))))
                    }}
                  />
                )
              },
            },
            {
              title: 'Возрастная группа',
              dataIndex: 'ageGroupCode',
              key: 'ageGroupCode',
              width: 220,
              render: (val: string, __, index) => (
                <Select
                  size="small"
                  placeholder="Справочник AGEGR"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={ageGroupLoading}
                  options={getAgeGroupSelectOptions()}
                  value={val || undefined}
                  onChange={(v) => updateGroup(index, 'ageGroupCode', v ?? '')}
                  style={{ width: '100%' }}
                />
              ),
            },
            {
              title: 'Исход болезни',
              dataIndex: 'diseaseOutcomeCode',
              key: 'diseaseOutcomeCode',
              width: 220,
              render: (val: string, __, index) => (
                <Select
                  size="small"
                  placeholder="Справочник DISEASEOUTCOME"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  loading={diseaseOutcomeLoading}
                  options={getDiseaseOutcomeSelectOptions()}
                  value={val || undefined}
                  onChange={(v) => updateGroup(index, 'diseaseOutcomeCode', v ?? '')}
                  style={{ width: '100%' }}
                />
              ),
            },
            {
              title: 'Лаб. подтверждение',
              dataIndex: 'laboratoryConfirmedIndicator',
              key: 'laboratoryConfirmedIndicator',
              width: 160,
              render: (val: 0 | 1 | null | undefined, __, index) => (
                <Select
                  size="small"
                  placeholder="Не указано"
                  allowClear
                  value={val ?? undefined}
                  onChange={(v) => updateGroup(index, 'laboratoryConfirmedIndicator', v === undefined ? undefined : (v as 0 | 1))}
                  options={LAB_OPTIONS}
                  style={{ width: '100%' }}
                />
              ),
            },
            {
              title: '',
              key: 'action',
              width: 56,
              render: (_, __, index) => (
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeGroup(index)} />
              ),
            },
          ]}
        />
      )}
    </div>
  )
}

export default PatientGroupTabEdit
