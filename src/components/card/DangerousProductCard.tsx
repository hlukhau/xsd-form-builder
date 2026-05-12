import { useState, useEffect, useMemo, useRef } from 'react'
import { Card, Tabs, Button, Space, message, Modal, Spin, Input } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import ProductTabEdit from '../tabs/dpa/ProductTabEdit'
import ViolationsTabEdit from '../tabs/dpa/ViolationsTabEdit'
import NotificationTabEdit from '../tabs/dpa/NotificationTabEdit'
import TSDTabEdit from '../tabs/dpa/TSDTabEdit'
import ComplianceDocumentsTabEdit from '../tabs/dpa/ComplianceDocumentsTabEdit'
import DetectionPlaceTabEdit from '../tabs/dpa/DetectionPlaceTabEdit'
import MeasuresTabEdit from '../tabs/dpa/MeasuresTabEdit'
import { CardHeader, CardActions } from '@/cards/shared'
import StatusHistoryModal from '../modals/dpa/StatusHistoryModal'
import ElectronicDocumentModal from '../modals/dpa/ElectronicDocumentModal'
import AccessModal from '../modals/dpa/AccessModal'
import NotificationTab from '../tabs/dpa/NotificationTab'
import ProductTab from '../tabs/dpa/ProductTab'
import TSDTab from '../tabs/dpa/TSDTab'
import ComplianceDocumentsTab from '../tabs/dpa/ComplianceDocumentsTab'
import ViolationsTab from '../tabs/dpa/ViolationsTab'
import DetectionPlaceTab from '../tabs/dpa/DetectionPlaceTab'
import MeasuresTab from '../tabs/dpa/MeasuresTab'
import PpvAddresseesTab from '../tabs/ppv/PpvAddresseesTab'
import PpvAddresseesTabEdit from '../tabs/ppv/PpvAddresseesTabEdit'
import { exportCardDataToXML, getEmptyTagsWarnings } from '@/utils/xmlExporter'
import { parseXMLToCardData } from '@/utils/xmlParser'
import { loadDpaCardFromDb } from '@/utils/loadDpaCardFromDb'
import {
  compareCardData,
  getCardDataReview,
  normalizePpvActorCountryCodesList,
  normalizePpvActorRemovalIds,
} from '@/utils/cardDataComparator'
import {
  fetchDpaStatusHistory,
  fetchDpaElectronicDocs,
  changeDpaStatus,
  fetchPpvIncomingCompletePreview,
  checkAccessRight,
  fetchCurrentUser,
  fetchDpaResolutions,
  fetchRightsByGuid,
  fetchRightsByGuidRaw,
  getOutgoingAuthorityFilterDepIdsFromRights,
  fetchDepInfo,
  saveDpaCard,
  buildSaveMetadataFromCardData,
  deleteDpaCard,
  canCreateNewVersion,
  type DpaSaveMetadata,
  type RightsJson,
  fetchDprCreateEligibility,
} from '@/utils/referenceDataApi'
import { getStatusButtonConfig } from '@/utils/statusButtonConfig'
import { parseElectronicDocContentBody } from '@/utils/xmlParser'
import { openLegacyRegisterAllVersions, isLegacyRegisterConfigured } from '@/utils/legacyRegisterUrl'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useParentActivityPing } from '@/hooks/shared/useParentActivityPing'
import { resolveAlertCountryNameForPostMessage } from '@/utils/alertCountryDisplay'
import { postMessageFromCardToParent } from '@/utils/parentPostMessage'
import XMLComparisonModal, { type ComparisonResultShape } from '../modals/dpa/XMLComparisonModal'
import ValidationResultModal from '../modals/dpa/ValidationResultModal'
import {
  validateOutgoingCardWithSchema,
  collectFormatValidationErrors,
  type ValidationResult,
} from '@/utils/cardValidation'
import type { CardData, StatusHistoryItem, ElectronicDocument } from '@/types/card'
import { isPpvApp, getDpaLikeCardSessionKeys, getDpaLikeCardIdLabel } from '@/cards/config'
import { format } from 'date-fns'

/** Статусы исходящей карты, при которых разрешено редактирование (DPASTATUSID). */
const EDITABLE_OUTGOING_STATUS_IDS = [5, 6, 9, 10, 12] // DRAFT, NEW, FAILED, ERROR, EDITED

interface DangerousProductCardProps {
  data: CardData
  onUpdate: (data: CardData) => void
  originalXML?: string | null
  dpaid?: string
  /** GUID из URL — для получения JSON прав (department.depid при «Определить доступ») */
  guid?: string
  /** После успешного сохранения новой карты (dpaid === '-') вызывается с новым DPAID для редиректа */
  onSaveNewCard?: (newDpaid: number) => void
  /** После успешного удаления карты (закрыть форму и показать сообщение) */
  onCardDeleted?: () => void
  /** При создании новой версии (Сделать копию) — исходный DPAID для сохранения */
  copyFromDpaid?: number
  /** Открыть форму новой версии (после «Сделать копию») — навигация с state */
  onMakeCopy?: (initialCardData: CardData, sourceDpaid: number) => void
  /** Автоматически выполнить сценарий кнопки «Сделать копию» (для URL ?command=copy). */
  autoRunCopyFromUrl?: boolean
}

