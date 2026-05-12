import { useState, useCallback, useEffect } from 'react'
import { Typography, Tabs, Descriptions, Button, Input, Collapse } from 'antd'
import { LinkOutlined, DownloadOutlined } from '@ant-design/icons'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import MeasuresTab from '@/components/tabs/dpa/MeasuresTab'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ElectronicDocumentModal from '@/components/modals/dpa/ElectronicDocumentModal'
import type { DprMetadataView, DprParsedBundle, DprResultDocRow } from '@/types/dprCard'
import type { StatusHistoryItem } from '@/types/card'
import { fetchDprStatusHistory, getIncidentAlertKindNameByCode } from '@/utils/referenceDataApi'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useLanguageOptions } from '@/hooks/shared/useLanguageOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { binaryDownloadFileName, blobMimeTypeFromDocBinaryMediaTypeCode } from '@/utils/docBinaryDownload'
import { DATE_TIME_DISPLAY_FORMAT_DATEFNS } from '@/constants/dateFormat'

const { Title, Text } = Typography

function formatDt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    const d = parseISO(iso)
    if (isNaN(d.getTime())) return iso
    return format(d, DATE_TIME_DISPLAY_FORMAT_DATEFNS, { locale: ru })
  } catch {
    return iso
  }
}

function formatDateOnly(s: string | null | undefined): string {
  if (!s) return '—'
  try {
    const d = s.includes('T') ? parseISO(s) : parseISO(`${s}T00:00:00`)
    if (isNaN(d.getTime())) return s
    return format(d, 'dd.MM.yyyy', { locale: ru })
  } catch {
    return s
  }
}

function dash(v: string | null | undefined): string {
  const t = (v ?? '').trim()
  return t || '—'
}

export interface DprCardProps {
  dprid: string
  guid?: string
  meta: DprMetadataView
  parsed: DprParsedBundle
}

