import { useState, useCallback, useEffect, useMemo, type CSSProperties } from 'react'
import { Typography, Tabs, Descriptions, Button, Input, Collapse, Space, message, Modal, Spin } from 'antd'
import { LinkOutlined, DownloadOutlined } from '@ant-design/icons'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import SmdMeasureImplementationView from '@/cards/smd/tabs/SmdMeasureImplementationView'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ElectronicDocumentModal from '@/components/modals/dpa/ElectronicDocumentModal'
import AccessModal from '@/components/modals/dpa/AccessModal'
import SaveBlockingErrorsModal from '@/components/modals/SaveBlockingErrorsModal'
import { CardActions } from '@/cards/shared'
import type { SmrMetadataView, SmrParsedBundle, SmrResultDocRow } from '@/types/smrCard'
import { SmrSourceMeasureCardView } from '@/cards/smr/SmrSourceMeasureCardView'
import { formatSmrCountryName, SMR_SOURCE_MEASURE_CARD_TITLE } from '@/cards/smr/smrDisplayUtils'
import type { MeasureImplementationItem, StatusHistoryItem } from '@/types/card'
import {
  fetchSmrResolutions,
  postSmrSave,
  postSmrDeleteDraft,
  postSmrStatusChange,
  fetchSmrStatusHistory,
} from '@/cards/smr/smrApi'
import type { SmrResolutionRow } from '@/types/smrCard'
import {
  fetchCurrentUser,
  fetchRightsByGuid,
  getSmrAuthorityFilterDepIdsFromRights,
} from '@/utils/referenceDataApi'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useLanguageOptions } from '@/hooks/shared/useLanguageOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { binaryDownloadFileName, blobMimeTypeFromDocBinaryMediaTypeCode } from '@/utils/docBinaryDownload'
import { DATE_TIME_DISPLAY_FORMAT_DATEFNS } from '@/constants/dateFormat'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'
import { outgoingSmrStatusButton, incomingSmrCompleteProcessingButton } from '@/utils/smrStatusButtonConfig'
import { visibleStatusButton, type StatusButtonResult } from '@/utils/statusButtonConfig'
import {
  collectSmrFormatValidationErrors,
  collectSmrSaveLogicalErrors,
  validateSmrOutgoingCardFull,
} from '@/utils/smrCardValidation'
import { exportSmrParsedBundleToXml } from '@/utils/xmlExporter'
import { SmrResultDocumentsEdit } from '@/cards/smr/SmrResultDocumentsEdit'
import { DprResultDescriptionField } from '@/cards/dpr/DprResultDescriptionField'
import { SmrRespondingAuthorityEdit } from '@/cards/smr/SmrRespondingAuthorityEdit'
import { SmrMeasureImplementationEdit } from '@/cards/smr/SmrMeasureImplementationEdit'
import { smrValidationReportContent } from '@/cards/smr/smrValidationReportContent'
import { buildSmdCardViewUrl } from '@/utils/smrCardUrl'
import {
  isSmrRespondingAuthorityNameFilled,
  MARK_READY_AUTHORITY_REQUIRED_MESSAGE,
} from '@/utils/markReadyAuthorityValidation'

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
  height: '100vh',
  maxHeight: '100vh',
  overflow: 'hidden',
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

function cloneImplementations(items: MeasureImplementationItem[]): MeasureImplementationItem[] {
  return JSON.parse(JSON.stringify(items)) as MeasureImplementationItem[]
}

function utf8ToBase64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
}

function readinessLevelForMarkReadyDialog(
  rightsDepKindId: number | null,
  depKindName: string | null
): string {
  if (rightsDepKindId === 72) return 'районного уровня'
  if (rightsDepKindId === 73) return 'областного уровня'
  if (rightsDepKindId === 74) return 'республиканского уровня'
  const t = depKindName?.trim()
  return t || 'подразделения'
}

const SMR_HEADER_TITLE = 'Карта результатов рассмотрений'

export interface SmrCardProps {
  smrId: string
  guid?: string
  meta: SmrMetadataView
  parsed: SmrParsedBundle
  onDataRefresh?: () => Promise<void>
}

