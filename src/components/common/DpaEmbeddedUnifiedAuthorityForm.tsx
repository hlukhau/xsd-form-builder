import { useEffect, useState } from 'react'
import { Form, Input, Select, Typography } from 'antd'
import CountrySelect from '@/components/common/CountrySelect'
import { useAuthorityOptions } from '@/hooks/shared/useAuthorityOptions'
import { getMaxLength } from '@/constants/xsdFieldConstraints'
import type { CountryOption } from '@/utils/referenceDataApi'
import type { UnifiedAuthorityDetails } from '@/types/card'

export interface DpaEmbeddedUnifiedAuthorityFormProps {
  /** Данные УО (без csdo:AuthorityId в XML; поле authorityId в модели не используется) */
  value: UnifiedAuthorityDetails
  onChange: (next: UnifiedAuthorityDetails) => void
  countryOptions: CountryOption[]
  loadingCountries: boolean
  normalizeCountryCode: (code: string | undefined) => string | undefined
}

/**
 * УО для встроенных блоков ДОП (документы соответствия, мероприятия мер):
 * идентификатор не вводится (прочерк), опциональный выбор из AUTHORITY по стране,
 * наименования можно ввести вручную или подставить из справочника и отредактировать.
 * Логика закладки «Уведомление» не затрагивается.
 */
export function DpaEmbeddedUnifiedAuthorityForm({
  value,
  onChange,
  countryOptions,
  loadingCountries,
  normalizeCountryCode,
}: DpaEmbeddedUnifiedAuthorityFormProps) {
  const countryTrim = (value.country ?? '').trim()
  const { options, loading: loadingAuthorities, getSelectOptions } = useAuthorityOptions(
    countryTrim || undefined,
    false,
    undefined,
    { enabled: !!countryTrim }
  )

  const [pickedDictUid, setPickedDictUid] = useState<string | undefined>(undefined)

  useEffect(() => {
    setPickedDictUid(undefined)
  }, [countryTrim])

  const emit = (next: UnifiedAuthorityDetails) => {
    const { authorityId: _drop, ...rest } = next
    onChange(rest)
  }

  return (
    <>
      <Form.Item label="Страна">
        <CountrySelect
          value={value.country}
          onChange={(c) => {
            setPickedDictUid(undefined)
            emit({ ...value, country: c || '' })
          }}
          loading={loadingCountries}
          countryOptions={countryOptions}
          normalizeCountryCode={normalizeCountryCode}
        />
      </Form.Item>
      <Form.Item label="Идентификатор">
        <Typography.Text type="secondary">—</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
          Не заполняется; в XML не выводится (csdo:AuthorityId).
        </Typography.Paragraph>
      </Form.Item>
      <Form.Item label="Уполномоченный орган из справочника (необязательно)">
        <Select
          showSearch
          allowClear
          placeholder={
            countryTrim
              ? 'Выберите из справочника AUTHORITY для выбранной страны'
              : 'Сначала укажите страну'
          }
          disabled={!countryTrim}
          loading={loadingAuthorities}
          options={getSelectOptions()}
          value={pickedDictUid}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          onChange={(uid) => {
            if (!uid) {
              setPickedDictUid(undefined)
              return
            }
            const opt = options.find((o) => o.uid === uid)
            if (opt) {
              setPickedDictUid(uid)
              emit({
                ...value,
                country: opt.countryCode || value.country,
                authorityName: opt.name,
                authorityBriefName: opt.briefName || '',
              })
            }
          }}
          style={{ width: '100%' }}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
          По умолчанию укажите наименование вручную. Выбор из справочника подставляет наименование и краткое наименование; их можно изменить.
        </Typography.Paragraph>
      </Form.Item>
      <Form.Item label="Наименование">
        <Input
          value={value.authorityName}
          onChange={(e) => {
            setPickedDictUid(undefined)
            emit({ ...value, authorityName: e.target.value })
          }}
          maxLength={getMaxLength('authorityName')}
          showCount
        />
      </Form.Item>
      <Form.Item label="Краткое наименование">
        <Input
          value={value.authorityBriefName}
          onChange={(e) => {
            setPickedDictUid(undefined)
            emit({ ...value, authorityBriefName: e.target.value })
          }}
          maxLength={getMaxLength('authorityBriefName')}
          showCount
        />
      </Form.Item>
    </>
  )
}
