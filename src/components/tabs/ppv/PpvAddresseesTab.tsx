import { useEffect, useState, useMemo, useCallback } from 'react'
import { Table, Spin, Alert, Tooltip, Button } from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { fetchPpvActors, type PpvActorRow } from '@/utils/referenceDataApi'

function reviewResultCardUrl(edocId: string, guid: string | undefined): string | null {
  const raw = (import.meta.env.VITE_REVIEW_RESULT_CARD_BASE as string | undefined)?.trim()
  if (!raw) return null
  const encId = encodeURIComponent(edocId)
  const encGuid = encodeURIComponent(guid ?? '')
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const base = raw.replace(/\/$/, '')
    return `${base}/${encId}/${encGuid}`
  }
  const path = raw.startsWith('/') ? raw.replace(/\/$/, '') : `/${raw.replace(/\/$/, '')}`
  return `${window.location.origin}${path}/${encId}/${encGuid}`
}

interface PpvAddresseesTabProps {
  ppvid: string
  guid?: string
  hasPersisted: boolean
}

const PpvAddresseesTab: React.FC<PpvAddresseesTabProps> = ({ ppvid, guid, hasPersisted }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<PpvActorRow[]>([])

  useEffect(() => {
    if (!hasPersisted || !ppvid || ppvid === '-') {
      setRows([])
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchPpvActors(ppvid, guid)
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setRows([])
          setError(e instanceof Error ? e.message : 'Не удалось загрузить адресатов')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [ppvid, guid, hasPersisted])

  const openReview = useCallback(
    (edocId: string) => {
      const href = reviewResultCardUrl(edocId, guid)
      if (href) window.open(href, '_blank', 'noopener,noreferrer')
    },
    [guid]
  )

  const reviewBaseConfigured = useMemo(
    () => Boolean((import.meta.env.VITE_REVIEW_RESULT_CARD_BASE as string | undefined)?.trim()),
    []
  )

  const columns: ColumnsType<PpvActorRow> = useMemo(
    () => [
      {
        title: 'Страна',
        dataIndex: 'countryName',
        key: 'countryName',
        render: (v: string | null) => (v && String(v).trim() ? v : '—'),
      },
      {
        title: 'Дата получения ответа',
        dataIndex: 'responseDateTime',
        key: 'responseDateTime',
        render: (v: string | null) => (v && String(v).trim() ? v : ''),
      },
      {
        title: 'Ответ',
        key: 'answer',
        width: 100,
        align: 'center',
        render: (_: unknown, record: PpvActorRow) => {
          const id = record.edocId?.trim()
          if (!id) return ''
          if (!reviewBaseConfigured) {
            return (
              <Tooltip title="Задайте VITE_REVIEW_RESULT_CARD_BASE (базовый URL карты результата рассмотрения) при сборке">
                <Button type="text" disabled icon={<LinkOutlined />} aria-label="Ответ" />
              </Tooltip>
            )
          }
          return (
            <Tooltip title="Открыть карту сведений о результате рассмотрения">
              <Button
                type="link"
                icon={<LinkOutlined style={{ fontSize: 18 }} />}
                onClick={() => openReview(id)}
                aria-label="Открыть карту результата рассмотрения"
              />
            </Tooltip>
          )
        },
      },
    ],
    [openReview, reviewBaseConfigured]
  )

  if (!hasPersisted || ppvid === '-') {
    return <div style={{ padding: 16, color: '#8c8c8c' }}>Сохраните карту, чтобы загрузить список адресатов.</div>
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin />
      </div>
    )
  }

  if (error) {
    return <Alert type="error" message={error} showIcon style={{ margin: 16 }} />
  }

  if (rows.length === 0) {
    return <div style={{ padding: 16, color: '#595959' }}>Данные об адресатах не найдены</div>
  }

  return (
    <Table<PpvActorRow>
      rowKey={(r) => String(r.ppvActorId)}
      columns={columns}
      dataSource={rows}
      pagination={false}
      size="small"
      bordered
    />
  )
}

export default PpvAddresseesTab
