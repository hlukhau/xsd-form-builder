import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from 'react'
import { Tabs, Button, Space, message, Modal } from 'antd'
import type { CardData, StatusHistoryItem, AccessItem, ElectronicDocument } from '@/types/card'
import type { SmdMetadata } from '@/types/smdCard'
import { CardActions } from '@/cards/shared'
import SmdCardHeader from './SmdCardHeader'
import SmdSanitaryMeasureTab from './tabs/SmdSanitaryMeasureTab'
import SmdMeasuresTab from './tabs/SmdMeasuresTab'
import SmdProductsTab from './tabs/SmdProductsTab'
import SmdDiseaseTab from './tabs/SmdDiseaseTab'
import SmdInfoRequestsTab from './tabs/SmdInfoRequestsTab'
import SmdReviewResultsTab from './tabs/SmdReviewResultsTab'
import { fetchSmdStatusHistory, fetchSmdXml, fetchSmdRelatedActions, saveSmdCard, buildSmdSaveMetadataFromCardData, canCreateSmdNewVersion, fetchSmdMetadata, postSmdStatus, fetchSmdIncomingCompletePreview, fetchSmdElectronicDocs } from './smdApi'
import { confirmDeleteSmdCard } from './smdDeleteActions'
import { exportSmdCardDataToXML } from './smdXmlExporter'
import type { SmdRelatedActions } from '@/types/smdCard'
import { validateSmdCardBeforeSave } from './smdSaveValidation'
import { validateSmdOutgoingCardFullWithSchema, validateSmdCardForSend } from './smdValidation'
import { syncSmdCardFromPrimaryMeasure } from './smdSanitaryMeasureModel'
import { applySmdRegulatoryDocToCard } from './smdMeasureDoc'
import {
  incomingSmdStatusButton,
  outgoingSmdStatusButton,
  isSmdIncomingSource,
  isSmdOutgoingSource,
} from './smdStatusButtonConfig'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ElectronicDocumentModal from '@/components/modals/dpa/ElectronicDocumentModal'
import SaveBlockingErrorsModal from '@/components/modals/SaveBlockingErrorsModal'
import ValidationResultModal from '@/components/modals/dpa/ValidationResultModal'
import AccessModal from '@/components/modals/dpa/AccessModal'
import { checkAccessRight, resolveCardAccessApiSource } from '@/utils/referenceDataApi'
import { smdApiSourceToAccessRight } from './smdApi'
import type { ValidationResult } from '@/utils/cardValidation'
import { useParentActivityPing } from '@/hooks/shared/useParentActivityPing'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'
import { getSmdMessageName, SMD_MESSAGE_CANCEL } from '@/constants/smdCard'
import { parseElectronicDocContentBody } from '@/utils/xmlParser'

interface SmdCardProps {
  data: CardData
  meta: SmdMetadata
  smdid?: string
  guid?: string
  /** XML из SMDXML (для «Валидация карты» без повторного запроса). */
  xmlBody?: string | null
  copyFromSmdid?: number
  onMakeCopy?: (initialCardData: CardData, sourceSmdid: number) => void
  onCardDeleted?: () => void
  onUpdate?: (data: CardData) => void
  onSaveNewCard?: (smdid: number) => void
  onMetaUpdate?: (meta: SmdMetadata) => void
}

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

const SMD_COPY_FROM_SESSION_KEY = 'smd_card_copy_from_smdid'

