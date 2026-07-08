import { DatePicker, Descriptions, Input, Select, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  PROCESSING_RESULT_CODE_OPTIONS,
  SMAR_ABSENT_PROCESSING_RESULT_CODE,
} from '@/constants/smarResponse'

export interface SmarAbsentResponseValue {
  eventDateTime: string | null
  processingResultV2Code: string | null
  descriptionText: string | null
}

interface SmarAbsentResponseFieldsProps {
  value: SmarAbsentResponseValue
  onChange?: (next: SmarAbsentResponseValue) => void
  readOnly?: boolean
}

function parseEventDateTime(value: string | null | undefined): Dayjs | null {
  const t = (value ?? '').trim()
  if (!t) return null
  const d = dayjs(t.includes('T') ? t : `${t}T00:00:00`)
  return d.isValid() ? d : null
}

function formatEventDateTime(d: Dayjs | null): string | null {
  if (!d || !d.isValid()) return null
  return d.toISOString()
}

/** Поля ответа «Сведения отсутствуют» (EEC_R_ProcessingResultDetails). */
export function SmarAbsentResponseFields({
  value,
  onChange,
  readOnly = false,
}: SmarAbsentResponseFieldsProps) {
  const code = (value.processingResultV2Code ?? SMAR_ABSENT_PROCESSING_RESULT_CODE).trim()
  const codeLabel =
    PROCESSING_RESULT_CODE_OPTIONS.find((o) => o.value === code)?.label ?? (code || '—')

  if (readOnly) {
    return (
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Дата и время окончания обработки">
          {value.eventDateTime ? parseEventDateTime(value.eventDateTime)?.format('DD.MM.YYYY HH:mm') ?? value.eventDateTime : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Код результата обработки">{codeLabel}</Descriptions.Item>
        <Descriptions.Item label="Описание результата обработки">
          {(value.descriptionText ?? '').trim() || '—'}
        </Descriptions.Item>
      </Descriptions>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Дата и время окончания обработки</Typography.Text>
        <DatePicker
          showTime
          style={{ display: 'block', marginTop: 4, width: '100%', maxWidth: 320 }}
          value={parseEventDateTime(value.eventDateTime)}
          onChange={(d) => onChange?.({ ...value, eventDateTime: formatEventDateTime(d) })}
          format="DD.MM.YYYY HH:mm"
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Код результата обработки</Typography.Text>
        <Select
          style={{ display: 'block', marginTop: 4, maxWidth: 480 }}
          value={code}
          options={PROCESSING_RESULT_CODE_OPTIONS}
          onChange={(v) => onChange?.({ ...value, processingResultV2Code: v })}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Описание результата обработки</Typography.Text>
        <Input.TextArea
          value={value.descriptionText ?? ''}
          onChange={(e) => onChange?.({ ...value, descriptionText: e.target.value || null })}
          autoSize={{ minRows: 3, maxRows: 12 }}
          style={{ marginTop: 4 }}
        />
      </div>
    </div>
  )
}

export function defaultSmarAbsentResponseValue(): SmarAbsentResponseValue {
  return {
    eventDateTime: new Date().toISOString(),
    processingResultV2Code: SMAR_ABSENT_PROCESSING_RESULT_CODE,
    descriptionText: null,
  }
}
