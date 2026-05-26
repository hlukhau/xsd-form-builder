import { useState, useCallback, useEffect, useMemo, type CSSProperties, type ReactNode } from 'react'
import { Typography, Tabs, Descriptions, Button, Input, Collapse, Space, message, Modal, Spin } from 'antd'
import { LinkOutlined, DownloadOutlined } from '@ant-design/icons'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import MeasuresTab from '@/components/tabs/dpa/MeasuresTab'
import MeasuresTabEdit from '@/components/tabs/dpa/MeasuresTabEdit'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ElectronicDocumentModal from '@/components/modals/dpa/ElectronicDocumentModal'
import AccessModal from '@/components/modals/dpa/AccessModal'
import XMLComparisonModal, { type ComparisonResultShape } from '@/components/modals/dpa/XMLComparisonModal'
import { CardActions } from '@/cards/shared'
import type { DprMetadataView, DprParsedBundle, DprResultDocRow } from '@/types/dprCard'
import type { StatusHistoryItem } from '@/types/card'
import { OUTGOING_MEASURE_START_DATE_REQUIRED_REMARK, type ValidationResult } from '@/utils/cardValidation'
import {
  fetchDprStatusHistory,
  getIncidentAlertKindNameByCode,
  fetchCurrentUser,
  fetchDprResolutions,
  fetchDprXml,
  postDprSave,
  changeDprStatus,
  postDprDeleteDraft,
  fetchRightsByGuid,
  fetchRightsByGuidRaw,
  type RightsJson,
} from '@/utils/referenceDataApi'
import type { DprResolutionRow } from '@/types/dprCard'
import type { MeasuresData } from '@/types/card'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useLanguageOptions } from '@/hooks/shared/useLanguageOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { binaryDownloadFileName, blobMimeTypeFromDocBinaryMediaTypeCode } from '@/utils/docBinaryDownload'
import { DATE_TIME_DISPLAY_FORMAT_DATEFNS } from '@/constants/dateFormat'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'
import { outgoingDprStatusButton, incomingDprCompleteProcessingButton } from '@/utils/dprStatusButtonConfig'
import { visibleStatusButton, type StatusButtonResult } from '@/utils/statusButtonConfig'
import { validateDprOutgoingCardFull } from '@/utils/dprCardValidation'
import { compareDprResponseXml, exportDprParsedBundleToXml } from '@/utils/xmlExporter'
import { DprResultDocumentsEdit } from '@/cards/dpr/DprResultDocumentsEdit'
import { DprNotifyingAuthorityEdit } from '@/cards/dpr/DprNotifyingAuthorityEdit'
import { getOutgoingAuthorityFilterDepIdsFromRights } from '@/utils/referenceDataApi'

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

