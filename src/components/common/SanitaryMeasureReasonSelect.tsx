import { useMemo } from 'react'
import { Select } from 'antd'
import { useSanitaryMeasureReasonOptions } from '@/hooks/shared/useSanitaryMeasureReasonOptions'

export const SANITARY_MEASURE_REASON_DROPDOWN_CLASS = 'sanitary-measure-reason-dropdown'

interface SanitaryMeasureReasonSelectProps {
  value?: string
  onChange?: (value: string | undefined) => void
  allowClear?: boolean
  disabled?: boolean
  placeholder?: string
}

/** Справочник причин введения временной меры: многострочное отображение длинных подписей. */
export function SanitaryMeasureReasonSelect({
  value,
  onChange,
  allowClear = true,
  disabled,
  placeholder,
}: SanitaryMeasureReasonSelectProps) {
  const { options, loading } = useSanitaryMeasureReasonOptions()
  const selectOptions = useMemo(
    () =>
      options.map((opt) => ({
        value: opt.code,
        label: `${opt.code} - ${opt.name}`,
      })),
    [options],
  )
  const selectedLabel = useMemo(
    () => selectOptions.find((o) => o.value === value)?.label,
    [selectOptions, value],
  )

  return (
    <div className="sanitary-measure-reason-select-wrap" title={selectedLabel}>
      <Select
        className="sanitary-measure-reason-select"
        popupClassName={SANITARY_MEASURE_REASON_DROPDOWN_CLASS}
        showSearch
        allowClear={allowClear}
        placeholder={placeholder ?? 'Выберите причину (код — наименование)'}
        loading={loading}
        disabled={disabled}
        value={value || undefined}
        options={selectOptions}
        onChange={(v) => onChange?.(v ?? undefined)}
        filterOption={(input, option) =>
          String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
        style={{ width: '100%', maxWidth: '100%' }}
        popupMatchSelectWidth={false}
      />
    </div>
  )
}
