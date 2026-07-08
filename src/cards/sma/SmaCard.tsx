import { useState, useCallback, useEffect, useMemo, type CSSProperties } from 'react'
import {
  Typography,
  Tabs,
  Descriptions,
  Button,
  Input,
  Collapse,
  Space,
  message,
  Modal,
  Segmented,
  Table,
} from 'antd'
import { LinkOutlined, DownloadOutlined } from '@ant-design/icons'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ElectronicDocumentModal from '@/components/modals/dpa/ElectronicDocumentModal'
import { CardActions } from '@/cards/shared'
import type {
  SmaMetadataView,
  SmaParsedBundle,
  SmaDocRow,
  SmaCardKind,
  SmarResponseKind,
} from '@/types/smaCard'
import type { StatusHistoryItem } from '@/types/card'
import {
  postSmaSave,
  postSmaDeleteDraft,
  postSmaStatusChange,
  fetchSmaStatusHistory,
} from '@/cards/sma/smaApi'
import { fetchRightsByGuid, getSmrAuthorityFilterDepIdsFromRights, type RightsJson } from '@/utils/referenceDataApi'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useLanguageOptions } from '@/hooks/shared/useLanguageOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { useIncidentAlertKindOptions } from '@/hooks/shared/useIncidentAlertKindOptions'
import { binaryDownloadFileName, blobMimeTypeFromDocBinaryMediaTypeCode } from '@/utils/docBinaryDownload'
import { DATE_TIME_DISPLAY_FORMAT_DATEFNS } from '@/constants/dateFormat'
import { exportSmaParsedBundleToXml } from '@/utils/xmlExporter'
import { SmaDocumentsEdit } from '@/cards/sma/SmaDocumentsEdit'
import { SmaAuthorityEdit } from '@/cards/sma/SmaAuthorityEdit'
import {
  SmarAbsentResponseFields,
  defaultSmarAbsentResponseValue,
  type SmarAbsentResponseValue,
} from '@/cards/sma/SmarAbsentResponseFields'
import { SMAR_EDOCCODE_ABSENT, SMAR_EDOCCODE_INFO } from '@/constants/smarResponse'
import { buildSmdCardViewUrl, buildSmaqCardViewUrl } from '@/utils/smaCardUrl'
import { outgoingSmaStatusButton, incomingSmaCompleteProcessingButton } from '@/utils/smaStatusButtonConfig'
import { visibleStatusButton } from '@/utils/statusButtonConfig'

const { Text } = Typography

const CARD_STICKY_HEADER_STYLE: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 100,
  background: '#ffffff',
  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
  padding: '0 24px 2px 24px',
  isolation: 'isolate',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '20vh',
  overflow: 'auto',
  flexShrink: 0,
}

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

function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}

function getSmarAuthorityFilterDepIdsFromRights(rights: RightsJson | null | undefined): string[] {
  const edit = rights?.up?.sanitaryMeasureOut?.edit
  if (!edit || typeof edit !== 'object') return []
  return Object.keys(edit).filter((k) => k != null && String(k).trim() !== '')
}

function resolveSmarResponseKind(
  meta: SmaMetadataView,
  parsed: SmaParsedBundle
): SmarResponseKind {
  const fromMeta = (meta.edocCode ?? '').trim()
  if (fromMeta === SMAR_EDOCCODE_ABSENT) return 'absent'
  const fromXml = (parsed.electronicDocument.documentCode ?? '').trim()
  if (fromXml === SMAR_EDOCCODE_ABSENT) return 'absent'
  return 'info'
}

function absentValueFromParsed(p: SmaParsedBundle): SmarAbsentResponseValue {
  const defaults = defaultSmarAbsentResponseValue()
  return {
    eventDateTime: p.eventDateTime?.trim() || defaults.eventDateTime,
    processingResultV2Code: p.processingResultV2Code?.trim() || defaults.processingResultV2Code,
    descriptionText: p.descriptionText?.trim() || null,
  }
}

function smaCardTitle(kind: SmaCardKind): string {
  return kind === 'smaq'
    ? 'Карта запроса дополнительных сведений'
    : 'Карта ответа на запрос дополнительных сведений'
}

export interface SmaCardProps {
  kind: SmaCardKind
  cardId: string
  guid?: string
  meta: SmaMetadataView
  parsed: SmaParsedBundle
  onDataRefresh?: () => Promise<void>
}

