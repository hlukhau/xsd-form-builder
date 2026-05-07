import { useEffect, useState, useMemo, useCallback } from 'react'
import { Table, Spin, Alert, Tooltip, Button, Modal } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { fetchPpvActors, type PpvActorRow } from '@/utils/referenceDataApi'

interface PpvAddresseesTabProps {
  ppvid: string
  guid?: string
  hasPersisted: boolean
}

const PpvAddresseesTab: React.FC<PpvAddresseesTabProps> = ({ ppvid, guid, hasPersisted }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<PpvActorRow[]>([])
  const [reviewStubOpen, setReviewStubOpen] = useState(false)
  const [reviewStubEdocId, setReviewStubEdocId] = useState<string | null>(null)

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

  const openReviewStub = useCallback((edocId: string) => {
    setReviewStubEdocId(edocId)
    setReviewStubOpen(true)
  }, [])

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
          const id = record.edocId?.trim()
          if (!id) return ''
          return (
            <Tooltip title="Карта сведений о результатах рассмотрения (заглушка)">
              <Button
                type="link"
                icon={<FileTextOutlined style={{ fontSize: 18 }} />}
                onClick={() => openReviewStub(id)}
                aria-label="Открыть карту результата рассмотрения"
              />
            </Tooltip>
          )
        },
      },
    ],
    [openReviewStub]
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
    <>
      <Table<PpvActorRow>
        rowKey={(r) => String(r.ppvActorId)}
        columns={columns}
        dataSource={rows}
        pagination={false}
        size="small"
        bordered
      />
      <Modal
        title="Карта сведений о результатах рассмотрения"
        open={reviewStubOpen}
        onCancel={() => setReviewStubOpen(false)}
        footer={null}
        destroyOnClose
      >
        <p style={{ color: '#595959', marginBottom: 8 }}>
          Просмотр карты сведений о результате рассмотрения будет подключён позже.
        </p>
        {reviewStubEdocId ? (
          <p style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
            Идентификатор ответа (EDOCID): {reviewStubEdocId}
          </p>
        ) : null}
      </Modal>
    </>
  )
}

export default PpvAddresseesTab