const DangerousProductCard: React.FC<DangerousProductCardProps> = ({
  data,
  onUpdate,
  originalXML: propOriginalXML,
  dpaid,
  guid,
  onSaveNewCard,
  onCardDeleted,
  copyFromDpaid,
  onMakeCopy,
  autoRunCopyFromUrl,
}) => {
  // Отладочный вывод
  console.log('DangerousProductCard получил данные:', data)
  
  const [statusHistoryVisible, setStatusHistoryVisible] = useState(false)
  const [statusHistoryModalData, setStatusHistoryModalData] = useState<StatusHistoryItem[]>([])
  const [statusHistoryLoading, setStatusHistoryLoading] = useState(false)
  const [electronicDocumentVisible, setElectronicDocumentVisible] = useState(false)
  const [electronicDocList, setElectronicDocList] = useState<ElectronicDocument[]>([])
  const [electronicDocLoading, setElectronicDocLoading] = useState(false)
  const [accessModalVisible, setAccessModalVisible] = useState(false)
  const [isEditMode, setIsEditMode] = useState(() => dpaid === '-')
  const [cancelReloading, setCancelReloading] = useState(false)
  const [editedData, setEditedData] = useState<CardData>(data)
  const [originalXML, setOriginalXML] = useState<string | null>(propOriginalXML || null)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResultShape | null>(null)
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false)
  const [validationModalVisible, setValidationModalVisible] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingSavePayload, setPendingSavePayload] = useState<{ xmlBody: string; metadata: DpaSaveMetadata } | null>(null)
  /** Ошибки формата полей (XSD) перед сохранением; блокируют кнопку «Сохранить в БД». */
  const [formatValidationErrors, setFormatValidationErrors] = useState<string[]>([])
  /** Логические проверки карты (в т.ч. «Вид» уведомления) перед сохранением в БД. */
  /** Только сценарий «новая версия по копии»: блок «Сохранить в БД» по пустому/неверному «Вид». */
  const [comparisonLogicalValidationErrors, setComparisonLogicalValidationErrors] = useState<string[]>([])
  const [hasStatusRight, setHasStatusRight] = useState(false)
  const [hasSendRight, setHasSendRight] = useState(false)
  const [hasSaveRight, setHasSaveRight] = useState(false)
  const [hasResolution, setHasResolution] = useState(false)
  const [currentUserDepKindCode, setCurrentUserDepKindCode] = useState<string | null>(null)
  const [currentUserDepKindName, setCurrentUserDepKindName] = useState<string | null>(null)
  /** Уровень ЦГЭ по depid из карты прав (когда текущий пользователь не загружен) — для подсказки в черновике */
  const [rightsDepKindCode, setRightsDepKindCode] = useState<string | null>(null)
  const [rightsDepKindName, setRightsDepKindName] = useState<string | null>(null)
  /** DEPID из прав (create / publicHealthOut.edit / violations / ВСМ и т.д.) → на сервере в AUTHORITYID; только эти УО в выборе при черновике исходящей */
  const [createAuthorityIds, setCreateAuthorityIds] = useState<string[] | null>(null)
  const [dpaResolutionDepKindCodes, setDpaResolutionDepKindCodes] = useState<string[]>([])
  /** После успешного создания — dpaid сохранённой карты; до редиректа все сохранения идут как update по нему */
  const [savedDpaid, setSavedDpaid] = useState<number | null>(null)
  /** Отладка: просмотр карты прав по GUID */
  const [rightsDebugVisible, setRightsDebugVisible] = useState(false)
  const [rightsDebugData, setRightsDebugData] = useState<RightsJson | null>(null)
  const [rightsDebugLoading, setRightsDebugLoading] = useState(false)
  const [rightsDebugError, setRightsDebugError] = useState<string | null>(null)
  const [rightsDebugRawText, setRightsDebugRawText] = useState<string | null>(null)
  const [rightsDebugDraft, setRightsDebugDraft] = useState('')
  const [rightsOverride, setRightsOverride] = useState<RightsJson | null>(null)
  const copyCommandHandledRef = useRef(false)
  /** Предпроверка GET /api/dpa/can-create-new-version — чтобы кнопка «Сделать копию» была неактивна с подсказкой. */
  const [copyCanCreateLoading, setCopyCanCreateLoading] = useState(false)
  const [copyCanCreateAllowed, setCopyCanCreateAllowed] = useState<boolean | null>(null)
  const [copyCanCreateReason, setCopyCanCreateReason] = useState<string | null>(null)
  /** GET /api/dpr/create-eligibility — кнопка «Подготовить ответ» на входящей PPV */
  const [dprPrepareAnswer, setDprPrepareAnswer] = useState<{ allowed: boolean; reason?: string } | null>(null)
  const { countryOptions } = useCountryOptions()
  useParentActivityPing()

  const effectiveDpaid = (dpaid !== '-' && dpaid) ? dpaid : (savedDpaid != null ? String(savedDpaid) : '-')
  const hasPersistedDpaid = !!effectiveDpaid && /^\d+$/.test(effectiveDpaid) && Number(effectiveDpaid) > 0
  // Новая карта (/-/) всегда исходящая; иначе — по DPA DATASOURCEKINDCODE ("2") или по названию источника (код 3 — из БД ЕЭК)
  const datasourceKindCode = data?.datasourceKindCode != null ? String(data.datasourceKindCode) : ''
  const sourceFromData = data?.source ?? ''
  const isOutgoingSource =
    effectiveDpaid === '-' ||
    datasourceKindCode === '2' ||
    sourceFromData.toLowerCase().includes('исходящ') ||
    sourceFromData === '2'
  const overrideDepid = rightsOverride?.department?.depid != null ? String(rightsOverride.department.depid) : null
  const overrideHasByMap = (map: Record<string, unknown> | undefined | null): boolean =>
    !!(overrideDepid && map && typeof map === 'object' && Object.prototype.hasOwnProperty.call(map, overrideDepid))
  const upOutBlock = isPpvApp() ? rightsOverride?.up?.violationDetectedOut : rightsOverride?.up?.dangerousProductOut
  const upInBlock = isPpvApp() ? rightsOverride?.up?.violationDetectedIn : rightsOverride?.up?.dangerousProductIn
  const effectiveHasStatusRight = rightsOverride
    ? (isOutgoingSource ? overrideHasByMap(upOutBlock?.status) : overrideHasByMap(upInBlock?.status))
    : hasStatusRight
  const effectiveHasSendRight = rightsOverride ? overrideHasByMap(upOutBlock?.send) : hasSendRight
  const effectiveHasSaveRight = rightsOverride ? overrideHasByMap(upOutBlock?.edit) : hasSaveRight

  const currentStatusId = editedData.statusId ?? data.statusId ?? undefined
  const canEditByStatus =
    !isOutgoingSource || currentStatusId === undefined || EDITABLE_OUTGOING_STATUS_IDS.includes(currentStatusId)

  const datasourceKindForEditPolicy =
    editedData.datasourceKindCode != null ? String(editedData.datasourceKindCode) : datasourceKindCode
  const sourceForEditPolicy = (editedData.source ?? sourceFromData) || ''
  const srcLowerForEdit = sourceForEditPolicy.toLowerCase()
  const isIncomingNoEdit =
    datasourceKindForEditPolicy === '1' ||
    datasourceKindForEditPolicy === '3' ||
    (srcLowerForEdit.includes('входящ') &&
      datasourceKindForEditPolicy !== '2' &&
      datasourceKindForEditPolicy !== '3') ||
    (srcLowerForEdit.includes('еэк') &&
      datasourceKindForEditPolicy !== '1' &&
      datasourceKindForEditPolicy !== '2')

  /** depIds для фильтра УО: при отладочном override — из JSON; иначе из GET /api/rights (не сбрасываем при сбое fetchDepInfo). */
  const outgoingAuthorityFilterDepIds = useMemo(() => {
    const fromOverride = rightsOverride ? getOutgoingAuthorityFilterDepIdsFromRights(rightsOverride, isPpvApp()) : []
    if (fromOverride.length > 0) return fromOverride
    return createAuthorityIds
  }, [rightsOverride, createAuthorityIds])

  useEffect(() => {
    if (dpaid !== '-') setSavedDpaid(null)
  }, [dpaid])

  useEffect(() => {
    if (!isPpvApp() || !hasPersistedDpaid || !guid?.trim()) {
      setDprPrepareAnswer(null)
      return
    }
    const dsc =
      editedData.datasourceKindCode != null ? String(editedData.datasourceKindCode) : datasourceKindCode
    if (dsc !== '1') {
      setDprPrepareAnswer(null)
      return
    }
    let cancelled = false
    fetchDprCreateEligibility(effectiveDpaid, guid.trim())
      .then((r) => {
        if (!cancelled) setDprPrepareAnswer({ allowed: r.allowed, reason: r.reason })
      })
      .catch(() => {
        if (!cancelled) setDprPrepareAnswer({ allowed: false })
      })
    return () => {
      cancelled = true
    }
  }, [
    hasPersistedDpaid,
    effectiveDpaid,
    guid,
    datasourceKindCode,
    editedData.datasourceKindCode,
    editedData.statusId,
    data?.statusId,
  ])

  // Права и уровень пользователя / резолюции по карте (исходящие)
  // Важно: для новой исходящей карты (dpaid '-') hasPersistedDpaid = false, но JSON прав и depIds для УО всё равно нужны — иначе список УО остаётся пустым.
  useEffect(() => {
    if (!isOutgoingSource) {
      const src = (data?.source ?? '').toLowerCase()
      if (src.includes('входящ')) {
        // Права по JSON привязаны к пользователю (guid), не к карте
        checkAccessRight(guid ?? null, isPpvApp() ? 'violationDetectedIn:status' : 'dangerousProductIn:status')
          .then(setHasStatusRight)
          .catch(() => setHasStatusRight(false))
      }
      return
    }
    if (isOutgoingSource) {
      // Права по JSON привязаны к пользователю (guid); без guid или без ключа в JSON — кнопки блокируются
      Promise.all([
        checkAccessRight(guid ?? null, isPpvApp() ? 'violationDetectedOut:status' : 'dangerousProductOut:status'),
        checkAccessRight(guid ?? null, isPpvApp() ? 'violationDetectedOut:send' : 'dangerousProductOut:send'),
        checkAccessRight(guid ?? null, isPpvApp() ? 'violationDetectedOut:edit' : 'dangerousProductOut:edit'),
      ])
        .then(([status, send, edit]) => {
          setHasStatusRight(status)
          setHasSendRight(send)
          setHasSaveRight(edit)
        })
        .catch(() => {
          setHasStatusRight(false)
          setHasSendRight(false)
          setHasSaveRight(false)
        })
      fetchCurrentUser(guid).then((u) => {
        setCurrentUserDepKindCode(u.depKindCode ?? null)
        setCurrentUserDepKindName(u.depKindName ?? null)
      })
      if (guid) {
        fetchRightsByGuid(guid)
          .then(async (r) => {
            setCreateAuthorityIds(getOutgoingAuthorityFilterDepIdsFromRights(r, isPpvApp()))

            const depid = r.department?.depid != null ? String(r.department.depid) : null
            const hasRightInMap = (map: Record<string, unknown> | undefined | null): boolean => {
              if (!depid || !map || typeof map !== 'object') return false
              return Object.prototype.hasOwnProperty.call(map, depid)
            }

            // Уточняем права по исходящим сведениям на основе JSON прав
            const upOut = isPpvApp() ? r.up?.violationDetectedOut : r.up?.dangerousProductOut
            const hasStatusByGuid = hasRightInMap(upOut?.status)
            const hasSendByGuid = hasRightInMap(upOut?.send)
            const hasEditByGuid = hasRightInMap(upOut?.edit)

            // Для UI‑кнопок требуем И право с сервера, И наличие соответствующего ключа в JSON прав
            if (hasStatusByGuid === false) {
              setHasStatusRight((prev) => prev && false)
            }
            if (hasSendByGuid === false) {
              setHasSendRight((prev) => prev && false)
            }
            if (hasEditByGuid === false) {
              setHasSaveRight((prev) => prev && false)
            }

            try {
              const level =
                r.department?.depid != null
                  ? await fetchDepInfo(r.department.depid, guid)
                  : { depKindCode: null, depKindName: null }
              setRightsDepKindCode(level.depKindCode ?? null)
              setRightsDepKindName(level.depKindName ?? null)
            } catch {
              setRightsDepKindCode(null)
              setRightsDepKindName(null)
            }
          })
          .catch(() => {
            setCreateAuthorityIds(null)
            setRightsDepKindCode(null)
            setRightsDepKindName(null)
          })
      } else {
        setRightsDepKindCode(null)
        setRightsDepKindName(null)
        setCreateAuthorityIds(null)
      }
      if (hasPersistedDpaid) {
        fetchDpaResolutions(effectiveDpaid, guid).then((list) => {
          setDpaResolutionDepKindCodes(list.map((r) => r.depKindCode))
          setHasResolution(list.length > 0)
        })
      } else {
        setDpaResolutionDepKindCodes([])
        setHasResolution(false)
      }
    }
  }, [hasPersistedDpaid, effectiveDpaid, isOutgoingSource, data?.source, guid])

  const editSwitchDisabled = isIncomingNoEdit || (isOutgoingSource && !canEditByStatus)
  /** Исходящие: право violationDetectedOut:edit (PPV) / dangerousProductOut:edit (DPA); черновик (-) — форма доступна до проверки прав. */
  const showEditButton =
    !editSwitchDisabled &&
    (!isOutgoingSource || effectiveHasSaveRight || effectiveDpaid === '-')

  useEffect(() => {
    if (isIncomingNoEdit) setIsEditMode(false)
  }, [isIncomingNoEdit])

  // Новая карта (/-/) всегда исходящая — подставляем код "2", т.к. метаданные ещё могут быть не заполнены
  const effectiveDatasourceKindCode =
    editedData.datasourceKindCode ?? data.datasourceKindCode ?? (effectiveDpaid === '-' ? '2' : undefined)
  const statusButtonResult = getStatusButtonConfig(
    editedData.source,
    editedData.status,
    effectiveHasStatusRight,
    effectiveHasSendRight,
    hasResolution,
    currentUserDepKindCode ?? rightsDepKindCode,
    dpaResolutionDepKindCodes,
    editedData.statusId ?? undefined,
    effectiveDatasourceKindCode,
    currentUserDepKindName ?? rightsDepKindName,
    editedData.notification?.endDate ?? data.notification?.endDate ?? null,
    isPpvApp()
  )
  const statusButton = statusButtonResult.config
  const statusButtonComment = statusButtonResult.comment
  const closeConfig = statusButtonResult.closeConfig ?? null
  // Несохранённая карта: кнопка смены статуса заблокирована с подсказкой «Сохраните изменения»
  const effectiveStatusButton =
    effectiveDpaid === '-' && statusButton
      ? { ...statusButton, disabled: true, hint: 'Сохраните изменения' }
      : statusButton
  const effectiveStatusButtonComment =
    effectiveDpaid === '-' && statusButton ? 'Сохраните изменения' : statusButtonComment
  const CLOSE_BUTTON_DISABLED_HINT = isPpvApp()
    ? 'Закрытие карты для исходящих: при «Новое» — если есть резолюция областного или республиканского ЦГЭ; иначе — в статусах «Обработано», ожидание ответов, частично или полностью выполнено.'
    : 'Закрытие карты доступно при статусе «Новое», «Отправка не удалась», «Ошибка обработки» или «Доставлено».'
  const primaryIsClose = (effectiveStatusButton?.action ?? '') === 'close'
  const effectiveCloseButton =
    effectiveDpaid === '-' && closeConfig
      ? { ...closeConfig, disabled: true, hint: 'Сохраните изменения' }
      : closeConfig ??
        (isOutgoingSource && !primaryIsClose
          ? { label: 'Закрытие карты', action: 'close' as const, disabled: true, hint: CLOSE_BUTTON_DISABLED_HINT }
          : null)

  // Кнопка «Удалить»: для черновика исходящей карты всегда отображается;
  // при отсутствии права/ guid — disabled с подсказкой причины.
  const isDraftStatus =
    (editedData.statusId ?? data.statusId) === 5 ||
    /черновик/i.test(editedData.status ?? data.status ?? '')
  const showDeleteButton =
    isOutgoingSource &&
    isDraftStatus &&
    effectiveDpaid !== '-' &&
    effectiveDpaid != null
  const canDeleteCard = effectiveHasSaveRight && !!guid
  const deleteButtonHint = !effectiveHasSaveRight
    ? isPpvApp()
      ? 'Недостаточно прав: требуется violationDetectedOut:edit.'
      : 'Недостаточно прав: требуется dangerousProductOut:edit.'
    : !guid
      ? 'GUID не задан: не удалось определить права доступа.'
      : undefined

  const copyButtonEligible = useMemo(
    () =>
      isOutgoingSource &&
      effectiveHasSaveRight &&
      effectiveDpaid !== '-' &&
      effectiveDpaid != null &&
      !!guid &&
      !!onMakeCopy &&
      (editedData.statusId ?? data.statusId) === 11,
    [
      isOutgoingSource,
      effectiveHasSaveRight,
      effectiveDpaid,
      guid,
      onMakeCopy,
      editedData.statusId,
      data.statusId,
    ]
  )

  useEffect(() => {
    if (!copyButtonEligible || !effectiveDpaid || !guid) {
      setCopyCanCreateLoading(false)
      setCopyCanCreateAllowed(null)
      setCopyCanCreateReason(null)
      return
    }
    let cancelled = false
    setCopyCanCreateLoading(true)
    setCopyCanCreateAllowed(null)
    setCopyCanCreateReason(null)
    canCreateNewVersion(String(effectiveDpaid), guid)
      .then((res) => {
        if (cancelled) return
        setCopyCanCreateAllowed(res.allowed)
        setCopyCanCreateReason(res.reason ?? null)
      })
      .catch(() => {
        if (!cancelled) {
          setCopyCanCreateAllowed(false)
          setCopyCanCreateReason('Не удалось проверить условия создания новой версии')
        }
      })
      .finally(() => {
        if (!cancelled) setCopyCanCreateLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [copyButtonEligible, effectiveDpaid, guid])

  const copyButtonDisabled =
    copyButtonEligible && (copyCanCreateLoading || copyCanCreateAllowed !== true)
  const copyButtonHint = !copyButtonEligible
    ? undefined
    : copyCanCreateLoading
      ? 'Проверка условий создания новой версии…'
      : copyCanCreateAllowed === false
        ? copyCanCreateReason ?? 'Создание новой версии недоступно'
        : undefined

  const handleDelete = () => {
    const regNumber =
      editedData.notification?.registrationNumber ??
      editedData.registrationNumber ??
      data.notification?.registrationNumber ??
      data.registrationNumber ??
      effectiveDpaid ??
      ''
    Modal.confirm({
      title: 'Подтверждение удаления',
      content: `Карта ${regNumber} будет удалена безвозвратно. Продолжить?`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await deleteDpaCard(Number(effectiveDpaid), guid!)
          if (isPpvApp()) {
            message.open({
              type: 'success',
              content: 'Черновик карты успешно удален',
              duration: 3,
              style: { marginTop: '38vh' },
            })
            postMessageFromCardToParent(
              { code: 'exit', ppvDraftDeleted: true, registryTab: 'outgoing' },
              'PPV: выход после удаления черновика на реестр «Исходящие»'
            )
          } else {
            message.success('Карта удалена')
            postMessageFromCardToParent({ code: 'exit' }, 'DPA: выход после удаления карты')
          }
          onCardDeleted?.()
        } catch (e) {
          const reason = e instanceof Error ? e.message : String(e)
          if (isPpvApp()) {
            Modal.error({
              title: 'Ошибка',
              content: `Не удалось выполнить удаление черновика. Причина: ${reason}`,
              okText: 'Ок',
            })
          } else {
            message.error(reason || 'Ошибка удаления')
          }
        }
      },
    })
  }

  const handleCopy = async () => {
    if (!effectiveDpaid || !guid || !onMakeCopy) return
    if (copyButtonDisabled) return
    try {
      const res = await canCreateNewVersion(String(effectiveDpaid), guid)
      if (!res.allowed) {
        message.error(res.reason ?? 'Создание новой версии недоступно')
        return
      }
      const today = format(new Date(), 'yyyy-MM-dd')
      const initialCardData: CardData = {
        ...currentData,
        version: (currentData.version ?? 1) + 1,
        status: 'Черновик',
        statusId: 5,
        notification: {
          ...currentData.notification!,
          formationDate: today,
          type: '',
        },
      }
      onMakeCopy(initialCardData, Number(effectiveDpaid))
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Ошибка проверки возможности создания копии')
    }
  }

  useEffect(() => {
    if (!autoRunCopyFromUrl) return
    if (copyCommandHandledRef.current) return
    copyCommandHandledRef.current = true
    void handleCopy()
  }, [autoRunCopyFromUrl, handleCopy])
  
  // Синхронизируем originalXML только при изменении пропса от родителя.
  // Локальное обновление после успешного save (setOriginalXML(xmlJustSaved))
  // не должно откатываться назад старым propOriginalXML.
  useEffect(() => {
    if (propOriginalXML) {
      setOriginalXML(propOriginalXML)
    }
  }, [propOriginalXML])
  
  // Обновляем editedData при изменении data только если это новый документ
  // (определяем по registrationNumber или version), чтобы не перезаписывать изменения пользователя
  useEffect(() => {
    // Если это новый документ (другой registrationNumber или version), обновляем editedData
    if (data.registrationNumber !== editedData.registrationNumber || 
        data.version !== editedData.version) {
      setEditedData(data)
    }
  }, [data.registrationNumber, data.version])
  
  // Проверка наличия данных
  if (!data) {
    return <div>Нет данных для отображения</div>
  }

  // Используем editedData для отображения, чтобы изменения были видны даже в режиме просмотра
  // Это позволяет пользователю видеть изменения без необходимости сохранять их
  const currentData = editedData

  // Создаем tabItems с использованием currentData, чтобы изменения были видны в режиме просмотра
  // Используем useMemo, чтобы пересоздавать tabItems при изменении currentData
  const tabItems = useMemo(() => {
    const base = [
      {
        key: 'notification',
        label: 'Уведомление',
        children: <NotificationTab data={currentData.notification} />,
      },
      {
        key: 'product',
        label: 'Продукция',
        children: currentData.product ? (
          <ProductTab data={currentData.product} />
        ) : (
          <div>Данные о продукции не найдены</div>
        ),
      },
      {
        key: 'tsd',
        label: 'ТСД',
        children: currentData.tsd ? (
          <TSDTab data={currentData.tsd} />
        ) : (
          <div>Данные о партиях продукции не найдены</div>
        ),
      },
      {
        key: 'compliance',
        label: 'Документы соответствия',
        children: <ComplianceDocumentsTab tsd={currentData.tsd} hasEditPermission={true} guid={guid} />,
      },
      {
        key: 'violations',
        label: 'Нарушения',
        children: <ViolationsTab tsd={currentData.tsd} />,
      },
      {
        key: 'detectionPlace',
        label: 'Место обнаружения',
        children: currentData.detectionPlace ? (
          <DetectionPlaceTab data={currentData.detectionPlace} />
        ) : (
          <div>Данные о месте обнаружения не найдены</div>
        ),
      },
    ]

    if (isPpvApp()) {
      return [
        ...base,
        {
          key: 'addressees',
          label: 'Адресаты',
          children: (
            <PpvAddresseesTab ppvid={effectiveDpaid} guid={guid} hasPersisted={hasPersistedDpaid} />
          ),
        },
      ]
    }

    return [
      ...base,
      {
        key: 'measures',
        label: 'Принятые меры',
        children: currentData.measures ? (
          <MeasuresTab data={currentData.measures} />
        ) : (
          <div>Данные о принятых мерах не найдены</div>
        ),
      },
    ]
  }, [currentData, effectiveDpaid, guid, hasPersistedDpaid])

  const handleCancelEdit = async () => {
    if (!hasPersistedDpaid || !effectiveDpaid || effectiveDpaid === '-') return
    setCancelReloading(true)
    try {
      const { card, xmlText } = await loadDpaCardFromDb(effectiveDpaid, guid)
      onUpdate(card)
      setEditedData(card)
      setOriginalXML(xmlText)
      setIsEditMode(false)
      setPendingSavePayload(null)
      setComparisonModalVisible(false)
      setFormatValidationErrors([])
      setComparisonLogicalValidationErrors([])
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Не удалось загрузить данные карты из БД')
    } finally {
      setCancelReloading(false)
    }
  }

  const handleSave = () => {
    if (copyFromDpaid != null) {
      const v = editedData.version ?? 1
      const kind = editedData.notification?.type?.trim() ?? ''
      const kindErrors: string[] = []
      if (!kind) {
        kindErrors.push('Уведомление: Вид уведомления должен быть указан')
      } else if (isPpvApp()) {
        if (v === 1 && kind !== '19') {
          kindErrors.push('Уведомление: Неверно указан вид уведомления')
        } else if (v !== 1 && kind !== '8' && kind !== '9') {
          kindErrors.push('Уведомление: Неверно указан вид уведомления')
        }
      } else if (v === 1 && kind !== '7') {
        kindErrors.push('Уведомление: Неверно указан вид уведомления')
      } else if (v !== 1 && kind !== '8' && kind !== '9') {
        kindErrors.push('Уведомление: Неверно указан вид уведомления')
      }
      setComparisonLogicalValidationErrors(kindErrors)
    } else {
      setComparisonLogicalValidationErrors([])
    }

    const xmlBody = exportCardDataToXML(editedData)
    const metadata = buildSaveMetadataFromCardData(editedData)
    const isNewCard = effectiveDpaid === '-'
    const isOutgoingWithSave = isOutgoingSource && effectiveHasSaveRight

    const formatErrors = collectFormatValidationErrors(editedData).errors
    setFormatValidationErrors(formatErrors)

    if (isNewCard) {
      const { filled, unfilled } = getCardDataReview(editedData)
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

    // Существующая карта: сравнение только с оригиналом этой вкладки (без localStorage — разные вкладки = разные документы)
    if (isOutgoingWithSave) {
      setPendingSavePayload({ xmlBody, metadata })
      // Режим редактирования не выключаем — только после успешного «Сохранить в БД» в handleSaveToDbFromModal
    } else {
      setPendingSavePayload(null)
      onUpdate(editedData)
      setIsEditMode(false)
    }
    const xmlToCompare = originalXML
    if (xmlToCompare) {
      try {
        const originalData = parseXMLToCardData(xmlToCompare)
        // Адресаты PPV не входят в XML: в «исходную» сторону сравнения подставляем коды, загруженные с БД (props data).
        const originalForCompare: CardData = {
          ...originalData,
          ppvActorCountryCodes: normalizePpvActorCountryCodesList(data.ppvActorCountryCodes),
          ppvActorRemovalIds: normalizePpvActorRemovalIds(data.ppvActorRemovalIds),
        }
        // Сравниваем с текущим состоянием формы (editedData), а не с повторно распарсенным XML,
        // чтобы корректно учитывать несколько нарушений в партии и не получать ложные различия
        const result = compareCardData(originalForCompare, editedData)
        const emptyTagsWarnings = getEmptyTagsWarnings(editedData)
        const resultWithWarnings = emptyTagsWarnings.length > 0
          ? { ...result, warnings: [...(result.warnings ?? []), ...emptyTagsWarnings] }
          : result
        setComparisonResult(resultWithWarnings)
        setComparisonModalVisible(true)
      } catch {
        const emptyTagsWarnings = getEmptyTagsWarnings(editedData)
        setComparisonResult({
          isIdentical: true,
          differences: [],
          warnings: emptyTagsWarnings,
          added: [],
        })
        setComparisonModalVisible(true)
      }
    }
  }

  const handleSaveToDbFromModal = async () => {
    if (!pendingSavePayload) return
    if (copyFromDpaid != null) {
      const v = editedData.version ?? 1
      const kind = editedData.notification?.type?.trim() ?? ''
      const kindErrors: string[] = []
      if (!kind) {
        kindErrors.push('Уведомление: Вид уведомления должен быть указан')
      } else if (isPpvApp()) {
        if (v === 1 && kind !== '19') {
          kindErrors.push('Уведомление: Неверно указан вид уведомления')
        } else if (v !== 1 && kind !== '8' && kind !== '9') {
          kindErrors.push('Уведомление: Неверно указан вид уведомления')
        }
      } else if (v === 1 && kind !== '7') {
        kindErrors.push('Уведомление: Неверно указан вид уведомления')
      } else if (v !== 1 && kind !== '8' && kind !== '9') {
        kindErrors.push('Уведомление: Неверно указан вид уведомления')
      }
      if (kindErrors.length > 0) {
        setComparisonLogicalValidationErrors(kindErrors)
        message.error('Сохранение в БД невозможно: укажите корректный вид уведомления для новой версии карты.')
        return
      }
    }
    const xmlJustSaved = pendingSavePayload.xmlBody
    setSaving(true)
    const isNewCard = effectiveDpaid === '-'
    try {
      const res = await saveDpaCard({
        isNew: isNewCard,
        xmlBody: pendingSavePayload.xmlBody,
        metadata: pendingSavePayload.metadata,
        ...(isNewCard ? {} : { dpaid: Number(effectiveDpaid) }),
        ...(isNewCard && copyFromDpaid != null && guid ? { copyFromDpaid, guid } : {}),
        ...(guid ? { guid } : {}),
      })
      setPendingSavePayload(null)
      setComparisonModalVisible(false)
      onUpdate({ ...editedData, ppvActorCountryCodes: [], ppvActorRemovalIds: [] })
      setEditedData((prev) => ({ ...prev, ppvActorCountryCodes: [], ppvActorRemovalIds: [] }))
      setIsEditMode(false)
      setOriginalXML(xmlJustSaved)
      if (isNewCard) {
        setSavedDpaid(res.dpaid)
        try {
          const { lastSavedIdKey, saveHappenedKey } = getDpaLikeCardSessionKeys()
          sessionStorage.setItem(lastSavedIdKey, String(res.dpaid))
          sessionStorage.setItem(saveHappenedKey, '1')
        } catch (_) {}
        message.success(`Карта сохранена в БД с ${getDpaLikeCardIdLabel()} ${res.dpaid}`)
        onSaveNewCard?.(res.dpaid)
      } else {
        message.success('Карта обновлена в БД')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ошибка сохранения в БД'
      console.error('[DangerousProductCard] Save failed:', err)
      message.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // Создаем редактируемые версии вкладок
  const tabItemsWithEdit = tabItems.map(item => {
    let editChildren = item.children
    
    if (isEditMode) {
      switch (item.key) {
        case 'product':
          if (currentData.product) {
            editChildren = (
              <ProductTabEdit
                data={currentData.product}
                onChange={(product) => setEditedData((prev) => ({ ...prev, product }))}
              />
            )
          } else {
            editChildren = (
              <div>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditedData({
                      ...editedData,
                      product: {
                        typeName: '',
                        typeCode: '',
                        productDetails: {
                          productId: '',
                        },
                        manufacturer: { country: '' },
                      },
                    })
                  }}
                >
                  Добавить данные о продукции
                </Button>
              </div>
            )
          }
          break
        case 'violations':
          if (currentData.tsd?.batches?.length) {
            editChildren = (
              <ViolationsTabEdit
                tsd={currentData.tsd}
                onTsdChange={(tsd) => setEditedData((prev) => ({ ...prev, tsd }))}
              />
            )
          } else {
            editChildren = (
              <div>
                <span style={{ marginRight: 8 }}>Добавьте партию во вкладке «ТСД», затем укажите нарушения в составе партии.</span>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setEditedData((prev) => ({ ...prev, tsd: { batches: [{ shippingDocuments: [] }] } }))}
                >
                  Добавить партию
                </Button>
              </div>
            )
          }
          break
        case 'notification':
          editChildren = (
            <NotificationTabEdit
              data={currentData.notification}
              onChange={(notification) => setEditedData((prev) => ({ ...prev, notification }))}
              isNewCard={effectiveDpaid === '-'}
              enforceIncidentKindForCopy={copyFromDpaid != null}
              version={currentData.version ?? 1}
              isDraft={effectiveDpaid === '-' || (currentStatusId === 5) || /черновик/i.test(editedData.status ?? data.status ?? '')}
              isOutgoing={isOutgoingSource}
              allowedAuthorityIds={isOutgoingSource && (effectiveDpaid === '-' || isDraftStatus) ? outgoingAuthorityFilterDepIds ?? undefined : undefined}
              ppvCard={isPpvApp()}
            />
          )
          break
        case 'tsd':
          if (currentData.tsd) {
            editChildren = (
              <TSDTabEdit
                data={currentData.tsd}
                onChange={(tsd) => setEditedData((prev) => ({ ...prev, tsd }))}
              />
            )
          } else {
            editChildren = (
              <div>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditedData({
                      ...editedData,
                      tsd: {
                        batches: [{
                          shippingDocuments: [],
                        }],
                      },
                    })
                  }}
                >
                  Добавить данные о партиях продукции
                </Button>
              </div>
            )
          }
          break
        case 'compliance':
          if (currentData.tsd?.batches?.length) {
            editChildren = (
              <ComplianceDocumentsTabEdit
                tsd={currentData.tsd}
                onTsdChange={(tsd) => setEditedData((prev) => ({ ...prev, tsd }))}
                guid={guid}
              />
            )
          } else {
            editChildren = (
              <div>
                <span style={{ marginRight: 8 }}>Добавьте партию во вкладке «ТСД», затем укажите документы соответствия в составе партии.</span>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setEditedData((prev) => ({ ...prev, tsd: { batches: [{ shippingDocuments: [] }] } }))}
                >
                  Добавить партию
                </Button>
              </div>
            )
          }
          break
        case 'detectionPlace':
          if (currentData.detectionPlace) {
            editChildren = (
              <DetectionPlaceTabEdit
                data={currentData.detectionPlace}
                onChange={(place) => setEditedData((prev) => ({ ...prev, detectionPlace: place }))}
              />
            )
          } else {
            editChildren = (
              <div>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditedData({
                      ...editedData,
                      detectionPlace: {
                        description: '',
                      },
                    })
                  }}
                >
                  Добавить место обнаружения
                </Button>
              </div>
            )
          }
          break
        case 'measures':
          if (currentData.measures) {
            editChildren = (
              <MeasuresTabEdit
                data={currentData.measures}
                onChange={(measures) => setEditedData((prev) => ({ ...prev, measures }))}
              />
            )
          } else {
            editChildren = (
              <div>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setEditedData({
                      ...editedData,
                      measures: {
                        measures: [],
                      },
                    })
                  }}
                >
                  Добавить принятые меры
                </Button>
              </div>
            )
          }
          break
        case 'addressees':
          editChildren = (
            <PpvAddresseesTabEdit
              pendingCountryCodes={editedData.ppvActorCountryCodes ?? []}
              removalIds={editedData.ppvActorRemovalIds ?? []}
              ppvid={effectiveDpaid}
              hasPersisted={hasPersistedDpaid}
              formationDate={editedData.notification?.formationDate}
              guid={guid}
              onChange={(codes) => setEditedData((prev) => ({ ...prev, ppvActorCountryCodes: codes }))}
              onRemovalIdsChange={(ids) => setEditedData((prev) => ({ ...prev, ppvActorRemovalIds: ids }))}
            />
          )
          break
        default:
          editChildren = (
            <div style={{ padding: '16px', border: '1px dashed #d9d9d9', borderRadius: '4px' }}>
              <div style={{ marginBottom: '16px', color: '#999' }}>
                Режим редактирования для вкладки "{item.label}" (в разработке)
              </div>
              {item.children}
            </div>
          )
      }
    }
    
    return {
      ...item,
      children: editChildren,
    }
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
            {isPpvApp() ? 'Карта сведений о выявленных нарушениях' : 'Карта сведений об обнаружении опасной продукции'}
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
                {isOutgoingSource && (
                  <Button
                    onClick={async () => {
                      const r = await validateOutgoingCardWithSchema(currentData)
                      setValidationResult(r)
                      setValidationModalVisible(true)
                    }}
                  >
                    Валидация карты
                  </Button>
                )}
                {isPpvApp() && dprPrepareAnswer?.allowed && (
                  <Button
                    type="primary"
                    onClick={() => {
                      const base =
                        (import.meta.env.VITE_DPR_CARD_BASE as string | undefined)?.replace(/\/$/, '') ||
                        '/dpr_card'
                      window.location.assign(
                        `${base}/create/${encodeURIComponent(effectiveDpaid)}/${encodeURIComponent(guid!.trim())}`
                      )
                    }}
                  >
                    Подготовить ответ
                  </Button>
                )}
                <Button
                  onClick={() => {
                    postMessageFromCardToParent(
                      { code: 'exit' },
                      effectiveDpaid === '-' ? 'DPA: отменить создание' : 'DPA: закрыть форму'
                    )
                  }}
                >
                  {effectiveDpaid === '-' ? 'Отменить создание' : 'Закрыть'}
                </Button>
              </>
            )}
            {isEditMode && (
              <>
                {(effectiveDpaid === '-' || (isOutgoingSource && effectiveHasSaveRight && canEditByStatus)) && (
                  <Button type="primary" onClick={handleSave} loading={saving}>
                    Сохранить
                  </Button>
                )}
                {isOutgoingSource && (
                  <Button
                    onClick={async () => {
                      const r = await validateOutgoingCardWithSchema(editedData)
                      setValidationResult(r)
                      setValidationModalVisible(true)
                    }}
                  >
                    Валидация карты
                  </Button>
                )}
                {hasPersistedDpaid && (
                  <Button onClick={() => void handleCancelEdit()} loading={cancelReloading} disabled={cancelReloading}>
                    Отменить
                  </Button>
                )}
                {effectiveDpaid === '-' && (
                  <Button
                    onClick={() => {
                      postMessageFromCardToParent({ code: 'exit' }, 'DPA: отменить создание (режим редактирования)')
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
            if (effectiveDpaid) {
              setStatusHistoryLoading(true)
              setStatusHistoryVisible(true)
              setStatusHistoryModalData([])
              fetchDpaStatusHistory(effectiveDpaid, guid)
                .then((items) => {
                  setStatusHistoryModalData(
                    items.map((i) => ({
                      status: i.status,
                      dateTime: i.dateTime ?? '',
                      employee: i.employee ?? null,
                    }))
                  )
                })
                .catch(() => setStatusHistoryModalData([]))
                .finally(() => setStatusHistoryLoading(false))
            } else {
              setStatusHistoryModalData(currentData.statusHistory ?? [])
              setStatusHistoryVisible(true)
            }
          }}
        />
        {!isEditMode && (
        <CardActions
          data={currentData}
          onDefineAccess={() => setAccessModalVisible(true)}
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
              setRightsDebugError('GUID не задан (выполните «Определить доступ»)')
              setRightsDebugLoading(false)
            }
          }}
          showDeleteButton={showDeleteButton}
          deleteButtonDisabled={!canDeleteCard}
          deleteButtonHint={deleteButtonHint}
          onDelete={handleDelete}
          showCopyButton={copyButtonEligible}
          onCopy={handleCopy}
          copyButtonDisabled={copyButtonDisabled}
          copyButtonHint={copyButtonHint}
          {...(!isPpvApp()
            ? {
                onOpenAllVersions: () => {
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
                  postMessageFromCardToParent(payload, 'DPA: открыть все версии')
                  if (isLegacyRegisterConfigured()) {
                    openLegacyRegisterAllVersions(currentData.country ?? '', currentData.registrationNumber ?? '')
                  }
                },
              }
            : {})}
          statusButton={effectiveStatusButton}
          statusButtonComment={effectiveStatusButtonComment}
          closeButton={effectiveCloseButton && !effectiveCloseButton.disabled ? effectiveCloseButton : null}
          onStatusAction={(action) => {
            if (!effectiveDpaid || effectiveDpaid === '-') {
              message.warning('Сначала сохраните карту перед сменой статуса')
              return
            }
            const depKindForAction = currentUserDepKindCode ?? rightsDepKindCode
            const opts: { depKindCode?: string; guid?: string } = {}
            if (action === 'mark_ready' && depKindForAction) opts.depKindCode = depKindForAction
            if (guid) opts.guid = guid

            if (action === 'send') {
              const dataToValidate = isEditMode ? editedData : currentData
              void (async () => {
                const validation = await validateOutgoingCardWithSchema(dataToValidate)
                if (!validation.success) {
                  setValidationResult(validation)
                  setValidationModalVisible(true)
                  message.error('Необходимо доработать карту исходящих сведений перед направлением.')
                  return
                }
              Modal.confirm({
                title: 'Направление сведений участникам ОП 57',
                content: 'Подтвердите выполнение операции отправки сведений данной карты участникам ОП 57.',
                okText: 'Направить сведения',
                cancelText: 'Отмена',
                onOk: async () => {
                  const hasSend = await checkAccessRight(
                    guid ?? null,
                    isPpvApp() ? 'violationDetectedOut:send' : 'dangerousProductOut:send'
                  )
                  if (!hasSend) {
                    message.error('Нет права на направление сведений об опасной продукции в пределах доступа к данной карте.')
                    return
                  }
                  changeDpaStatus(effectiveDpaid, 'send', Object.keys(opts).length ? opts : undefined)
                    .then((res) => {
                      const newStatus = res.newStatus ?? currentData.status
                      const newStatusId = newStatus === 'Новое' ? 6 : newStatus === 'Ожидает отправки' ? 7 : newStatus === 'Завершено' ? 13 : (editedData.statusId ?? data.statusId)
                      onUpdate({ ...currentData, status: newStatus, statusId: newStatusId })
                      setEditedData((prev) => ({ ...prev, status: newStatus, statusId: newStatusId }))
                      message.success('Статус обновлён: карта переведена в состояние «Ожидает отправки».')
                    })
                    .catch((e) => message.error(e instanceof Error ? e.message : 'Ошибка смены статуса'))
                },
              })
              })()
              return
            }

            if (action === 'to_new') {
              const regNumber = currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectiveDpaid ?? ''
              Modal.confirm({
                title: 'Возврат в статус «Новое»',
                content: `Внимание! Карта ${regNumber} будет возвращена в статус „Новое". Вы сможете снова отредактировать её и отправить повторно. Отменить это действие нельзя. Продолжить?`,
                okText: 'Продолжить',
                cancelText: 'Отмена',
                onOk: () =>
                  changeDpaStatus(effectiveDpaid, 'to_new', Object.keys(opts).length ? opts : undefined)
                    .then((res) => {
                      const newStatus = res.newStatus ?? currentData.status
                      const newStatusId = newStatus === 'Новое' ? 6 : (editedData.statusId ?? data.statusId)
                      onUpdate({ ...currentData, status: newStatus, statusId: newStatusId })
                      setEditedData((prev) => ({ ...prev, status: newStatus, statusId: newStatusId }))
                      message.success('Карта переведена в статус «Новое».')
                    })
                    .catch((e) => {
                      message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
                      return Promise.reject(e)
                    }),
              })
              return
            }

            if (action === 'mark_ready') {
              const regNumber = currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectiveDpaid ?? ''
              const levelName = currentUserDepKindName ?? rightsDepKindName ?? (() => {
                const c = (depKindForAction ?? '').trim().toLowerCase()
                if (c === 'dep0601') return 'районный ЦГЭ'
                if (c === 'dep0602') return 'областной ЦГЭ'
                if (c === 'dep0603') return 'республиканский ЦГЭ'
                return 'подразделения пользователя'
              })()
              Modal.confirm({
                title: 'Отметка о готовности',
                content: `Внимание! После подтверждения по карте ${regNumber} будет зафиксирована отметка о готовности на уровне ${levelName}. Отменить данное действие будет невозможно. Продолжить?`,
                okText: 'Продолжить',
                cancelText: 'Отмена',
                onOk: () => {
                  changeDpaStatus(effectiveDpaid, action, Object.keys(opts).length ? opts : undefined)
                    .then((res) => {
                      const newStatus = res.newStatus ?? currentData.status
                      const newStatusId = newStatus === 'Новое' ? 6 : newStatus === 'Ожидает отправки' ? 7 : newStatus === 'Завершено' ? 13 : (editedData.statusId ?? data.statusId)
                      onUpdate({ ...currentData, status: newStatus, statusId: newStatusId })
                      setEditedData((prev) => ({ ...prev, status: newStatus, statusId: newStatusId }))
                      message.success('Статус обновлён')
                      fetchDpaResolutions(effectiveDpaid, guid).then((list) => setDpaResolutionDepKindCodes(list.map((r) => r.depKindCode)))
                    })
                    .catch((e) => message.error(e instanceof Error ? e.message : 'Ошибка смены статуса'))
                },
              })
              return
            }

            if (action === 'complete_processing') {
              const regNumber =
                currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectiveDpaid ?? ''
              const runCompleteProcessing = async () => {
                const hasRight = await checkAccessRight(
                  guid ?? null,
                  isPpvApp() ? 'violationDetectedIn:status' : 'dangerousProductIn:status'
                )
                if (!hasRight) {
                  message.error('Нет права на управление статусом входящих сведений.')
                  return
                }
                try {
                  const res = await changeDpaStatus(
                    effectiveDpaid,
                    'complete_processing',
                    Object.keys(opts || {}).length ? opts : undefined
                  )
                  const newStatus = res.newStatus ?? currentData.status
                  const newStatusId = isPpvApp()
                    ? (res.newStatusId ?? (editedData.statusId ?? data.statusId))
                    : newStatus === 'Обработано'
                      ? 3
                      : (editedData.statusId ?? data.statusId)
                  onUpdate({ ...currentData, status: newStatus, statusId: newStatusId })
                  setEditedData((prev) => ({ ...prev, status: newStatus, statusId: newStatusId }))
                  message.success('Карта переведена в статус «Обработано».')
                } catch (e) {
                  message.error(e instanceof Error ? e.message : 'Ошибка смены статуса')
                }
              }
              if (isPpvApp()) {
                fetchPpvIncomingCompletePreview(effectiveDpaid, guid)
                  .then(({ reviewOutcomeSent }) => {
                    if (reviewOutcomeSent) {
                      Modal.confirm({
                        title: 'Завершение обработки',
                        content: `Карта ${regNumber} будет переведена в статус „Обработано“. Продолжить?`,
                        okText: 'Завершить',
                        cancelText: 'Отмена',
                        okButtonProps: { type: 'primary' },
                        onOk: () => runCompleteProcessing(),
                      })
                    } else {
                      Modal.confirm({
                        title: 'Завершение обработки',
                        content:
                          'Результат рассмотрения не готов или не отправлен. Завершить обработку?',
                        okText: 'Завершить',
                        cancelText: 'Отмена',
                        okButtonProps: { type: 'default' },
                        cancelButtonProps: { type: 'primary' },
                        onOk: () => runCompleteProcessing(),
                      })
                    }
                  })
                  .catch((e) => message.error(e instanceof Error ? e.message : 'Не удалось проверить статус ответа'))
                return
              }
              Modal.confirm({
                title: 'Завершение обработки',
                content: `Внимание! После подтверждения карта ${regNumber} будет переведена в статус «Обработано» (завершение обработки входящих сведений). Продолжить?`,
                okText: 'Продолжить',
                cancelText: 'Отмена',
                onOk: () => runCompleteProcessing(),
              })
              return
            }

            if (action === 'close') {
              const regNumber = currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectiveDpaid ?? ''
              Modal.confirm({
                title: 'Закрытие карты',
                content: `Внимание! После подтверждения карта ${regNumber} будет переведена в статус „Завершено“. Выполнение каких-либо действий, кроме просмотра, станет невозможным. Отменить данное действие будет нельзя. Продолжить?`,
                okText: 'Продолжить',
                cancelText: 'Отмена',
                okButtonProps: { danger: true },
                onOk: async () => {
                  const rightKey = isOutgoingSource
                    ? isPpvApp()
                      ? 'violationDetectedOut:status'
                      : 'dangerousProductOut:status'
                    : isPpvApp()
                      ? 'violationDetectedIn:status'
                      : 'dangerousProductIn:status'
                  const hasRight = await checkAccessRight(guid ?? null, rightKey)
                  if (!hasRight) {
                    message.error(isOutgoingSource ? 'Нет права на управление статусом исходящих сведений.' : 'Нет права на управление статусом входящих сведений.')
                    return
                  }
                  changeDpaStatus(effectiveDpaid, 'close', Object.keys(opts || {}).length ? opts : undefined)
                    .then((res) => {
                      const newStatus = res.newStatus ?? currentData.status
                      const newStatusId = isPpvApp()
                        ? (res.newStatusId ??
                            (newStatus === 'Завершено' ? (isOutgoingSource ? 13 : 4) : (editedData.statusId ?? data.statusId)))
                        : newStatus === 'Завершено'
                          ? isOutgoingSource
                            ? 13
                            : 4
                          : (editedData.statusId ?? data.statusId)
                      onUpdate({ ...currentData, status: newStatus, statusId: newStatusId })
                      setEditedData((prev) => ({ ...prev, status: newStatus, statusId: newStatusId }))
                      message.success('Карта переведена в статус «Завершено».')
                    })
                    .catch((e) => message.error(e instanceof Error ? e.message : 'Ошибка смены статуса'))
                },
              })
              return
            }

            changeDpaStatus(effectiveDpaid, action, Object.keys(opts).length ? opts : undefined)
              .then((res) => {
                const newStatus = res.newStatus ?? currentData.status
                const newStatusId = newStatus === 'Новое' ? 6 : newStatus === 'Ожидает отправки' ? 7 : newStatus === 'Завершено' ? 13 : (editedData.statusId ?? data.statusId)
                onUpdate({ ...currentData, status: newStatus, statusId: newStatusId })
                setEditedData((prev) => ({ ...prev, status: newStatus, statusId: newStatusId }))
                message.success('Статус обновлён')
                if (action === 'mark_ready') fetchDpaResolutions(effectiveDpaid, guid).then((list) => setDpaResolutionDepKindCodes(list.map((r) => r.depKindCode)))
              })
              .catch((e) => message.error(e instanceof Error ? e.message : 'Ошибка смены статуса'))
          }}
          onElectronicDocumentClick={() => {
            if (effectiveDpaid) {
              setElectronicDocLoading(true)
              setElectronicDocumentVisible(true)
              setElectronicDocList([])
              fetchDpaElectronicDocs(effectiveDpaid, guid)
                .then((rawList) => {
                  const docs: ElectronicDocument[] = rawList.map((raw) => {
                    const resource = raw.contentBody ? parseElectronicDocContentBody(raw.contentBody) : { validityPeriod: { start: '', end: '' }, updateDateTime: '' }
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
                .catch(() => setElectronicDocList([]))
                .finally(() => setElectronicDocLoading(false))
            } else {
              setElectronicDocList([])
              setElectronicDocumentVisible(true)
            }
          }}
        />
        )}
        <div className="card-tabs-wrapper">
          <Tabs defaultActiveKey="notification" items={tabItemsWithEdit} />
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
          data={
            electronicDocList.length > 0
              ? electronicDocList
              : data.electronicDocument
                ? [
                    {
                      ...data.electronicDocument,
                      validityPeriod: {
                        start: data.electronicDocument.validityPeriod?.start || data.createdAt || '',
                        end: data.electronicDocument.validityPeriod?.end || '',
                        // «По» — только ccdo:ValidityPeriodDetails → csdo:EndDateTime
                      },
                      updateDateTime: data.electronicDocument.updateDateTime || data.modifiedAt || '',
                    },
                  ]
                : []
          }
          onClose={() => setElectronicDocumentVisible(false)}
          loading={electronicDocLoading}
        />

        <AccessModal
          visible={accessModalVisible}
          data={currentData.accessList}
          onClose={() => setAccessModalVisible(false)}
          onUpdate={(accessList) => {
            if (isEditMode) {
              setEditedData((prev) => ({ ...prev, accessList }))
            } else {
              onUpdate({ ...currentData, accessList })
            }
          }}
          dpaid={hasPersistedDpaid ? effectiveDpaid : undefined}
          source={currentData.source}
          datasourceKindCode={currentData.datasourceKindCode}
          countryCode={currentData.country}
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
              setFormatValidationErrors([])
              setComparisonLogicalValidationErrors([])
            }}
            formatValidationErrors={formatValidationErrors}
            logicalValidationErrors={comparisonLogicalValidationErrors}
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

export default DangerousProductCard

