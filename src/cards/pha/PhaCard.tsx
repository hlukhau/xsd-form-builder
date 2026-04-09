import { useState, useEffect, useRef } from 'react'
import { Tabs, Button, Space, message, Modal, Spin, Collapse, Input } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { CardData, StatusHistoryItem } from '@/types/card'
import { CardHeader, CardActions } from '@/cards/shared'
import {
  NotificationTab,
  NotificationTabEdit,
  DiseaseTab,
  DiseaseTabEdit,
  PatientGroupTab,
  PatientGroupTabEdit,
  SanitaryMeasuresTab,
  SanitaryMeasuresTabEdit,
} from '@/components/tabs/pha'
import DetectionPlaceTab from '@/components/tabs/dpa/DetectionPlaceTab'
import DetectionPlaceTabEdit from '@/components/tabs/dpa/DetectionPlaceTabEdit'
import {
  savePhaCard,
  buildPhaSaveMetadataFromCardData,
  deletePhaCard,
  fetchPhaStatusHistory,
  postPhaStatus,
  canCreatePhaNewVersion,
} from '@/cards/pha/phaApi'
import { exportPhaCardDataToXML } from '@/cards/pha/phaXmlExporter'
import { alignPhaParsedCardForCompare, parsePhaXmlToCardData } from '@/cards/pha/phaXmlParser'
import {
  validatePhaOutgoingCardFull,
  collectPhaFormatValidationErrors,
  type ValidationResult,
} from '@/cards/pha/phaValidation'
import { compareCardData, getPhaCardDataReview } from '@/utils/cardDataComparator'
import { getEmptyTagsWarnings } from '@/utils/xmlExporter'
import { getPhaEmptyTagsWarnings } from '@/cards/pha/phaPatientGroupXml'
import { fetchRightsByGuid, fetchRightsByGuidRaw, checkAccessRight, type RightsJson } from '@/utils/referenceDataApi'
import {
  incomingPhaStatusButton,
  outgoingPhaStatusButton,
  isPhaIncomingSource,
  isPhaOutgoingSource,
  phaSituationEndDateFilled,
} from '@/utils/phaStatusButtonConfig'
import XMLComparisonModal, { type ComparisonResultShape } from '@/components/modals/dpa/XMLComparisonModal'
import ValidationResultModal from '@/components/modals/dpa/ValidationResultModal'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ElectronicDocumentModal from '@/components/modals/dpa/ElectronicDocumentModal'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useParentActivityPing } from '@/hooks/shared/useParentActivityPing'
import { resolveAlertCountryNameForPostMessage } from '@/utils/alertCountryDisplay'
import { loadPhaCardFromDb } from '@/cards/pha/loadPhaCardFromDb'

interface PhaCardProps {
  data: CardData
  phaid?: string
  guid?: string
  /** Исходный XML (с сервера) для сравнения с текущим состоянием формы. */
  originalXML?: string | null
  /** Обновление данных карты (после сохранения или при переключении с бэкенда). */
  onUpdate?: (data: CardData) => void
  /** После первого сохранения новой карты — переход на URL с реальным PHAID */
  onSaveNewCard?: (newPhaid: number) => void
  /** После удаления карты — закрыть форму и показать сообщение (как DPA) */
  onCardDeleted?: () => void
  /** Создание новой версии исходящей карты PHA */
  onMakeCopy?: (initialCardData: CardData, sourcePhaid: number) => void
}

/** Исходящие PHA: редактирование недоступно в терминальных / «ожидает отправки» статусах */
function phaOutgoingAllowsEdit(status: string | undefined): boolean {
  const s = (status ?? '').trim().toLowerCase()
  return s === 'новое' || s.includes('не удалась') || s.includes('ошибка обработки')
}

/** Сервер publicHealthIn:status и пересечение с PHADEPPERMIS, если в карте есть phaAccessibleDepIds. */
function canApplyPublicHealthInStatusForCard(
  serverAllows: boolean,
  rights: RightsJson | null,
  cardDepIds: string[] | undefined
): boolean {
  if (!serverAllows) return false
  if (cardDepIds === undefined) return true
  if (cardDepIds.length === 0) return false
  const statusMap = rights?.up?.publicHealthIn?.status
  if (!statusMap || typeof statusMap !== 'object') return false
  return cardDepIds.some((id) => Object.prototype.hasOwnProperty.call(statusMap, String(id)))
}

function canApplyPublicHealthOutStatusForCard(
  serverAllows: boolean,
  rights: RightsJson | null,
  cardDepIds: string[] | undefined
): boolean {
  if (!serverAllows) return false
  if (cardDepIds === undefined) return true
  if (cardDepIds.length === 0) return false
  const statusMap = rights?.up?.publicHealthOut?.status
  if (!statusMap || typeof statusMap !== 'object') return false
  return cardDepIds.some((id) => Object.prototype.hasOwnProperty.call(statusMap, String(id)))
}

function canApplyPublicHealthOutEditForCard(
  serverAllows: boolean,
  rights: RightsJson | null,
  cardDepIds: string[] | undefined
): boolean {
  if (!serverAllows) return false
  if (cardDepIds === undefined) return true
  if (cardDepIds.length === 0) return false
  const editMap = rights?.up?.publicHealthOut?.edit
  if (!editMap || typeof editMap !== 'object') return false
  return cardDepIds.some((id) => Object.prototype.hasOwnProperty.call(editMap, String(id)))
}

