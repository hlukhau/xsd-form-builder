import { useState, useEffect } from 'react'
import { Card, Tabs, Button, Space, Switch } from 'antd'
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
import { compareCardData } from '@/utils/cardDataComparator'
import XMLComparisonModal from '../modals/XMLComparisonModal'
import type { CardData } from '@/types/card'

interface DangerousProductCardProps {
  data: CardData
  onUpdate: (data: CardData) => void
}

const DangerousProductCard: React.FC<DangerousProductCardProps> = ({
  data,
  onUpdate,
  originalXML: propOriginalXML,
}) => {
  // Отладочный вывод
  console.log('DangerousProductCard получил данные:', data)
  
  const [statusHistoryVisible, setStatusHistoryVisible] = useState(false)
  const [electronicDocumentVisible, setElectronicDocumentVisible] = useState(false)
  const [accessModalVisible, setAccessModalVisible] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [editedData, setEditedData] = useState<CardData>(data)
  const [originalXML, setOriginalXML] = useState<string | null>(propOriginalXML || null)
  const [comparisonResult, setComparisonResult] = useState<{
    isIdentical: boolean
    differences: string[]
    warnings: string[]
  } | null>(null)
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false)
  
  // Обновляем originalXML при изменении prop
  useEffect(() => {
    if (propOriginalXML && propOriginalXML !== originalXML) {
      setOriginalXML(propOriginalXML)
    }
  }, [propOriginalXML, originalXML])
  
  // Обновляем editedData при изменении data (только если не в режиме редактирования)
  useEffect(() => {
    if (!isEditMode && editedData !== data) {
      setEditedData(data)
    }
  }, [data, isEditMode])
  
  // Проверка наличия данных
  if (!data) {
    return <div>Нет данных для отображения</div>
  }

  const tabItems = [
    {
      key: 'notification',
      label: 'Уведомление',
      children: <NotificationTab data={data.notification} />,
    },
    {
      key: 'product',
      label: 'Продукция',
      children: data.product ? (
        <ProductTab data={data.product} />
      ) : (
        <div>Данные о продукции не найдены</div>
      ),
    },
    {
      key: 'tsd',
      label: 'ТСД',
      children: data.tsd ? (
        <TSDTab data={data.tsd} />
      ) : (
        <div>Данные о партиях продукции не найдены</div>
      ),
    },
    {
      key: 'compliance',
      label: 'Документы соответствия',
      children: data.complianceDocuments ? (
        <ComplianceDocumentsTab data={data.complianceDocuments} hasEditPermission={true} />
      ) : (
        <div>Данные о документах соответствия не найдены</div>
      ),
    },
    {
      key: 'violations',
      label: 'Нарушения',
      children: data.violations ? (
        <ViolationsTab data={data.violations} />
      ) : (
        <div>Данные о нарушениях не найдены</div>
      ),
    },
    {
      key: 'detectionPlace',
      label: 'Место обнаружения',
      children: data.detectionPlace ? (
        <DetectionPlaceTab data={data.detectionPlace} />
      ) : (
        <div>Данные о месте обнаружения не найдены</div>
      ),
    },
    {
      key: 'measures',
      label: 'Принятые меры',
      children: data.measures ? (
        <MeasuresTab data={data.measures} />
      ) : (
        <div>Данные о принятых мерах не найдены</div>
      ),
    },
  ]

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
    // Пытаемся получить исходный XML из состояния или localStorage
    const xmlToCompare = originalXML || localStorage.getItem('originalXML')
    
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
    onUpdate(editedData)
    setIsEditMode(false)
  }

  const handleCancel = () => {
    setEditedData(data)
    setIsEditMode(false)
  }

  const currentData = isEditMode ? editedData : data

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
                <Button type="primary" onClick={handleSave} size="middle">Сохранить</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportXML} size="middle">Экспорт XML</Button>
                <Button onClick={handleCompareXML} size="middle">Сравнить с исходным</Button>
              </>
            )}
            <Button onClick={() => console.log('Закрыть')} size="middle">Закрыть</Button>
          </Space>
        }
      >
        <CardHeader data={currentData} onStatusClick={() => setStatusHistoryVisible(true)} />
        
        <CardActions
          data={currentData}
          onDefineAccess={() => setAccessModalVisible(true)}
          onOpenAllVersions={() => console.log('Открыть все версии')}
          onCompleteProcessing={() => console.log('Завершить обработку')}
          onElectronicDocumentClick={() => setElectronicDocumentVisible(true)}
        />

        <Tabs defaultActiveKey="notification" items={tabItemsWithEdit} />

        <StatusHistoryModal
          visible={statusHistoryVisible}
          data={currentData.statusHistory}
          onClose={() => setStatusHistoryVisible(false)}
          isEditMode={isEditMode}
          onUpdate={isEditMode ? (statusHistory) => setEditedData((prev) => ({ ...prev, statusHistory })) : undefined}
        />

        <ElectronicDocumentModal
          visible={electronicDocumentVisible}
          data={currentData.electronicDocument}
          onClose={() => setElectronicDocumentVisible(false)}
          isEditMode={isEditMode}
          onUpdate={isEditMode ? (electronicDocument) => setEditedData((prev) => ({ ...prev, electronicDocument })) : undefined}
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
        />

        {comparisonResult && (
          <XMLComparisonModal
            visible={comparisonModalVisible}
            comparisonResult={comparisonResult}
            onClose={() => setComparisonModalVisible(false)}
          />
        )}
      </Card>
    </div>
  )
}

export default DangerousProductCard

