import { Form, Input } from 'antd'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { getMaxLength, validateFieldValue } from '@/constants/xsdFieldConstraints'

const FIELD_KEY = 'dprResultDescription'

export interface DprResultDescriptionFieldProps {
  value: string
  onChange?: (value: string) => void
  /** Просмотр: обычное текстовое поле без disabled (текст можно выделить и скопировать). */
  readOnly?: boolean
}

export function DprResultDescriptionField({ value, onChange, readOnly = false }: DprResultDescriptionFieldProps) {
  const maxLen = getMaxLength(FIELD_KEY) ?? 4000
  const validationMsg = readOnly ? null : validateFieldValue(FIELD_KEY, value)

  return (
    <Form layout="vertical" className="field-tag-form">
      <Form.Item
        label={labelWithHelp('Описание результатов рассмотрения', FIELD_HELP.dprResultDescription)}
        validateStatus={validationMsg ? 'error' : undefined}
        help={validationMsg ?? undefined}
        style={{ marginBottom: 16 }}
      >
        <Input.TextArea
          readOnly={readOnly}
          value={value}
          onChange={
            readOnly || !onChange
              ? undefined
              : (e) => {
                  const next = e.target.value
                  if (next.length <= maxLen) onChange(next)
                }
          }
          maxLength={readOnly ? undefined : maxLen}
          showCount={!readOnly}
          autoSize={{ minRows: 4, maxRows: 18 }}
        />
      </Form.Item>
    </Form>
  )
}
