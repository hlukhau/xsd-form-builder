import { useState, useEffect, useMemo } from 'react'
import { Card, Tabs, Button, Space, Switch, message, Modal, Spin } from 'antd'
import { EditOutlined, EyeOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons'
import ProductTabEdit from '../tabs/ProductTabEdit'
import ViolationsTabEdit from '../tabs/ViolationsTabEdit'
import NotificationTabEdit from '../tabs/NotificationTabEdit'
import TSDTabEdit from '../tabs/TSDTabEdit'
import ComplianceDocumentsTabEdit from '../tabs/ComplianceDocumentsTabEdit'
import DetectionPlaceTabEdit from '../tabs/DetectionPlaceTabEdit'
import MeasuresTabEdit from '../tabs/MeasuresTabEdit'
import CardHeader from './CardHeader'
import CardActions from './CardActions'
import StatusHistoryModal from '../modals/StatusHistoryModal'
import ElectronicDocumentModal from '../modals/ElectronicDocumentModal'
import AccessModal from '../modals/AccessModal'
import NotificationTab from '../tabs/NotificationTab'
import ProductTab from '../tabs/ProductTab'
import TSDTab from '../tabs/TSDTab'
import ComplianceDocumentsTab from '../tabs/ComplianceDocumentsTab'
import ViolationsTab from '../tabs/ViolationsTab'
import DetectionPlaceTab from '../tabs/DetectionPlaceTab'
import MeasuresTab from '../tabs/MeasuresTab'
import { exportCardDataToXML } from '@/utils/xmlExporter'
import { parseXMLToCardData } from '@/utils/xmlParser'
import { compareCardData, getCardDataReview } from '@/utils/cardDataComparator'
import { fetchDpaStatusHistory, fetchDpaElectronicDocs, changeDpaStatus, checkAccessRight, fetchCurrentUser, fetchDpaResolutions, fetchRightsByGuid, fetchRightsByGuidRaw, getCreateAuthorityIdsFromRights, fetchDepInfo, saveDpaCard, buildSaveMetadataFromCardData, deleteDpaCard, canCreateNewVersion, type DpaSaveMetadata, type RightsJson } from '@/utils/referenceDataApi'
import { getStatusButtonConfig } from '@/utils/statusButtonConfig'
import { parseElectronicDocContentBody } from '@/utils/xmlParser'
import { openLegacyRegisterAllVersions, isLegacyRegisterConfigured } from '@/utils/legacyRegisterUrl'
import XMLComparisonModal, { type ComparisonResultShape } from '../modals/XMLComparisonModal'
import ValidationResultModal from '../modals/ValidationResultModal'
import { validateOutgoingCard, type ValidationResult } from '@/utils/cardValidation'
import type { CardData, StatusHistoryItem, ElectronicDocument } from '@/types/card'

/** Статусы исходящей карты, при которых разрешено редактирование (DPASTATUSID). */
const EDITABLE_OUTGOING_STATUS_IDS = [5, 6, 9, 10, 12] // DRAFT, NEW, FAILED, ERROR, EDITED

interface DangerousProductCardProps {
  data: CardData
  onUpdate: (data: CardData) => void
  originalXML?: string | null
  dpaid?: string
  /** GUID из URL — для получения JSON прав (department.depid при «Определить доступ») */
  guid?: string
  /** Открыть карту сразу в режиме редактирования (например после редиректа по сохранению новой карты) */
  initialEditMode?: boolean
  /** После успешного сохранения новой карты (dpaid === '-') вызывается с новым DPAID для редиректа */
  onSaveNewCard?: (newDpaid: number) => void
  /** После успешного удаления карты (закрыть форму и показать сообщение) */
  onCardDeleted?: () => void
  /** При создании новой версии (Сделать копию) — исходный DPAID для сохранения */
  copyFromDpaid?: number
  /** Открыть форму новой версии (после «Сделать копию») — навигация с state */
  onMakeCopy?: (initialCardData: CardData, sourceDpaid: number) => void
}

const DangerousProductCard: React.FC<DangerousProductCardProps> = ({
  data,
  onUpdate,
  originalXML: propOriginalXML,
  dpaid,
  guid,
  initialEditMode,
  onSaveNewCard,
  onCardDeleted,
  copyFromDpaid,
  onMakeCopy,
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
  const [isEditMode, setIsEditMode] = useState(() => dpaid === '-' || initialEditMode === true)
  const [editedData, setEditedData] = useState<CardData>(data)
  const [originalXML, setOriginalXML] = useState<string | null>(propOriginalXML || null)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResultShape | null>(null)
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false)
  const [validationModalVisible, setValidationModalVisible] = useState(false)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingSavePayload, setPendingSavePayload] = useState<{ xmlBody: string; metadata: DpaSaveMetadata } | null>(null)
  const [hasStatusRight, setHasStatusRight] = useState(false)
  const [hasSendRight, setHasSendRight] = useState(false)
  const [hasSaveRight, setHasSaveRight] = useState(false)
  const [hasResolution, setHasResolution] = useState(false)
  const [currentUserDepKindCode, setCurrentUserDepKindCode] = useState<string | null>(null)
  const [currentUserDepKindName, setCurrentUserDepKindName] = useState<string | null>(null)
  /** Уровень ЦГЭ по depid из карты прав (когда текущий пользователь не загружен) — для подсказки в черновике */
  const [rightsDepKindCode, setRightsDepKindCode] = useState<string | null>(null)
  const [rightsDepKindName, setRightsDepKindName] = useState<string | null>(null)
  /** AUTHORITYID из dangerousProductOut.create — только эти УО показывать в выборе при исходящей карте */
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

  const effectiveDpaid = (dpaid !== '-' && dpaid) ? dpaid : (savedDpaid != null ? String(savedDpaid) : '-')

  // Новая карта (/-/) всегда исходящая; иначе — по DPA DATASOURCEKINDCODE ("2") или по названию источника (код 3 — из БД ЕЭК)
  const datasourceKindCode = data?.datasourceKindCode != null ? String(data.datasourceKindCode) : ''
  const sourceFromData = data?.source ?? ''
  const isOutgoingSource =
    effectiveDpaid === '-' ||
    datasourceKindCode === '2' ||
    sourceFromData.toLowerCase().includes('исходящ') ||
    sourceFromData === '2'

  const currentStatusId = editedData.statusId ?? data.statusId ?? undefined
  const canEditByStatus =
    !isOutgoingSource || currentStatusId === undefined || EDITABLE_OUTGOING_STATUS_IDS.includes(currentStatusId)

  useEffect(() => {
    if (dpaid !== '-') setSavedDpaid(null)
  }, [dpaid])

  // Права и уровень пользователя / резолюции по карте (исходящие)
  useEffect(() => {
    if (!effectiveDpaid) return
    if (!isOutgoingSource) {
      const src = (data?.source ?? '').toLowerCase()
      if (src.includes('входящ')) {
        checkAccessRight(effectiveDpaid, 'dangerousProductIn:status')
          .then(setHasStatusRight)
          .catch(() => setHasStatusRight(false))
      }
      return
    }
    if (isOutgoingSource) {
      Promise.all([
        checkAccessRight(effectiveDpaid, 'dangerousProductOut:status'),
        checkAccessRight(effectiveDpaid, 'dangerousProductOut:send'),
        checkAccessRight(effectiveDpaid, 'dangerousProductOut:edit'),
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
      fetchCurrentUser().then((u) => {
        setCurrentUserDepKindCode(u.depKindCode ?? null)
        setCurrentUserDepKindName(u.depKindName ?? null)
      })
      if (guid) {
        fetchRightsByGuid(guid)
          .then((r) => {
            setCreateAuthorityIds(getCreateAuthorityIdsFromRights(r))

            const depid = r.department?.depid != null ? String(r.department.depid) : null
            const hasRightInMap = (map: Record<string, unknown> | undefined | null): boolean => {
              if (!depid || !map || typeof map !== 'object') return false
              return Object.prototype.hasOwnProperty.call(map, depid)
            }

            // Уточняем права по исходящим сведениям на основе JSON прав
            const upOut = r.up?.dangerousProductOut
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

            return r.department?.depid != null
              ? fetchDepInfo(r.department.depid)
              : Promise.resolve({ depKindCode: null, depKindName: null })
          })
          .then((level) => {
            setRightsDepKindCode(level.depKindCode ?? null)
            setRightsDepKindName(level.depKindName ?? null)
          })
          .catch(() => { setRightsDepKindCode(null); setRightsDepKindName(null); setCreateAuthorityIds(null) })
      } else {
        setRightsDepKindCode(null)
        setRightsDepKindName(null)
        setCreateAuthorityIds(null)
      }
      fetchDpaResolutions(effectiveDpaid).then((list) => {
        setDpaResolutionDepKindCodes(list.map((r) => r.depKindCode))
        setHasResolution(list.length > 0)
      })
    }
  }, [effectiveDpaid, isOutgoingSource, data?.source, guid])

  // Исходящая карта: при наличии права dangerousProductOut:edit и статусе, допускающем редактирование, включаем режим редактирования автоматически
  useEffect(() => {
    if (isOutgoingSource && hasSaveRight && canEditByStatus) {
      setIsEditMode(true)
    }
  }, [isOutgoingSource, hasSaveRight, canEditByStatus])

  // Для статусов, не допускающих редактирование, принудительно выключаем режим редактирования
  useEffect(() => {
    if (isOutgoingSource && !canEditByStatus) {
      setIsEditMode(false)
    }
  }, [isOutgoingSource, canEditByStatus])

  // Новая карта (/-/) всегда исходящая — подставляем код "2", т.к. метаданные ещё могут быть не заполнены
  const effectiveDatasourceKindCode =
    editedData.datasourceKindCode ?? data.datasourceKindCode ?? (effectiveDpaid === '-' ? '2' : undefined)
  const statusButtonResult = getStatusButtonConfig(
    editedData.source,
    editedData.status,
    hasStatusRight,
    hasSendRight,
    hasResolution,
    currentUserDepKindCode ?? rightsDepKindCode,
    dpaResolutionDepKindCodes,
    editedData.statusId ?? undefined,
    effectiveDatasourceKindCode,
    currentUserDepKindName ?? rightsDepKindName,
    editedData.notification?.endDate ?? data.notification?.endDate ?? null
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
  const CLOSE_BUTTON_DISABLED_HINT =
    'Закрытие карты доступно при статусе «Новое», «Отправка не удалась», «Ошибка обработки» или «Доставлено».'
  const effectiveCloseButton =
    effectiveDpaid === '-' && closeConfig
      ? { ...closeConfig, disabled: true, hint: 'Сохраните изменения' }
      : closeConfig ??
        (isOutgoingSource
          ? { label: 'Закрытие карты', action: 'close' as const, disabled: true, hint: CLOSE_BUTTON_DISABLED_HINT }
          : null)

  // Кнопка «Удалить»: исходящая карта, статус Черновик, право dangerousProductOut:edit, карта сохранена в БД, есть guid
  const isDraftStatus =
    (editedData.statusId ?? data.statusId) === 5 ||
    /черновик/i.test(editedData.status ?? data.status ?? '')
  const showDeleteButton =
    isOutgoingSource &&
    isDraftStatus &&
    hasSaveRight &&
    effectiveDpaid !== '-' &&
    effectiveDpaid != null &&
    !!guid

  const handleDelete = () => {
    const regNumber = editedData.registrationNumber ?? data.registrationNumber ?? effectiveDpaid ?? ''
    Modal.confirm({
      title: 'Подтверждение удаления',
      content: `Карта ${regNumber} будет удалена безвозвратно. Продолжить?`,
      okText: 'Удалить',
      okButtonProps: { danger: true },
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await deleteDpaCard(Number(effectiveDpaid), guid!)
          message.success('Карта удалена')
          onCardDeleted?.()
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Ошибка удаления')
        }
      },
    })
  }

  // Кнопка «Сделать копию»: исходящая карта, статус Доставлено (11), право dangerousProductOut:edit, есть guid
  const showCopyButton =
    isOutgoingSource &&
    hasSaveRight &&
    effectiveDpaid !== '-' &&
    effectiveDpaid != null &&
    !!guid &&
    !!onMakeCopy &&
    (editedData.statusId ?? data.statusId) === 11

  const handleCopy = async () => {
    if (!effectiveDpaid || !guid || !onMakeCopy) return
    try {
      const res = await canCreateNewVersion(String(effectiveDpaid), guid)
      if (!res.allowed) {
        message.error(res.reason ?? 'Создание новой версии недоступно')
        return
      }
      const today = new Date().toISOString().slice(0, 10)
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
  
  // Обновляем originalXML при изменении prop
  useEffect(() => {
    if (propOriginalXML && propOriginalXML !== originalXML) {
      setOriginalXML(propOriginalXML)
    }
  }, [propOriginalXML, originalXML])
  
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
  const tabItems = useMemo(() => [
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
      children: <ComplianceDocumentsTab tsd={currentData.tsd} hasEditPermission={true} />,
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
    {
      key: 'measures',
      label: 'Принятые меры',
      children: currentData.measures ? (
        <MeasuresTab data={currentData.measures} />
      ) : (
        <div>Данные о принятых мерах не найдены</div>
      ),
    },
  ], [currentData])

  const handleExportXML = () => {
    const xmlString = exportCardDataToXML(editedData)
    const blob = new Blob([xmlString], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `dangerous-product-alert-${editedData.registrationNumber}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleCompareXML = () => {
    // Только свой «оригинал» из состояния вкладки, без localStorage — чтобы не подставлять документ из другой вкладки
    const xmlToCompare = originalXML

    if (!xmlToCompare) {
      alert('Исходный XML не найден. Пожалуйста, загрузите XML файл сначала.')
      return
    }
    
    try {
      // Парсим исходный XML в объект
      const originalData = parseXMLToCardData(xmlToCompare)
      console.log('[handleCompareXML] Исходные данные после парсинга:', originalData)
      
      // Экспортируем editedData в XML
      const exportedXML = exportCardDataToXML(editedData)
      console.log('[handleCompareXML] Экспортированный XML создан')
      
      // Парсим экспортированный XML обратно в объект
      const exportedData = parseXMLToCardData(exportedXML)
      console.log('[handleCompareXML] Экспортированные данные после парсинга:', exportedData)
      
      // Сравниваем объекты
      const result = compareCardData(originalData, exportedData)
      console.log('[handleCompareXML] Результат сравнения:', result)
      console.log('[handleCompareXML] Количество различий:', result.differences.length)
      console.log('[handleCompareXML] Количество предупреждений:', result.warnings.length)
      if (result.warnings.length > 0) {
        console.log('[handleCompareXML] Предупреждения:', result.warnings)
      }
      if (result.differences.length > 0) {
        console.log('[handleCompareXML] Различия:', result.differences)
      }
      
      setComparisonResult(result)
      setComparisonModalVisible(true)
    } catch (error) {
      console.error('[handleCompareXML] Ошибка при сравнении:', error)
      alert(`Ошибка при сравнении XML: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleSave = () => {
    const xmlBody = exportCardDataToXML(editedData)
    const metadata = buildSaveMetadataFromCardData(editedData)
    const isNewCard = effectiveDpaid === '-'
    const isOutgoingWithSave = isOutgoingSource && hasSaveRight

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
    } else {
      setPendingSavePayload(null)
    }
    onUpdate(editedData)
    setIsEditMode(false)
    const xmlToCompare = originalXML
    if (xmlToCompare) {
      try {
        const originalData = parseXMLToCardData(xmlToCompare)
        const exportedData = parseXMLToCardData(xmlBody)
        const result = compareCardData(originalData, exportedData)
        setComparisonResult(result)
        setComparisonModalVisible(true)
      } catch {
        setComparisonResult({ isIdentical: true, differences: [], warnings: [], added: [] })
        setComparisonModalVisible(true)
      }
    }
  }

  const handleSaveToDbFromModal = async () => {
    if (!pendingSavePayload) return
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
      onUpdate(editedData)
      setIsEditMode(false)
      setOriginalXML(xmlJustSaved)
      if (isNewCard) {
        setSavedDpaid(res.dpaid)
        try {
          sessionStorage.setItem('xsd_form_builder_last_saved_dpaid', String(res.dpaid))
          sessionStorage.setItem('xsd_form_builder_save_happened', '1')
        } catch (_) {}
        message.success(`Карта сохранена в БД с DPAID ${res.dpaid}`)
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
              cardCountry={currentData.country}
              version={currentData.version ?? 1}
              isDraft={effectiveDpaid === '-' || (currentStatusId === 5) || /черновик/i.test(editedData.status ?? data.status ?? '')}
              isOutgoing={isOutgoingSource}
              allowedAuthorityIds={isOutgoingSource && (effectiveDpaid === '-' || isDraftStatus) ? createAuthorityIds ?? undefined : undefined}
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
    <div style={{ padding: 0 }} className="fade-in">
      <Card
        bordered={false}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Карта сведений об обнаружении опасной продукции</span>
          </div>
        }
        extra={
          <Space size="small" wrap>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Switch
                checked={isEditMode}
                onChange={setIsEditMode}
                checkedChildren={<EditOutlined />}
                unCheckedChildren={<EyeOutlined />}
                size="default"
                disabled={isOutgoingSource && !canEditByStatus}
                title={isOutgoingSource && !canEditByStatus ? 'Редактирование недоступно для текущего статуса карты' : undefined}
              />
              <span style={{ color: '#ffffff', fontWeight: 500 }}>
                Режим редактирования
                {isOutgoingSource && !canEditByStatus && ' (недоступен для текущего статуса)'}
              </span>
            </div>
            {isEditMode && (
              <>
                {(effectiveDpaid === '-' || (isOutgoingSource && hasSaveRight && canEditByStatus)) && (
                  <Button type="primary" onClick={handleSave} loading={saving} size="middle">Сохранить</Button>
                )}
                <Button icon={<DownloadOutlined />} onClick={handleExportXML} size="middle">Экспорт XML</Button>
                <Button onClick={handleCompareXML} size="middle">Сравнить с исходным</Button>
              </>
            )}
            {isOutgoingSource && (
              <Button
                onClick={() => {
                  const dataToValidate = isEditMode ? editedData : currentData
                  setValidationResult(validateOutgoingCard(dataToValidate))
                  setValidationModalVisible(true)
                }}
                size="middle"
              >
                Валидация карты
              </Button>
            )}
            <Button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.parent.postMessage({ code: 'exit' }, '*')
                  }
                }}
                size="middle"
              >
                {effectiveDpaid === '-' ? 'Отменить создание' : 'Закрыть'}
              </Button>
          </Space>
        }
      >
        <CardHeader
          data={currentData}
          onStatusClick={() => {
            if (effectiveDpaid) {
              setStatusHistoryLoading(true)
              setStatusHistoryVisible(true)
              setStatusHistoryModalData([])
              fetchDpaStatusHistory(effectiveDpaid)
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
          onDelete={handleDelete}
          showCopyButton={showCopyButton}
          onCopy={handleCopy}
          onOpenAllVersions={() => {
            const payload = {
              code: 'all_version' as const,
              INCIDENTID: currentData.registrationNumber ?? '',
              COUNTRY: currentData.country ?? '',
            }
            if (typeof window !== 'undefined') {
              window.parent.postMessage(payload, '*')
              console.log('[Открыть все версии] Сообщение отправлено родительскому окну:', payload)
            }
            if (isLegacyRegisterConfigured()) {
              openLegacyRegisterAllVersions(currentData.country ?? '', currentData.registrationNumber ?? '')
            }
          }}
          statusButton={effectiveStatusButton}
          statusButtonComment={effectiveStatusButtonComment}
          closeButton={effectiveCloseButton}
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
              const validation = validateOutgoingCard(dataToValidate)
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
                  const hasSend = await checkAccessRight(effectiveDpaid, 'dangerousProductOut:send')
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
              return
            }

            if (action === 'to_new') {
              changeDpaStatus(effectiveDpaid, 'to_new', Object.keys(opts).length ? opts : undefined)
                .then((res) => {
                  const newStatus = res.newStatus ?? currentData.status
                  const newStatusId = newStatus === 'Новое' ? 6 : (editedData.statusId ?? data.statusId)
                  onUpdate({ ...currentData, status: newStatus, statusId: newStatusId })
                  setEditedData((prev) => ({ ...prev, status: newStatus, statusId: newStatusId }))
                  message.success('Карта переведена в статус «Новое».')
                })
                .catch((e) => message.error(e instanceof Error ? e.message : 'Ошибка смены статуса'))
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
                      fetchDpaResolutions(effectiveDpaid).then((list) => setDpaResolutionDepKindCodes(list.map((r) => r.depKindCode)))
                    })
                    .catch((e) => message.error(e instanceof Error ? e.message : 'Ошибка смены статуса'))
                },
              })
              return
            }

            if (action === 'complete_processing') {
              const regNumber = currentData.registrationNumber ?? currentData.notification?.registrationNumber ?? effectiveDpaid ?? ''
              Modal.confirm({
                title: 'Завершение обработки',
                content: `Внимание! После подтверждения карта ${regNumber} будет переведена в статус «Обработано» (завершение обработки входящих сведений). Продолжить?`,
                okText: 'Продолжить',
                cancelText: 'Отмена',
                onOk: async () => {
                  const hasRight = await checkAccessRight(effectiveDpaid, 'dangerousProductIn:status')
                  if (!hasRight) {
                    message.error('Нет права на управление статусом входящих сведений.')
                    return
                  }
                  changeDpaStatus(effectiveDpaid, 'complete_processing', Object.keys(opts || {}).length ? opts : undefined)
                    .then((res) => {
                      const newStatus = res.newStatus ?? currentData.status
                      const newStatusId = newStatus === 'Обработано' ? 3 : (editedData.statusId ?? data.statusId)
                      onUpdate({ ...currentData, status: newStatus, statusId: newStatusId })
                      setEditedData((prev) => ({ ...prev, status: newStatus, statusId: newStatusId }))
                      message.success('Карта переведена в статус «Обработано».')
                    })
                    .catch((e) => message.error(e instanceof Error ? e.message : 'Ошибка смены статуса'))
                },
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
                  const rightKey = isOutgoingSource ? 'dangerousProductOut:status' : 'dangerousProductIn:status'
                  const hasRight = await checkAccessRight(effectiveDpaid, rightKey)
                  if (!hasRight) {
                    message.error(isOutgoingSource ? 'Нет права на управление статусом исходящих сведений.' : 'Нет права на управление статусом входящих сведений.')
                    return
                  }
                  changeDpaStatus(effectiveDpaid, 'close', Object.keys(opts || {}).length ? opts : undefined)
                    .then((res) => {
                      const newStatus = res.newStatus ?? currentData.status
                      const newStatusId = newStatus === 'Завершено' ? (isOutgoingSource ? 13 : 4) : (editedData.statusId ?? data.statusId)
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
                if (action === 'mark_ready') fetchDpaResolutions(effectiveDpaid).then((list) => setDpaResolutionDepKindCodes(list.map((r) => r.depKindCode)))
              })
              .catch((e) => message.error(e instanceof Error ? e.message : 'Ошибка смены статуса'))
          }}
          onElectronicDocumentClick={() => {
            if (effectiveDpaid) {
              setElectronicDocLoading(true)
              setElectronicDocumentVisible(true)
              setElectronicDocList([])
              fetchDpaElectronicDocs(effectiveDpaid)
                .then((rawList) => {
                  const docs: ElectronicDocument[] = rawList.map((raw) => {
                    const resource = raw.contentBody ? parseElectronicDocContentBody(raw.contentBody) : { validityPeriod: { start: '', end: '' }, updateDateTime: '' }
                    return {
                      messageCode: raw.messageCode ?? '',
                      documentCode: raw.documentCode ?? '',
                      documentId: raw.documentId ?? '',
                      documentDate: raw.documentDate ?? '',
                      language: raw.language ?? 'ru',
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

        <Tabs defaultActiveKey="notification" items={tabItemsWithEdit} />

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
          dpaid={effectiveDpaid}
          source={currentData.source}
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
                <pre style={{ margin: 0, padding: 12, background: '#fff2f0', borderRadius: 4, maxHeight: 360, overflow: 'auto', fontSize: 11 }}>
                  {rightsDebugRawText}
                </pre>
              )}
            </div>
          ) : rightsDebugData != null ? (
            <pre style={{ margin: 0, padding: 12, background: '#f5f5f5', borderRadius: 4, maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
              {JSON.stringify(rightsDebugData, null, 2)}
            </pre>
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
            }}
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
      </Card>
    </div>
  )
}

export default DangerousProductCard

