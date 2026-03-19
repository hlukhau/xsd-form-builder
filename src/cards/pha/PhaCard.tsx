import { useState, useEffect } from 'react'
import { Tabs, Switch, Button, Space, message, Modal, Spin } from 'antd'
import { EditOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import type { CardData } from '@/types/card'
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
import { savePhaCard } from '@/cards/pha/phaApi'
import { exportPhaCardDataToXML } from '@/cards/pha/phaXmlExporter'
import { parsePhaXmlToCardData } from '@/cards/pha/phaXmlParser'
import { compareCardData } from '@/utils/cardDataComparator'
import { getEmptyTagsWarnings } from '@/utils/xmlExporter'
import { fetchRightsByGuid, fetchRightsByGuidRaw, type RightsJson } from '@/utils/referenceDataApi'
import XMLComparisonModal, { type ComparisonResultShape } from '@/components/modals/dpa/XMLComparisonModal'
import StatusHistoryModal from '@/components/modals/dpa/StatusHistoryModal'
import ElectronicDocumentModal from '@/components/modals/dpa/ElectronicDocumentModal'

interface PhaCardProps {
  data: CardData
  phaid?: string
  guid?: string
  /** Исходный XML (с сервера) для сравнения с текущим состоянием формы. */
  originalXML?: string | null
  /** Обновление данных карты (после сохранения или при переключении с бэкенда). */
  onUpdate?: (data: CardData) => void
  /** Включить режим редактирования по умолчанию (например, для новой карты). */
  initialEditMode?: boolean
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
const PhaCard: React.FC<PhaCardProps> = ({ data, phaid = '', guid, originalXML, onUpdate, initialEditMode = false }) => {
  const [isEditMode, setIsEditMode] = useState(initialEditMode)
  const [editedData, setEditedData] = useState<CardData>(data)
  const [saving, setSaving] = useState(false)
  const [comparisonResult, setComparisonResult] = useState<ComparisonResultShape | null>(null)
  const [comparisonModalVisible, setComparisonModalVisible] = useState(false)
  const [statusHistoryVisible, setStatusHistoryVisible] = useState(false)
  const [electronicDocumentVisible, setElectronicDocumentVisible] = useState(false)
  const [rightsDebugVisible, setRightsDebugVisible] = useState(false)
  const [rightsDebugData, setRightsDebugData] = useState<RightsJson | null>(null)
  const [rightsDebugLoading, setRightsDebugLoading] = useState(false)
  const [rightsDebugError, setRightsDebugError] = useState<string | null>(null)
  const [rightsDebugRawText, setRightsDebugRawText] = useState<string | null>(null)

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

  const handleSwitchEdit = (checked: boolean) => {
    setIsEditMode(checked)
  }

  const handleSave = async () => {
    if (!phaid) {
      message.info('Сохранение новой карты PHA в разработке')
      return
    }
    setSaving(true)
    try {
      await savePhaCard({ phaid, guid, data: editedData })
      message.success('Карта PHA сохранена')
      onUpdate?.(editedData)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleExportXML = () => {
    const xmlString = exportPhaCardDataToXML(editedData)
    const blob = new Blob([xmlString], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `public-health-alert-${editedData.notification?.registrationNumber || editedData.registrationNumber || 'export'}.xml`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleCompareXML = () => {
    if (!originalXML) {
      message.warning('Исходный XML не найден. Загрузите карту с сервера.')
      return
    }
    try {
      const originalData = parsePhaXmlToCardData(originalXML)
      const result = compareCardData(originalData, editedData)
      const emptyTagsWarnings = getEmptyTagsWarnings(editedData)
      const resultWithWarnings = emptyTagsWarnings.length > 0
        ? { ...result, warnings: [...(result.warnings ?? []), ...emptyTagsWarnings] }
        : result
      setComparisonResult(resultWithWarnings)
      setComparisonModalVisible(true)
    } catch (err) {
      message.error(`Ошибка при сравнении: ${err instanceof Error ? err.message : String(err)}`)
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
        children = (
          <EditComponent
            data={currentData.spreadingZone ?? {}}
            onChange={(zone) => setEditedData((prev) => ({ ...prev, spreadingZone: zone }))}
          />
        )
      } else {
        children = (
          <EditComponent
            data={currentData}
            onChange={setEditedData}
            {...(item.key === 'notification' ? { isNewCard: phaid === '-' || !phaid } : {})}
          />
        )
      }
    } else {
      if (item.key === 'detectionPlace') {
        children = <TabView data={currentData.detectionPlace ?? {}} />
      } else if (item.key === 'spreadZone') {
        children = <TabView data={currentData.spreadingZone ?? {}} label="зоне распространения" />
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
            {phaid ? `Карта сведений об обнаружении болезни ${phaid}` : 'Карта сведений об обнаружении болезни'}
          </span>
          <Space size="small" wrap>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Switch
                checked={isEditMode}
                onChange={handleSwitchEdit}
                checkedChildren={<EditOutlined />}
                unCheckedChildren={<EyeOutlined />}
              />
              <span className="card-sticky-header-mode-label">Режим редактирования</span>
            </div>
            {isEditMode && (
              <>
                <Button type="primary" onClick={handleSave} loading={saving}>Сохранить</Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportXML}>Экспорт XML</Button>
                <Button onClick={handleCompareXML}>Сравнить с исходным</Button>
              </>
            )}
            <Button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.parent.postMessage({ code: 'exit' }, '*')
                }
              }}
            >
              {phaid === '-' || !phaid ? 'Отменить создание' : 'Закрыть карту'}
            </Button>
          </Space>
        </div>
        <CardHeader
          data={currentData}
          onStatusClick={() => setStatusHistoryVisible(true)}
        />
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
            const payload = {
              code: 'all_version' as const,
              INCIDENTID: currentData.registrationNumber ?? '',
              COUNTRY: currentData.country ?? '',
            }
            if (typeof window !== 'undefined') {
              window.parent.postMessage(payload, '*')
            }
          }}
          statusButton={null}
          onStatusAction={() => {}}
          onElectronicDocumentClick={() => setElectronicDocumentVisible(true)}
        />
        <div className="card-tabs-wrapper">
          <Tabs defaultActiveKey="notification" items={tabItems} />
        </div>
      </div>

      <>
        <StatusHistoryModal
          visible={statusHistoryVisible}
          data={currentData.statusHistory ?? []}
          onClose={() => setStatusHistoryVisible(false)}
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
            onClose={() => setComparisonModalVisible(false)}
          />
        )}
      </>
    </div>
  )
}

export default PhaCard