export function SmrCard({ smrId, guid, meta, parsed, onDataRefresh }: SmrCardProps) {
  const { getDisplayLabel: countryLabel, countryOptions } = useCountryOptions()
  const { getLangCatalogSelectOptions } = useLanguageOptions()
  const { getNameByCode: shipDocKindName } = useShipDocKindOptions()

  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusRows, setStatusRows] = useState<StatusHistoryItem[]>([])
  const [edocOpen, setEdocOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusActionLoading, setStatusActionLoading] = useState(false)
  const [validateLoading, setValidateLoading] = useState(false)
  const [authEdit, setAuthEdit] = useState({
    country: '',
    authorityUid: undefined as string | undefined,
    name: '',
    shortName: '',
  })
  const [authorityFilterDepIds, setAuthorityFilterDepIds] = useState<string[] | null>(null)
  const [descText, setDescText] = useState('')
  const [hasStatusRight, setHasStatusRight] = useState(false)
  const [hasIncomingCompleteRight, setHasIncomingCompleteRight] = useState(false)
  const [resolutionRows, setResolutionRows] = useState<SmrResolutionRow[]>([])
  const [userDepKindCode, setUserDepKindCode] = useState<string | null>(null)
  const [userDepKindName, setUserDepKindName] = useState<string | null>(null)
  const [userRightsDepKindId, setUserRightsDepKindId] = useState<number | null>(null)
  const [accessModalVisible, setAccessModalVisible] = useState(false)
  const [implementationsEdit, setImplementationsEdit] = useState<MeasureImplementationItem[]>([])
  const [documentsEdit, setDocumentsEdit] = useState<SmrResultDocRow[]>([])
  const [saveBlockingErrorsVisible, setSaveBlockingErrorsVisible] = useState(false)
  const [saveBlockingErrors, setSaveBlockingErrors] = useState<string[]>([])

  const smdHref =
    meta.linkedSmdid > 0 && guid?.trim()
      ? `${buildSmdCardViewUrl(meta.linkedSmdid, guid.trim())}?tab=review`
      : null

  const accessSmdid = meta.linkedSmdid > 0 ? String(meta.linkedSmdid) : ''
  const outgoing = String(meta.datasourceKindCode ?? '').trim() === '2'
  const canEditCard = meta.canEdit === true
  const canDeleteDraft = meta.canDeleteDraft === true
  const canValidateOutgoingCard = meta.canValidateOutgoingCard === true
  const statusId = meta.smrStatusId ?? null
  const isDraftAuthority =
    statusId === 4 ||
    (meta.smrStatusCode ?? '').toUpperCase() === 'DRAFT' ||
    /черновик/i.test(meta.smrStatusName ?? '')

  const openSmd = useCallback(() => {
    if (smdHref) window.location.assign(smdHref)
  }, [smdHref])

  const reloadResolutions = useCallback(async () => {
    if (!guid?.trim()) {
      setResolutionRows([])
      return
    }
    try {
      const list = await fetchSmrResolutions(smrId, guid)
      setResolutionRows(Array.isArray(list) ? list : [])
    } catch {
      setResolutionRows([])
    }
  }, [smrId, guid])

  useEffect(() => {
    if (!guid?.trim()) {
      setHasStatusRight(false)
      setHasIncomingCompleteRight(false)
      setUserDepKindCode(null)
      setUserDepKindName(null)
      setUserRightsDepKindId(null)
      return
    }
    let cancelled = false
    ;(async () => {
      const u = await fetchCurrentUser(guid)
      if (cancelled) return
      if (outgoing) {
        setHasStatusRight(meta.canChangeOutgoingStatus === true)
        setHasIncomingCompleteRight(false)
      } else {
        setHasStatusRight(false)
        setHasIncomingCompleteRight(meta.canCompleteIncomingProcessing === true)
      }
      setUserDepKindCode(u.depKindCode ?? null)
      setUserDepKindName(u.depKindName ?? null)
      setUserRightsDepKindId(u.rightsDepKindId ?? null)
    })()
    return () => {
      cancelled = true
    }
  }, [guid, outgoing, meta.canChangeOutgoingStatus, meta.canCompleteIncomingProcessing])

  useEffect(() => {
    void reloadResolutions()
  }, [reloadResolutions, meta.modificationDateTime, meta.smrStatusName])

  useEffect(() => {
    if (!guid?.trim() || !outgoing) {
      setAuthorityFilterDepIds(null)
      return
    }
    let cancelled = false
    fetchRightsByGuid(guid.trim())
      .then((rights) => {
        if (!cancelled) {
          setAuthorityFilterDepIds(getSmrAuthorityFilterDepIdsFromRights(rights))
        }
      })
      .catch(() => {
        if (!cancelled) setAuthorityFilterDepIds([])
      })
    return () => {
      cancelled = true
    }
  }, [guid, outgoing])

  const authCountryDisplay = formatSmrCountryName(
    meta.responseCountryCode ?? parsed.respondingAuthority.country,
    countryOptions,
    meta.responseCountryName
  )

  const headerCountryDisplay = formatSmrCountryName(
    meta.responseCountryCode ?? parsed.respondingAuthority.country,
    countryOptions,
    meta.responseCountryName
  )

  const parsedForValidation: SmrParsedBundle = useMemo(() => {
    if (!isEditMode) return parsed
    return {
      ...parsed,
      respondingAuthority: {
        country: (authEdit.country || parsed.respondingAuthority.country)?.trim() ?? '',
        identifier: '',
        name: authEdit.name.trim(),
        shortName: authEdit.shortName.trim(),
      },
      resultDescription: descText.trim() || null,
      measureImplementations: implementationsEdit,
      resultDocuments: documentsEdit,
    }
  }, [isEditMode, parsed, authEdit, descText, implementationsEdit, documentsEdit])

  const beginEdit = useCallback(() => {
    setAuthEdit({
      country: meta.responseCountryCode?.trim() || parsed.respondingAuthority.country?.trim() || '',
      authorityUid: meta.authorityUid?.trim() || undefined,
      name: parsed.respondingAuthority.name?.trim() ?? '',
      shortName: parsed.respondingAuthority.shortName?.trim() ?? '',
    })
    setDescText(parsed.resultDescription?.trim() ?? '')
    setImplementationsEdit(cloneImplementations(parsed.measureImplementations ?? []))
    setDocumentsEdit(JSON.parse(JSON.stringify(parsed.resultDocuments ?? [])) as SmrResultDocRow[])
    setIsEditMode(true)
  }, [parsed, meta])

  const cancelEdit = useCallback(() => {
    setSaveBlockingErrorsVisible(false)
    setSaveBlockingErrors([])
    setIsEditMode(false)
  }, [])

  const saveEdit = useCallback(async () => {
    const g = guid?.trim()
    if (!g) {
      message.error('Нет GUID')
      return
    }
    setSaving(true)
    try {
      const bundle: SmrParsedBundle = {
        ...parsed,
        respondingAuthority: {
          country: (authEdit.country || parsed.respondingAuthority.country)?.trim() ?? '',
          identifier: '',
          name: authEdit.name.trim(),
          shortName: authEdit.shortName.trim(),
        },
        resultDescription: descText.trim() || null,
        measureImplementations: implementationsEdit,
        resultDocuments: documentsEdit,
      }
      const blockingErrors = [
        ...collectSmrFormatValidationErrors(bundle),
        ...collectSmrSaveLogicalErrors(bundle),
      ]
      if (blockingErrors.length > 0) {
        setSaveBlockingErrors(blockingErrors)
        setSaveBlockingErrorsVisible(true)
        return
      }
      const fullXml = exportSmrParsedBundleToXml(bundle)
      await postSmrSave({
        guid: g,
        smrId,
        smrXmlB64: utf8ToBase64(fullXml),
        authorityId: authEdit.authorityUid?.trim() || undefined,
      })
      setSaveBlockingErrorsVisible(false)
      setSaveBlockingErrors([])
      setIsEditMode(false)
      await onDataRefresh?.()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [guid, smrId, parsed, authEdit, descText, implementationsEdit, documentsEdit, onDataRefresh])

  const runForcedCardValidation = useCallback(async () => {
    if (!guid?.trim()) {
      message.error('Нет GUID')
      return
    }
    setValidateLoading(true)
    try {
      const xml = exportSmrParsedBundleToXml(parsedForValidation)
      const vr = await validateSmrOutgoingCardFull(parsedForValidation, xml)
      if (!vr.success) {
        Modal.info({
          title: 'Результат валидации карты',
          width: 640,
          content: (
            <div>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                Обнаружены замечания по результатам контроля:
              </Typography.Paragraph>
              {smrValidationReportContent(vr)}
            </div>
          ),
        })
      } else {
        message.success('Все контроли пройдены успешно.')
      }
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка валидации карты')
    } finally {
      setValidateLoading(false)
    }
  }, [guid, parsedForValidation])

  const docRegDisplay = useMemo(() => {
    const cc = (meta.docCountryCode ?? parsed.measureDoc.country ?? '').trim()
    const id = (meta.docId ?? parsed.measureDoc.docId ?? '').trim()
    return [cc, id].filter(Boolean).join(' ') || '—'
  }, [meta.docCountryCode, meta.docId, parsed.measureDoc])

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
          content: `Результат рассмотрения временной санитарной меры ${docRegDisplay} будет переведен в статус „Обработано". Продолжить?`,
          okText: 'Завершить',
          cancelText: 'Отмена',
          okButtonProps: { type: 'primary' },
          onOk: async () => {
            setStatusActionLoading(true)
            try {
              const res = await postSmrStatusChange(smrId, 'complete_processing', { guid: g })
              message.success(res.newStatus ? `Статус: ${res.newStatus}` : 'Выполнено')
              await onDataRefresh?.()
              await reloadResolutions()
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
      if (action === 'mark_ready') {
        if (!isSmrRespondingAuthorityNameFilled(parsedForValidation)) {
          message.error(MARK_READY_AUTHORITY_REQUIRED_MESSAGE)
          return
        }
        const levelLabel = readinessLevelForMarkReadyDialog(userRightsDepKindId, userDepKindName)
        Modal.confirm({
          title: 'Отметка о готовности',
          content: `Внимание! После подтверждения по результату рассмотрения временной санитарной меры ${docRegDisplay} будет зафиксирована отметка о готовности на уровне ${levelLabel}. Отменить данное действие будет невозможно. Продолжить?`,
          okText: 'Продолжить',
          cancelText: 'Отмена',
          onOk: async () => {
            setStatusActionLoading(true)
            try {
              const res = await postSmrStatusChange(smrId, 'mark_ready', { guid: g })
              message.success(res.newStatus ? `Статус: ${res.newStatus}` : 'Выполнено')
              await onDataRefresh?.()
              await reloadResolutions()
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
            'Направить сведения о результатах рассмотрения участникам органа по сотрудничеству в рамках решения Комиссии №57 (ОП 57)?',
          okText: 'Направить',
          cancelText: 'Отмена',
          onOk: async () => {
            setStatusActionLoading(true)
            try {
              const xml = exportSmrParsedBundleToXml(parsedForValidation)
              const vr = await validateSmrOutgoingCardFull(parsedForValidation, xml)
              if (!vr.success) {
                Modal.error({
                  title: 'Направление сведений недоступно',
                  width: 640,
                  content: (
                    <div>
                      <Typography.Paragraph style={{ marginBottom: 12 }}>
                        Необходимо доработать карту исходящих сведений. Направление сведений участникам ОП 57
                        не выполнено. Отчёт по проверкам:
                      </Typography.Paragraph>
                      {smrValidationReportContent(vr)}
                    </div>
                  ),
                })
                return
              }
              const res = await postSmrStatusChange(smrId, 'send', { guid: g })
              message.success(res.newStatus ? `Статус: ${res.newStatus}` : 'Выполнено')
              await onDataRefresh?.()
              await reloadResolutions()
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
      setStatusActionLoading(true)
      try {
        const res = await postSmrStatusChange(smrId, action, { guid: g })
        message.success(res.newStatus ? `Статус: ${res.newStatus}` : 'Выполнено')
        await onDataRefresh?.()
        await reloadResolutions()
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
      } finally {
        setStatusActionLoading(false)
      }
    },
    [smrId, guid, onDataRefresh, reloadResolutions, parsedForValidation, docRegDisplay, userRightsDepKindId, userDepKindName]
  )

  const requestDeleteDraft = useCallback(() => {
    const g = guid?.trim()
    if (!g || !smdHref) {
      message.error('Нет данных для перехода к связанной карте SMD')
      return
    }
    Modal.confirm({
      title: 'Подтверждение',
      content: `Результат рассмотрения временной санитарной меры ${docRegDisplay} будет удален безвозвратно. Продолжить?`,
      okText: 'Продолжить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await postSmrDeleteDraft({ guid: g, smrId })
          message.open({
            type: 'success',
            content: 'Черновик карты успешно удален',
            duration: 3,
            style: {
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              top: '15vh',
              marginTop: 0,
            } as CSSProperties,
            onClose: () => {
              window.location.assign(smdHref)
            },
          })
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e)
          Modal.error({
            title: 'Ошибка',
            content: `Не удалось выполнить удаление черновика. Причина: ${reason}`,
            okText: 'Ок',
          })
          throw e
        }
      },
    })
  }, [guid, smdHref, smrId, docRegDisplay])

  const openStatusHistory = useCallback(async () => {
    const g = guid?.trim()
    if (!g) {
      message.warning('Для просмотра истории укажите доступ к карте (guid)')
      return
    }
    setStatusModalOpen(true)
    setStatusLoading(true)
    try {
      const rows = await fetchSmrStatusHistory(smrId, g)
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
  }, [smrId, guid])

  const langLabel = useCallback(
    (code: string) => {
      const opts = getLangCatalogSelectOptions()
      const o = opts.find((x) => x.value === code)
      return o?.label ?? code
    },
    [getLangCatalogSelectOptions]
  )

  const docKindLabel = useCallback(
    (row: SmrResultDocRow) => {
      if (row.docKindCode?.trim()) {
        const n = shipDocKindName(row.docKindCode.trim())
        return n || row.docKindCode
      }
      return row.docKindName?.trim() || '—'
    },
    [shipDocKindName]
  )

  const downloadBinary = (row: SmrResultDocRow) => {
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

  const downloadAnyXml = (row: SmrResultDocRow) => {
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

  const docPanels = useMemo(
    () =>
      parsed.resultDocuments.map((row, i) => ({
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
      })),
    [parsed.resultDocuments, countryLabel, langLabel, docKindLabel]
  )

  const statusBtn = outgoing
    ? outgoingSmrStatusButton(
        meta.smrStatusCode,
        statusId,
        meta.smrStatusName ?? '',
        hasStatusRight,
        meta.canSendOutgoing === true,
        resolutionRows,
        userDepKindCode,
        userDepKindName,
        userRightsDepKindId
      )
    : ({ config: null, comment: '' } satisfies StatusButtonResult)

  const incomingCompleteBtn = !outgoing
    ? incomingSmrCompleteProcessingButton(
        meta.smrStatusCode,
        statusId,
        meta.smrStatusName ?? '',
        hasIncomingCompleteRight
      )
    : ({ config: null, comment: '' } satisfies StatusButtonResult)

  const cardActionsPrimaryStatus = visibleStatusButton(
    outgoing ? statusBtn.config : incomingCompleteBtn.config
  )
  const cardActionsStatusComment = outgoing ? statusBtn.comment : incomingCompleteBtn.comment
  const cardActionsCloseStatus = visibleStatusButton(
    outgoing ? statusBtn.closeConfig ?? statusBtn.sendOp57Config : null
  )

  return (
    <div
      style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      className="fade-in card-page-layout"
    >
      <div className="card-sticky-header" style={CARD_STICKY_HEADER_STYLE}>
        <div className="card-sticky-header-title-row">
          <span className="card-sticky-header-title">{SMR_HEADER_TITLE}</span>
          <Space size="small" wrap>
            {!isEditMode && canEditCard ? (
              <Button type="default" onClick={beginEdit}>
                Редактировать
              </Button>
            ) : null}
            {isEditMode ? (
              <>
                <Button
                  type="primary"
                  onClick={() => void saveEdit()}
                  loading={saving}
                  disabled={saveBlockingErrorsVisible}
                >
                  Сохранить
                </Button>
                {outgoing ? (
                  <Button
                    type="default"
                    loading={validateLoading}
                    disabled={saving || saveBlockingErrorsVisible}
                    onClick={() => void runForcedCardValidation()}
                  >
                    Валидация карты
                  </Button>
                ) : null}
                <Button onClick={cancelEdit} disabled={saving || saveBlockingErrorsVisible || validateLoading}>
                  Отменить
                </Button>
              </>
            ) : (
              <>
                {outgoing && canValidateOutgoingCard ? (
                  <Button type="default" loading={validateLoading} onClick={() => void runForcedCardValidation()}>
                    Валидация карты
                  </Button>
                ) : null}
                <Button
                  onClick={() => {
                    postMessageFromCardToParent({ code: 'exit' }, 'SMR: закрыть форму')
                  }}
                >
                  Закрыть
                </Button>
              </>
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
              <Button type="link" icon={<LinkOutlined />} onClick={openSmd} style={{ padding: 0, height: 'auto' }}>
                {docRegDisplay}
              </Button>
            ) : (
              <Text>{docRegDisplay}</Text>
            )}
          </Descriptions.Item>
          <Descriptions.Item label="Страна">{headerCountryDisplay}</Descriptions.Item>
          <Descriptions.Item label="Статус">
            {isEditMode ? (
              <Text>{dash(meta.smrStatusName)}</Text>
            ) : (
              <Button
                type="link"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => void openStatusHistory()}
              >
                {dash(meta.smrStatusName)}
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
            onDefineAccess={
              accessSmdid && guid?.trim()
                ? () => {
                    setAccessModalVisible(true)
                  }
                : undefined
            }
            showDeleteButton={canDeleteDraft}
            deleteButtonDisabled={!smdHref}
            deleteButtonHint={!smdHref ? 'Нет связанной карты SMD — удаление недоступно' : undefined}
            onDelete={() => void requestDeleteDraft()}
            statusButton={cardActionsPrimaryStatus}
            statusButtonComment={cardActionsStatusComment}
            closeButton={cardActionsCloseStatus}
            onStatusAction={(action) => void runStatusAction(action)}
            onElectronicDocumentClick={() => setEdocOpen(true)}
            statusButtonsLoading={statusActionLoading}
          />
        )}

        <div className="card-tabs-wrapper">
          <Tabs
            defaultActiveKey="notification"
            items={[
              {
                key: 'notification',
                label: 'Уведомление',
                children: (
                  <div style={{ padding: 16 }}>
                    <Typography.Title level={5}>Уполномоченный орган</Typography.Title>
                    {isEditMode ? (
                      <SmrRespondingAuthorityEdit
                        value={{
                          country: authEdit.country || parsed.respondingAuthority.country || '',
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
                      />
                    ) : (
                      <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
                        <Descriptions.Item label="Страна">{authCountryDisplay}</Descriptions.Item>
                        <Descriptions.Item label="Идентификатор">—</Descriptions.Item>
                        <Descriptions.Item label="Наименование">{dash(parsed.respondingAuthority.name)}</Descriptions.Item>
                        <Descriptions.Item label="Краткое наименование">
                          {dash(parsed.respondingAuthority.shortName)}
                        </Descriptions.Item>
                      </Descriptions>
                    )}
                    <Typography.Title level={5} style={{ marginTop: isEditMode ? 0 : 24 }}>
                      {SMR_SOURCE_MEASURE_CARD_TITLE}
                    </Typography.Title>
                    <SmrSourceMeasureCardView
                      doc={parsed.measureDoc}
                      countryCodeFallback={meta.docCountryCode}
                      docIdFallback={meta.docId}
                      docDateFallback={meta.docCreationDate}
                    />
                  </div>
                ),
              },
              {
                key: 'implementations',
                label: 'Мероприятия',
                children: (
                  <div style={{ padding: 16 }}>
                    {isEditMode ? (
                      <SmrMeasureImplementationEdit
                        items={implementationsEdit}
                        onChange={setImplementationsEdit}
                      />
                    ) : parsed.measureImplementations.length > 0 ? (
                      <SmdMeasureImplementationView items={parsed.measureImplementations} />
                    ) : (
                      <Text type="secondary">Сведения о мероприятиях не указаны</Text>
                    )}
                  </div>
                ),
              },
              {
                key: 'results',
                label: 'Описание результатов',
                children: (
                  <div style={{ padding: 16 }}>
                    <DprResultDescriptionField
                      value={isEditMode ? descText : parsed.resultDescription ?? ''}
                      onChange={isEditMode ? setDescText : undefined}
                      readOnly={!isEditMode}
                    />
                    <Typography.Title level={5}>Документы</Typography.Title>
                    {isEditMode ? (
                      <SmrResultDocumentsEdit documents={documentsEdit} onChange={setDocumentsEdit} />
                    ) : docPanels.length === 0 ? (
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
      <AccessModal
        visible={accessModalVisible}
        data={[]}
        onClose={() => setAccessModalVisible(false)}
        onUpdate={() => {
          void onDataRefresh?.()
        }}
        smdid={accessSmdid || undefined}
        source={meta.datasourceKindName ?? undefined}
        datasourceKindCode={
          meta.datasourceKindCode != null ? String(meta.datasourceKindCode) : undefined
        }
        guid={guid}
      />
      <SaveBlockingErrorsModal
        visible={saveBlockingErrorsVisible}
        errors={saveBlockingErrors}
        onClose={() => setSaveBlockingErrorsVisible(false)}
      />
    </div>
  )
}

export default SmrCard