function canApplyPublicHealthOutSendForCard(
  serverAllows: boolean,
  rights: RightsJson | null,
  cardDepIds: string[] | undefined
): boolean {
  if (!serverAllows) return false
  if (cardDepIds === undefined) return true
  if (cardDepIds.length === 0) return false
  const sendMap = rights?.up?.publicHealthOut?.send
  if (!sendMap || typeof sendMap !== 'object') return false
  return cardDepIds.some((id) => Object.prototype.hasOwnProperty.call(sendMap, String(id)))
}

const PHA_TABS = [
  { key: 'notification', label: 'Уведомление', view: NotificationTab, edit: NotificationTabEdit },
  { key: 'disease', label: 'Болезнь', view: DiseaseTab, edit: DiseaseTabEdit },
  { key: 'patientGroup', label: 'Группа пациентов', view: PatientGroupTab, edit: PatientGroupTabEdit },
  { key: 'detectionPlace', label: 'Место обнаружения', view: DetectionPlaceTab, edit: DetectionPlaceTabEdit },
  { key: 'spreadZone', label: 'Зона распространения', view: DetectionPlaceTab, edit: DetectionPlaceTabEdit },
  { key: 'sanitaryMeasures', label: 'Санитарные меры', view: SanitaryMeasuresTab, edit: SanitaryMeasuresTabEdit },
]

/**
 * Карта сведений об обнаружении болезней (PHA).
 * Тело карты — вкладки: Уведомление, Болезнь, Группа пациентов, Место обнаружения, Зона распространения, Санитарные меры.
 * Режим редактирования: переключатель, кнопки «Сохранить», «Экспорт XML»; вкладка «Уведомление» редактируется.
 */
