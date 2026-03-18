import { Table } from 'antd'
import type { CardData } from '@/types/card'
import { useSanitaryMeasureOptions } from '@/hooks/shared/useSanitaryMeasureOptions'

interface SanitaryMeasuresTabProps {
  data: CardData
}

/**
 * Санитарные меры — сведения о принятых санитарных мерах (smsdo:MeasureCode, smsdo:MeasureName).
 * Таблица: Код меры (из справочника или «—»), Наименование меры (по справочнику или произвольный текст).
 */
const SanitaryMeasuresTab: React.FC<SanitaryMeasuresTabProps> = ({ data }) => {
  const { getNameByCode } = useSanitaryMeasureOptions()
  const measures = data.measures?.measures ?? []

  const columns = [
    {
      title: 'Код меры',
      dataIndex: 'measureCode',
      key: 'measureCode',
      render: (_: unknown, record: { measureCode?: string; measureName?: string }) => {
        const code = record.measureCode?.trim()
        return code ?? '—'
      },
    },
    {
      title: 'Наименование меры',
      dataIndex: 'measureName',
      key: 'measureName',
      render: (_: unknown, record: { measureCode?: string; measureName?: string }) => {
        const code = record.measureCode?.trim()
        if (code) return getNameByCode(code) ?? code
        return record.measureName?.trim() ?? '—'
      },
    },
  ]

  if (measures.length === 0) {
    return (
      <Table
        columns={columns}
        dataSource={[]}
        pagination={false}
        locale={{ emptyText: 'Нет сведений о санитарных мерах' }}
      />
    )
  }

  return (
    <Table
      rowKey={(_, i) => String(i)}
      columns={columns}
      dataSource={measures}
      pagination={false}
      size="small"
    />
  )
}

export default SanitaryMeasuresTab
