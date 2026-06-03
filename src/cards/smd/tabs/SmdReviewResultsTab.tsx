import { useEffect, useState } from 'react'
import { Table, Spin, Alert } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { SmdReviewResultRow } from '@/types/smdCard'

interface SmdReviewResultsTabProps {
  smdid: string
  hasPersisted: boolean
}

/** Результаты рассмотрения — по аналогии с PPV «Адресаты» (заготовка под API). */
const SmdReviewResultsTab: React.FC<SmdReviewResultsTabProps> = ({ smdid, hasPersisted }) => {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<SmdReviewResultRow[]>([])

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

  const columns: ColumnsType<SmdReviewResultRow> = [
    { title: 'Страна', dataIndex: 'countryName', key: 'countryName', render: (v) => v || '—' },
    { title: 'Дата ответа', dataIndex: 'responseDateTime', key: 'responseDateTime', render: (v) => v || '—' },
    { title: 'Результат', dataIndex: 'resultName', key: 'resultName', render: (v) => v || '—' },
    { title: 'Комментарий', dataIndex: 'comment', key: 'comment', render: (v) => v || '—' },
  ]

  if (!hasPersisted) {
    return <Alert type="info" showIcon message="Результаты рассмотрения появятся после сохранения карты в БД." />
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

export default SmdReviewResultsTab