const PhaCard: React.FC<PhaCardProps> = ({
  data,
  phaid = '',
  guid,
  originalXML,
  onUpdate,
  onSaveNewCard,
  onCardDeleted,
  onMakeCopy,
}) => {
  const [savedPhaid, setSavedPhaid] = useState<number | null>(null)
  const effectivePhaid =
    phaid && phaid !== '-' ? phaid : savedPhaid != null ? String(savedPhaid) : '-'

  const [isEditMode, setIsEditMode] = useState(() => phaid === '-')
  const [cancelReloading, setCancelReloading] = useState(false)
  const [editedData, setEditedData] = useState<CardData>(data)
  const [saving, setSaving] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResultShape | null>(null)
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false)
  const [pendingSavePayload, setPendingSavePayload] = useState<{ xmlBody: string; metadata: ReturnType<typeof buildPhaSaveMetadataFromCardData> } | null>(null)
  const [formatValidationErrors, setFormatValidationErrors] = useState<string[]>([])
  /** Логические проверки / обязательные поля — в модалке «Проверка перед сохранением», как в DPA для XSD. */
  const [logicalValidationErrors, setLogicalValidationErrors] = useState<string[]>([])
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [validationModalVisible, setValidationModalVisible] = useState(false)
  const [baselineXml, setBaselineXml] = useState<string | null>(originalXML ?? null)
  const [statusHistoryVisible, setStatusHistoryVisible] = useState(false)
  const [statusHistoryModalData, setStatusHistoryModalData] = useState<StatusHistoryItem[]>([])
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false)
  const [electronicDocumentVisible, setElectronicDocumentVisible] = useState(false)
  const [rightsDebugVisible, setRightsDebugVisible] = useState(false)
  const [rightsDebugData, setRightsDebugData] = useState<RightsJson | null>(null)
  const [rightsDebugLoading, setRightsDebugLoading] = useState(false)
  const [rightsDebugError, setRightsDebugError] = useState<string | null>(null)
  const [rightsDebugRawText, setRightsDebugRawText] = useState<string | null>(null)
  const [rightsDebugDraft, setRightsDebugDraft] = useState('')
  const [rightsOverride, setRightsOverride] = useState<RightsJson | null>(null)
  /** Право publicHealthIn:status (входящие) / publicHealthOut:status (исходящие). */
  const [hasPhaStatusRight, setHasPhaStatusRight] = useState(false)
  /** Право publicHealthOut:send — «Направление сведений» для исходящих. */
  const [hasPhaSendRight, setHasPhaSendRight] = useState(false)
  /** Право publicHealthOut:edit — сохранение и удаление исходящей карты в допустимом статусе. */
  const [hasPhaEditRight, setHasPhaEditRight] = useState(false)
  const { countryOptions } = useCountryOptions()
  useParentActivityPing()

  useEffect(() => {
    setBaselineXml(originalXML ?? null)
  }, [originalXML, phaid])

  useEffect(() => {
    if (phaid && phaid !== '-') setSavedPhaid(null)
  }, [phaid])

  const datasourceKindCode = String(editedData.datasourceKindCode ?? data.datasourceKindCode ?? '').trim()
  /** Входящие ЕАЭС (1) и сведения БД ЕЭК (3): только просмотр, без редактирования сохранённой карты. */
  const phaDatasourceNoEdit =
    effectivePhaid !== '-' && (datasourceKindCode === '1' || datasourceKindCode === '3')
  const sourceFromData = data?.source ?? ''
  const isOutgoingPha =
    effectivePhaid === '-' ||
    datasourceKindCode === '2' ||
    datasourceKindCode === '3' ||
    sourceFromData.toLowerCase().includes('исходящ') ||
    sourceFromData === '2'
  const isIncomingPha = isPhaIncomingSource(editedData.source)
  const overrideDepid = rightsOverride?.department?.depid != null ? String(rightsOverride.department.depid) : null
  const overrideHasByMap = (map: Record<string, unknown> | undefined | null): boolean =>
    !!(overrideDepid && map && typeof map === 'object' && Object.prototype.hasOwnProperty.call(map, overrideDepid))
  const effectivePhaStatusRight = rightsOverride
    ? (isOutgoingPha
        ? overrideHasByMap(rightsOverride.up?.publicHealthOut?.status)
        : overrideHasByMap(rightsOverride.up?.publicHealthIn?.status))
    : hasPhaStatusRight
  const effectivePhaSendRight = rightsOverride
    ? overrideHasByMap(rightsOverride.up?.publicHealthOut?.send)
    : hasPhaSendRight
  const effectivePhaEditRight = rightsOverride
    ? overrideHasByMap(rightsOverride.up?.publicHealthOut?.edit)
    : hasPhaEditRight
  const outgoingStatusId = editedData.statusId ?? data.statusId
  const canEditByStatus =
    !isOutgoingPha ||
    isIncomingPha ||
    outgoingStatusId === 5 ||
    outgoingStatusId === 8 ||
    outgoingStatusId === 9 ||
    phaOutgoingAllowsEdit(editedData.status ?? data.status)

  // Обновляем editedData только при смене карты (другой registrationNumber/version), чтобы не терять правки при переключении в режим просмотра
  useEffect(() => {
    if (
      data.registrationNumber !== editedData.registrationNumber ||
      (data.version !== undefined && data.version !== editedData.version)
    ) {
      setEditedData(data)
    }
  }, [data, data.registrationNumber, data.version, editedData.registrationNumber, editedData.version])

  // Как в DPA: для отображения всегда используем editedData, чтобы правки сохранялись при переключении вкладок и режима просмотра
  const currentData = editedData
  const currentDataRef = useRef(editedData)
  useEffect(() => {
    currentDataRef.current = editedData
  }, [editedData])

  useEffect(() => {
    if (!guid?.trim()) {
      setHasPhaStatusRight(false)
      setHasPhaSendRight(false)
      setHasPhaEditRight(false)
      return
    }
    const dscRights = String(editedData.datasourceKindCode ?? data.datasourceKindCode ?? '').trim()
    const eecDbCtx = dscRights === '3'
    const incomingCtx = isPhaIncomingSource(editedData.source)
    const outgoingCtx = isPhaOutgoingSource(editedData.source) || eecDbCtx
    if (incomingCtx && effectivePhaid !== '-' && !eecDbCtx) {
      let cancelled = false
      setHasPhaSendRight(false)
      setHasPhaEditRight(false)
      ;(async () => {
        try {
          const [server, rights] = await Promise.all([
            checkAccessRight(guid.trim(), 'publicHealthIn:status'),
            fetchRightsByGuid(guid.trim()),
          ])
          if (cancelled) return
          const depIds = editedData.phaAccessibleDepIds ?? data.phaAccessibleDepIds
          setHasPhaStatusRight(canApplyPublicHealthInStatusForCard(server, rights, depIds))
        } catch {
          if (!cancelled) setHasPhaStatusRight(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }
    if (!(incomingCtx && effectivePhaid !== '-' && !eecDbCtx) && (outgoingCtx || effectivePhaid === '-' || eecDbCtx)) {
      let cancelled = false
      ;(async () => {
        try {
          const [status, send, edit, rights] = await Promise.all([
            checkAccessRight(guid.trim(), 'publicHealthOut:status'),
            checkAccessRight(guid.trim(), 'publicHealthOut:send'),
            checkAccessRight(guid.trim(), 'publicHealthOut:edit'),
            fetchRightsByGuid(guid.trim()),
          ])
          if (cancelled) return
          const depIds = editedData.phaAccessibleDepIds ?? data.phaAccessibleDepIds
          setHasPhaStatusRight(canApplyPublicHealthOutStatusForCard(status, rights, depIds))
          setHasPhaSendRight(canApplyPublicHealthOutSendForCard(send, rights, depIds))
          setHasPhaEditRight(canApplyPublicHealthOutEditForCard(edit, rights, depIds))
          const depid = rights.department?.depid != null ? String(rights.department.depid) : null
          const hasRightInMap = (map: Record<string, unknown> | undefined | null): boolean => {
            if (!depid || !map || typeof map !== 'object') return false
            return Object.prototype.hasOwnProperty.call(map, depid)
          }
          const upOut = rights.up?.publicHealthOut as { edit?: Record<string, unknown> } | undefined
          if (hasRightInMap(upOut?.edit) === false) {
            setHasPhaEditRight((prev) => prev && false)
          }
        } catch {
          if (!cancelled) {
            setHasPhaStatusRight(false)
            setHasPhaSendRight(false)
            setHasPhaEditRight(false)
          }
        }
      })()
      return () => {
        cancelled = true
      }
    } else {
      setHasPhaStatusRight(false)
      setHasPhaSendRight(false)
      setHasPhaEditRight(false)
    }
  }, [
    guid,
    editedData.source,
    editedData.datasourceKindCode,
    data.datasourceKindCode,
    effectivePhaid,
    editedData.phaAccessibleDepIds,
    data.phaAccessibleDepIds,
    data.source,
  ])

  const editSwitchDisabled = (isOutgoingPha && !canEditByStatus) || phaDatasourceNoEdit
  /** Исходящие: право publicHealthOut:edit; новая карта (-); входящие — без отдельного права edit в API. */
  const showEditButton =
    !editSwitchDisabled &&
    (isIncomingPha || effectivePhaid === '-' || (isOutgoingPha && effectivePhaEditRight))

  const situationEndFilled = phaSituationEndDateFilled(currentData.notification?.endDate)

  const phaStatusResultRaw =
    effectivePhaid && effectivePhaid !== '-'
      ? isPhaIncomingSource(currentData.source)
        ? incomingPhaStatusButton(
            currentData.statusId,
            currentData.status,
            effectivePhaStatusRight,
            situationEndFilled
          )
        : isPhaOutgoingSource(currentData.source) || datasourceKindCode === '3'
          ? outgoingPhaStatusButton(
              currentData.statusId,
              currentData.status,
              effectivePhaStatusRight,
              effectivePhaSendRight,
              situationEndFilled
            )
          : { config: null as const, comment: '' }
      : { config: null as const, comment: '' }

  const phaStatusResult =
    effectivePhaid === '-' && phaStatusResultRaw.config
      ? {
          ...phaStatusResultRaw,
          config: { ...phaStatusResultRaw.config, disabled: true, hint: 'Сохраните изменения' },
          comment: 'Сохраните изменения',
        }
      : effectivePhaid === '-' && phaStatusResultRaw.closeConfig
        ? {
            ...phaStatusResultRaw,
            closeConfig: { ...phaStatusResultRaw.closeConfig, disabled: true, hint: 'Сохраните изменения' },
          }
        : phaStatusResultRaw

  const showSaveButton =
    isEditMode &&
    !phaDatasourceNoEdit &&
    (effectivePhaid === '-' ||
      (isIncomingPha && canEditByStatus) ||
      (isOutgoingPha && effectivePhaEditRight && canEditByStatus))

  const isPhaDeletableStatus =
    (editedData.statusId ?? data.statusId) === 5 || /^новое$/i.test((editedData.status ?? data.status ?? '').trim())

  const showDeleteButton =
    isOutgoingPha &&
    isPhaDeletableStatus &&
    effectivePhaEditRight &&
    effectivePhaid !== '-' &&
    !!guid

  const showCopyButton =
    isOutgoingPha &&
    effectivePhaEditRight &&
    effectivePhaid !== '-' &&
    effectivePhaid != null &&
    !!guid &&
    !!onMakeCopy &&
    (editedData.statusId ?? data.statusId) === 10

  const confirmCompleteIncomingProcessing = () => {
    if (!effectivePhaid || effectivePhaid === '-') return
    const regNumber =
      currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectivePhaid
    Modal.confirm({
      title: 'Завершение обработки',
      content: `После подтверждения карта ${regNumber} будет переведена в статус «Обработано». Продолжить?`,
      okText: 'Продолжить',
      cancelText: 'Отмена',
      onOk: async () => {
        const hasRight = await checkAccessRight(guid ?? null, 'publicHealthIn:status')
        if (!hasRight) {
          message.error('Нет права управления статусом входящих сведений (publicHealthIn:status).')
          return
        }
        try {
          const res = await postPhaStatus(effectivePhaid, 'complete_processing', guid)
          const newStatus = res.newStatus ?? 'Обработано'
          const newStatusId = res.newStatusId ?? editedData.statusId
          const next = { ...editedData, status: newStatus, statusId: newStatusId }
          setEditedData(next)
          onUpdate?.(next)
          message.success('Карта переведена в статус «Обработано».')
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
        }
      },
    })
  }

  /**
   * Направление сведений ОП 57 — как DPA (send):
   * 1) сначала проверка заполнения и формата (модальное окно «Валидация карты» при ошибках);
   * 2) затем предупреждение Modal.confirm;
   * 3) сохранение XML в БД (чтобы серверная проверка PHAXML совпала с формой), затем смена статуса.
   */
  const confirmSendPhaOp57 = () => {
    if (!effectivePhaid || effectivePhaid === '-') return
    const dataToValidate = editedData
    const full = validatePhaOutgoingCardFull(dataToValidate)
    if (!full.success) {
      setValidationResult(full)
      setValidationModalVisible(true)
      message.error('Необходимо доработать карту исходящих сведений перед направлением.')
      return
    }

    const regNumber =
      currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectivePhaid
    Modal.confirm({
      title: 'Направление сведений участникам ОП 57',
      content: `После подтверждения по карте ${regNumber} будут направлены сведения участникам ОП 57; карта перейдёт в статус «Ожидает отправки». Подтвердите выполнение операции.`,
      okText: 'Направить сведения',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const [hasSend, rightsFetched] = await Promise.all([
            checkAccessRight(guid ?? null, 'publicHealthOut:send'),
            guid?.trim() ? fetchRightsByGuid(guid.trim()) : Promise.resolve(null),
          ])
          const rights = rightsOverride ?? rightsFetched
          const depIds = editedData.phaAccessibleDepIds ?? data.phaAccessibleDepIds
          if (!canApplyPublicHealthOutSendForCard(hasSend, rights, depIds)) {
            message.error(
              'Нет права на направление исходящих сведений (publicHealthOut:send) в пределах подразделения с доступом к карте.'
            )
            return
          }
        } catch {
          message.error('Не удалось проверить права на направление сведений.')
          return
        }

        try {
          if (effectivePhaEditRight && isOutgoingPha) {
            const xmlBody = exportPhaCardDataToXML(editedData)
            const metadata = buildPhaSaveMetadataFromCardData(editedData)
            await savePhaCard({
              isNew: false,
              xmlBody,
              metadata,
              phaid: Number(effectivePhaid),
              ...(guid ? { guid } : {}),
            })
            setBaselineXml(xmlBody)
          }

          const res = await postPhaStatus(effectivePhaid, 'send', guid)
          const newStatus = res.newStatus ?? 'Ожидает отправки'
          const newStatusId = res.newStatusId ?? editedData.statusId
          const next = { ...editedData, status: newStatus, statusId: newStatusId }
          setEditedData(next)
          onUpdate?.(next)
          message.success('Карта переведена в статус «Ожидает отправки».')
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
        }
      },
    })
  }

  const confirmClosePhaCard = () => {
    if (!effectivePhaid || effectivePhaid === '-') return
    const regNumber =
      currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectivePhaid
    Modal.confirm({
      title: 'Закрытие карты',
      content: `После подтверждения карта ${regNumber} будет переведена в статус «Завершено». Продолжить?`,
      okText: 'Продолжить',
      cancelText: 'Отмена',
      onOk: async () => {
        const rightKey = isIncomingPha ? 'publicHealthIn:status' : 'publicHealthOut:status'
        const hasRight = await checkAccessRight(guid ?? null, rightKey)
        if (!hasRight) {
          message.error(
            isIncomingPha
              ? 'Нет права управления статусом входящих сведений (publicHealthIn:status).'
              : 'Нет права управления статусом исходящих сведений (publicHealthOut:status).'
          )
          return
        }
        try {
          const res = await postPhaStatus(effectivePhaid, 'close', guid)
          const newStatus = res.newStatus ?? 'Завершено'
          const newStatusId = res.newStatusId ?? editedData.statusId
          const next = { ...editedData, status: newStatus, statusId: newStatusId }
          setEditedData(next)
          onUpdate?.(next)
          message.success('Карта переведена в статус «Завершено».')
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
        }
      },
    })
  }

  const handleDelete = () => {
    const regNumber =
      currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectivePhaid ?? ''
    Modal.confirm({
      title: 'Подтверждение удаления',
      content: `Карта ${regNumber} будет удалена безвозвратно. Продолжить?`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          const hasRight = await checkAccessRight(guid ?? null, 'publicHealthOut:edit')
          if (!hasRight) {
            message.error('Нет права на редактирование исходящих сведений (publicHealthOut:edit).')
            return
          }
          await deletePhaCard(Number(effectivePhaid), guid!)
          message.success('Карта удалена')
          console.log('[PhaCard] Sending exit message to parent after delete')
          window.parent.postMessage({ code: 'exit' }, '*')
          onCardDeleted?.()
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Ошибка удаления')
        }
      },
    })
  }

  const handleCopy = async () => {
    if (!effectivePhaid || !guid || !onMakeCopy) return
    try {
      const res = await canCreatePhaNewVersion(String(effectivePhaid), guid)
      if (!res.allowed) {
        message.error(res.reason ?? 'Создание новой версии недоступно')
        return
      }
      const nowIso = new Date().toISOString()
      const today = nowIso.slice(0, 10)
      const initialCardData: CardData = {
        ...currentData,
        version: (currentData.version ?? 1) + 1,
        status: 'Новое',
        statusId: 5,
        createdAt: nowIso,
        modifiedAt: nowIso,
        notification: {
          ...currentData.notification!,
          formationDate: today,
          type: '',
        },
      }
      onMakeCopy(initialCardData, Number(effectivePhaid))
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка проверки возможности создания новой версии')
    }
  }

  const handlePhaStatusAction = (action: string) => {
    if (!effectivePhaid || effectivePhaid === '-') return
    const regNumber =
      currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? phaid
    if (action === 'pha_complete_processing') {
      confirmCompleteIncomingProcessing()
      return
    }
    if (action === 'pha_close') {
      confirmClosePhaCard()
      return
    }
    if (action === 'pha_send') {
      confirmSendPhaOp57()
      return
    }
    if (action === 'pha_to_new') {
      Modal.confirm({
        title: 'Перевести в Новое',
        content: `После подтверждения карта ${regNumber} будет переведена в статус «Новое». Продолжить?`,
        okText: 'Продолжить',
        cancelText: 'Отмена',
        onOk: async () => {
          const hasRight = await checkAccessRight(guid ?? null, 'publicHealthOut:status')
          if (!hasRight) {
            message.error('Нет права управления статусом исходящих сведений (publicHealthOut:status).')
            return
          }
          try {
            const res = await postPhaStatus(effectivePhaid, 'to_new', guid)
            const newStatus = res.newStatus ?? 'Новое'
            const newStatusId = res.newStatusId ?? editedData.statusId
            const next = { ...editedData, status: newStatus, statusId: newStatusId }
            setEditedData(next)
            onUpdate?.(next)
            message.success('Карта переведена в статус «Новое».')
          } catch (e) {
            message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
          }
        },
      })
    }
  }

  const handleCancelEdit = async () => {
    if (!effectivePhaid || effectivePhaid === '-' || !/^\d+$/.test(effectivePhaid)) return
    setCancelReloading(true)
    try {
      const { card, xmlText } = await loadPhaCardFromDb(effectivePhaid, guid)
      onUpdate?.(card)
      setEditedData(card)
      setBaselineXml(xmlText)
      setIsEditMode(false)
      setPendingSavePayload(null)
      setComparisonModalVisible(false)
      setFormatValidationErrors([])
      setLogicalValidationErrors([])
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось загрузить данные карты из БД')
    } finally {
      setCancelReloading(false)
    }
  }

  const handleSaveToDbFromModal = async () => {
    if (!pendingSavePayload) return
    const xmlJustSaved = pendingSavePayload.xmlBody
    setSaving(true)
    const isNewCard = effectivePhaid === '-'
    try {
      const res = await savePhaCard({
        isNew: isNewCard,
        xmlBody: pendingSavePayload.xmlBody,
        metadata: pendingSavePayload.metadata,
        ...(isNewCard ? {} : { phaid: Number(effectivePhaid) }),
        ...(guid ? { guid } : {}),
      })
      setPendingSavePayload(null)
      setComparisonModalVisible(false)
      setLogicalValidationErrors([])
      onUpdate?.(editedData)
      setIsEditMode(false)
      setBaselineXml(xmlJustSaved)
      if (isNewCard) {
        setSavedPhaid(res.phaid)
        try {
          sessionStorage.setItem('xsd_form_builder_last_saved_phaid', String(res.phaid))
          sessionStorage.setItem('xsd_form_builder_save_happened', '1')
        } catch (_) {}
        message.success(`Карта сохранена в БД с PHAID ${res.phaid}`)
        onSaveNewCard?.(res.phaid)
      } else {
        message.success('Карта обновлена в БД')
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Ошибка сохранения в БД')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    const xmlBody = exportPhaCardDataToXML(editedData)
    const metadata = buildPhaSaveMetadataFromCardData(editedData)
    const isNewCard = effectivePhaid === '-'
    const canSaveToDb =
      effectivePhaid !== '-' &&
      !phaDatasourceNoEdit &&
      ((isOutgoingPha && effectivePhaEditRight) || isIncomingPha)

    const formatErrors = collectPhaFormatValidationErrors(editedData)
    setFormatValidationErrors(formatErrors)
    /** Незаполненные обязательные по XSD поля и прочие контроли — только в «Валидация карты» / перед направлением ОП 57, не блокируют сохранение. */
    setLogicalValidationErrors([])

    if (isNewCard) {
      const { filled, unfilled } = getPhaCardDataReview(editedData)
      setComparisonResult({
        isIdentical: true,
        differences: [],
        warnings: [],
        added: [],
        isNewDocument: true,
        filled,
        unfilled,
      })
      setPendingSavePayload({ xmlBody, metadata })
      setComparisonModalVisible(true)
      return
    }

    if (canSaveToDb) {
      setPendingSavePayload({ xmlBody, metadata })
    } else {
      setPendingSavePayload(null)
      onUpdate?.(editedData)
      setIsEditMode(false)
    }

    const xmlToCompare = baselineXml
    if (xmlToCompare) {
      try {
        const originalData = alignPhaParsedCardForCompare(
          parsePhaXmlToCardData(xmlToCompare),
          editedData
        )
        const result = compareCardData(originalData, editedData)
        const emptyTagsWarnings = [
          ...getEmptyTagsWarnings(editedData),
          ...getPhaEmptyTagsWarnings(editedData),
        ]
        const resultWithWarnings =
          emptyTagsWarnings.length > 0
            ? { ...result, warnings: [...(result.warnings ?? []), ...emptyTagsWarnings] }
            : result
        setComparisonResult(resultWithWarnings)
        setComparisonModalVisible(true)
      } catch {
        const emptyTagsWarnings = [
          ...getEmptyTagsWarnings(editedData),
          ...getPhaEmptyTagsWarnings(editedData),
        ]
        setComparisonResult({
          isIdentical: true,
          differences: [],
          warnings: emptyTagsWarnings,
          added: [],
        })
        setComparisonModalVisible(true)
      }
    } else {
      setComparisonResult({
        isIdentical: true,
        differences: [],
        warnings: [...getEmptyTagsWarnings(editedData), ...getPhaEmptyTagsWarnings(editedData)],
        added: [],
      })
      setComparisonModalVisible(true)
    }
  }

  const tabItems = PHA_TABS.map((item) => {
    const TabView = item.view
    const EditComponent = 'edit' in item ? item.edit : null
    let children: React.ReactNode
    if (isEditMode && EditComponent) {
      if (item.key === 'detectionPlace') {
        children = (
          <EditComponent
            data={currentData.detectionPlace ?? {}}
            onChange={(place) => setEditedData((prev) => ({ ...prev, detectionPlace: place }))}
          />
        )
      } else if (item.key === 'spreadZone') {
        const zones = currentData.spreadingZones && currentData.spreadingZones.length > 0
          ? currentData.spreadingZones
          : (currentData.spreadingZone ? [currentData.spreadingZone] : [])
        const setZones = (nextZones: typeof zones) =>
          setEditedData((prev) => ({
            ...prev,
            spreadingZones: nextZones.length > 0 ? nextZones : undefined,
            spreadingZone: nextZones.length > 0 ? nextZones[0] : undefined,
          }))
        children = (
          <div>
            <Collapse
              style={{ marginBottom: 12 }}
              items={zones.map((zone, idx) => ({
                key: String(idx),
                label: `Место зоны распространения #${idx + 1}`,
                extra: (
                  <Button
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      setZones(zones.filter((_, i) => i !== idx))
                    }}
                  >
                    Удалить место
                  </Button>
                ),
                children: (
                  <EditComponent
                    data={zone ?? {}}
                    onChange={(nextZone) => {
                      const next = [...zones]
                      next[idx] = nextZone
                      setZones(next)
                    }}
                  />
                ),
              }))}
            />
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => setZones([...(zones ?? []), {}])}
            >
              Добавить место
            </Button>
          </div>
        )
      } else {
        children = (
          <EditComponent
            data={currentData}
            onChange={setEditedData}
            {...(item.key === 'notification'
              ? { isNewCard: effectivePhaid === '-', guid: guid ?? undefined }
              : {})}
          />
        )
      }
    } else {
      if (item.key === 'detectionPlace') {
        children = <TabView data={currentData.detectionPlace ?? {}} />
      } else if (item.key === 'spreadZone') {
        const zones = currentData.spreadingZones && currentData.spreadingZones.length > 0
          ? currentData.spreadingZones
          : (currentData.spreadingZone ? [currentData.spreadingZone] : [])
        children = zones.length > 0 ? (
          <Collapse
            items={zones.map((zone, idx) => ({
              key: String(idx),
              label: `Место зоны распространения #${idx + 1}`,
              children: <TabView data={zone ?? {}} label="зоне распространения" />,
            }))}
          />
        ) : (
          <TabView data={{}} label="зоне распространения" />
        )
      } else {
        children = <TabView data={currentData} />
      }
    }
    return { key: item.key, label: item.label, children }
  })

  return (
    <div style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }} className="fade-in card-page-layout">
      <div
        className="card-sticky-header"
        style={{
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
        }}
      >
        <div className="card-sticky-header-title-row">
          <span className="card-sticky-header-title">
            {datasourceKindCode === '3'
              ? effectivePhaid && effectivePhaid !== '-'
                ? `Исходящие сведения о болезни ${effectivePhaid}`
                : 'Исходящие сведения о болезни'
              : effectivePhaid && effectivePhaid !== '-'
                ? `Карта сведений об обнаружении болезни ${effectivePhaid}`
                : 'Карта сведений об обнаружении болезни'}
          </span>
          <Space size="small" wrap>
            {!isEditMode && (
              <>
                {showEditButton && (
                  <Button
                    type="default"
                    onClick={() => setIsEditMode(true)}
                  >
                    Редактировать
                  </Button>
                )}
                {isOutgoingPha && (
                  <Button
                    onClick={() => {
                      setValidationResult(validatePhaOutgoingCardFull(currentData))
                      setValidationModalVisible(true)
                    }}
                  >
                    Валидация карты
                  </Button>
                )}
                {showCopyButton && (
                  <Button onClick={handleCopy}>Новая версия</Button>
                )}
                <Button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.parent.postMessage({ code: 'exit' }, '*')
                    }
                  }}
                >
                  {effectivePhaid === '-' ? 'Отменить создание' : 'Закрыть'}
                </Button>
              </>
            )}
            {isEditMode && (
              <>
                {showSaveButton && (
                  <Button type="primary" onClick={handleSave} loading={saving}>
                    Сохранить
                  </Button>
                )}
                {isOutgoingPha && (
                  <Button
                    onClick={() => {
                      setValidationResult(validatePhaOutgoingCardFull(editedData))
                      setValidationModalVisible(true)
                    }}
                  >
                    Валидация карты
                  </Button>
                )}
                {effectivePhaid !== '-' && /^\d+$/.test(effectivePhaid) && (
                  <Button onClick={() => void handleCancelEdit()} loading={cancelReloading} disabled={cancelReloading}>
                    Отменить
                  </Button>
                )}
                {effectivePhaid === '-' && (
                  <Button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.parent.postMessage({ code: 'exit' }, '*')
                      }
                    }}
                  >
                    Отменить создание
                  </Button>
                )}
              </>
            )}
          </Space>
        </div>
        <CardHeader
          data={currentData}
            onStatusClick={() => {
            setStatusHistoryVisible(true)
            setStatusHistoryModalData([])
            if (effectivePhaid && effectivePhaid !== '-') {
              setStatusHistoryLoading(true)
              fetchPhaStatusHistory(effectivePhaid, guid)
                .then((list) => {
                  setStatusHistoryModalData(list)
                  // Подставить последнюю запись истории только если нет текста статуса и нет statusId (источник истины — PHA + метаданные)
                  if (list.length > 0) {
                    const latest = list[list.length - 1]
                    const cur = currentDataRef.current
                    const noStatusText = !cur.status || !String(cur.status).trim()
                    const noStatusId = cur.statusId == null
                    if (latest?.status?.trim() && noStatusText && noStatusId) {
                      const updated = { ...cur, status: latest.status }
                      setEditedData(updated)
                      onUpdate?.(updated)
                    }
                  }
                })
                .catch(() => setStatusHistoryModalData([]))
                .finally(() => setStatusHistoryLoading(false))
            } else {
              setStatusHistoryLoading(false)
            }
          }}
        />
        {!isEditMode && (
        <CardActions
          data={currentData}
          onShowRightsDebug={() => {
            setRightsDebugVisible(true)
            setRightsDebugError(null)
            setRightsDebugRawText(null)
            setRightsDebugData(null)
            if (guid) {
              setRightsDebugLoading(true)
              fetchRightsByGuid(guid)
                .then((data) => {
                  setRightsDebugData(data)
                  setRightsDebugDraft(JSON.stringify(data, null, 2))
                  setRightsDebugError(null)
                  setRightsDebugRawText(null)
                })
                .catch(async (e) => {
                  setRightsDebugError(e instanceof Error ? e.message : 'Ошибка загрузки')
                  setRightsDebugData(null)
                  try {
                    const raw = await fetchRightsByGuidRaw(guid)
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
          onOpenAllVersions={() => {
            const countryForMessage = resolveAlertCountryNameForPostMessage(
              currentData.country,
              currentData.alertCountryName,
              countryOptions
            )
            const payload = {
              code: 'all_version' as const,
              INCIDENTID: currentData.registrationNumber ?? '',
              COUNTRY: countryForMessage,
            }
            if (typeof window !== 'undefined') {
              window.parent.postMessage(payload, '*')
              console.log('[Открыть все версии] Сообщение отправлено родительскому окну:', payload)
            }
          }}
          statusButton={
            phaStatusResult.config && !phaStatusResult.config.disabled ? phaStatusResult.config : null
          }
          statusButtonComment={phaStatusResult.comment || undefined}
          closeButton={
            phaStatusResult.closeConfig && !phaStatusResult.closeConfig.disabled
              ? phaStatusResult.closeConfig
              : null
          }
          onStatusAction={handlePhaStatusAction}
          onElectronicDocumentClick={() => setElectronicDocumentVisible(true)}
          showDeleteButton={showDeleteButton}
          onDelete={handleDelete}
        />
        )}
        <div className="card-tabs-wrapper">
          <Tabs defaultActiveKey="notification" items={tabItems} />
        </div>
      </div>

      <>
        <StatusHistoryModal
          visible={statusHistoryVisible}
          data={statusHistoryModalData}
          onClose={() => setStatusHistoryVisible(false)}
          loading={statusHistoryLoading}
        />
        <ElectronicDocumentModal
          visible={electronicDocumentVisible}
          data={currentData.electronicDocument ? [currentData.electronicDocument] : []}
          onClose={() => setElectronicDocumentVisible(false)}
        />
        <Modal
          title="Карта прав доступа (отладка)"
          open={rightsDebugVisible}
          onCancel={() => {
            setRightsDebugVisible(false)
            setRightsDebugData(null)
            setRightsDebugError(null)
            setRightsDebugRawText(null)
            setRightsDebugDraft('')
          }}
          footer={[
            <Button
              key="close"
              onClick={() => {
                setRightsDebugVisible(false)
                setRightsDebugData(null)
                setRightsDebugError(null)
                setRightsDebugRawText(null)
                setRightsDebugDraft('')
              }}
            >
              Закрыть
            </Button>,
            rightsDebugData != null && (
              <Button
                key="apply"
                onClick={() => {
                  try {
                    const parsed = JSON.parse(rightsDebugDraft) as RightsJson
                    setRightsOverride(parsed)
                    setRightsDebugData(parsed)
                    setRightsDebugError(null)
                    message.success('Мапа прав перезаписана из JSON.')
                  } catch (e) {
                    message.error(`Некорректный JSON: ${e instanceof Error ? e.message : String(e)}`)
                  }
                }}
              >
                Применить JSON
              </Button>
            ),
            rightsOverride != null && (
              <Button
                key="resetOverride"
                onClick={() => {
                  setRightsOverride(null)
                  message.success('Переопределение мапы прав сброшено.')
                }}
              >
                Сбросить переопределение
              </Button>
            ),
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
                <pre style={{ margin: 0, padding: 12, background: '#fff2f0', borderRadius: 4, maxHeight: 360, overflow: 'auto', fontSize: 11 }}>
                  {rightsDebugRawText}
                </pre>
              )}
            </div>
          ) : rightsDebugData != null ? (
            <Input.TextArea
              value={rightsDebugDraft}
              onChange={(e) => setRightsDebugDraft(e.target.value)}
              autoSize={{ minRows: 14, maxRows: 22 }}
              style={{ fontFamily: 'monospace' }}
            />
          ) : (
            <span>Нет данных</span>
          )}
        </Modal>
        {comparisonResult && (
          <XMLComparisonModal
            visible={comparisonModalVisible}
            comparisonResult={comparisonResult}
            onClose={() => {
              setComparisonModalVisible(false)
              setPendingSavePayload(null)
              setLogicalValidationErrors([])
            }}
            formatValidationErrors={formatValidationErrors}
            logicalValidationErrors={logicalValidationErrors}
            onSaveToDb={pendingSavePayload ? handleSaveToDbFromModal : undefined}
            saving={saving}
          />
        )}
        <ValidationResultModal
          visible={validationModalVisible}
          result={validationResult}
          onClose={() => {
            setValidationModalVisible(false)
            setValidationResult(null)
          }}
        />
      </>
    </div>
  )
}

export default PhaCard