export function DprCard({ dprid, guid, meta, parsed }: DprCardProps) {
  const { getDisplayLabel: countryLabel } = useCountryOptions()
  const { getLangCatalogSelectOptions } = useLanguageOptions()
  const { getNameByCode: shipDocKindName } = useShipDocKindOptions()
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusRows, setStatusRows] = useState<StatusHistoryItem[]>([])
  const [edocOpen, setEdocOpen] = useState(false)
  const [incidentKindLabel, setIncidentKindLabel] = useState<string>('')

  const ppvBase = (import.meta.env.VITE_PPV_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/ppv_card'
  const ppvHref =
    meta.linkedPpvid > 0 && guid?.trim()
      ? `${ppvBase}/${meta.linkedPpvid}/${encodeURIComponent(guid.trim())}`
      : null

  const openPpv = useCallback(() => {
    if (ppvHref) window.open(ppvHref, '_blank', 'noopener,noreferrer')
  }, [ppvHref])

  const openStatusHistory = useCallback(async () => {
    if (!guid?.trim()) return
    setStatusModalOpen(true)
    setStatusLoading(true)
    try {
      const rows = await fetchDprStatusHistory(dprid, guid)
      setStatusRows(
        rows.map((r) => ({
          status: r.status,
          dateTime: r.dateTime ?? '',
          employee: r.employee ?? null,
        }))
      )
    } catch {
      setStatusRows([])
    } finally {
      setStatusLoading(false)
    }
  }, [dprid, guid])

  const langLabel = useCallback(
    (code: string) => {
      const opts = getLangCatalogSelectOptions()
      const o = opts.find((x) => x.value === code)
      return o?.label ?? code
    },
    [getLangCatalogSelectOptions]
  )

  const docKindLabel = useCallback(
    (row: DprResultDocRow) => {
      if (row.docKindCode?.trim()) {
        const n = shipDocKindName(row.docKindCode.trim())
        return n || row.docKindCode
      }
      return row.docKindName?.trim() || '—'
    },
    [shipDocKindName]
  )

  useEffect(() => {
    const code = parsed.incidentAlert.typeCode?.trim()
    if (!code) {
      setIncidentKindLabel('')
      return
    }
    let cancelled = false
    getIncidentAlertKindNameByCode(code)
      .then((name) => {
        if (cancelled) return
        setIncidentKindLabel(name?.trim() ? `${code} — ${name}` : code)
      })
      .catch(() => {
        if (!cancelled) setIncidentKindLabel(code)
      })
    return () => {
      cancelled = true
    }
  }, [parsed.incidentAlert.typeCode])

  const downloadBinary = (row: DprResultDocRow) => {
    const base64Content = row.docBinaryText?.trim()
    if (!base64Content) return
    try {
      const binaryString = atob(base64Content)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i)
      const mime = blobMimeTypeFromDocBinaryMediaTypeCode(row.docBinaryMediaTypeCode)
      const blob = new Blob([bytes], { type: mime })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = binaryDownloadFileName(row.docBinaryMediaTypeCode, undefined, undefined)
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      /* ignore */
    }
  }

  const downloadAnyXml = (row: DprResultDocRow) => {
    const xml = row.anyDetailsXml?.trim()
    if (!xml) return
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'document.xml'
    link.click()
    URL.revokeObjectURL(url)
  }

  const docPanels = parsed.resultDocuments.map((row, i) => ({
    key: String(i),
    label: `Документ ${i + 1}`,
    children: (
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Страна">
          {row.countryCode ? `${row.countryCode} — ${countryLabel(row.countryCode) || row.countryCode}` : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Язык">{row.languageCode ? langLabel(row.languageCode) : '—'}</Descriptions.Item>
        <Descriptions.Item label="Вид">{docKindLabel(row)}</Descriptions.Item>
        <Descriptions.Item label="Наименование">{dash(row.docName)}</Descriptions.Item>
        <Descriptions.Item label="Серия">{dash(row.docSeriesId)}</Descriptions.Item>
        <Descriptions.Item label="Номер">{dash(row.docId)}</Descriptions.Item>
        <Descriptions.Item label="Дата документа">{formatDateOnly(row.docCreationDate)}</Descriptions.Item>
        <Descriptions.Item label="Срок действия. Начало">{formatDateOnly(row.docStartDate)}</Descriptions.Item>
        <Descriptions.Item label="Срок действия. Окончание">{formatDateOnly(row.docValidityDate)}</Descriptions.Item>
        <Descriptions.Item label="Срок действия">{dash(row.docValidityDuration)}</Descriptions.Item>
        <Descriptions.Item label="Уполномоченный орган. Идентификатор">{dash(row.authorityId)}</Descriptions.Item>
        <Descriptions.Item label="Уполномоченный орган. Наименование">{dash(row.authorityName)}</Descriptions.Item>
        <Descriptions.Item label="Описание">{dash(row.descriptionText)}</Descriptions.Item>
        <Descriptions.Item label="Количество листов">{dash(row.pageQuantity)}</Descriptions.Item>
        <Descriptions.Item label="Документ в бинарном виде">
          {row.docBinaryText?.trim() ? (
            <Button type="link" icon={<DownloadOutlined />} onClick={() => downloadBinary(row)}>
              Скачать
            </Button>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="XML">
          {row.anyDetailsXml?.trim() ? (
            <Button type="link" icon={<DownloadOutlined />} onClick={() => downloadAnyXml(row)}>
              Скачать
            </Button>
          ) : (
            '—'
          )}
        </Descriptions.Item>
      </Descriptions>
    ),
  }))

  return (
    <div className="dpr-card-root">
      <div className="dpr-card-header">
        <Title level={4} style={{ margin: '0 0 8px' }}>
          Карта сведений о результатах рассмотрения
        </Title>
        <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small" colon>
          <Descriptions.Item label="Исходная карта">
            {ppvHref ? (
              <Button type="link" icon={<LinkOutlined />} onClick={openPpv} style={{ padding: 0, height: 'auto' }}>
                {dash(meta.incidentId)}
              </Button>
            ) : (
              <Text>{dash(meta.incidentId)}</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Страна">{dash(meta.responseCountryName)}</Descriptions.Item>
          <Descriptions.Item label="Статус">
            <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={openStatusHistory}>
              {dash(meta.dprStatusName)}
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label="Электронный документ">
            <Button type="link" style={{ padding: 0, height: 'auto' }} onClick={() => setEdocOpen(true)}>
              Открыть
            </Button>
          </Descriptions.Item>
          <Descriptions.Item label="Источник">{dash(meta.datasourceKindName)}</Descriptions.Item>
          <Descriptions.Item label="Дата создания">{formatDt(meta.creationDateTime)}</Descriptions.Item>
          <Descriptions.Item label="Дата изменения">{formatDt(meta.modificationDateTime)}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
          Кнопки действий (редактирование, удаление, смена статуса и т.д.) будут добавлены отдельно по правилам доступа.
        </div>
      </div>

      <div className="dpr-card-tabs-wrap">
        <Tabs
          defaultActiveKey="notification"
          items={[
            {
              key: 'notification',
              label: 'Уведомление',
              children: (
                <div style={{ padding: 16 }}>
                  <Typography.Title level={5}>Уполномоченный орган</Typography.Title>
                  <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="Страна">
                      {parsed.notifyingAuthority.country
                        ? `${parsed.notifyingAuthority.country} — ${countryLabel(parsed.notifyingAuthority.country) || parsed.notifyingAuthority.country}`
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Идентификатор">{dash(parsed.notifyingAuthority.identifier)}</Descriptions.Item>
                    <Descriptions.Item label="Наименование">{dash(parsed.notifyingAuthority.name)}</Descriptions.Item>
                    <Descriptions.Item label="Краткое наименование">{dash(parsed.notifyingAuthority.shortName)}</Descriptions.Item>
                  </Descriptions>
                  <Typography.Title level={5}>Исходная карта сведений о выявленных нарушениях</Typography.Title>
                  <Descriptions column={1} bordered size="small">
                    <Descriptions.Item label="Страна">
                      {parsed.incidentAlert.country
                        ? `${parsed.incidentAlert.country} — ${countryLabel(parsed.incidentAlert.country) || parsed.incidentAlert.country}`
                        : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Регистрационный номер">{dash(parsed.incidentAlert.registrationNumber)}</Descriptions.Item>
                    <Descriptions.Item label="Вид уведомления">{incidentKindLabel || dash(parsed.incidentAlert.typeCode)}</Descriptions.Item>
                    <Descriptions.Item label="Дата формирования">{formatDateOnly(parsed.incidentAlert.formationDate)}</Descriptions.Item>
                  </Descriptions>
                </div>
              ),
            },
            {
              key: 'measures',
              label: 'Принятые меры',
              children: (
                <div style={{ padding: 16 }}>
                  <MeasuresTab data={parsed.measures} />
                </div>
              ),
            },
            {
              key: 'results',
              label: 'Описание результатов',
              children: (
                <div style={{ padding: 16 }}>
                  <Typography.Title level={5}>Описание результатов рассмотрения</Typography.Title>
                  <Input.TextArea
                    readOnly
                    value={parsed.resultDescription ?? ''}
                    placeholder="—"
                    autoSize={{ minRows: 3, maxRows: 16 }}
                    style={{ marginBottom: 16 }}
                  />
                  <Typography.Title level={5}>Документы</Typography.Title>
                  {docPanels.length === 0 ? (
                    <Text type="secondary">Нет приложенных документов</Text>
                  ) : (
                    <Collapse items={docPanels} />
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      <StatusHistoryModal
        visible={statusModalOpen}
        data={statusRows}
        loading={statusLoading}
        onClose={() => setStatusModalOpen(false)}
      />
      <ElectronicDocumentModal
        visible={edocOpen}
        data={parsed.electronicDocument}
        onClose={() => setEdocOpen(false)}
      />
    </div>
  )
}
