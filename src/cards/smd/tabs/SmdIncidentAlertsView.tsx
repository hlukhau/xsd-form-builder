import { Table } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { CardData } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'

interface SmdIncidentAlertsViewProps {
  data: CardData
}

const SmdIncidentAlertsView: React.FC<SmdIncidentAlertsViewProps> = ({ data }) => {
  const { getDisplayLabel: getCountryLabel } = useCountryOptions()
  const { getNameByCode: getKindName } = useIncidentAlertKindOptions()
  const list = data.smdIncidentAlerts ?? []

  const formatDate = (d: string | null | undefined) => {
    if (!d?.trim()) return '—'
    const date = new Date(d.slice(0, 10))
    if (isNaN(date.getTime())) return d
    return format(date, 'dd.MM.yyyy', { locale: ru })
  }

  if (list.length === 0) {
    return <div style={{ color: '#999', fontStyle: 'italic' }}>Уведомления не указаны</div>
  }

  return (
    <Table
      size="small"
      pagination={false}
      rowKey={(_, i) => String(i)}
      dataSource={list}
      columns={[
        {
          title: 'Страна',
          key: 'country',
          render: (_, row) => getCountryLabel(row.country) || row.country || '—',
        },
        {
          title: 'Рег. номер',
          key: 'registrationNumber',
          render: (_, row) => row.registrationNumber?.trim() || '—',
        },
        {
          title: 'Вид',
          key: 'type',
          render: (_, row) => {
            const code = row.type?.trim()
            if (!code) return '—'
            const name = getKindName(code)
            return name ? `${code} — ${name}` : code
          },
        },
        {
          title: 'Дата',
          key: 'formationDate',
          render: (_, row) => formatDate(row.formationDate),
        },
      ]}
    />
  )
}

export default SmdIncidentAlertsView
