import { useState, useEffect } from 'react'
import { Card, Tabs, Switch, Button, Space, message } from 'antd'
import { EditOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import type { CardData } from '@/types/card'
import { CardHeader } from '@/cards/shared'
import {
  NotificationTab,
  NotificationTabEdit,
  DiseaseTab,
  PatientGroupTab,
  DetectionPlaceTab,
  SpreadZoneTab,
  SanitaryMeasuresTab,
} from '@/components/tabs/pha'
import { savePhaCard } from '@/cards/pha/phaApi'
import { exportPhaCardDataToXML } from '@/cards/pha/phaXmlExporter'
import { parsePhaXmlToCardData } from '@/cards/pha/phaXmlParser'
import { compareCardData } from '@/utils/cardDataComparator'
import { getEmptyTagsWarnings } from '@/utils/xmlExporter'
import XMLComparisonModal, { type ComparisonResultShape } from '@/components/modals/dpa/XMLComparisonModal'

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
  { key: 'disease', label: 'Болезнь', view: DiseaseTab },
  { key: 'patientGroup', label: 'Группа пациентов', view: PatientGroupTab },
  { key: 'detectionPlace', label: 'Место обнаружения', view: DetectionPlaceTab },
  { key: 'spreadZone', label: 'Зона распространения', view: SpreadZoneTab },
  { key: 'sanitaryMeasures', label: 'Санитарные меры', view: SanitaryMeasuresTab },
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

  useEffect(() => {
    setEditedData(data)
  }, [data])

  const currentData = isEditMode ? editedData : data

  const handleSwitchEdit = (checked: boolean) => {
    if (!checked) setEditedData(data)
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
    const children = isEditMode && item.key === 'notification' && EditComponent
      ? (
        <EditComponent
          data={currentData}
          onChange={setEditedData}
          isNewCard={phaid === '-' || !phaid}
        />
        )
      : <TabView data={currentData} />
    return { key: item.key, label: item.label, children }
  })

  return (
    <Card
      title={phaid ? `Карта сведений об обнаружении болезней ${phaid}` : 'Карта сведений об обнаружении болезней'}
      className="pha-card"
      extra={
        <Space wrap>
          <Switch
            checked={isEditMode}
            onChange={handleSwitchEdit}
            checkedChildren={<EditOutlined />}
            unCheckedChildren={<EyeOutlined />}
          />
          <span style={{ fontSize: 12, color: '#666' }}>Режим редактирования</span>
          {isEditMode && (
            <>
              <Button type="primary" onClick={handleSave} loading={saving}>Сохранить</Button>
              <Button icon={<DownloadOutlined />} onClick={handleExportXML}>Экспорт XML</Button>
              <Button onClick={handleCompareXML}>Сравнить с исходным</Button>
            </>
          )}
        </Space>
      }
    >
      <CardHeader data={currentData} onStatusClick={() => {}} />
      <Tabs style={{ marginTop: 16 }} items={tabItems} />
      {comparisonResult && (
        <XMLComparisonModal
          visible={comparisonModalVisible}
          comparisonResult={comparisonResult}
          onClose={() => setComparisonModalVisible(false)}
        />
      )}
    </Card>
  )
}

export default PhaCard
