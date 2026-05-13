import { useEffect, useState, useMemo, useCallback } from 'react'
import { Table, Spin, Alert, Tooltip, Button } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { fetchPpvActors, type PpvActorRow } from '@/utils/referenceDataApi'
import { buildDprCardViewUrl } from '@/utils/dprCardUrl'

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

  const openDprCard = useCallback(
    (dprId: number) => {
      const g = guid?.trim()
      if (!g) return
      const url = buildDprCardViewUrl(dprId, g)
      window.location.assign(url)
    },
    [guid]
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
        title: 'Код страны',
        dataIndex: 'actorCountryCode',
        key: 'actorCountryCode',
        width: 110,
        render: (_: unknown, record: PpvActorRow) =>
          record.actorCountryCode?.trim() ? String(record.actorCountryCode).trim().toUpperCase() : '—',
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
          const dprId = record.dprId
          if (dprId == null || dprId <= 0) return null
          const g = guid?.trim()
          if (!g) {
            return (
              <Tooltip title="Для перехода к карте DPR нужен GUID в адресе страницы">
                <Button type="link" disabled icon={<FileTextOutlined style={{ fontSize: 18 }} />} aria-label="Просмотр недоступен" />
              </Tooltip>
            )
          }
          return (
            <Tooltip title="Открыть карту сведений о результатах рассмотрения">
              <Button
                type="link"
                icon={<FileTextOutlined style={{ fontSize: 18 }} />}
                onClick={() => openDprCard(dprId)}
                aria-label="Открыть карту сведений о результатах рассмотрения"
              />
            </Tooltip>
          )
        },
      },
    ],
    [guid, openDprCard]
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
