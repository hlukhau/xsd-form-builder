import { useEffect, useState } from 'react'
import { Input, Select, Typography } from 'antd'
import { useAuthorityOptions } from '@/hooks/shared/useAuthorityOptions'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'

export interface SmrRespondingAuthorityValue {
  country: string
  authorityUid?: string
  /** Числовой AUTHORITYID из справочника */
  authorityDbId?: number
  name: string
  shortName: string
}

export interface SmrRespondingAuthorityEditProps {
  value: SmrRespondingAuthorityValue
  onChange: (next: SmrRespondingAuthorityValue) => void
  countryDisplay: string
  isDraft: boolean
  /** DEPID из прав пользователя (sanitaryMeasureIn:status и др.) */
  allowedAuthorityIds?: string[] | null
}

/** Блок «Уполномоченный орган» SMR — орган, представивший результат рассмотрения. */
export function SmrRespondingAuthorityEdit({
  value,
  onChange,
  countryDisplay,
  isDraft,
  allowedAuthorityIds,
}: SmrRespondingAuthorityEditProps) {
  const countryCode = (value.country ?? '').trim() || undefined
  const { options: authorityOptions, loading: loadingAuthorities, getSelectOptions, getAuthorityByUid } =
    useAuthorityOptions(countryCode, true, isDraft ? allowedAuthorityIds ?? undefined : undefined)

  const [selectedUid, setSelectedUid] = useState<string | undefined>(value.authorityUid)

  useEffect(() => {
    const uid = value.authorityUid?.trim()
    if (uid) {
      setSelectedUid(uid)
      return
    }
    const name = (value.name ?? '').trim()
    if (!name) {
      setSelectedUid(undefined)
      return
    }
    const match = authorityOptions.find((o) => (o.name ?? '').trim() === name)
    if (match?.uid) {
      setSelectedUid(match.uid)
      onChange({
        ...value,
        authorityUid: match.uid,
        authorityDbId: match.authorityId,
        name: match.name,
        shortName: match.briefName || '',
        country: match.countryCode || value.country,
      })
    } else {
      setSelectedUid(undefined)
    }
  }, [value.authorityUid, value.name, authorityOptions, onChange, value])

  const handleSelect = (uid: string | null) => {
    if (!uid) {
      setSelectedUid(undefined)
      onChange({ ...value, authorityUid: undefined, authorityDbId: undefined, name: '', shortName: '' })
      return
    }
    const authority = getAuthorityByUid(uid)
    if (authority) {
      setSelectedUid(uid)
      onChange({
        ...value,
        country: authority.countryCode || value.country,
        authorityUid: uid,
        authorityDbId: authority.authorityId,
        name: authority.name,
        shortName: authority.briefName || '',
      })
    } else {
      setSelectedUid(uid)
      onChange({ ...value, authorityUid: uid, authorityDbId: undefined })
    }
  }

  const allowedOptions = getSelectOptions()
  const currentName = (value.name ?? '').trim()
  const currentInList = selectedUid && allowedOptions.some((o) => String(o.value) === selectedUid)
  const selectOptions =
    selectedUid && currentName && !currentInList
      ? [{ value: selectedUid, label: currentName }, ...allowedOptions]
      : allowedOptions

  const selectDisabled = !countryCode || !isDraft

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Страна</Typography.Text>
        <Input readOnly value={countryDisplay || '—'} style={{ marginTop: 4 }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Идентификатор</Typography.Text>
        <Input readOnly value="—" style={{ marginTop: 4 }} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 4, color: 'rgba(0, 0, 0, 0.45)', fontSize: 14 }}>
          {labelWithHelp('Выбор уполномоченного органа', FIELD_HELP.authority)}
        </div>
        <Select
          showSearch
          allowClear
          style={{ width: '100%', marginTop: 4 }}
          placeholder={
            !countryCode
              ? 'Страна не указана'
              : !isDraft
                ? 'Доступно только в статусе «Черновик»'
                : 'Выберите уполномоченный орган'
          }
          loading={loadingAuthorities}
          value={selectedUid}
          onChange={handleSelect}
          disabled={selectDisabled}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={selectOptions}
          notFoundContent={
            loadingAuthorities
              ? 'Загрузка...'
              : authorityOptions.length === 0
                ? 'Нет доступных УО по правам пользователя'
                : 'Не найдено'
          }
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">Наименование</Typography.Text>
        <Input readOnly value={(value.name ?? '').trim() || '—'} style={{ marginTop: 4 }} />
      </div>
      <div style={{ marginBottom: 0 }}>
        <Typography.Text type="secondary">Краткое наименование</Typography.Text>
        <Input readOnly value={(value.shortName ?? '').trim() || '—'} style={{ marginTop: 4 }} />
      </div>
    </div>
  )
}
