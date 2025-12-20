import { useState } from 'react'
import { Card, Tabs, Button, Space } from 'antd'
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
import type { CardData } from '@/types/card'

interface DangerousProductCardProps {
  data: CardData
  onUpdate: (data: CardData) => void
}

const DangerousProductCard: React.FC<DangerousProductCardProps> = ({
  data,
  onUpdate,
}) => {
  // Отладочный вывод
  console.log('DangerousProductCard получил данные:', data)
  
  const [statusHistoryVisible, setStatusHistoryVisible] = useState(false)
  const [electronicDocumentVisible, setElectronicDocumentVisible] = useState(false)
  const [accessModalVisible, setAccessModalVisible] = useState(false)
  
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

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title="Карта сведений об обнаружении опасной продукции"
        extra={
          <Button onClick={() => console.log('Закрыть')}>Закрыть</Button>
        }
      >
        <CardHeader data={data} onStatusClick={() => setStatusHistoryVisible(true)} />
        
        <CardActions
          data={data}
          onDefineAccess={() => setAccessModalVisible(true)}
          onOpenAllVersions={() => console.log('Открыть все версии')}
          onCompleteProcessing={() => console.log('Завершить обработку')}
          onElectronicDocumentClick={() => setElectronicDocumentVisible(true)}
        />

        <Tabs defaultActiveKey="notification" items={tabItems} />

        <StatusHistoryModal
          visible={statusHistoryVisible}
          data={data.statusHistory}
          onClose={() => setStatusHistoryVisible(false)}
        />

        <ElectronicDocumentModal
          visible={electronicDocumentVisible}
          data={data.electronicDocument}
          onClose={() => setElectronicDocumentVisible(false)}
        />

        <AccessModal
          visible={accessModalVisible}
          data={data.accessList}
          onClose={() => setAccessModalVisible(false)}
          onUpdate={(accessList) => onUpdate({ ...data, accessList })}
        />
      </Card>
    </div>
  )
}

export default DangerousProductCard

