import { useEffect, useState, useMemo, useCallback } from 'react'
import { Table, Spin, Alert, Tooltip, Button, Space } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { SmdReviewResultRow } from '@/types/smdCard'
import { fetchSmdReviewResults } from '@/cards/smd/smdApi'
import { buildSmrCardCreateUrl, buildSmrCardViewUrl } from '@/utils/smdCardUrl'

interface SmdReviewResultsTabProps {
  smdid: string
  guid?: string
  hasPersisted: boolean
  canPrepareReviewResult: boolean
}

const SmdReviewResultsTab: React.FC<SmdReviewResultsTabProps> = ({
  smdid,
  guid,
  hasPersisted,
  canPrepareReviewResult,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<SmdReviewResultRow[]>([])

  useEffect(() => {
    if (!hasPersisted || !smdid || smdid === '-') {
      setRows([])
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchSmdReviewResults(smdid, guid)
      .then((list) => {
        if (!cancelled) setRows(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setRows([])
          setError(e instanceof Error ? e.message : 'Не удалось загрузить результаты рассмотрения')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [smdid, guid, hasPersisted])

  const g = guid?.trim()

  const openUrl = useCallback((url: string) => {
    window.location.assign(url)
  }, [])

  const columns: ColumnsType<SmdReviewResultRow> = useMemo(
    () => [
      {
        title: 'Страна',
        dataIndex: 'countryName',
        key: 'countryName',
        render: (v: string | null, record) => {
          const name = v?.trim()
          if (name) return name
          const code = record.countryCode?.trim()
          return code || '—'
        },
      },
      {
        title: 'Дата',
        dataIndex: 'creationDateTime',
        key: 'creationDateTime',
        render: (v: string | null) => (v && String(v).trim() ? v : '—'),
      },
      {
        title: 'Результат рассмотрения',
        key: 'resultLink',
        width: 120,
        align: 'center',
        render: (_: unknown, record: SmdReviewResultRow) => {
          if (!g) {
            return (
              <Tooltip title="Для перехода нужен GUID в адресе страницы">
                <Button type="link" disabled icon={<FileTextOutlined style={{ fontSize: 18 }} />} />
              </Tooltip>
            )
          }
          return (
            <Tooltip title="Открыть карту сведений о результате рассмотрения меры">
              <Button
                type="link"
                icon={<FileTextOutlined style={{ fontSize: 18 }} />}
                onClick={() => openUrl(buildSmrCardViewUrl(record.smrId, g))}
                aria-label="Открыть карту сведений о результате рассмотрения меры"
              />
            </Tooltip>
          )
        },
      },
      {
        title: 'Статус',
        dataIndex: 'statusName',
        key: 'statusName',
        render: (v: string | null) => (v && String(v).trim() ? v : '—'),
      },
    ],
    [g, openUrl]
  )

  if (!hasPersisted) {
    return (
      <Alert
        type="info"
        showIcon
        message="Результаты рассмотрения появятся после сохранения карты в БД."
      />
    )
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 24 }}>
        <Spin />
      </div>
    )
  }

  if (error) {
    return <Alert type="error" message={error} showIcon />
  }

  return (
    <div>
      {canPrepareReviewResult && g && (
        <Space style={{ marginBottom: 12 }}>
          <Button type="primary" onClick={() => openUrl(buildSmrCardCreateUrl(smdid, g))}>
            Подготовить результат рассмотрения
          </Button>
        </Space>
      )}
      {rows.length === 0 ? (
        <div style={{ padding: 8, color: '#595959' }}>Данные о результатах рассмотрения не найдены</div>
      ) : (
        <Table<SmdReviewResultRow>
          rowKey={(r) => String(r.smrId)}
          columns={columns}
          dataSource={rows}
          pagination={false}
          size="small"
          bordered
        />
      )}
    </div>
  )
}

export default SmdReviewResultsTab
