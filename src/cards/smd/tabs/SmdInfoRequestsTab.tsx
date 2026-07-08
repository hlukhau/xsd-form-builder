import { useEffect, useState, useMemo, useCallback } from 'react'
import { Table, Spin, Alert, Tooltip, Button, Space } from 'antd'
import { FileTextOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { SmdInfoRequestApiRow, SmdInfoRequestTableRow } from '@/types/smdCard'
import { fetchSmdInfoRequests } from '@/cards/smd/smdApi'
import {
  buildSmaqCardCreateUrl,
  buildSmaqCardViewUrl,
  buildSmarCardCreateUrl,
  buildSmarCardViewUrl,
} from '@/utils/smaCardUrl'

interface SmdInfoRequestsTabProps {
  smdid: string
  guid?: string
  hasPersisted: boolean
  /** Загружать данные только когда вкладка активна. */
  enabled?: boolean
  isIncoming?: boolean
  isOutgoing?: boolean
  canAddInfoRequest: boolean
  canAddResponse: boolean
}

function buildTableRows(apiRows: SmdInfoRequestApiRow[]): SmdInfoRequestTableRow[] {
  const byRequest = new Map<number, SmdInfoRequestApiRow[]>()
  for (const row of apiRows) {
    const list = byRequest.get(row.smaqId) ?? []
    list.push(row)
    byRequest.set(row.smaqId, list)
  }

  const result: SmdInfoRequestTableRow[] = []
  const sortedKeys = [...byRequest.keys()].sort((a, b) => a - b)
  for (const smaqId of sortedKeys) {
    const rows = byRequest.get(smaqId) ?? []
    const withResponses = rows.filter((r) => r.smarId != null && r.smarId > 0)
    const displayRows = withResponses.length > 0 ? withResponses : [rows[0]]
    const hasAnyResponse = withResponses.length > 0
    displayRows.forEach((r, idx) => {
      result.push({
        ...r,
        key: `${smaqId}-${r.smarId ?? 'none'}-${idx}`,
        requestRowSpan: idx === 0 ? displayRows.length : 0,
        hasAnyResponseForRequest: hasAnyResponse,
      })
    })
  }
  return result
}

function normalizeEdocCode(edocCode: string | null | undefined): string {
  return (edocCode ?? '').trim().replace(/\./g, '').toUpperCase()
}

function isAbsentResponseCode(edocCode: string | null | undefined): boolean {
  return normalizeEdocCode(edocCode) === 'R006'
}

function responseTooltip(edocCode: string | null | undefined): string {
  if (isAbsentResponseCode(edocCode)) return 'Сведения отсутствуют'
  const code = (edocCode ?? '').trim()
  if (code === 'R.SM.SS.09.002') return 'Дополнительные сведения'
  return code ? `Ответ (${code})` : 'Открыть карту ответа на запрос дополнительных сведений'
}

function ResponseIcon({
  edocCode,
  inactiveAbsent,
}: {
  edocCode: string | null | undefined
  inactiveAbsent?: boolean
}) {
  if (isAbsentResponseCode(edocCode)) {
    return (
      <MinusCircleOutlined
        style={{ fontSize: 18, color: inactiveAbsent ? '#fa8c16' : '#8c8c8c' }}
      />
    )
  }
  return <FileTextOutlined style={{ fontSize: 18, color: '#1677ff' }} />
}

const SmdInfoRequestsTab: React.FC<SmdInfoRequestsTabProps> = ({
  smdid,
  guid,
  hasPersisted,
  enabled = true,
  isIncoming,
  isOutgoing,
  canAddInfoRequest,
  canAddResponse,
}) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiRows, setApiRows] = useState<SmdInfoRequestApiRow[]>([])

  useEffect(() => {
    if (!enabled || !hasPersisted || !smdid || smdid === '-') {
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchSmdInfoRequests(smdid, guid)
      .then((list) => {
        if (!cancelled) setApiRows(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setApiRows([])
          setError(e instanceof Error ? e.message : 'Не удалось загрузить запросы сведений')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [smdid, guid, hasPersisted, enabled])

  const tableRows = useMemo(() => buildTableRows(apiRows), [apiRows])
  const g = guid?.trim()

  const openUrl = useCallback((url: string) => {
    window.location.assign(url)
  }, [])

  const linkIconStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    lineHeight: 1,
    cursor: 'pointer',
  }

  const requestCellProps = useCallback(
    (record: SmdInfoRequestTableRow) => ({ rowSpan: record.requestRowSpan }),
    []
  )

  const columns: ColumnsType<SmdInfoRequestTableRow> = useMemo(
    () => [
      {
        title: 'Страна запроса',
        dataIndex: 'countryName',
        key: 'countryName',
        onCell: requestCellProps,
        render: (v: string | null) => (v && String(v).trim() ? v : '—'),
      },
      {
        title: 'Дата запроса',
        dataIndex: 'requestDateTime',
        key: 'requestDateTime',
        onCell: requestCellProps,
        render: (v: string | null) => (v && String(v).trim() ? v : '—'),
      },
      {
        title: '№ запроса',
        dataIndex: 'requestVersion',
        key: 'requestVersion',
        width: 100,
        onCell: requestCellProps,
        render: (v: number | null) => (v != null ? String(v) : '—'),
      },
      {
        title: 'Запрос',
        key: 'requestLink',
        width: 72,
        align: 'center',
        onCell: requestCellProps,
        render: (_: unknown, record: SmdInfoRequestTableRow) => {
          if (!g) {
            return (
              <Tooltip title="Для перехода укажите GUID в адресе карты">
                <span style={{ ...linkIconStyle, opacity: 0.4, cursor: 'not-allowed' }}>
                  <FileTextOutlined style={{ fontSize: 18 }} />
                </span>
              </Tooltip>
            )
          }
          const href = buildSmaqCardViewUrl(record.smaqId, g)
          return (
            <Tooltip title="Карта запроса дополнительных сведений">
              <a
                href={href}
                style={linkIconStyle}
                aria-label="Открыть карту запроса дополнительных сведений"
              >
                <FileTextOutlined style={{ fontSize: 18, color: '#1677ff' }} />
              </a>
            </Tooltip>
          )
        },
      },
      {
        title: 'Статус запроса',
        dataIndex: 'requestStatusName',
        key: 'requestStatusName',
        onCell: requestCellProps,
        render: (v: string | null) => (v && String(v).trim() ? v : '—'),
      },
      {
        title: 'Дата ответа',
        dataIndex: 'responseDateTime',
        key: 'responseDateTime',
        render: (v: string | null) => (v && String(v).trim() ? v : '—'),
      },
      {
        title: '№ ответа',
        dataIndex: 'responseVersion',
        key: 'responseVersion',
        width: 90,
        render: (v: number | null) => (v != null ? String(v) : '—'),
      },
      {
        title: 'Ответ',
        key: 'responseLink',
        width: 100,
        align: 'center',
        render: (_: unknown, record: SmdInfoRequestTableRow) => {
          const smarId = record.smarId
          if (smarId != null && smarId > 0) {
            if (!g) {
              return (
                <Tooltip title="Для перехода укажите GUID в адресе карты">
                  <span style={{ ...linkIconStyle, opacity: 0.4, cursor: 'not-allowed' }}>
                    <ResponseIcon edocCode={record.edocCode} />
                  </span>
                </Tooltip>
              )
            }
            const tip = responseTooltip(record.edocCode)
            const absentOnOutgoing = isOutgoing && isAbsentResponseCode(record.edocCode)
            if (absentOnOutgoing) {
              return (
                <Tooltip title={tip}>
                  <span
                    style={{ ...linkIconStyle, cursor: 'default', opacity: 1 }}
                    aria-label={tip}
                  >
                    <ResponseIcon edocCode={record.edocCode} inactiveAbsent />
                  </span>
                </Tooltip>
              )
            }
            const href = buildSmarCardViewUrl(smarId, g)
            return (
              <Tooltip title={tip}>
                <a
                  href={href}
                  style={linkIconStyle}
                  aria-label={tip}
                >
                  <ResponseIcon edocCode={record.edocCode} />
                </a>
              </Tooltip>
            )
          }
          if (canAddResponse && g) {
            return (
              <Tooltip title="Добавить ответ на запрос дополнительных сведений">
                <Button
                  type="link"
                  size="small"
                  onClick={() => openUrl(buildSmarCardCreateUrl(record.smaqId, g))}
                >
                  Добавить
                </Button>
              </Tooltip>
            )
          }
          return '—'
        },
      },
      {
        title: 'Статус ответа',
        dataIndex: 'responseStatusName',
        key: 'responseStatusName',
        render: (v: string | null) => (v && String(v).trim() ? v : '—'),
      },
    ],
    [g, canAddResponse, isOutgoing, openUrl, requestCellProps]
  )

  if (!hasPersisted) {
    return (
      <Alert type="info" showIcon message="Запросы сведений появятся после сохранения карты в БД." />
    )
  }

  if (!g) {
    return (
      <Alert
        type="warning"
        showIcon
        message="Укажите GUID в адресе карты (…/smd_card/{SMDID}/{GUID}), чтобы загрузить запросы сведений."
      />
    )
  }

  if (!enabled) {
    return null
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

  const emptyHint = isIncoming
    ? 'Запросы дополнительных сведений не найдены. Нажмите «Добавить», чтобы создать запрос.'
    : isOutgoing
      ? 'Запросы дополнительных сведений от стран ЕАЭС не найдены. После получения запроса здесь можно подготовить ответ.'
      : 'Данные о запросах дополнительных сведений не найдены'

  return (
    <div>
      {canAddInfoRequest && g && (
        <Space style={{ marginBottom: 12 }}>
          <Button type="default" icon={<PlusOutlined />} onClick={() => openUrl(buildSmaqCardCreateUrl(smdid, g))}>
            Добавить
          </Button>
        </Space>
      )}
      {tableRows.length === 0 ? (
        <div style={{ padding: 8, color: '#595959' }}>{emptyHint}</div>
      ) : (
        <Table<SmdInfoRequestTableRow>
          rowKey="key"
          columns={columns}
          dataSource={tableRows}
          pagination={false}
          size="small"
          bordered
          scroll={{ x: 'max-content' }}
        />
      )}
    </div>
  )
}

export default SmdInfoRequestsTab
