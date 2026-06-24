import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from 'react'
import { Tabs, Button, Space, message, Modal } from 'antd'
import type { CardData, StatusHistoryItem, AccessItem } from '@/types/card'
import type { SmdMetadata } from '@/types/smdCard'
import { CardActions } from '@/cards/shared'
import SmdCardHeader from './SmdCardHeader'
import SmdSanitaryMeasureTab from './tabs/SmdSanitaryMeasureTab'
import SmdMeasuresTab from './tabs/SmdMeasuresTab'
import SmdProductsTab from './tabs/SmdProductsTab'
import SmdDiseaseTab from './tabs/SmdDiseaseTab'
import SmdInfoRequestsTab from './tabs/SmdInfoRequestsTab'
import SmdReviewResultsTab from './tabs/SmdReviewResultsTab'
import { fetchSmdStatusHistory, fetchSmdXml, fetchSmdRelatedActions, saveSmdCard, buildSmdSaveMetadataFromCardData, canCreateSmdNewVersion, fetchSmdMetadata, postSmdStatus } from './smdApi'
import { confirmDeleteSmdCard } from './smdDeleteActions'
import { exportSmdCardDataToXML } from './smdXmlExporter'
import type { SmdRelatedActions } from '@/types/smdCard'
import { validateSmdCardBeforeSave } from './smdSaveValidation'
import { validateSmdOutgoingCardFullWithSchema, validateSmdCardForSend } from './smdValidation'
import { syncSmdCardFromPrimaryMeasure } from './smdSanitaryMeasureModel'
import {
  incomingSmdStatusButton,
  outgoingSmdStatusButton,
  smdCloseCardButton,
  isSmdIncomingSource,
  isSmdOutgoingSource,
} from './smdStatusButtonConfig'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ValidationResultModal from '@/components/modals/dpa/ValidationResultModal'
import AccessModal from '@/components/modals/dpa/AccessModal'
import { checkAccessRight, fetchRightsByGuidRaw, resolveCardAccessApiSource } from '@/utils/referenceDataApi'
import { smdApiSourceToAccessRight } from './smdApi'
import type { ValidationResult } from '@/utils/cardValidation'
import { useParentActivityPing } from '@/hooks/shared/useParentActivityPing'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'
import { getSmdMessageName, SMD_MESSAGE_CANCEL } from '@/constants/smdCard'

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
  const [validationModalVisible, setValidationModalVisible] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validating, setValidating] = useState(false)
  const [sending, setSending] = useState(false)

  useParentActivityPing()

  useEffect(() => {
    setEditedData(data)
    if (!isCreateMode) setIsEditMode(false)
  }, [data, isCreateMode])

  const effectiveSmdid = (smdid ?? '').trim()
  const hasPersisted = effectiveSmdid.length > 0 && effectiveSmdid !== '-'
  const isIncoming = isSmdIncomingSource(meta.dataSourceKindName ?? data.source, meta.dataSourceKindCode)
  const isOutgoing = isSmdOutgoingSource(meta.dataSourceKindName ?? data.source, meta.dataSourceKindCode)
  const isEec = String(meta.dataSourceKindCode ?? '').trim() === '3'

  const currentData = isEditMode ? editedData : data

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

  const showEditButton = (isOutgoing && !isEec && hasEditRight && !isNewVersionCopy) || (isCreateMode && !isNewVersionCopy)
  const showValidationButton = isOutgoing && !isEec && canValidateCard

  const canShowCopyButton =
    isOutgoing &&
    hasPersisted &&
    hasEditRight &&
    (meta.smdStatusCode ?? '').toUpperCase() === 'DELIVERED' &&
    (meta.messageCode ?? data.electronicDocument?.messageCode ?? '').trim().toUpperCase() !== SMD_MESSAGE_CANCEL

  const statusButton = useMemo(() => {
    if (isEec) return null
    const code = meta.smdStatusCode ?? undefined
    if (isIncoming) return incomingSmdStatusButton(code)
    if (isOutgoing) return outgoingSmdStatusButton(code)
    return null
  }, [isEec, isIncoming, isOutgoing, meta.smdStatusCode])

  const closeButton = smdCloseCardButton()

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

  const handleStatusAction = (action: string) => {
    if (action === 'close_card') {
      postMessageFromCardToParent({ type: 'close_card' })
      return
    }
    message.info(`Действие «${action}» для SMD будет реализовано в следующей итерации`)
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
          onUpdate?.({
            ...data,
            status: res.newStatus ?? freshMeta.smdStatusName ?? 'Ожидает отправки',
          })
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
    if (!isCreateMode) {
      message.info('Сохранение существующей карты SMD — в следующей итерации')
      return
    }
    const synced = syncSmdCardFromPrimaryMeasure(currentData)
    const validationErrors = validateSmdCardBeforeSave(synced, {
      requireMessageForNewVersion: isNewVersionCopy,
    })
    if (validationErrors.length > 0) {
      message.error(validationErrors[0])
      return
    }
    const copySourceSmdid =
      copyFromSmdid != null && copyFromSmdid > 0
        ? copyFromSmdid
        : copyFromSmdidRef.current != null && copyFromSmdidRef.current > 0
          ? copyFromSmdidRef.current
          : undefined
    setSaving(true)
    try {
      const xml = exportSmdCardDataToXML(synced)
      const metadata = buildSmdSaveMetadataFromCardData(synced)
      const res = await saveSmdCard({
        isNew: true,
        xmlBody: xml,
        metadata,
        guid,
        ...(copySourceSmdid != null ? { copyFromSmdid: copySourceSmdid } : {}),
      })
      message.success(
        isNewVersionCopy
          ? 'Новая версия карты сведений о временной санитарной мере сохранена'
          : 'Карта сведений о временной санитарной мере сохранена'
      )
      if (isNewVersionCopy) {
        copyFromSmdidRef.current = undefined
        try {
          sessionStorage.removeItem(SMD_COPY_FROM_SESSION_KEY)
        } catch {
          /* ignore */
        }
      }
      onSaveNewCard?.(res.smdid)
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка сохранения карты')
    } finally {
      setSaving(false)
    }
  }

  const onCardChange = (next: CardData) => {
    const synced = syncSmdCardFromPrimaryMeasure(next)
    setEditedData(synced)
    onUpdate?.(synced)
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
        <div style={{ padding: 16 }}>
          <SmdMeasuresTab data={currentData} {...tabProps} />
        </div>
      ),
    },
    {
      key: 'products',
      label: 'Продукция',
      children: (
        <div style={{ padding: 16 }}>
          <SmdProductsTab data={currentData} />
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
            {hasPersisted ? ` (SMDID ${effectiveSmdid})` : isNewVersionCopy ? ' (новая версия)' : ''}
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
          statusButton={statusButton}
          closeButton={closeButton}
          onStatusAction={handleStatusAction}
          onElectronicDocumentClick={() => message.info('Электронные документы SMD — в разработке')}
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
              {isIncoming && hasPersisted && (
                <Button
                  size="small"
                  onClick={() => message.info('Завершение обработки — в разработке')}
                >
                  Завершить обработку
                </Button>
              )}
            </>
          }
          onShowRightsDebug={
            import.meta.env.DEV && guid
              ? () => {
                  void fetchRightsByGuidRaw(guid).then((t) => {
                    Modal.info({ title: 'Права (JSON)', content: t.slice(0, 8000), width: 720 })
                  })
                }
              : undefined
          }
        />
        )}
        <div className="card-tabs-wrapper">
          <Tabs defaultActiveKey="sanitary" items={tabItems} />
        </div>
      </div>

      <StatusHistoryModal
        visible={statusHistoryVisible}
        loading={statusHistoryLoading}
        data={statusHistoryModalData}
        onClose={() => setStatusHistoryVisible(false)}
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
