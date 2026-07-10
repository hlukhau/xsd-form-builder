import { DatePicker, Form, Input, Select } from 'antd'
import dayjs from 'dayjs'
import type { SmaIncidentAlert } from '@/types/smaCard'
import { useEaueCountryOptions } from '@/hooks/shared/useEaueCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import { getMaxLength } from '@/constants/xsdFieldConstraints'

const SMD_INCIDENT_KIND_CODES = new Set([
  '1', '2', '3', '4', '7', '8', '10', '11', '13', '14', '16', '17', '19',
])

export interface SmaIncidentAlertEditProps {
  value: SmaIncidentAlert
  onChange: (next: SmaIncidentAlert) => void
  readOnly?: boolean
}

/** Одно уведомление о нежелательной ситуации (smcdo:IncidentAlertIdDetails) для SMAQ. */
export function SmaIncidentAlertEdit({ value, onChange, readOnly }: SmaIncidentAlertEditProps) {
  const { getSelectOptions: getCountrySelectOptions } = useEaueCountryOptions()
  const { getSelectOptions: getKindOptions, loading: loadingKinds } = useIncidentAlertKindOptions()
  const kindOptions = getKindOptions().filter((o) => SMD_INCIDENT_KIND_CODES.has(String(o.value)))

  const patch = (field: keyof SmaIncidentAlert, fieldValue: string) => {
    onChange({ ...value, [field]: fieldValue })
  }

  if (readOnly) {
    return (
      <Form layout="vertical" className="field-tag-form">
        <Form.Item label="Страна">
          <Input readOnly value={value.country?.trim() || '—'} />
        </Form.Item>
        <Form.Item label="Рег. номер">
          <Input readOnly value={value.registrationNumber?.trim() || '—'} />
        </Form.Item>
        <Form.Item label="Вид">
          <Input readOnly value={value.typeCode?.trim() || '—'} />
        </Form.Item>
        <Form.Item label="Дата">
          <Input readOnly value={value.formationDate?.trim().slice(0, 10) || '—'} />
        </Form.Item>
      </Form>
    )
  }

  return (
    <Form layout="vertical" className="field-tag-form" style={{ maxWidth: 560 }}>
      <Form.Item label="Страна">
        <Select
          showSearch
          allowClear
          value={value.country?.trim() || undefined}
          onChange={(v) => patch('country', v ?? '')}
          options={getCountrySelectOptions()}
          filterOption={(input, option) =>
            String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
        />
      </Form.Item>
      <Form.Item label="Рег. номер">
        <Input
          value={value.registrationNumber ?? ''}
          onChange={(e) => patch('registrationNumber', e.target.value)}
          maxLength={getMaxLength('phaIncidentId')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Вид">
        <Select
          showSearch
          allowClear
          loading={loadingKinds}
          value={value.typeCode?.trim() || undefined}
          onChange={(v) => patch('typeCode', v ?? '')}
          options={kindOptions}
        />
      </Form.Item>
      <Form.Item label="Дата">
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={value.formationDate?.trim() ? dayjs(value.formationDate.slice(0, 10)) : null}
          onChange={(d) => patch('formationDate', d ? d.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
        />
      </Form.Item>
    </Form>
  )
}

export const emptySmaIncidentAlert = (): SmaIncidentAlert => ({
  country: '',
  registrationNumber: '',
  typeCode: '',
  formationDate: '',
})
