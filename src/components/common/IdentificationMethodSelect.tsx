import { useMemo } from 'react'
import { Select } from 'antd'
import { useIdentificationMethodOptions } from '@/hooks/shared/useIdentificationMethodOptions'

export const IDENTIFICATION_METHOD_DROPDOWN_CLASS = 'identification-method-dropdown'

interface IdentificationMethodSelectProps {
  countryCode?: string
  value?: string
  onChange?: (value: string | undefined) => void
  allowClear?: boolean
  disabled?: boolean
  placeholder?: string
}

/** Справочник методов идентификации (kindId): многострочное отображение, без горизонтального переполнения. */
export function IdentificationMethodSelect({
  countryCode,
  value,
  onChange,
  allowClear = true,
  disabled,
  placeholder,
}: IdentificationMethodSelectProps) {
  const { options, loading } = useIdentificationMethodOptions(countryCode)
  const country = (countryCode ?? '').trim()
  const selectOptions = useMemo(
    () =>
      options.map((opt) => {
        const label = [opt.letterCode, opt.description].filter(Boolean).join(' — ') || opt.code
        return { value: opt.code, label }
      }),
    [options],
  )
  const selectedLabel = useMemo(
    () => selectOptions.find((o) => o.value === value)?.label,
    [selectOptions, value],
  )

  return (
    <div className="identification-method-select-wrap" title={selectedLabel}>
      <Select
        className="identification-method-select"
        popupClassName={IDENTIFICATION_METHOD_DROPDOWN_CLASS}
        showSearch
        allowClear={allowClear}
        placeholder={placeholder ?? (country ? 'Выберите значение' : 'Сначала укажите страну')}
        loading={loading}
        disabled={disabled ?? !country}
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
