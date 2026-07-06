import { useState } from 'react'
import { Table } from 'antd'
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { MeasureImplementationItem } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/shared/useSanitaryMeasureObjKindOptions'
import MeasureImplementationDetailSections, {
  formatMeasureAffectedObjectKind,
  hasMeasureImplementationSubsections,
} from '@/components/tabs/shared/MeasureImplementationDetailSections'

interface SmdMeasureImplementationViewProps {
  items: MeasureImplementationItem[]
}

const formatDate = (d: string | null | undefined) => {
  if (!d?.trim()) return '—'
  const date = new Date(d.slice(0, 10))
  if (isNaN(date.getTime())) return d
  return format(date, 'dd.MM.yyyy', { locale: ru })
}

/**
 * Вкладка «Мероприятия» SMD (smcdo:MeasureImplementationDetails) — по макету SS.09:
 * таблица записей + четыре раздела детализации под выбранной строкой.
 */
const SmdMeasureImplementationView: React.FC<SmdMeasureImplementationViewProps> = ({ items }) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(items.length > 0 ? 0 : null)
  const { getDisplayLabel: getCountryLabel } = useCountryOptions()
  const { getNameByCode: getObjKindName } = useSanitaryMeasureObjKindOptions()

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
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setSelectedIndex(selectedIndex === index ? null : index)
            }
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
      render: (_: unknown, row: MeasureImplementationItem) => getCountryLabel(row.country) || '—',
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
  ]

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16, fontWeight: 600 }}>
        Мероприятия, обеспечивающие соблюдение меры
      </h3>
      {items.length === 0 ? (
        <div style={{ color: '#8c8c8c' }}>Мероприятия не указаны</div>
      ) : (
        <>
          <Table
            dataSource={items}
            columns={columns}
            rowKey={(_, index) => `impl-${index}`}
            pagination={false}
            size="small"
            bordered
            scroll={{ x: 'max-content' }}
            onRow={(_, index) => ({
              onClick: () => setSelectedIndex(index ?? null),
              style: { cursor: 'pointer' },
            })}
            rowClassName={(_, index) => (selectedIndex === index ? 'ant-table-row-selected' : '')}
          />
          {selected && hasMeasureImplementationSubsections(selected) ? (
            <div className="smd-implementation-detail-panel">
              <MeasureImplementationDetailSections item={selected} />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default SmdMeasureImplementationView