export function SmaCard({ kind, cardId, guid, meta, parsed, onDataRefresh }: SmaCardProps) {
  const { getDisplayLabel: countryLabel } = useCountryOptions()
  const { getLangCatalogSelectOptions } = useLanguageOptions()
  const { getNameByCode: shipDocKindName } = useShipDocKindOptions()
  const { getNameByCode: incidentKindName } = useIncidentAlertKindOptions()

  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusRows, setStatusRows] = useState<StatusHistoryItem[]>([])
  const [edocOpen, setEdocOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusActionLoading, setStatusActionLoading] = useState(false)
  const [authEdit, setAuthEdit] = useState({
    country: '',
    authorityUid: undefined as string | undefined,
    name: '',
    shortName: '',
  })
  const [authorityFilterDepIds, setAuthorityFilterDepIds] = useState<string[] | null>(null)
  const [descText, setDescText] = useState('')
  const [sanitaryProductTypeCode, setSanitaryProductTypeCode] = useState('')
  const [productName, setProductName] = useState('')
  const [laboratoryTestMethodName, setLaboratoryTestMethodName] = useState('')
  const [documentsEdit, setDocumentsEdit] = useState<SmaDocRow[]>([])
  const [responseKind, setResponseKind] = useState<SmarResponseKind>(() =>
    resolveSmarResponseKind(meta, parsed)
  )
  const [absentResponse, setAbsentResponse] = useState<SmarAbsentResponseValue>(() =>
    absentValueFromParsed(parsed)
  )

  const outgoing = String(meta.datasourceKindCode ?? '').trim() === '2'
  const canEditCard = meta.canEdit === true
  const canDeleteDraft = meta.canDeleteDraft === true
  const statusId = meta.statusId ?? null
  const isDraftAuthority =
    statusId === 4 ||
    (meta.statusCode ?? '').toUpperCase() === 'DRAFT' ||
    /черновик/i.test(meta.statusName ?? '')

  const isAbsentResponse = kind === 'smar' && responseKind === 'absent'

  const smdHref =
    meta.linkedSmdid > 0 && guid?.trim()
      ? `${buildSmdCardViewUrl(meta.linkedSmdid, guid.trim())}?tab=info`
      : null

  const smaqHref =
    kind === 'smar' && meta.linkedSmaqid != null && meta.linkedSmaqid > 0 && guid?.trim()
      ? buildSmaqCardViewUrl(meta.linkedSmaqid, guid.trim())
      : null

  const docRegDisplay = useMemo(() => {
    const cc = (meta.docCountryCode ?? parsed.measureDocReference.country ?? '').trim()
    const id = (meta.docId ?? parsed.measureDocReference.docId ?? '').trim()
    return [cc, id].filter(Boolean).join(' ') || '—'
  }, [meta.docCountryCode, meta.docId, parsed.measureDocReference])

  const authCountryDisplay =
    (parsed.authority.country ?? '').trim()
      ? `${parsed.authority.country} — ${countryLabel(parsed.authority.country) || parsed.authority.country}`
      : meta.requestCountryName?.trim() || '—'

  const requestCountryDisplay = meta.requestCountryName?.trim() || '—'

  useEffect(() => {
    if (!guid?.trim() || !outgoing) {
      setAuthorityFilterDepIds(null)
      return
    }
    let cancelled = false
    fetchRightsByGuid(guid.trim())
      .then((rights) => {
        if (!cancelled) {
          const depIds =
            kind === 'smaq'
              ? getSmrAuthorityFilterDepIdsFromRights(rights)
              : getSmarAuthorityFilterDepIdsFromRights(rights)
          setAuthorityFilterDepIds(depIds)
        }
      })
      .catch(() => {
        if (!cancelled) setAuthorityFilterDepIds([])
      })
    return () => {
      cancelled = true
    }
  }, [guid, outgoing, kind])

  const parsedForSave: SmaParsedBundle = useMemo(() => {
    if (!isEditMode) return parsed
    return {
      ...parsed,
      electronicDocument: {
        ...parsed.electronicDocument,
        documentCode: isAbsentResponse ? SMAR_EDOCCODE_ABSENT : SMAR_EDOCCODE_INFO,
      },
      eventDateTime: isAbsentResponse ? absentResponse.eventDateTime : null,
      processingResultV2Code: isAbsentResponse ? absentResponse.processingResultV2Code : null,
      authority: {
        country: (authEdit.country || parsed.authority.country)?.trim() ?? '',
        identifier: authEdit.authorityUid?.trim() ?? parsed.authority.identifier ?? '',
        name: authEdit.name.trim(),
        shortName: authEdit.shortName.trim(),
      },
      descriptionText: isAbsentResponse
        ? absentResponse.descriptionText?.trim() || null
        : descText.trim() || null,
      sanitaryProductTypeCode: isAbsentResponse ? null : sanitaryProductTypeCode.trim() || null,
      productName: isAbsentResponse ? null : productName.trim() || null,
      laboratoryTestMethodName: isAbsentResponse ? null : laboratoryTestMethodName.trim() || null,
      documents: isAbsentResponse ? [] : documentsEdit,
    }
  }, [
    isEditMode,
    parsed,
    authEdit,
    descText,
    sanitaryProductTypeCode,
    productName,
    laboratoryTestMethodName,
    documentsEdit,
    isAbsentResponse,
    absentResponse,
  ])

  const beginEdit = useCallback(() => {
    setAuthEdit({
      country: parsed.authority.country?.trim() ?? '',
      authorityUid: parsed.authority.identifier?.trim() || undefined,
      name: parsed.authority.name?.trim() ?? '',
      shortName: parsed.authority.shortName?.trim() ?? '',
    })
    setDescText(parsed.descriptionText?.trim() ?? '')
    setSanitaryProductTypeCode(parsed.sanitaryProductTypeCode?.trim() ?? '')
    setProductName(parsed.productName?.trim() ?? '')
    setLaboratoryTestMethodName(parsed.laboratoryTestMethodName?.trim() ?? '')
    setDocumentsEdit(JSON.parse(JSON.stringify(parsed.documents ?? [])) as SmaDocRow[])
    setAbsentResponse(absentValueFromParsed(parsed))
    setResponseKind(resolveSmarResponseKind(meta, parsed))
    setIsEditMode(true)
  }, [parsed, meta])

  const cancelEdit = useCallback(() => {
    setIsEditMode(false)
    setResponseKind(resolveSmarResponseKind(meta, parsed))
    setAbsentResponse(absentValueFromParsed(parsed))
  }, [meta, parsed])

  const saveEdit = useCallback(async () => {
    const g = guid?.trim()
    if (!g) {
      message.error('Нет GUID')
      return
    }
    setSaving(true)
    try {
      const xml = exportSmaParsedBundleToXml(parsedForSave, {
        responseKind: kind === 'smar' ? responseKind : undefined,
      })
      await postSmaSave({
        kind,
        id: cardId,
        guid: g,
        smaXmlB64: utf8ToBase64(xml),
        responseKind: kind === 'smar' ? responseKind : undefined,
      })
      setIsEditMode(false)
      await onDataRefresh?.()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [guid, kind, cardId, parsedForSave, responseKind, onDataRefresh])

  const runStatusAction = useCallback(
    async (action: string) => {
      const g = guid?.trim()
      if (!g) {
        message.error('Нет GUID')
        return
      }
      if (action === 'complete_processing') {
        Modal.confirm({
          title: 'Завершение обработки',
          content: `Карта ${kind === 'smaq' ? 'запроса' : 'ответа'} ${docRegDisplay} будет переведена в статус „Обработано". Продолжить?`,
          okText: 'Завершить',
          cancelText: 'Отмена',
          onOk: async () => {
            setStatusActionLoading(true)
            try {
              const res = await postSmaStatusChange(kind, cardId, 'complete_processing', g)
              message.success(res.newStatus ? `Статус: ${res.newStatus}` : 'Выполнено')
              await onDataRefresh?.()
            } catch (e) {
              message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
              throw e
            } finally {
              setStatusActionLoading(false)
            }
          },
        })
        return
      }
      if (action === 'send') {
        Modal.confirm({
          title: 'Подтверждение',
          content:
            'Направить сведения участникам органа по сотрудничеству в рамках решения Комиссии №58 (ОП 58)?',
          okText: 'Направить',
          cancelText: 'Отмена',
          onOk: async () => {
            setStatusActionLoading(true)
            try {
              const res = await postSmaStatusChange(kind, cardId, 'send', g)
              message.success(res.newStatus ? `Статус: ${res.newStatus}` : 'Выполнено')
              await onDataRefresh?.()
            } catch (e) {
              message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
              throw e
            } finally {
              setStatusActionLoading(false)
            }
          },
        })
        return
      }
    },
    [guid, kind, cardId, onDataRefresh, docRegDisplay]
  )

  const requestDeleteDraft = useCallback(() => {
    const g = guid?.trim()
    if (!g || !smdHref) {
      message.error('Нет данных для перехода к связанной карте SMD')
      return
    }
    Modal.confirm({
      title: 'Подтверждение',
      content: `Черновик карты ${docRegDisplay} будет удален безвозвратно. Продолжить?`,
      okText: 'Продолжить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await postSmaDeleteDraft({ kind, id: cardId, guid: g })
          message.success('Черновик карты успешно удален')
          window.location.assign(smdHref)
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Ошибка удаления')
          throw e
        }
      },
    })
  }, [guid, smdHref, kind, cardId, docRegDisplay])

  const openStatusHistory = useCallback(async () => {
    const g = guid?.trim()
    if (!g) {
      message.warning('Для просмотра истории укажите доступ к карте (guid)')
      return
    }
    setStatusModalOpen(true)
    setStatusLoading(true)
    try {
      const rows = await fetchSmaStatusHistory(kind, cardId, g)
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
  }, [kind, cardId, guid])

  const langLabel = useCallback(
    (code: string) => {
      const opts = getLangCatalogSelectOptions()
      const o = opts.find((x) => x.value === code)
      return o?.label ?? code
    },
    [getLangCatalogSelectOptions]
  )

  const docKindLabel = useCallback(
    (row: SmaDocRow) => {
      if (row.docKindCode?.trim()) {
        const n = shipDocKindName(row.docKindCode.trim())
        return n || row.docKindCode
      }
      return row.docKindName?.trim() || '—'
    },
    [shipDocKindName]
  )

  const downloadBinary = (row: SmaDocRow) => {
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

  const docPanels = useMemo(
    () =>
      parsed.documents.map((row, i) => ({
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
            <Descriptions.Item label="Номер">{dash(row.docId)}</Descriptions.Item>
            <Descriptions.Item label="Дата документа">{formatDateOnly(row.docCreationDate)}</Descriptions.Item>
            <Descriptions.Item label="Описание">{dash(row.descriptionText)}</Descriptions.Item>
            <Descriptions.Item label="Документ в бинарном виде">
              {row.docBinaryText?.trim() ? (
                <Button type="link" icon={<DownloadOutlined />} onClick={() => downloadBinary(row)}>
                  Скачать
                </Button>
              ) : (
                '—'
              )}
            </Descriptions.Item>
          </Descriptions>
        ),
      })),
    [parsed.documents, countryLabel, langLabel, docKindLabel]
  )

  const incidentRow = parsed.incidentAlert
  const hasIncident =
    incidentRow.country?.trim() ||
    incidentRow.registrationNumber?.trim() ||
    incidentRow.typeCode?.trim() ||
    incidentRow.formationDate?.trim()

  const statusBtn = outgoing
    ? outgoingSmaStatusButton(meta.statusCode, meta.statusName ?? '', meta.canSend === true)
    : { config: null, comment: '' }

  const incomingCompleteBtn = !outgoing
    ? incomingSmaCompleteProcessingButton(
        meta.statusCode,
        meta.statusName ?? '',
        meta.canCompleteIncomingProcessing === true
      )
    : { config: null, comment: '' }

  const cardActionsPrimaryStatus = visibleStatusButton(
    outgoing ? statusBtn.config : incomingCompleteBtn.config
  )

  const descLabel =
    kind === 'smaq'
      ? 'Описание запроса'
      : isAbsentResponse
        ? 'Описание результата обработки'
        : 'Описание ответа'

  return (
    <div
      style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      className="fade-in card-page-layout"
    >
      <div className="card-sticky-header" style={CARD_STICKY_HEADER_STYLE}>
        <div className="card-sticky-header-title-row">
          <span className="card-sticky-header-title">{smaCardTitle(kind)}</span>
          <Space size="small" wrap>
            {!isEditMode && canEditCard ? (
              <Button type="default" onClick={beginEdit}>
                Редактировать
              </Button>
            ) : null}
            {isEditMode ? (
              <>
                <Button type="primary" onClick={() => void saveEdit()} loading={saving}>
                  Сохранить
                </Button>
                <Button onClick={cancelEdit} disabled={saving}>
                  Отменить
                </Button>
              </>
            ) : (
              <Button
                onClick={() => {
                  if (smdHref) window.location.assign(smdHref)
                  else message.info('Связанная карта SMD не найдена')
                }}
              >
                Закрыть
              </Button>
            )}
          </Space>
        </div>
        <Descriptions
          column={{ xxl: 4, xl: 4, lg: 4, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          style={{ margin: 0 }}
          className="card-header-descriptions"
        >
          <Descriptions.Item label="Исходная карта SMD">
            {smdHref ? (
              <Button
                type="link"
                icon={<LinkOutlined />}
                onClick={() => window.location.assign(smdHref)}
                style={{ padding: 0, height: 'auto' }}
              >
                {docRegDisplay}
              </Button>
            ) : (
              <Text>{docRegDisplay}</Text>
            )}
          </Descriptions.Item>
          {kind === 'smar' ? (
            <Descriptions.Item label="Связанный запрос SMAQ">
              {smaqHref ? (
                <Button
                  type="link"
                  icon={<LinkOutlined />}
                  onClick={() => window.location.assign(smaqHref)}
                  style={{ padding: 0, height: 'auto' }}
                >
                  SMAQ {meta.linkedSmaqid}
                </Button>
              ) : (
                <Text>—</Text>
              )}
            </Descriptions.Item>
          ) : null}
          <Descriptions.Item label="Страна запроса">{requestCountryDisplay}</Descriptions.Item>
          <Descriptions.Item label="Статус">
            {isEditMode ? (
              <Text>{dash(meta.statusName)}</Text>
            ) : (
              <Button
                type="link"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => void openStatusHistory()}
              >
                {dash(meta.statusName)}
              </Button>
            )}
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

        {isEditMode ? (
          <CardActions
            statusButton={null}
            closeButton={null}
            onStatusAction={() => {}}
            onElectronicDocumentClick={() => setEdocOpen(true)}
          />
        ) : (
          <CardActions
            showDeleteButton={canDeleteDraft}
            deleteButtonDisabled={!smdHref}
            deleteButtonHint={!smdHref ? 'Нет связанной карты SMD — удаление недоступно' : undefined}
            onDelete={() => void requestDeleteDraft()}
            statusButton={cardActionsPrimaryStatus}
            statusButtonComment={outgoing ? statusBtn.comment : incomingCompleteBtn.comment}
            onStatusAction={(action) => void runStatusAction(action)}
            onElectronicDocumentClick={() => setEdocOpen(true)}
            statusButtonsLoading={statusActionLoading}
          />
        )}
      </div>

      <div className="card-tabs-wrapper" style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
        <Tabs
          defaultActiveKey="main"
          items={[
            {
              key: 'main',
              label: 'Сведения',
              children: (
                <div style={{ padding: 16 }}>
                  {kind === 'smar' ? (
                    <div style={{ marginBottom: 24 }}>
                      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                        Вид ответа
                      </Typography.Text>
                      <Segmented
                        disabled={!isEditMode}
                        value={responseKind}
                        onChange={(v) => {
                          const next = v as SmarResponseKind
                          setResponseKind(next)
                          if (next === 'absent') {
                            setAbsentResponse((prev) => ({
                              ...defaultSmarAbsentResponseValue(),
                              descriptionText: (prev.descriptionText ?? descText.trim()) || null,
                            }))
                          }
                        }}
                        options={[
                          { label: 'Дополнительные сведения', value: 'info' },
                          { label: 'Сведения отсутствуют', value: 'absent' },
                        ]}
                      />
                    </div>
                  ) : null}

                  {!isAbsentResponse ? (
                    <>
                      <Typography.Title level={5}>Уполномоченный орган</Typography.Title>
                      {isEditMode ? (
                        <SmaAuthorityEdit
                          value={{
                            country: authEdit.country || parsed.authority.country || '',
                            authorityUid: authEdit.authorityUid,
                            name: authEdit.name,
                            shortName: authEdit.shortName,
                          }}
                          onChange={(next) =>
                            setAuthEdit({
                              country: next.country,
                              authorityUid: next.authorityUid,
                              name: next.name,
                              shortName: next.shortName,
                            })
                          }
                          countryDisplay={authCountryDisplay}
                          isDraft={isDraftAuthority}
                          allowedAuthorityIds={authorityFilterDepIds}
                          roleLabel={
                            kind === 'smaq'
                              ? 'Уполномоченный орган, запросивший сведения'
                              : 'Уполномоченный орган, представивший ответ'
                          }
                        />
                      ) : (
                        <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                          <Descriptions.Item label="Страна">{authCountryDisplay}</Descriptions.Item>
                          <Descriptions.Item label="Наименование">{dash(parsed.authority.name)}</Descriptions.Item>
                          <Descriptions.Item label="Краткое наименование">
                            {dash(parsed.authority.shortName)}
                          </Descriptions.Item>
                        </Descriptions>
                      )}

                      <Typography.Title level={5}>
                        Исходная карта сведений о временной санитарной мере
                      </Typography.Title>
                      <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="Страна">
                          {parsed.measureDocReference.country
                            ? `${parsed.measureDocReference.country} — ${countryLabel(parsed.measureDocReference.country) || parsed.measureDocReference.country}`
                            : dash(parsed.measureCountryCode)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Номер документа">
                          {dash(parsed.measureDocReference.docId ?? meta.docId)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Дата документа">
                          {formatDateOnly(parsed.measureDocReference.docCreationDate ?? meta.docCreationDate)}
                        </Descriptions.Item>
                      </Descriptions>

                      <Typography.Title level={5}>Уведомление о нежелательной ситуации</Typography.Title>
                      {hasIncident ? (
                        <Table
                          size="small"
                          pagination={false}
                          rowKey={() => '0'}
                          dataSource={[incidentRow]}
                          columns={[
                            {
                              title: 'Страна',
                              key: 'country',
                              render: (_, row) => countryLabel(row.country) || row.country || '—',
                            },
                            {
                              title: 'Рег. номер',
                              key: 'registrationNumber',
                              render: (_, row) => dash(row.registrationNumber),
                            },
                            {
                              title: 'Вид',
                              key: 'type',
                              render: (_, row) => {
                                const code = row.typeCode?.trim()
                                if (!code) return '—'
                                const name = incidentKindName(code)
                                return name ? `${code} — ${name}` : code
                              },
                            },
                            {
                              title: 'Дата',
                              key: 'formationDate',
                              render: (_, row) => formatDateOnly(row.formationDate),
                            },
                          ]}
                          style={{ marginBottom: 16 }}
                        />
                      ) : (
                        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                          Уведомление не указано
                        </Text>
                      )}

                      <Typography.Title level={5}>
                        {kind === 'smaq' ? 'Запрос' : 'Ответ на запрос'}
                      </Typography.Title>
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary">{descLabel}</Typography.Text>
                        <Input.TextArea
                          readOnly={!isEditMode}
                          value={isEditMode ? descText : parsed.descriptionText ?? ''}
                          onChange={(e) => setDescText(e.target.value)}
                          autoSize={{ minRows: 3, maxRows: 12 }}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary">Код вида продукции</Typography.Text>
                        <Input
                          readOnly={!isEditMode}
                          value={isEditMode ? sanitaryProductTypeCode : parsed.sanitaryProductTypeCode ?? ''}
                          onChange={(e) => setSanitaryProductTypeCode(e.target.value)}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary">Наименование продукции</Typography.Text>
                        <Input
                          readOnly={!isEditMode}
                          value={isEditMode ? productName : parsed.productName ?? ''}
                          onChange={(e) => setProductName(e.target.value)}
                          style={{ marginTop: 4 }}
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <Typography.Text type="secondary">Метод (вид) исследования</Typography.Text>
                        <Input
                          readOnly={!isEditMode}
                          value={
                            isEditMode ? laboratoryTestMethodName : parsed.laboratoryTestMethodName ?? ''
                          }
                          onChange={(e) => setLaboratoryTestMethodName(e.target.value)}
                          style={{ marginTop: 4 }}
                        />
                      </div>

                      <Typography.Title level={5}>Документы</Typography.Title>
                      {isEditMode ? (
                        <SmaDocumentsEdit documents={documentsEdit} onChange={setDocumentsEdit} />
                      ) : docPanels.length === 0 ? (
                        <Text type="secondary">Нет приложенных документов</Text>
                      ) : (
                        <Collapse items={docPanels} />
                      )}
                    </>
                  ) : (
                    <>
                      <Typography.Title level={5}>Сведения отсутствуют</Typography.Title>
                      <SmarAbsentResponseFields
                        value={isEditMode ? absentResponse : absentValueFromParsed(parsed)}
                        onChange={isEditMode ? setAbsentResponse : undefined}
                        readOnly={!isEditMode}
                      />
                    </>
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
        title="История смены статуса карты"
        hideEmployeeWhenMissing
        employeeColumnTitle="ФИО / код сотрудника"
      />
      <ElectronicDocumentModal
        visible={edocOpen}
        data={parsed.electronicDocument}
        onClose={() => setEdocOpen(false)}
      />
    </div>
  )
}

export default SmaCard