function cloneMeasuresData(m: MeasuresData): MeasuresData {
  return JSON.parse(JSON.stringify(m)) as MeasuresData
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

/** Разбивка результата валидации DPR для модалки «Проверка перед сохранением» (XSD отдельно от прочих разделов). */
function splitDprValidationForModal(vr: ValidationResult): { format: string[]; logical: string[] } {
  const format: string[] = []
  const logical: string[] = []
  for (const sec of vr.sections) {
    const isXsd = sec.sectionName === 'Ошибки структуры (XSD)'
    for (const r of sec.remarks) {
      if (isXsd) format.push(r)
      else logical.push(`${sec.sectionName}: ${r}`)
    }
  }
  return { format, logical }
}

function dprValidationReportContent(vr: ValidationResult): ReactNode {
  return (
    <div>
      {vr.sections.map((sec) => (
        <div key={sec.sectionName} style={{ marginBottom: 12 }}>
          <Text strong>{sec.sectionName}</Text>
          <ul style={{ marginTop: 4, marginBottom: 0, paddingLeft: 20 }}>
            {sec.remarks.map((r, i) => (
              <li key={`${sec.sectionName}-${i}`}>
                <Text>{r}</Text>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export interface DprCardProps {
  dprid: string
  guid?: string
  meta: DprMetadataView
  parsed: DprParsedBundle
  /** После сохранения или смены статуса — перезагрузить XML и метаданные в родителе */
  onDataRefresh?: () => Promise<void>
}

export function DprCard({ dprid, guid, meta, parsed, onDataRefresh }: DprCardProps) {
  const { getDisplayLabel: countryLabel } = useCountryOptions()
  const { getLangCatalogSelectOptions } = useLanguageOptions()
  const { getNameByCode: shipDocKindName } = useShipDocKindOptions()
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusRows, setStatusRows] = useState<StatusHistoryItem[]>([])
  const [edocOpen, setEdocOpen] = useState(false)
  const [incidentKindLabel, setIncidentKindLabel] = useState<string>('')
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
  const [resolutionRows, setResolutionRows] = useState<DprResolutionRow[]>([])
  const [userDepKindCode, setUserDepKindCode] = useState<string | null>(null)
  const [userDepKindName, setUserDepKindName] = useState<string | null>(null)
  const [userRightsDepKindId, setUserRightsDepKindId] = useState<number | null>(null)
  const [accessModalVisible, setAccessModalVisible] = useState(false)
  const [rightsDebugVisible, setRightsDebugVisible] = useState(false)
  const [rightsDebugData, setRightsDebugData] = useState<RightsJson | null>(null)
  const [rightsDebugLoading, setRightsDebugLoading] = useState(false)
  const [rightsDebugError, setRightsDebugError] = useState<string | null>(null)
  const [rightsDebugRawText, setRightsDebugRawText] = useState<string | null>(null)
  const [measuresEdit, setMeasuresEdit] = useState<MeasuresData>({ measures: [] })
  const [documentsEdit, setDocumentsEdit] = useState<DprResultDocRow[]>([])
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResultShape | null>(null)
  const [pendingDprXmlB64, setPendingDprXmlB64] = useState<string | null>(null)
  const [comparisonFormatErrors, setComparisonFormatErrors] = useState<string[]>([])
  const [comparisonLogicalErrors, setComparisonLogicalErrors] = useState<string[]>([])

  const ppvBase = (import.meta.env.VITE_PPV_CARD_BASE as string | undefined)?.replace(/\/$/, '') || '/ppv_card'
  const ppvHref =
    meta.linkedPpvid > 0 && guid?.trim()
      ? `${ppvBase}/${meta.linkedPpvid}/${encodeURIComponent(guid.trim())}`
      : null

  const accessPpvid = meta.linkedPpvid > 0 ? String(meta.linkedPpvid) : ''

  const outgoing = String(meta.datasourceKindCode ?? '').trim() === '2'
  const canEditCard = meta.canEdit === true
  const canDeleteDraft = meta.canDeleteDraft === true
  const canValidateOutgoingCard = meta.canValidateOutgoingCard === true
  const statusId = meta.dprStatusId ?? null
  const isDraftAuthority =
    statusId === 4 ||
    (meta.dprStatusCode ?? '').toUpperCase() === 'DRAFT' ||
    /черновик/i.test(meta.dprStatusName ?? '')

  const openPpv = useCallback(() => {
    if (ppvHref) window.location.assign(ppvHref)
  }, [ppvHref])

  const reloadResolutions = useCallback(async () => {
    if (!guid?.trim()) {
      setResolutionRows([])
      return
    }
    try {
      const list = await fetchDprResolutions(dprid, guid)
      setResolutionRows(Array.isArray(list) ? list : [])
    } catch {
      setResolutionRows([])
    }
  }, [dprid, guid])

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
      if (outgoing) {
        const u = await fetchCurrentUser(guid)
        if (!cancelled) {
          setHasStatusRight(meta.canChangeOutgoingStatus === true)
          setHasIncomingCompleteRight(false)
          setUserDepKindCode(u.depKindCode ?? null)
          setUserDepKindName(u.depKindName ?? null)
          setUserRightsDepKindId(u.rightsDepKindId ?? null)
        }
      } else {
        const u = await fetchCurrentUser(guid)
        if (!cancelled) {
          setHasStatusRight(false)
          setHasIncomingCompleteRight(meta.canCompleteIncomingProcessing === true)
          setUserDepKindCode(u.depKindCode ?? null)
          setUserDepKindName(u.depKindName ?? null)
          setUserRightsDepKindId(u.rightsDepKindId ?? null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [guid, outgoing, meta.canChangeOutgoingStatus, meta.canCompleteIncomingProcessing])

  useEffect(() => {
    void reloadResolutions()
  }, [reloadResolutions, meta.modificationDateTime, meta.dprStatusName])

  useEffect(() => {
    if (!guid?.trim() || !outgoing) {
      setAuthorityFilterDepIds(null)
      return
    }
    let cancelled = false
    fetchRightsByGuid(guid.trim())
      .then((rights) => {
        if (!cancelled) {
          setAuthorityFilterDepIds(getOutgoingAuthorityFilterDepIdsFromRights(rights, true))
        }
      })
      .catch(() => {
        if (!cancelled) setAuthorityFilterDepIds([])
      })
    return () => {
      cancelled = true
    }
  }, [guid, outgoing])

  const authCountryDisplay =
    (parsed.notifyingAuthority.country ?? '').trim()
      ? `${parsed.notifyingAuthority.country} — ${countryLabel(parsed.notifyingAuthority.country) || parsed.notifyingAuthority.country}`
      : '—'

  const parsedForValidation: DprParsedBundle = useMemo(() => {
    if (!isEditMode) return parsed
    return {
      ...parsed,
      notifyingAuthority: {
        country: (authEdit.country || parsed.notifyingAuthority.country)?.trim() ?? '',
        identifier: '',
        name: authEdit.name.trim(),
        shortName: authEdit.shortName.trim(),
      },
      resultDescription: descText.trim() || null,
      measures: measuresEdit,
      resultDocuments: documentsEdit,
    }
  }, [isEditMode, parsed, authEdit, descText, measuresEdit, documentsEdit])

  const beginEdit = useCallback(() => {
    setAuthEdit({
      country: parsed.notifyingAuthority.country?.trim() ?? '',
      authorityUid: parsed.notifyingAuthority.identifier?.trim() || undefined,
      name: parsed.notifyingAuthority.name?.trim() ?? '',
      shortName: parsed.notifyingAuthority.shortName?.trim() ?? '',
    })
    setDescText(parsed.resultDescription?.trim() ?? '')
    setMeasuresEdit(cloneMeasuresData(parsed.measures ?? { measures: [] }))
    setDocumentsEdit(JSON.parse(JSON.stringify(parsed.resultDocuments ?? [])) as DprResultDocRow[])
    setIsEditMode(true)
  }, [parsed])

  const cancelEdit = useCallback(() => {
    setComparisonModalVisible(false)
    setPendingDprXmlB64(null)
    setComparisonResult(null)
    setComparisonFormatErrors([])
    setComparisonLogicalErrors([])
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
      const bundle: DprParsedBundle = {
        ...parsed,
        notifyingAuthority: {
          country: (authEdit.country || parsed.notifyingAuthority.country)?.trim() ?? '',
          identifier: '',
          name: authEdit.name.trim(),
          shortName: authEdit.shortName.trim(),
        },
        resultDescription: descText.trim() || null,
        measures: measuresEdit,
        resultDocuments: documentsEdit,
      }
      const fullXml = exportDprParsedBundleToXml(bundle)
      const originalXml = await fetchDprXml(dprid, g)
      const vr = await validateDprOutgoingCardFull(bundle, fullXml)
      const { format: fmt, logical: logRaw } = splitDprValidationForModal(vr)
      const measureStartDateHints = logRaw.filter((line) =>
        line.includes(OUTGOING_MEASURE_START_DATE_REQUIRED_REMARK)
      )
      const log = logRaw.filter((line) => !line.includes(OUTGOING_MEASURE_START_DATE_REQUIRED_REMARK))
      const cmp = compareDprResponseXml(originalXml, fullXml)
      setComparisonResult({
        isIdentical: cmp.isIdentical,
        differences: cmp.differences,
        warnings: [...cmp.warnings, ...measureStartDateHints],
        added: [],
      })
      setComparisonFormatErrors(fmt)
      setComparisonLogicalErrors(log)
      setPendingDprXmlB64(utf8ToBase64(fullXml))
      setComparisonModalVisible(true)
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка подготовки сохранения')
    } finally {
      setSaving(false)
    }
  }, [
    guid,
    dprid,
    parsed,
    authEdit,
    descText,
    measuresEdit,
    documentsEdit,
  ])

  const handleSaveToDbFromModal = useCallback(async () => {
    const g = guid?.trim()
    if (!g || !pendingDprXmlB64) return
    setSaving(true)
    try {
      await postDprSave({
        guid: g,
        dprid,
        dprXmlB64: pendingDprXmlB64,
      })
      message.success('Карта сохранена')
      setComparisonModalVisible(false)
      setPendingDprXmlB64(null)
      setComparisonResult(null)
      setComparisonFormatErrors([])
      setComparisonLogicalErrors([])
      setIsEditMode(false)
      await onDataRefresh?.()
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [guid, dprid, pendingDprXmlB64, onDataRefresh])

  const runForcedCardValidation = useCallback(async () => {
    const g = guid?.trim()
    if (!g) {
      message.error('Нет GUID')
      return
    }
    setValidateLoading(true)
    try {
      const xml = await fetchDprXml(dprid, g)
      const vr = await validateDprOutgoingCardFull(parsedForValidation, xml)
      if (!vr.success) {
        Modal.info({
          title: 'Результат валидации карты',
          width: 640,
          content: (
            <div>
              <Typography.Paragraph style={{ marginBottom: 8 }}>
                Обнаружены замечания по результатам контроля:
              </Typography.Paragraph>
              {dprValidationReportContent(vr)}
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
  }, [dprid, guid, parsedForValidation])

  const runStatusAction = useCallback(
    async (action: string) => {
      const g = guid?.trim()
      if (!g) {
        message.error('Нет GUID')
        return
      }
      if (action === 'complete_processing') {
        const ppvRegNumber = (meta.incidentId ?? parsed.incidentAlert.registrationNumber ?? '').trim() || '—'
        Modal.confirm({
          title: 'Завершение обработки',
          content: `Ответ с результатами рассмотрения сведений о выявленных нарушениях ${ppvRegNumber} будет переведен в статус „Обработано". Продолжить?`,
          okText: 'Завершить',
          cancelText: 'Отмена',
          okButtonProps: { type: 'primary' },
          onOk: async () => {
            setStatusActionLoading(true)
            try {
              const res = await changeDprStatus(dprid, 'complete_processing', { guid: g })
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
        const ppvRegNumber = (meta.incidentId ?? parsed.incidentAlert.registrationNumber ?? '').trim() || '—'
        const levelLabel = readinessLevelForMarkReadyDialog(userRightsDepKindId, userDepKindName)
        Modal.confirm({
          title: 'Отметка о готовности',
          content: `Внимание! После подтверждения по ответу с результатами рассмотрения сведений о выявленных нарушениях ${ppvRegNumber} будет зафиксирована отметка о готовности на уровне ${levelLabel}. Отменить данное действие будет невозможно. Продолжить?`,
          okText: 'Продолжить',
          cancelText: 'Отмена',
          onOk: async () => {
            setStatusActionLoading(true)
            try {
              const xml = await fetchDprXml(dprid, g)
              const vr = await validateDprOutgoingCardFull(parsed, xml)
              if (!vr.success) {
                Modal.error({
                  title: 'Отметка о готовности недоступна',
                  width: 640,
                  content: (
                    <div>
                      <Typography.Paragraph style={{ marginBottom: 8 }}>
                        Заполните обязательные поля карты, в том числе наименование уполномоченного органа
                        (csdo:AuthorityName), и повторите попытку.
                      </Typography.Paragraph>
                      {dprValidationReportContent(vr)}
                    </div>
                  ),
                })
                return
              }
              const res = await changeDprStatus(dprid, 'mark_ready', { guid: g })
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
              const xml = await fetchDprXml(dprid, g)
              const vr = await validateDprOutgoingCardFull(parsedForValidation, xml)
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
                      {dprValidationReportContent(vr)}
                    </div>
                  ),
                })
                return
              }
              const res = await changeDprStatus(dprid, 'send', { guid: g })
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
        const res = await changeDprStatus(dprid, action, { guid: g })
        message.success(res.newStatus ? `Статус: ${res.newStatus}` : 'Выполнено')
        await onDataRefresh?.()
        await reloadResolutions()
      } catch (e) {
        message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
      } finally {
        setStatusActionLoading(false)
      }
    },
    [
      dprid,
      guid,
      onDataRefresh,
      reloadResolutions,
      parsedForValidation,
      parsed.incidentAlert.registrationNumber,
      meta.incidentId,
      userRightsDepKindId,
      userDepKindName,
    ]
  )

  const requestDeleteDraft = useCallback(() => {
    const g = guid?.trim()
    if (!g || !ppvHref) {
      message.error('Нет данных для перехода к связанной карте PPV')
      return
    }
    const regDisplay =
      (parsed.incidentAlert.registrationNumber ?? meta.incidentId ?? '').trim() || '—'
    Modal.confirm({
      title: 'Подтверждение',
      content: `Ответ с результатами рассмотрения сведений о выявленных нарушениях ${regDisplay} будет удален безвозвратно. Продолжить?`,
      okText: 'Продолжить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await postDprDeleteDraft({ guid: g, dprid })
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
              window.location.assign(ppvHref)
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
  }, [guid, ppvHref, dprid, parsed.incidentAlert.registrationNumber, meta.incidentId])

  const openStatusHistory = useCallback(async () => {
    const g = guid?.trim()
    if (!g) {
      message.warning('Для просмотра истории укажите доступ к карте (guid)')
      return
    }
    setStatusModalOpen(true)
    setStatusLoading(true)
    try {
      const rows = await fetchDprStatusHistory(dprid, g)
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
      })),
    [parsed.resultDocuments, countryLabel, langLabel, docKindLabel]
  )

  const statusBtn = outgoing
    ? outgoingDprStatusButton(
        meta.dprStatusCode,
        statusId,
        meta.dprStatusName ?? '',
        hasStatusRight,
        meta.canSendOutgoing === true,
        resolutionRows,
        userDepKindCode,
        userDepKindName,
        userRightsDepKindId
      )
    : ({ config: null, comment: '' } satisfies StatusButtonResult)

  const incomingCompleteBtn = !outgoing
    ? incomingDprCompleteProcessingButton(
        meta.dprStatusCode,
        statusId,
        meta.dprStatusName ?? '',
        hasIncomingCompleteRight
      )
    : ({ config: null, comment: '' } satisfies StatusButtonResult)

  const primaryStatus = statusBtn.config
  const sendOp57Status = statusBtn.sendOp57Config

  const cardActionsPrimaryStatus = visibleStatusButton(
    outgoing ? primaryStatus : incomingCompleteBtn.config
  )
  const cardActionsStatusComment = outgoing ? statusBtn.comment : incomingCompleteBtn.comment
  const cardActionsCloseStatus = visibleStatusButton(
    outgoing ? statusBtn.closeConfig ?? sendOp57Status : null
  )

  return (
    <div
      style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
      className="fade-in card-page-layout"
    >
      <div className="card-sticky-header" style={CARD_STICKY_HEADER_STYLE}>
        <div className="card-sticky-header-title-row">
          <span className="card-sticky-header-title">Карта сведений о результатах рассмотрения</span>
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
                  disabled={comparisonModalVisible}
                >
                  Сохранить
                </Button>
                <Button onClick={cancelEdit} disabled={saving || comparisonModalVisible}>
                  Отменить
                </Button>
              </>
            ) : null}
            {outgoing && canValidateOutgoingCard ? (
              <Button type="default" loading={validateLoading} onClick={() => void runForcedCardValidation()}>
                Валидация карты
              </Button>
            ) : null}
            <Button
              onClick={() => {
                postMessageFromCardToParent({ code: 'exit' }, 'DPR: закрыть форму')
              }}
            >
              Закрыть
            </Button>
          </Space>
        </div>
        <Descriptions
          column={{ xxl: 4, xl: 4, lg: 4, md: 3, sm: 2, xs: 1 }}
          bordered
          size="small"
          style={{ margin: 0 }}
          className="card-header-descriptions"
        >
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
            {isEditMode ? (
              <Text>{dash(meta.dprStatusName)}</Text>
            ) : (
              <Button
                type="link"
                className="dpr-card-header-status-link"
                style={{ padding: 0, height: 'auto' }}
                onClick={() => void openStatusHistory()}
              >
                {dash(meta.dprStatusName)}
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

        {!isEditMode ? (
          <CardActions
            onDefineAccess={
              accessPpvid && guid?.trim()
                ? () => {
                    setAccessModalVisible(true)
                  }
                : undefined
            }
            onShowRightsDebug={() => {
              setRightsDebugVisible(true)
              setRightsDebugError(null)
              setRightsDebugRawText(null)
              setRightsDebugData(null)
              const g = guid?.trim()
              if (g) {
                setRightsDebugLoading(true)
                fetchRightsByGuid(g)
                  .then((data) => {
                    setRightsDebugData(data)
                    setRightsDebugError(null)
                    setRightsDebugRawText(null)
                  })
                  .catch(async (e) => {
                    setRightsDebugError(e instanceof Error ? e.message : 'Ошибка загрузки')
                    setRightsDebugData(null)
                    try {
                      const raw = await fetchRightsByGuidRaw(g)
                      setRightsDebugRawText(raw.text)
                    } catch {
                      setRightsDebugRawText(null)
                    }
                  })
                  .finally(() => setRightsDebugLoading(false))
              } else {
                setRightsDebugError('GUID не задан')
                setRightsDebugLoading(false)
              }
            }}
            showDeleteButton={canDeleteDraft}
            deleteButtonDisabled={!ppvHref}
            deleteButtonHint={
              !ppvHref ? 'Нет связанной карты PPV — удаление недоступно' : undefined
            }
            onDelete={() => void requestDeleteDraft()}
            statusButton={cardActionsPrimaryStatus}
            statusButtonComment={cardActionsStatusComment}
            closeButton={cardActionsCloseStatus}
            onStatusAction={(action) => void runStatusAction(action)}
            onElectronicDocumentClick={() => setEdocOpen(true)}
            statusButtonsLoading={statusActionLoading}
          />
        ) : null}

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
                      <DprNotifyingAuthorityEdit
                        value={{
                          country: authEdit.country || parsed.notifyingAuthority.country || '',
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
                        <Descriptions.Item label="Наименование">{dash(parsed.notifyingAuthority.name)}</Descriptions.Item>
                        <Descriptions.Item label="Краткое наименование">{dash(parsed.notifyingAuthority.shortName)}</Descriptions.Item>
                      </Descriptions>
                    )}
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
                    {isEditMode ? (
                      <MeasuresTabEdit data={measuresEdit} onChange={setMeasuresEdit} />
                    ) : (
                      <MeasuresTab data={parsed.measures} />
                    )}
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
                      readOnly={!isEditMode}
                      disabled={!isEditMode}
                      value={isEditMode ? descText : parsed.resultDescription ?? ''}
                      onChange={isEditMode ? (e) => setDescText(e.target.value) : undefined}
                      placeholder="—"
                      autoSize={{ minRows: 3, maxRows: 16 }}
                      style={{ marginBottom: 16 }}
                    />
                    <Typography.Title level={5}>Документы</Typography.Title>
                    {isEditMode ? (
                      <DprResultDocumentsEdit documents={documentsEdit} onChange={setDocumentsEdit} />
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
        ppvid={accessPpvid || undefined}
        source={meta.datasourceKindName ?? undefined}
        datasourceKindCode={
          meta.datasourceKindCode != null ? String(meta.datasourceKindCode) : undefined
        }
        guid={guid}
      />
      <Modal
        title="Карта прав доступа (отладка)"
        open={rightsDebugVisible}
        onCancel={() => {
          setRightsDebugVisible(false)
          setRightsDebugData(null)
          setRightsDebugError(null)
          setRightsDebugRawText(null)
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setRightsDebugVisible(false)
              setRightsDebugData(null)
              setRightsDebugError(null)
              setRightsDebugRawText(null)
            }}
          >
            Закрыть
          </Button>,
          rightsDebugData != null && (
            <Button
              key="copy"
              type="primary"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(rightsDebugData, null, 2)).then(
                  () => message.success('Скопировано в буфер обмена'),
                  () => message.error('Не удалось скопировать')
                )
              }}
            >
              Копировать JSON
            </Button>
          ),
          rightsDebugRawText != null && (
            <Button
              key="copyRaw"
              onClick={() => {
                navigator.clipboard.writeText(rightsDebugRawText).then(
                  () => message.success('Сырой ответ скопирован'),
                  () => message.error('Не удалось скопировать')
                )
              }}
            >
              Копировать сырой ответ
            </Button>
          ),
        ].filter(Boolean)}
        width={640}
        destroyOnClose
      >
        {rightsDebugLoading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Spin tip="Загрузка карты прав..." />
          </div>
        ) : rightsDebugError != null ? (
          <div>
            <div style={{ color: '#ff4d4f', marginBottom: 8 }}>{rightsDebugError}</div>
            {rightsDebugRawText != null && (
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  background: '#fff2f0',
                  borderRadius: 4,
                  maxHeight: 360,
                  overflow: 'auto',
                  fontSize: 11,
                }}
              >
                {rightsDebugRawText}
              </pre>
            )}
          </div>
        ) : rightsDebugData != null ? (
          <Input.TextArea
            readOnly
            value={JSON.stringify(rightsDebugData, null, 2)}
            autoSize={{ minRows: 14, maxRows: 22 }}
            style={{ fontFamily: 'monospace' }}
          />
        ) : (
          <span>Нет данных</span>
        )}
      </Modal>

      {comparisonResult != null && (
        <XMLComparisonModal
          visible={comparisonModalVisible}
          comparisonResult={comparisonResult}
          onClose={() => {
            setComparisonModalVisible(false)
            setPendingDprXmlB64(null)
            setComparisonFormatErrors([])
            setComparisonLogicalErrors([])
          }}
          formatValidationErrors={comparisonFormatErrors}
          logicalValidationErrors={comparisonLogicalErrors}
          onSaveToDb={pendingDprXmlB64 ? handleSaveToDbFromModal : undefined}
          saving={saving}
        />
      )}
    </div>
  )
}