const SmdCard: React.FC<SmdCardProps> = ({
  data,
  meta,
  smdid,
  guid,
  xmlBody,
  copyFromSmdid,
  onMakeCopy,
  onCardDeleted,
  onUpdate,
  onSaveNewCard,
  onMetaUpdate,
}) => {
  const copyFromSmdidRef = useRef<number | undefined>(undefined)
  const loadedCardKeyRef = useRef<string>('')
  useEffect(() => {
    if (copyFromSmdid != null && copyFromSmdid > 0) {
      copyFromSmdidRef.current = copyFromSmdid
      return
    }
    if ((smdid ?? '').trim() !== '-') return
    try {
      const stored = sessionStorage.getItem(SMD_COPY_FROM_SESSION_KEY)
      if (stored) {
        const n = Number(stored)
        if (n > 0) copyFromSmdidRef.current = n
      }
    } catch {
      /* ignore */
    }
  }, [copyFromSmdid, smdid])

  const [editedData, setEditedData] = useState<CardData>(data)
  const isCreateMode = (smdid ?? '').trim() === '-'
  const isNewVersionCopy =
    isCreateMode &&
    ((copyFromSmdid != null && copyFromSmdid > 0) ||
      (copyFromSmdidRef.current != null && copyFromSmdidRef.current > 0))
  const [activeTabKey, setActiveTabKey] = useState('sanitary')
  const [isEditMode, setIsEditMode] = useState(isCreateMode)
  const [saving, setSaving] = useState(false)
  const [statusHistoryVisible, setStatusHistoryVisible] = useState(false)
  const [statusHistoryModalData, setStatusHistoryModalData] = useState<StatusHistoryItem[]>([])
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false)
  const [hasManageAccessRight, setHasManageAccessRight] = useState(false)
  const [hasEditRight, setHasEditRight] = useState(false)
  const [hasViewRight, setHasViewRight] = useState(false)
  const [accessModalVisible, setAccessModalVisible] = useState(false)
  const [accessList, setAccessList] = useState<AccessItem[]>([])
  const [relatedActions, setRelatedActions] = useState<SmdRelatedActions | null>(null)
  const [saveBlockingErrorsVisible, setSaveBlockingErrorsVisible] = useState(false)
  const [saveBlockingErrors, setSaveBlockingErrors] = useState<string[]>([])
  const [validationModalVisible, setValidationModalVisible] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [sending, setSending] = useState(false)
  const [completingProcessing, setCompletingProcessing] = useState(false)
  const [closingCard, setClosingCard] = useState(false)
  const [electronicDocumentVisible, setElectronicDocumentVisible] = useState(false)
  const [electronicDocList, setElectronicDocList] = useState<ElectronicDocument[]>([])
  const [electronicDocLoading, setElectronicDocLoading] = useState(false)

  useParentActivityPing()

  const effectiveSmdid = (smdid ?? '').trim()
  const cardIdentityKey = `${effectiveSmdid}|${data.registrationNumber ?? ''}|${data.version ?? ''}`

  useEffect(() => {
    if (loadedCardKeyRef.current !== cardIdentityKey) {
      loadedCardKeyRef.current = cardIdentityKey
      setEditedData(data)
      setIsEditMode(isCreateMode)
      return
    }
    if (
      data.registrationNumber !== editedData.registrationNumber ||
      (data.version !== undefined && data.version !== editedData.version)
    ) {
      setEditedData(data)
    }
  }, [data, cardIdentityKey, isCreateMode, editedData.registrationNumber, editedData.version])

  const hasPersisted = effectiveSmdid.length > 0 && effectiveSmdid !== '-'
  const isIncoming = isSmdIncomingSource(meta.dataSourceKindName ?? data.source, meta.dataSourceKindCode)
  const isOutgoing = isSmdOutgoingSource(meta.dataSourceKindName ?? data.source, meta.dataSourceKindCode)
  const isEec = String(meta.dataSourceKindCode ?? '').trim() === '3'

  const currentData = editedData

  const manageAccessRight = useMemo(() => {
    const api = resolveCardAccessApiSource(
      meta.dataSourceKindName ?? data.source,
      meta.dataSourceKindCode
    )
    return smdApiSourceToAccessRight(api)
  }, [meta.dataSourceKindName, meta.dataSourceKindCode, data.source])

  useEffect(() => {
    if (!guid?.trim()) {
      setHasManageAccessRight(false)
      setHasEditRight(false)
      setHasViewRight(false)
      return
    }
    const g = guid.trim()
    void (async () => {
      try {
        const checks: Promise<boolean>[] = [
          checkAccessRight(g, 'sanitaryMeasureOut:edit'),
          checkAccessRight(g, 'sanitaryMeasureOut:view'),
        ]
        if (manageAccessRight) {
          checks.unshift(checkAccessRight(g, manageAccessRight))
        }
        const results = await Promise.all(checks)
        if (manageAccessRight) {
          setHasManageAccessRight(results[0] ?? false)
          setHasEditRight(results[1] ?? false)
          setHasViewRight(results[2] ?? false)
        } else {
          setHasManageAccessRight(false)
          setHasEditRight(results[0] ?? false)
          setHasViewRight(results[1] ?? false)
        }
      } catch {
        setHasManageAccessRight(false)
        setHasEditRight(false)
        setHasViewRight(false)
      }
    })()
  }, [guid, manageAccessRight])

  useEffect(() => {
    if (!hasPersisted || !effectiveSmdid || !guid?.trim()) {
      setRelatedActions(null)
      return
    }
    let cancelled = false
    void fetchSmdRelatedActions(effectiveSmdid, guid)
      .then((actions) => {
        if (!cancelled) setRelatedActions(actions)
      })
      .catch(() => {
        if (!cancelled) setRelatedActions(null)
      })
    return () => {
      cancelled = true
    }
  }, [effectiveSmdid, guid, hasPersisted])

  const canDeleteCard = relatedActions?.canDelete ?? false
  const canSendCard = relatedActions?.canSend ?? false
  const canValidateCard =
    (relatedActions?.canValidate ?? false) || (isCreateMode && isOutgoing && hasViewRight)
  const canAddInfoRequest = relatedActions?.canAddInfoRequest ?? false
  const canAddResponse =
    (relatedActions?.isOutgoing && relatedActions?.hasOutgoingEditRight) ?? false
  const canPrepareReviewResult = relatedActions?.canPrepareReviewResult ?? false
  const canCompleteIncomingProcessing = relatedActions?.canCompleteIncomingProcessing ?? false
  const canCompleteIncomingProcessingReason = relatedActions?.canCompleteIncomingProcessingReason
  const canCloseCard = relatedActions?.canCloseCard ?? false
  const canCloseCardReason = relatedActions?.canCloseCardReason

  const showEditButton = (isOutgoing && !isEec && hasEditRight && !isNewVersionCopy) || (isCreateMode && !isNewVersionCopy)
  const showValidationButton = isOutgoing && !isEec && canValidateCard

  const canShowCopyButton =
    isOutgoing &&
    hasPersisted &&
    hasEditRight &&
    (meta.smdStatusCode ?? '').toUpperCase() === 'DELIVERED' &&
    (meta.messageCode ?? data.electronicDocument?.messageCode ?? '').trim().toUpperCase() !== SMD_MESSAGE_CANCEL

  const smdStatusResult = useMemo(() => {
    if (isEec) return { config: null, comment: '', closeConfig: null }
    const code = meta.smdStatusCode ?? undefined
    const name = meta.smdStatusName ?? data.status
    if (isIncoming) {
      return incomingSmdStatusButton(
        code,
        name,
        canCompleteIncomingProcessing,
        canCompleteIncomingProcessingReason,
        canCloseCard,
        canCloseCardReason
      )
    }
    if (isOutgoing) {
      return outgoingSmdStatusButton(code, name, canCloseCard, canCloseCardReason)
    }
    return { config: null, comment: '', closeConfig: null }
  }, [
    isEec,
    isIncoming,
    isOutgoing,
    meta.smdStatusCode,
    meta.smdStatusName,
    data.status,
    canCompleteIncomingProcessing,
    canCompleteIncomingProcessingReason,
    canCloseCard,
    canCloseCardReason,
  ])

  const handleStatusClick = () => {
    if (!hasPersisted) {
      message.info('История статусов доступна после сохранения карты')
      return
    }
    setStatusHistoryVisible(true)
    setStatusHistoryLoading(true)
    fetchSmdStatusHistory(effectiveSmdid, guid)
      .then(setStatusHistoryModalData)
      .catch((e) => {
        message.error(e instanceof Error ? e.message : 'Ошибка загрузки истории')
        setStatusHistoryModalData([])
      })
      .finally(() => setStatusHistoryLoading(false))
  }

  const formatSmdDocDate = (d: string | null | undefined) => {
    if (!d?.trim()) return '—'
    const date = new Date(d.slice(0, 10))
    if (isNaN(date.getTime())) return d
    return date.toLocaleDateString('ru-RU')
  }

  const runCompleteIncomingProcessing = async () => {
    if (!effectiveSmdid || !guid || !hasPersisted) return
    setCompletingProcessing(true)
    try {
      const res = await postSmdStatus(effectiveSmdid, 'complete_processing', guid)
      const freshMeta = await fetchSmdMetadata(effectiveSmdid, guid)
      onMetaUpdate?.(freshMeta)
      const newStatus = res.newStatus ?? freshMeta.smdStatusName ?? 'Обработано'
      const next = { ...editedData, status: newStatus }
      onUpdate?.(next)
      setEditedData(next)
      message.success('Карта переведена в статус «Обработано».')
      void fetchSmdRelatedActions(effectiveSmdid, guid).then(setRelatedActions).catch(() => {})
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
    } finally {
      setCompletingProcessing(false)
    }
  }

  const confirmCompleteIncomingProcessing = () => {
    if (!effectiveSmdid || !guid || !hasPersisted || isEditMode) return
    const docNumber = meta.docId?.trim() || data.registrationNumber || effectiveSmdid
    const docDate = formatSmdDocDate(meta.docCreationDate ?? data.notification?.formationDate)
    void fetchSmdIncomingCompletePreview(effectiveSmdid, guid)
      .then(({ reviewOutcomeSent }) => {
        if (reviewOutcomeSent) {
          Modal.confirm({
            title: 'Завершение обработки',
            content: `Карта ${docNumber} от ${docDate} будет переведена в статус „Обработано“. Продолжить?`,
            okText: 'Завершить',
            cancelText: 'Отмена',
            okButtonProps: { type: 'primary' },
            onOk: () => runCompleteIncomingProcessing(),
          })
        } else {
          Modal.confirm({
            title: 'Завершение обработки',
            content: 'Результат рассмотрения не готов или не отправлен. Завершить обработку?',
            okText: 'Завершить',
            cancelText: 'Отмена',
            okButtonProps: { type: 'default' },
            cancelButtonProps: { type: 'primary' },
            onOk: () => runCompleteIncomingProcessing(),
          })
        }
      })
      .catch((e) => message.error(e instanceof Error ? e.message : 'Не удалось проверить статус результата рассмотрения'))
  }

  const runCloseSmdCard = async () => {
    if (!effectiveSmdid || !guid || !hasPersisted) return
    setClosingCard(true)
    try {
      const res = await postSmdStatus(effectiveSmdid, 'close', guid)
      const freshMeta = await fetchSmdMetadata(effectiveSmdid, guid)
      onMetaUpdate?.(freshMeta)
      const newStatus = res.newStatus ?? freshMeta.smdStatusName ?? 'Завершено'
      const next = { ...editedData, status: newStatus }
      onUpdate?.(next)
      setEditedData(next)
      message.success('Карта переведена в статус «Завершено».')
      void fetchSmdRelatedActions(effectiveSmdid, guid).then(setRelatedActions).catch(() => {})
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка закрытия карты')
    } finally {
      setClosingCard(false)
    }
  }

  const confirmCloseSmdCard = () => {
    if (!effectiveSmdid || !guid || !hasPersisted || isEditMode) return
    const docNumber = meta.docId?.trim() || data.registrationNumber || effectiveSmdid
    const docDate = formatSmdDocDate(meta.docCreationDate ?? data.notification?.formationDate)
    Modal.confirm({
      title: 'Закрытие карты',
      content: `Внимание! После подтверждения карта ${docNumber} от ${docDate} будет переведена в статус „Завершено“. Выполнение каких-либо действий, кроме просмотра, станет невозможным. Отменить данное действие будет нельзя. Продолжить?`,
      okText: 'Продолжить',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: () => runCloseSmdCard(),
    })
  }

  const handleStatusAction = (action: string) => {
    if (action === 'complete_processing') {
      confirmCompleteIncomingProcessing()
      return
    }
    if (action === 'close') {
      confirmCloseSmdCard()
      return
    }
    message.info(`Действие «${action}» для SMD будет реализовано в следующей итерации`)
  }

  const handleElectronicDocumentClick = () => {
    if (!hasPersisted || !effectiveSmdid) {
      message.info('Сведения об электронных документах доступны после сохранения карты')
      return
    }
    setElectronicDocLoading(true)
    setElectronicDocumentVisible(true)
    setElectronicDocList([])
    void fetchSmdElectronicDocs(effectiveSmdid, guid)
      .then((rawList) => {
        const docs: ElectronicDocument[] = rawList.map((raw) => {
          const resource = raw.contentBody
            ? parseElectronicDocContentBody(raw.contentBody)
            : { validityPeriod: { start: '', end: '' }, updateDateTime: '' }
          return {
            messageCode: raw.messageCode ?? '',
            documentCode: raw.documentCode ?? '',
            documentId: raw.documentId ?? '',
            documentDate: raw.documentDate ?? '',
            language: raw.language ?? '',
            sourceDocumentId: raw.sourceDocumentId ?? '',
            validityPeriod: resource.validityPeriod,
            updateDateTime: resource.updateDateTime,
          }
        })
        setElectronicDocList(docs)
      })
      .catch((e) => {
        message.error(e instanceof Error ? e.message : 'Ошибка загрузки сведений об электронных документах')
        setElectronicDocList([])
      })
      .finally(() => setElectronicDocLoading(false))
  }

  const resolveXmlForValidation = useCallback(async (): Promise<string | null> => {
    if (isCreateMode) {
      const synced = syncSmdCardFromPrimaryMeasure(currentData)
      const xml = exportSmdCardDataToXML(synced).trim()
      return xml || null
    }
    const cached = (xmlBody ?? '').trim()
    if (cached && !cached.includes('<empty/>')) {
      return cached
    }
    if (!hasPersisted) {
      return null
    }
    try {
      const xml = await fetchSmdXml(effectiveSmdid, guid)
      return xml.trim() || null
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось загрузить XML из БД')
      return null
    }
  }, [isCreateMode, currentData, xmlBody, hasPersisted, effectiveSmdid, guid])

  const runValidation = async () => {
    setValidating(true)
    try {
      const xml = await resolveXmlForValidation()
      const r = await validateSmdOutgoingCardFullWithSchema(currentData, xml)
      setValidationResult(r)
      setValidationModalVisible(true)
      if (r.success) {
        message.success('Все контроли пройдены успешно')
      } else {
        message.warning('Валидация выявила замечания')
      }
    } finally {
      setValidating(false)
    }
  }

  const handleCloseForm = () => {
    if (isNewVersionCopy) {
      try {
        sessionStorage.removeItem(SMD_COPY_FROM_SESSION_KEY)
      } catch {
        /* ignore */
      }
      copyFromSmdidRef.current = undefined
    }
    postMessageFromCardToParent(
      { code: 'exit' },
      hasPersisted ? 'SMD: закрыть форму' : isNewVersionCopy ? 'SMD: отменить создание новой версии' : 'SMD: отменить создание'
    )
  }

  const handleCopy = async () => {
    if (!effectiveSmdid || !guid || !onMakeCopy) return
    try {
      const res = await canCreateSmdNewVersion(effectiveSmdid, guid)
      if (!res.allowed) {
        message.error(res.reason ?? 'Создание новой версии недоступно')
        return
      }
      const nowIso = new Date().toISOString()
      const newVersion = (meta.smdVersion ?? data.version ?? 1) + 1
      const initialCardData = syncSmdCardFromPrimaryMeasure({
        ...data,
        version: newVersion,
        status: 'Новое',
        createdAt: nowIso,
        modifiedAt: nowIso,
        electronicDocument: {
          ...(data.electronicDocument ?? { documentCode: 'R.SM.SS.09.001' }),
          messageCode: '',
        },
        notification: data.notification
          ? { ...data.notification, type: '' }
          : data.notification,
      })
      onMakeCopy(initialCardData, Number(effectiveSmdid))
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка проверки возможности создания новой версии')
    }
  }

  const handleCancelEdit = () => {
    setEditedData(data)
    setIsEditMode(false)
  }

  const handleDelete = () => {
    if (!effectiveSmdid || !guid) return
    confirmDeleteSmdCard({
      smdid: effectiveSmdid,
      docId: meta.docId ?? data.registrationNumber ?? data.notification?.registrationNumber,
      docCreationDate: meta.docCreationDate ?? data.notification?.formationDate,
      guid,
      fromCardView: true,
      onDeleted: () => onCardDeleted?.(),
    })
  }

  const confirmSendSmdOp58 = () => {
    if (!effectiveSmdid || !guid || !hasPersisted || isEditMode) return
    const docNumber = meta.docId?.trim() || data.registrationNumber || effectiveSmdid
    Modal.confirm({
      title: 'Направление сведений участникам ОП 58',
      content: `После подтверждения по карте ${docNumber} будут направлены сведения о временной санитарной мере участникам ОП 58; карта перейдёт в статус «Ожидает отправки». Продолжить?`,
      okText: 'Направить сведения',
      cancelText: 'Отмена',
      onOk: async () => {
        setSending(true)
        try {
          const xml = await resolveXmlForValidation()
          const validation = await validateSmdCardForSend(currentData, xml)
          if (!validation.success) {
            setValidationResult(validation)
            setValidationModalVisible(true)
            message.error('Необходимо доработать карту исходящих сведений перед направлением.')
            return
          }
          const res = await postSmdStatus(effectiveSmdid, 'send', guid)
          const freshMeta = await fetchSmdMetadata(effectiveSmdid, guid)
          onMetaUpdate?.(freshMeta)
          const newStatus = res.newStatus ?? freshMeta.smdStatusName ?? 'Ожидает отправки'
          const next = { ...editedData, status: newStatus }
          onUpdate?.(next)
          setEditedData(next)
          message.success('Карта переведена в статус «Ожидает отправки».')
          void fetchSmdRelatedActions(effectiveSmdid, guid).then(setRelatedActions).catch(() => {})
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Ошибка направления сведений')
        } finally {
          setSending(false)
        }
      },
    })
  }

  const handleSave = async () => {
    const synced = applySmdRegulatoryDocToCard(syncSmdCardFromPrimaryMeasure(currentData))
    const validationErrors = validateSmdCardBeforeSave(synced, {
      requireMessageForNewVersion: isNewVersionCopy,
    })
    if (validationErrors.length > 0) {
      setSaveBlockingErrors(validationErrors)
      setSaveBlockingErrorsVisible(true)
      return
    }
    setSaving(true)
    try {
      const xml = exportSmdCardDataToXML(synced)
      const metadata = buildSmdSaveMetadataFromCardData(synced)
      if (isCreateMode) {
        const copySourceSmdid =
          copyFromSmdid != null && copyFromSmdid > 0
            ? copyFromSmdid
            : copyFromSmdidRef.current != null && copyFromSmdidRef.current > 0
              ? copyFromSmdidRef.current
              : undefined
        const res = await saveSmdCard({
          isNew: true,
          xmlBody: xml,
          metadata,
          guid,
          ...(copySourceSmdid != null ? { copyFromSmdid: copySourceSmdid } : {}),
        })
        if (isNewVersionCopy) {
          copyFromSmdidRef.current = undefined
          try {
            sessionStorage.removeItem(SMD_COPY_FROM_SESSION_KEY)
          } catch {
            /* ignore */
          }
        }
        onSaveNewCard?.(res.smdid)
        return
      }
      if (!hasPersisted || !effectiveSmdid) {
        message.error('Не задан идентификатор карты SMD')
        return
      }
      const res = await saveSmdCard({
        isNew: false,
        smdid: Number(effectiveSmdid),
        xmlBody: xml,
        metadata,
        guid,
      })
      const freshMeta = await fetchSmdMetadata(String(res.smdid), guid)
      onMetaUpdate?.(freshMeta)
      const nextStatus = res.newStatus ?? freshMeta.smdStatusName ?? synced.status
      const next = { ...synced, status: nextStatus }
      onUpdate?.(next)
      setEditedData(next)
      setIsEditMode(false)
      message.success(
        res.newStatus ? `Карта сохранена. Статус: «${res.newStatus}».` : 'Карта сохранена.'
      )
      void fetchSmdRelatedActions(effectiveSmdid, guid).then(setRelatedActions).catch(() => {})
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка сохранения карты')
    } finally {
      setSaving(false)
    }
  }

  const onCardChange = (next: CardData) => {
    const synced = syncSmdCardFromPrimaryMeasure(next)
    setEditedData(synced)
    if (isCreateMode) {
      onUpdate?.(synced)
    }
  }

  const handleMessageCodeChange = (code: string) => {
    onCardChange({
      ...currentData,
      electronicDocument: {
        ...currentData.electronicDocument!,
        messageCode: code,
      },
      notification: {
        ...currentData.notification!,
        type: getSmdMessageName(code, currentData.version) ?? code,
      },
    })
  }

  const tabProps = { editMode: isEditMode, onChange: isEditMode ? onCardChange : undefined }

  const tabItems = [
    {
      key: 'sanitary',
      label: 'Санитарная мера',
      children: (
        <div style={{ padding: 16 }}>
          <SmdSanitaryMeasureTab
            data={currentData}
            {...tabProps}
            regulatoryDocReadOnly={isNewVersionCopy}
          />
        </div>
      ),
    },
    {
      key: 'implementation',
      label: 'Мероприятия',
      children: (
        <div className="smd-tab-pane-body">
          <SmdMeasuresTab data={currentData} {...tabProps} />
        </div>
      ),
    },
    {
      key: 'products',
      label: 'Продукция',
      children: (
        <div className="smd-tab-pane-body">
          <SmdProductsTab data={currentData} {...tabProps} guid={guid} />
        </div>
      ),
    },
    {
      key: 'disease',
      label: 'Болезнь',
      children: (
        <div style={{ padding: 16 }}>
          <SmdDiseaseTab data={currentData} {...tabProps} />
        </div>
      ),
    },
    ...(isCreateMode
      ? []
      : [
          {
            key: 'info',
            label: 'Запрос сведений',
            children: (
              <div style={{ padding: 16 }}>
                <SmdInfoRequestsTab
                  smdid={effectiveSmdid}
                  guid={guid}
                  hasPersisted={hasPersisted}
                  enabled={activeTabKey === 'info'}
                  isIncoming={isIncoming}
                  isOutgoing={isOutgoing}
                  canAddInfoRequest={canAddInfoRequest}
                  canAddResponse={canAddResponse}
                />
              </div>
            ),
          },
          {
            key: 'review',
            label: 'Результаты рассмотрения',
            children: (
              <div style={{ padding: 16 }}>
                <SmdReviewResultsTab
                  smdid={effectiveSmdid}
                  guid={guid}
                  hasPersisted={hasPersisted}
                  enabled={activeTabKey === 'review'}
                  canPrepareReviewResult={canPrepareReviewResult}
                />
              </div>
            ),
          },
        ]),
  ]

  return (
    <div
      className="smd-card pha-card fade-in card-page-layout"
      style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}
    >
      <div className="card-sticky-header" style={CARD_STICKY_HEADER_STYLE}>
        <div className="card-sticky-header-title-row" style={{ marginBottom: 8, marginTop: 8 }}>
          <span className="card-sticky-header-title" style={{ fontSize: 16, fontWeight: 600 }}>
            Карта сведений о временной санитарной мере
            {isNewVersionCopy ? ' (новая версия)' : ''}
          </span>
          <Space size="small" wrap>
            {!isEditMode && (
              <>
                {showEditButton && (
                  <Button type="default" onClick={() => setIsEditMode(true)}>
                    Редактировать
                  </Button>
                )}
                {showValidationButton && (
                  <Button onClick={() => void runValidation()} loading={validating}>
                    Валидация карты
                  </Button>
                )}
                <Button onClick={handleCloseForm}>
                  {hasPersisted ? 'Закрыть' : 'Отменить создание'}
                </Button>
              </>
            )}
            {isEditMode && (
              <>
                {(showEditButton || isCreateMode) && (
                  <Button type="primary" onClick={() => void handleSave()} loading={saving}>
                    Сохранить
                  </Button>
                )}
                {showValidationButton && (
                  <Button onClick={() => void runValidation()} loading={validating}>
                    Валидация карты
                  </Button>
                )}
                {hasPersisted && !isCreateMode && (
                  <Button onClick={handleCancelEdit}>Отменить</Button>
                )}
                {(!hasPersisted || isCreateMode) && (
                  <Button onClick={handleCloseForm}>
                    {isNewVersionCopy ? 'Отменить создание новой версии' : 'Отменить создание'}
                  </Button>
                )}
              </>
            )}
          </Space>
        </div>

        <SmdCardHeader
          meta={meta}
          onStatusClick={handleStatusClick}
          statusClickable={!isEditMode && hasPersisted && !isEec}
          isCreateMode={isCreateMode}
          messageCode={currentData.electronicDocument?.messageCode}
          onMessageCodeChange={isCreateMode && isEditMode ? handleMessageCodeChange : undefined}
          requireMessageSelection={isNewVersionCopy}
        />
        {!isCreateMode && (
        <CardActions
          onDefineAccess={
            hasManageAccessRight && hasPersisted
              ? () => setAccessModalVisible(true)
              : undefined
          }
          onOpenAllVersions={
            hasPersisted
              ? () =>
                  message.info(
                    'Реестр всех версий SMD — подключите URL реестра (фильтр: страна, номер, дата документа)'
                  )
              : undefined
          }
          statusButton={smdStatusResult.config}
          statusButtonComment={smdStatusResult.comment || undefined}
          closeButton={smdStatusResult.closeConfig}
          onStatusAction={handleStatusAction}
          statusButtonsLoading={completingProcessing || closingCard}
          onElectronicDocumentClick={handleElectronicDocumentClick}
          showDeleteButton={isOutgoing && hasPersisted && canDeleteCard}
          onDelete={handleDelete}
          showCopyButton={canShowCopyButton}
          onCopy={() => void handleCopy()}
          nextToStatusButtons={
            <>
              {isOutgoing && canSendCard && hasPersisted && !isEditMode && !isEec && (
                <Button
                  size="small"
                  type="primary"
                  loading={sending}
                  onClick={confirmSendSmdOp58}
                >
                  Направить сведения
                </Button>
              )}
            </>
          }
        />
        )}
        <div className="card-tabs-wrapper">
          <Tabs
            activeKey={activeTabKey}
            onChange={setActiveTabKey}
            destroyInactiveTabPane={false}
            items={tabItems}
          />
        </div>
      </div>

      <StatusHistoryModal
        visible={statusHistoryVisible}
        loading={statusHistoryLoading}
        data={statusHistoryModalData}
        onClose={() => setStatusHistoryVisible(false)}
        hideEmployeeWhenMissing
      />
      <ElectronicDocumentModal
        visible={electronicDocumentVisible}
        data={electronicDocList}
        onClose={() => setElectronicDocumentVisible(false)}
        loading={electronicDocLoading}
      />
      <SaveBlockingErrorsModal
        visible={saveBlockingErrorsVisible}
        errors={saveBlockingErrors}
        onClose={() => setSaveBlockingErrorsVisible(false)}
      />
      <ValidationResultModal
        visible={validationModalVisible}
        result={validationResult}
        onClose={() => {
          setValidationModalVisible(false)
          setValidationResult(null)
        }}
      />
      <AccessModal
        visible={accessModalVisible}
        data={accessList}
        onClose={() => setAccessModalVisible(false)}
        onUpdate={setAccessList}
        smdid={hasPersisted ? effectiveSmdid : undefined}
        source={meta.dataSourceKindName ?? data.source}
        datasourceKindCode={meta.dataSourceKindCode}
        guid={guid}
      />
    </div>
  )
}

export default SmdCard
