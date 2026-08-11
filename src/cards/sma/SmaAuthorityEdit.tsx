import { useEffect, useState } from 'react'
import { Input, Select, Typography } from 'antd'
import { useAuthorityOptions } from '@/hooks/shared/useAuthorityOptions'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'

export interface SmaAuthorityValue {
  country: string
  authorityUid?: string
  /** Числовой AUTHORITYID из справочника (для SMAQ.AUTHORITYID). */
  authorityDbId?: number
  name: string
  shortName: string
}

export interface SmaAuthorityEditProps {
  value: SmaAuthorityValue
  onChange: (next: SmaAuthorityValue) => void
  countryDisplay: string
  isDraft: boolean
  allowedAuthorityIds?: string[] | null
  /** Подпись роли органа в карте */
  roleLabel?: string
  /** Скрыть выпадающий список выбора УО (для SMAR — УО из связанного запроса). */
  hideAuthoritySelect?: boolean
}

/** Блок «Уполномоченный орган» SMAQ/SMAR. */
export function SmaAuthorityEdit({
  value,
  onChange,
  countryDisplay,
  isDraft,
  allowedAuthorityIds,
  roleLabel = 'Уполномоченный орган',
  hideAuthoritySelect = false,
}: SmaAuthorityEditProps) {
  const countryCode = (value.country ?? '').trim() || undefined
  const { options: authorityOptions, loading: loadingAuthorities, getSelectOptions, getAuthorityByUid } =
    useAuthorityOptions(countryCode, true, isDraft ? allowedAuthorityIds ?? undefined : undefined)

  const [selectedUid, setSelectedUid] = useState<string | undefined>(value.authorityUid)

  useEffect(() => {
    const uid = value.authorityUid?.trim()
    setSelectedUid(uid || undefined)
  }, [value.authorityUid])

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
      onChange({ ...value, authorityUid: uid })
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
      {!hideAuthoritySelect ? (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 4, color: 'rgba(0, 0, 0, 0.45)', fontSize: 14 }}>
            {labelWithHelp(`Выбор ${roleLabel.toLowerCase()}`, FIELD_HELP.authority)}
          </div>
          <Select
            showSearch
            allowClear
            style={{ width: '100%', marginTop: 4 }}
            placeholder={
              !countryCode
                ? 'Страна не указана'
                : !isDraft
                  ? 'Доступно только в статусе «Черновик» / «Новое»'
                  : `Выберите ${roleLabel.toLowerCase()}`
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
      ) : null}
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
