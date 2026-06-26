import { useState, useMemo } from 'react'
import { Button, Table } from 'antd'
import { CaretDownOutlined, CaretRightOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CardData, MeasureImplementationItem } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/shared/useSanitaryMeasureObjKindOptions'
import { MeasureImplementationDetailsEdit } from '@/components/tabs/dpa/MeasuresTabEdit'
import {
  getSmdPrimaryMeasure,
  patchSmdPrimaryMeasure,
  syncSmdCardFromPrimaryMeasure,
} from '../smdSanitaryMeasureModel'
import { formatMeasureAffectedObjectKind } from '@/components/tabs/shared/MeasureImplementationDetailSections'

interface SmdMeasureImplementationEditProps {
  data: CardData
  onChange: (next: CardData) => void
}

const formatDate = (d: string | null | undefined) => {
  if (!d?.trim()) return '—'
  const date = new Date(d.slice(0, 10))
  if (isNaN(date.getTime())) return d
  return format(date, 'dd.MM.yyyy', { locale: ru })
}

const EAUE_COUNTRY_CODES = new Set(['AM', 'BY', 'KZ', 'KG', 'RU'])

const SmdMeasureImplementationEdit: React.FC<SmdMeasureImplementationEditProps> = ({ data, onChange }) => {
  const measure = getSmdPrimaryMeasure(data)
  const items = measure.measureImplementationDetails ?? []
  const [selectedIndex, setSelectedIndex] = useState<number | null>(items.length > 0 ? 0 : null)

  const { countryOptions, loading: loadingCountries, normalizeCountryCode } = useCountryOptions()
  const eaueCountryOptions = useMemo(
    () => countryOptions.filter((opt) => EAUE_COUNTRY_CODES.has(String(opt.code || '').toUpperCase())),
    [countryOptions]
  )
  const { getSelectOptions: getObjKindOptions, getNameByCode: getObjKindName } =
    useSanitaryMeasureObjKindOptions()

  const patchItems = (nextItems: MeasureImplementationItem[]) => {
    onChange(
      syncSmdCardFromPrimaryMeasure(
        patchSmdPrimaryMeasure(data, { measureImplementationDetails: nextItems })
      )
    )
  }

  const handleImplementationChange = (implIndex: number, field: string, value: unknown) => {
    const updated = [...items]
    const next: MeasureImplementationItem = { ...(updated[implIndex] ?? {}), [field]: value }
    if (field === 'authorities') {
      delete next.authority
      if (value == null || (Array.isArray(value) && value.length === 0)) delete next.authorities
    }
    if (field === 'subjectDetailsList') {
      delete next.subjectDetails
      if (value == null || (Array.isArray(value) && value.length === 0)) delete next.subjectDetailsList
    }
    updated[implIndex] = next
    patchItems(updated)
  }

  const handleAdd = () => {
    const next = [...items, { country: '', startDate: '', description: '' }]
    patchItems(next)
    setSelectedIndex(next.length - 1)
  }

  const handleRemove = (index: number) => {
    const next = items.filter((_, i) => i !== index)
    patchItems(next)
    setSelectedIndex((prev) => {
      if (prev == null) return next.length > 0 ? 0 : null
      if (prev === index) return next.length > 0 ? Math.min(index, next.length - 1) : null
      if (prev > index) return prev - 1
      return prev
    })
  }

  const selected = selectedIndex != null ? items[selectedIndex] : undefined

  const columns = [
    {
      title: '',
      key: 'expand',
      width: 40,
      align: 'center' as const,
      render: (_: unknown, __: MeasureImplementationItem, index: number) => (
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation()
            setSelectedIndex(selectedIndex === index ? null : index)
          }}
          style={{ cursor: 'pointer' }}
        >
          {selectedIndex === index ? <CaretDownOutlined /> : <CaretRightOutlined />}
        </span>
      ),
    },
    {
      title: 'Страна',
      key: 'country',
      width: 140,
      render: (_: unknown, row: MeasureImplementationItem) =>
        countryOptions.find((o) => o.value === row.country)?.label ?? row.country ?? '—',
    },
    {
      title: 'Начальная дата',
      key: 'startDate',
      width: 120,
      render: (_: unknown, row: MeasureImplementationItem) => formatDate(row.startDate),
    },
    {
      title: 'Конечная дата',
      key: 'endDate',
      width: 120,
      render: (_: unknown, row: MeasureImplementationItem) => formatDate(row.endDate),
    },
    {
      title: 'Описание',
      key: 'description',
      render: (_: unknown, row: MeasureImplementationItem) => (row.description ?? '').trim() || '—',
    },
    {
      title: 'Вид объекта действия',
      key: 'objKind',
      width: 220,
      render: (_: unknown, row: MeasureImplementationItem) =>
        formatMeasureAffectedObjectKind(row.measureAffectedObjectKindCode, getObjKindName),
    },
    {
      title: '',
      key: 'actions',
      width: 90,
      render: (_: unknown, __: MeasureImplementationItem, index: number) => (
        <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemove(index)}>
          Удалить
        </Button>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
          Мероприятия, обеспечивающие соблюдение меры
        </h3>
        <Button type="dashed" icon={<PlusOutlined />} onClick={handleAdd}>
          Добавить мероприятие
        </Button>
      </div>
      <Table
        dataSource={items}
        columns={columns}
        rowKey={(_, index) => `impl-edit-${index}`}
        pagination={false}
        size="small"
        bordered
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Мероприятия не указаны' }}
        onRow={(_, index) => ({
          onClick: () => setSelectedIndex(index ?? null),
          style: { cursor: 'pointer' },
        })}
        rowClassName={(_, index) => (selectedIndex === index ? 'ant-table-row-selected' : '')}
      />
      {selected && selectedIndex != null && (
        <MeasureImplementationDetailsEdit
          measureIndex={0}
          implIndex={selectedIndex}
          item={selected}
          onChange={(field, value) => handleImplementationChange(selectedIndex, field, value)}
          countryOptions={countryOptions}
          authorityCountryOptions={eaueCountryOptions}
          loadingCountries={loadingCountries}
          normalizeCountryCode={normalizeCountryCode}
          getSanitaryMeasureObjKindSelectOptions={getObjKindOptions}
          getSanitaryMeasureObjKindNameByCode={getObjKindName}
        />
      )}
    </div>
  )
}

export default SmdMeasureImplementationEdit
