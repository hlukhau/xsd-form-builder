import { Form, Input, DatePicker, Select, Button, Table } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { CardData, PhaDiseaseDetails, PhaPathogenDetails } from '@/types/card'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import { getMaxLength, getFormatHint } from '@/constants/xsdFieldConstraints'
import { useDiseaseHealthProblemOptions } from '@/hooks/shared/useDiseaseHealthProblemOptions'
import { usePathogenKindOptions } from '@/hooks/shared/usePathogenKindOptions'

/** Отображение риска трансграничного распространения: 0 — Нет, 1 — Да, null — Не указано. */
const CROSSBORDER_OPTIONS = [
  { value: null, label: 'Не указано' },
  { value: 0, label: 'Нет' },
  { value: 1, label: 'Да' },
]

interface DiseaseTabEditProps {
  data: CardData
  onChange: (data: CardData) => void
}

/**
 * Болезнь — редактирование (R.SM.SS.08.001).
 * Наименование болезни редактируется только для версии = 1. Справочники diseasehealthproblem и pathogenkind — при наличии бэкенда.
 */
const DiseaseTabEdit: React.FC<DiseaseTabEditProps> = ({ data, onChange }) => {
  const d = data.phaDisease ?? ({} as PhaDiseaseDetails)
  const version = data.version ?? 1
  const isVersion1 = version === 1
  const kind = (data.notification?.type ?? '').trim()
  const pathogens = d.pathogens ?? []
  const { getSelectOptions: getDiseaseSelectOptions, loading: diseaseOptionsLoading } = useDiseaseHealthProblemOptions()
  const diseaseOptionsRaw = getDiseaseSelectOptions() as Array<{ value: string; label: string; infectFl?: number | null }>
  const diseaseOptions = isVersion1
    ? diseaseOptionsRaw.filter((o) => {
        if (kind === '1') return o.infectFl === 1
        if (kind === '2') return o.infectFl === 0
        return true
      })
    : diseaseOptionsRaw
  const { getSelectOptions: getPathogenKindSelectOptions, loading: pathogenKindLoading } = usePathogenKindOptions()

  const updateDisease = (partial: Partial<PhaDiseaseDetails>) => {
    onChange({
      ...data,
      phaDisease: { ...d, ...partial },
    })
  }

  const setDiseaseField = <K extends keyof PhaDiseaseDetails>(key: K, value: PhaDiseaseDetails[K]) => {
    updateDisease({ [key]: value })
  }

  const addPathogen = () => {
    updateDisease({ pathogens: [...pathogens, {}] })
  }
  const removePathogen = (index: number) => {
    updateDisease({ pathogens: pathogens.filter((_, i) => i !== index) })
  }
  const updatePathogen = (index: number, field: keyof PhaPathogenDetails, value: string) => {
    const next = [...pathogens]
    next[index] = { ...next[index], [field]: value }
    updateDisease({ pathogens: next })
  }

  return (
    <div>
      <Form layout="vertical" className="field-tag-form">
        <Form.Item label="Код болезни">
          <Input disabled value="—" />
        </Form.Item>
        <Form.Item label="Наименование болезни">
          {isVersion1 ? (
            <Select
              showSearch
              allowClear
              placeholder="Выберите болезнь из справочника"
              loading={diseaseOptionsLoading}
              optionFilterProp="label"
              options={diseaseOptions}
              value={d.diseaseName ?? undefined}
              onChange={(v) => setDiseaseField('diseaseName', (v ?? '') as string)}
            />
          ) : (
            <Input
              placeholder="Наименование болезни"
              value={d.diseaseName ?? ''}
              disabled
            />
          )}
        </Form.Item>
        <Form.Item label="Дата первого случая">
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            style={{ width: '100%' }}
            value={d.firstCaseDate?.trim().slice(0, 10) ? dayjs(d.firstCaseDate.slice(0, 10)) : null}
            onChange={(date) => setDiseaseField('firstCaseDate', date ? date.format('YYYY-MM-DD') : '')}
          />
        </Form.Item>
        <Form.Item label="Дата последнего случая">
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            style={{ width: '100%' }}
            allowClear
            value={d.lastCaseDate?.trim().slice(0, 10) ? dayjs(d.lastCaseDate.slice(0, 10)) : null}
            onChange={(date) => setDiseaseField('lastCaseDate', date ? date.format('YYYY-MM-DD') : '')}
          />
        </Form.Item>
        <Form.Item label="Риск трансграничного распространения">
          <Select
            placeholder="Не указано"
            allowClear
            value={d.crossborderSpreadRiskIndicator ?? null}
            onChange={(v) => setDiseaseField('crossborderSpreadRiskIndicator', v === null || v === undefined ? undefined : (v as 0 | 1))}
            options={CROSSBORDER_OPTIONS}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>

      <div style={{ marginTop: 24 }}>
        <h4>Возбудитель</h4>
        <Button type="dashed" icon={<PlusOutlined />} onClick={addPathogen} style={{ marginBottom: 8 }}>
          Добавить возбудитель
        </Button>
        {pathogens.length > 0 && (
          <Table
            size="small"
            rowKey={(_, i) => String(i)}
            dataSource={pathogens}
            pagination={false}
            columns={[
              {
                title: 'Тип',
                dataIndex: 'pathogenKindName',
                key: 'pathogenKindName',
                render: (val: string, __, index) => (
                  <Select
                    size="small"
                    placeholder="Тип возбудителя"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={pathogenKindLoading}
                    options={getPathogenKindSelectOptions()}
                    value={val || undefined}
                    onChange={(v) => updatePathogen(index, 'pathogenKindName', v ?? '')}
                    style={{ width: '100%' }}
                  />
                ),
              },
              {
                title: 'Наименование',
                dataIndex: 'pathogenName',
                key: 'pathogenName',
                render: (val: string, __, index) => (
                  <Input
                    size="small"
                    placeholder="Наименование"
                    value={val ?? ''}
                    onChange={(e) => updatePathogen(index, 'pathogenName', e.target.value)}
                    maxLength={getMaxLength('pathogenName')}
                    showCount
                    title={getFormatHint('pathogenName') ?? 'csdo:Name120Type (smsdo:PathogenName)'}
                  />
                ),
              },
              {
                title: '',
                key: 'action',
                width: 56,
                render: (_, __, index) => (
                  <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removePathogen(index)} />
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  )
}

export default DiseaseTabEdit
