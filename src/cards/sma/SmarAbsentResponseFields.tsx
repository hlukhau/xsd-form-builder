import { Descriptions, Input, Typography } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import {
  PROCESSING_RESULT_CODE_OPTIONS,
  SMAR_ABSENT_PROCESSING_RESULT_CODE,
} from '@/constants/smarResponse'
import { getMaxLength } from '@/constants/xsdFieldConstraints'

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

/** Поля ответа «Сведения отсутствуют» (EEC_R_ProcessingResultDetails). */
export function SmarAbsentResponseFields({
  value,
  onChange,
  readOnly = false,
}: SmarAbsentResponseFieldsProps) {
  const code = (value.processingResultV2Code ?? SMAR_ABSENT_PROCESSING_RESULT_CODE).trim()
  const codeLabel =
    PROCESSING_RESULT_CODE_OPTIONS.find((o) => o.value === code)?.label ?? (code || '—')
  const descMax = getMaxLength('description')

  if (readOnly) {
    return (
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Дата и время обработки">
          {value.eventDateTime
            ? (parseEventDateTime(value.eventDateTime)?.format('DD.MM.YYYY HH:mm') ?? value.eventDateTime)
            : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Результат обработки">{codeLabel}</Descriptions.Item>
        <Descriptions.Item label="Описание">{(value.descriptionText ?? '').trim() || '—'}</Descriptions.Item>
      </Descriptions>
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Описание</Typography.Text>
        <Input.TextArea
          value={value.descriptionText ?? ''}
          onChange={(e) => onChange?.({ ...value, descriptionText: e.target.value || null })}
          autoSize={{ minRows: 3, maxRows: 12 }}
          maxLength={descMax}
          showCount
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
