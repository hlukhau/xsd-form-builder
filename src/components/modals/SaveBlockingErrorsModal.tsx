import { Modal, List, Typography, Button } from 'antd'
import { CloseCircleOutlined } from '@ant-design/icons'

const { Text } = Typography

interface SaveBlockingErrorsModalProps {
  visible: boolean
  errors: string[]
  onClose: () => void
}

/** Замечания, блокирующие сохранение в БД — только список ошибок и кнопка «Закрыть». */
const SaveBlockingErrorsModal: React.FC<SaveBlockingErrorsModalProps> = ({ visible, errors, onClose }) => (
  <Modal
    title="Сохранение невозможно"
    open={visible}
    onCancel={onClose}
    footer={[<Button key="close" onClick={onClose}>Закрыть</Button>]}
    width={720}
    destroyOnClose
  >
    <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
      Исправьте указанные замечания и повторите сохранение.
    </Text>
    <List
      size="small"
      dataSource={errors}
      renderItem={(item) => (
        <List.Item>
          <Text type="danger">
            <CloseCircleOutlined /> {item}
          </Text>
        </List.Item>
      )}
    />
  </Modal>
)

export default SaveBlockingErrorsModal
