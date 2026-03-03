import { useState, useEffect, useMemo } from 'react'
import { Card, Tabs, Button, Space, Switch, message } from 'antd'
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
import { fetchDpaStatusHistory, fetchDpaElectronicDocs, changeDpaStatus, checkAccessRight, fetchCurrentUser, fetchDpaResolutions, saveDpaCard, buildSaveMetadataFromCardData, type DpaSaveMetadata } from '@/utils/referenceDataApi'
import { getStatusButtonConfig } from '@/utils/statusButtonConfig'
import { parseElectronicDocContentBody } from '@/utils/xmlParser'
import { openLegacyRegisterAllVersions, isLegacyRegisterConfigured } from '@/utils/legacyRegisterUrl'
import XMLComparisonModal, { type ComparisonResultShape } from '../modals/XMLComparisonModal'
import ValidationResultModal from '../modals/ValidationResultModal'
import { validateOutgoingCard, type ValidationResult } from '@/utils/cardValidation'
import type { CardData, StatusHistoryItem, ElectronicDocument } from '@/types/card'

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
}

const DangerousProductCard: React.FC<DangerousProductCardProps> = ({
  data,
  onUpdate,
  originalXML: propOriginalXML,
  dpaid,
  guid,
  initialEditMode,
  onSaveNewCard,
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
  const [hasStatusRight, setHasStatusRight] = useState(true)
  const [hasSendRight, setHasSendRight] = useState(false)
  const [hasSaveRight, setHasSaveRight] = useState(false)
  const [hasResolution, setHasResolution] = useState(false)
  const [currentUserDepKindCode, setCurrentUserDepKindCode] = useState<string | null>(null)
  const [dpaResolutionDepKindCodes, setDpaResolutionDepKindCodes] = useState<string[]>([])
  /** После успешного создания — dpaid сохранённой карты; до редиректа все сохранения идут как update по нему */
  const [savedDpaid, setSavedDpaid] = useState<number | null>(null)

  const effectiveDpaid = (dpaid !== '-' && dpaid) ? dpaid : (savedDpaid != null ? String(savedDpaid) : '-')

  useEffect(() => {
    if (dpaid !== '-') setSavedDpaid(null)
  }, [dpaid])

  // Новая карта (/-/) всегда исходящая; иначе — по DPA DATASOURCEKINDCODE ("3") или по названию источника
  const datasourceKindCode = data?.datasourceKindCode != null ? String(data.datasourceKindCode) : ''
  const sourceFromData = data?.source ?? ''
  const isOutgoingSource =
    effectiveDpaid === '-' ||
    datasourceKindCode === '3' ||
    sourceFromData.toLowerCase().includes('исходящ') ||
    sourceFromData === '3'

  // Права и уровень пользователя / резолюции по карте (исходящие)
  useEffect(() => {
    if (!effectiveDpaid) return
    if (!isOutgoingSource) {
      const src = (data?.source ?? '').toLowerCase()
      if (src.includes('входящ')) {
        checkAccessRight(effectiveDpaid, 'dangerousProductIn:status').then(setHasStatusRight)
      }
      return
    }
    if (isOutgoingSource) {
      Promise.all([
        checkAccessRight(effectiveDpaid, 'dangerousProductOut:status'),
        checkAccessRight(effectiveDpaid, 'dangerousProductOut:send'),
        checkAccessRight(effectiveDpaid, 'dangerousProductOut:edit'),
      ]).then(([status, send, edit]) => {
        setHasStatusRight(status)
        setHasSendRight(send)
        setHasSaveRight(edit)
      })
      fetchCurrentUser().then((u) => setCurrentUserDepKindCode(u.depKindCode ?? null))
      fetchDpaResolutions(effectiveDpaid).then((list) => {
        setDpaResolutionDepKindCodes(list.map((r) => r.depKindCode))
        setHasResolution(list.length > 0)
      })
    }
  }, [effectiveDpaid, isOutgoingSource, data?.source])

  // Исходящая карта: при наличии права dangerousProductOut:edit включаем режим редактирования автоматически
  useEffect(() => {
    if (isOutgoingSource && hasSaveRight) {
      setIsEditMode(true)
    }
  }, [isOutgoingSource, hasSaveRight])

  const statusButton = getStatusButtonConfig(
    editedData.source,
    editedData.status,
    hasStatusRight,
    hasSendRight,
    hasResolution,
    currentUserDepKindCode,
    dpaResolutionDepKindCodes,
    editedData.statusId ?? undefined
  )
  
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
      children: currentData.complianceDocuments ? (
        <ComplianceDocumentsTab data={currentData.complianceDocuments} hasEditPermission={true} />
      ) : (
        <div>Данные о документах соответствия не найдены</div>
      ),
    },
    {
      key: 'violations',
      label: 'Нарушения',
      children: currentData.violations ? (
        <ViolationsTab data={currentData.violations} />
      ) : (
        <div>Данные о нарушениях не найдены</div>
      ),
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
        setComparisonResult({ isIdentical: true, differences: [], warnings: [] })
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

  const handleCancel = () => {
    setEditedData(data)
    setIsEditMode(false)
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
          if (currentData.violations) {
            editChildren = (
              <ViolationsTabEdit
                data={currentData.violations}
                onChange={(violations) => {
                  console.log('[DangerousProductCard] Получены изменения violations:', violations)
                  console.log('[DangerousProductCard] violatedRequirements:', violations.violatedRequirements)
                  setEditedData((prev) => {
                    const updated = { ...prev, violations }
                    console.log('[DangerousProductCard] Обновленный editedData:', updated)
                    console.log('[DangerousProductCard] editedData.violations:', updated.violations)
                    return updated
                  })
                }}
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
                      violations: {
                        generalDescription: '',
                        violatedRequirements: [],
                        violatedIndicators: [],
                      },
                    })
                  }}
                >
                  Добавить данные о нарушениях
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
          if (currentData.complianceDocuments) {
            editChildren = (
              <ComplianceDocumentsTabEdit
                data={currentData.complianceDocuments}
                onChange={(compliance) => setEditedData((prev) => ({ ...prev, complianceDocuments: compliance }))}
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
                      complianceDocuments: {
                        documents: [],
                      },
                    })
                  }}
                >
                  Добавить документы соответствия
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
    <div style={{ padding: '0' }} className="fade-in">
      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Карта сведений об обнаружении опасной продукции</span>
          </div>
        }
        extra={
          <Space size="middle" wrap>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Switch
                checked={isEditMode}
                onChange={setIsEditMode}
                checkedChildren={<EditOutlined />}
                unCheckedChildren={<EyeOutlined />}
                size="default"
              />
              <span style={{ color: '#ffffff', fontWeight: 500 }}>Режим редактирования</span>
            </div>
            {isEditMode && (
              <>
                <Button onClick={handleCancel} size="middle">Отмена</Button>
                {(effectiveDpaid === '-' || (isOutgoingSource && hasSaveRight)) && (
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
            <Button onClick={() => console.log('Закрыть')} size="middle">Закрыть</Button>
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
          statusButton={statusButton}
          onStatusAction={(action) => {
            if (!effectiveDpaid) return
            changeDpaStatus(effectiveDpaid, action)
              .then((res) => {
                const newStatus = res.newStatus ?? currentData.status
                onUpdate({ ...currentData, status: newStatus })
                setEditedData((prev) => ({ ...prev, status: newStatus }))
                message.success('Статус обновлён')
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
              setElectronicDocList(currentData.electronicDocument ? [currentData.electronicDocument] : [])
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
          data={electronicDocList.length > 0 ? electronicDocList : (currentData.electronicDocument ? [currentData.electronicDocument] : [])}
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

