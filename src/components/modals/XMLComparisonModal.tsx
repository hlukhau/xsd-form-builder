import { Modal, Alert, List, Typography, Button } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, WarningOutlined, SaveOutlined } from '@ant-design/icons'

const { Text, Paragraph } = Typography

export interface ComparisonResultShape {
  isIdentical: boolean
  differences: string[]
  warnings: string[]
  /** Добавленные пользователем значения (отображаются зелёным в разделе «Добавленные данные») */
  added?: string[]
  isNewDocument?: boolean
  filled?: string[]
  unfilled?: string[]
}

interface XMLComparisonModalProps {
  visible: boolean
  comparisonResult: ComparisonResultShape
  onClose: () => void
  /** Если задан, в футере показывается кнопка «Сохранить в БД» (экспорт не отдаётся, а сохраняется). */
  onSaveToDb?: () => void | Promise<void>
  saving?: boolean
}

const XMLComparisonModal: React.FC<XMLComparisonModalProps> = ({
  visible,
  comparisonResult,
  onClose,
  onSaveToDb,
  saving = false,
}) => {
  const isNewDoc = comparisonResult.isNewDocument === true
  const footer = onSaveToDb ? (
    <>
      <Button onClick={onClose}>Закрыть</Button>
      <Button type="primary" icon={<SaveOutlined />} onClick={onSaveToDb} loading={saving}>
        Сохранить в БД
      </Button>
    </>
  ) : null

  return (
    <Modal
      title={onSaveToDb ? 'Проверка перед сохранением' : 'Результат сравнения XML'}
      open={visible}
      onCancel={onClose}
      footer={footer}
      width={800}
    >
      {isNewDoc ? (
        <>
          <Alert
            message="Новая карта"
            description="Проверьте заполненные и незаполненные поля. Для сохранения в БД нажмите «Сохранить в БД»."
            type="info"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginBottom: '16px' }}
          />
          {comparisonResult.filled && comparisonResult.filled.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <Text strong>Заполненные поля:</Text>
              <List
                size="small"
                dataSource={comparisonResult.filled}
                renderItem={(item) => (
                  <List.Item><Text type="success">{item}</Text></List.Item>
                )}
              />
            </div>
          )}
          {comparisonResult.unfilled && comparisonResult.unfilled.length > 0 && (
            <div>
              <Text strong>Незаполненные поля:</Text>
              <List
                size="small"
                dataSource={comparisonResult.unfilled}
                renderItem={(item) => (
                  <List.Item><Text type="secondary">{item}</Text></List.Item>
                )}
              />
            </div>
          )}
        </>
      ) : (
        <>
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

      {(comparisonResult.added?.length ?? 0) > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <Text strong style={{ color: '#52c41a' }}>Добавленные данные:</Text>
          <List
            size="small"
            dataSource={comparisonResult.added}
            renderItem={(item) => (
              <List.Item>
                <Text style={{ color: '#52c41a' }}>
                  <CheckCircleOutlined /> {item}
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

      {comparisonResult.differences.length === 0 && comparisonResult.warnings.length === 0 && (comparisonResult.added?.length ?? 0) === 0 && !comparisonResult.isIdentical && (
        <Paragraph>Различия не обнаружены, но документы не идентичны (возможно, разница в форматировании).</Paragraph>
      )}
        </>
      )}
    </Modal>
  )
}

export default XMLComparisonModal









