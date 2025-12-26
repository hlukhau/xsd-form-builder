import { Select } from 'antd'
import type { CountryOption } from '@/utils/referenceDataApi'

interface CountrySelectProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  loading?: boolean
  countryOptions: CountryOption[]
  normalizeCountryCode?: (country: string | undefined) => string | undefined
  style?: React.CSSProperties
}

/**
 * Переиспользуемый компонент Select для выбора страны
 */
const CountrySelect: React.FC<CountrySelectProps> = ({
  value,
  onChange,
  placeholder = 'Выберите страну',
  loading = false,
  countryOptions,
  normalizeCountryCode,
  style,
}) => {
  const normalizedValue = normalizeCountryCode ? normalizeCountryCode(value) : value

  return (
    <Select
      showSearch
      placeholder={placeholder}
      loading={loading}
      value={normalizedValue}
      onChange={onChange}
      filterOption={(input, option) =>
        (option?.label ?? '').toLowerCase().includes(input.toLowerCase()) ||
        (option?.value ?? '').toLowerCase().includes(input.toLowerCase())
      }
      options={countryOptions.map((opt) => ({
        value: opt.code,
        label: `${opt.code} - ${opt.name}`,
      }))}
      style={style || { width: '100%' }}
    />
  )
}

export default CountrySelect


