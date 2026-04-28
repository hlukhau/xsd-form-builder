import { Modal, List, Typography } from 'antd'
import type { ValidationResult } from '@/utils/cardValidation'
import { sanitizeValidationMessageForDisplay } from '@/utils/schemaValidationApi'

export interface ValidationResultModalProps {
  visible: boolean
  result: ValidationResult | null
  onClose: () => void
}

const ValidationResultModal: React.FC<ValidationResultModalProps> = ({
  visible,
  result,
  onClose,
}) => {
  const success = result?.success ?? false
  const sections = result?.sections ?? []

  return (
    <Modal
      title="Результат валидации карты"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={560}
      destroyOnClose
    >
      {result == null ? null : (
        <>
          {success ? (
            <Typography.Paragraph style={{ marginBottom: sections.length > 0 ? 12 : 0 }}>
              Все контроли пройдены.
            </Typography.Paragraph>
          ) : null}
          {sections.length > 0 ? (
            <List
              dataSource={sections}
              renderItem={({ sectionName, remarks }) => (
                <List.Item key={sectionName}>
                  <div>
                    <Typography.Text strong>{sectionName}</Typography.Text>
                    <List
                      size="small"
                      dataSource={remarks}
                      renderItem={(remark, idx) => (
                        <List.Item key={idx} style={{ border: 'none', padding: '2px 0' }}>
                          <Typography.Text type="secondary">• </Typography.Text>
                          {sanitizeValidationMessageForDisplay(remark)}
                        </List.Item>
                      )}
                    />
                  </div>
                </List.Item>
              )}
            />
          ) : null}
        </>
      )}
    </Modal>
  )
}

export default ValidationResultModal
