import { Modal, Alert, List, Typography } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography

interface XMLComparisonModalProps {
  visible: boolean
  comparisonResult: {
    isIdentical: boolean
    differences: string[]
    warnings: string[]
  }
  onClose: () => void
}

const XMLComparisonModal: React.FC<XMLComparisonModalProps> = ({
  visible,
  comparisonResult,
  onClose,
}) => {
  return (
    <Modal
      title="Результат сравнения XML"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={800}
    >
      {comparisonResult.isIdentical ? (
        <Alert
          message="XML документы идентичны"
          description="Экспортированный XML полностью соответствует исходному документу."
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
          style={{ marginBottom: '16px' }}
        />
      ) : (
        <Alert
          message="Обнаружены различия"
          description="Экспортированный XML отличается от исходного документа."
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}

      {comparisonResult.differences.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <Text strong>Критические различия:</Text>
          <List
            size="small"
            dataSource={comparisonResult.differences}
            renderItem={(item) => (
              <List.Item>
                <Text type="danger">
                  <CloseCircleOutlined /> {item}
                </Text>
              </List.Item>
            )}
          />
        </div>
      )}

      {comparisonResult.warnings.length > 0 && (
        <div>
          <Text strong>Предупреждения:</Text>
          <List
            size="small"
            dataSource={comparisonResult.warnings}
            renderItem={(item) => (
              <List.Item>
                <Text type="warning">
                  <WarningOutlined /> {item}
                </Text>
              </List.Item>
            )}
          />
        </div>
      )}

      {comparisonResult.differences.length === 0 && comparisonResult.warnings.length === 0 && !comparisonResult.isIdentical && (
        <Paragraph>Различия не обнаружены, но документы не идентичны (возможно, разница в форматировании).</Paragraph>
      )}
    </Modal>
  )
}

export default XMLComparisonModal






