import { Button, Input, Select, Table } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { CardData } from '@/types/card'
import type { SanitaryMeasure } from '@/types/card'
import { useSanitaryMeasureOptions } from '@/hooks/shared/useSanitaryMeasureOptions'

interface SanitaryMeasuresTabEditProps {
  data: CardData
  onChange: (data: CardData) => void
}

/**
 * Редактирование санитарных мер PHA.
 * Добавление из справочника (SANITARYMEASURE, codeListId=1067) → сохраняется smsdo:MeasureCode.
 * Добавление произвольного текста → сохраняется smsdo:MeasureName.
 */
const SanitaryMeasuresTabEdit: React.FC<SanitaryMeasuresTabEditProps> = ({ data, onChange }) => {
  const { getSelectOptions, getNameByCode, loading } = useSanitaryMeasureOptions()
  const measures = data.measures?.measures ?? []

  const setMeasures = (next: SanitaryMeasure[]) => {
    onChange({ ...data, measures: { measures: next } })
  }

  const addFromDictionary = () => {
    setMeasures([...measures, { measureCode: '' }])
  }

  const addFreeText = () => {
    setMeasures([...measures, { measureName: '' }])
  }

  const remove = (index: number) => {
    setMeasures(measures.filter((_, i) => i !== index))
  }

  const update = (index: number, field: 'measureCode' | 'measureName', value: string) => {
    const next = [...measures]
    const item = next[index] ?? {}
    if (field === 'measureCode') {
      next[index] = { ...item, measureCode: value || undefined, measureName: undefined }
    } else {
      next[index] = { ...item, measureName: value || undefined, measureCode: undefined }
    }
    setMeasures(next)
  }

  const columns = [
    {
      title: 'Код меры',
      key: 'measureCode',
      width: 280,
      render: (_: unknown, record: SanitaryMeasure, index: number) => {
        if (record.measureName !== undefined && record.measureName !== null) {
          return '—'
        }
        return (
          <Select
            size="small"
            placeholder="Выберите меру из справочника"
            allowClear
            showSearch
            optionFilterProp="label"
            optionLabelProp="value"
            loading={loading}
            options={getSelectOptions()}
            value={record.measureCode || undefined}
            onChange={(v) => update(index, 'measureCode', v ?? '')}
            style={{ width: '100%' }}
          />
        )
      },
    },
    {
      title: 'Наименование меры',
      key: 'measureName',
      render: (_: unknown, record: SanitaryMeasure, index: number) => {
        if (record.measureCode !== undefined && record.measureCode !== null) {
          return getNameByCode(record.measureCode) ?? record.measureCode ?? '—'
        }
        return (
          <Input
            size="small"
            placeholder="Произвольное описание меры"
            value={record.measureName ?? ''}
            onChange={(e) => update(index, 'measureName', e.target.value)}
            allowClear
          />
        )
      },
    },
    {
      title: '',
      key: 'action',
      width: 56,
      render: (_: unknown, __: SanitaryMeasure, index: number) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => remove(index)} />
      ),
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addFromDictionary} style={{ marginRight: 8 }}>
          Добавить из справочника
        </Button>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addFreeText}>
          Добавить произвольное описание
        </Button>
      </div>
      <Table
        rowKey={(_, i) => String(i)}
        size="small"
        columns={columns}
        dataSource={measures}
        pagination={false}
        locale={{ emptyText: 'Нет мер. Добавьте из справочника или введите описание.' }}
      />
    </div>
  )
}

export default SanitaryMeasuresTabEdit
