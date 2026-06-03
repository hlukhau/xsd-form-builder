import { useEffect, useState } from 'react'
import { Table, Spin, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { SmdInfoRequestRow } from '@/types/smdCard'

interface SmdInfoRequestsTabProps {
  smdid: string
  hasPersisted: boolean
}

/** Сведения — по аналогии с вкладкой «Адресаты» PPV (заготовка под API). */
const SmdInfoRequestsTab: React.FC<SmdInfoRequestsTabProps> = ({ smdid, hasPersisted }) => {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SmdInfoRequestRow[]>([])

  useEffect(() => {
    if (!hasPersisted || !smdid || smdid === '-') {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = window.setTimeout(() => {
      setRows([])
      setLoading(false)
    }, 200)
    return () => window.clearTimeout(t)
  }, [smdid, hasPersisted])

  const columns: ColumnsType<SmdInfoRequestRow> = [
    { title: 'Страна', dataIndex: 'countryName', key: 'countryName', render: (v) => v || '—' },
    { title: 'Дата запроса', dataIndex: 'requestDateTime', key: 'requestDateTime', render: (v) => v || '—' },
    { title: 'Статус', dataIndex: 'statusName', key: 'statusName', render: (v) => v || '—' },
    { title: 'Описание', dataIndex: 'description', key: 'description', render: (v) => v || '—' },
  ]

  if (!hasPersisted) {
    return <Alert type="info" showIcon message="Сведения появятся после сохранения карты в БД." />
  }

  if (loading) return <Spin />

  return (
    <Table
      rowKey={(r, i) => String(r.id ?? i)}
      columns={columns}
      dataSource={rows}
      pagination={false}
      locale={{ emptyText: 'Нет данных (API в разработке)' }}
      size="small"
    />
  )
}

export default SmdInfoRequestsTab
