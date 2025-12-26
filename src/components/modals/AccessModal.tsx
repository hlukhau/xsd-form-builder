import { useState } from 'react'
import { Modal, List, Button, Input, Space, Popconfirm } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { AccessItem } from '@/types/card'

interface AccessModalProps {
  visible: boolean
  data: AccessItem[]
  onClose: () => void
  onUpdate: (accessList: AccessItem[]) => void
}

const AccessModal: React.FC<AccessModalProps> = ({
  visible,
  data,
  onClose,
  onUpdate,
}) => {
  const [accessList, setAccessList] = useState<AccessItem[]>(data)
  const [searchText, setSearchText] = useState('')
  const [newItemName, setNewItemName] = useState('')

  const filteredList = accessList.filter((item) =>
    item.name.toLowerCase().includes(searchText.toLowerCase())
  )

  const handleAdd = () => {
    if (newItemName.trim()) {
      const newItem: AccessItem = {
        id: Date.now().toString(),
        name: newItemName.trim(),
      }
      setAccessList([...accessList, newItem])
      setNewItemName('')
    }
  }

  const handleDelete = (id: string) => {
    // Нельзя удалять РЦГЭ и ОЗ (проверка по имени)
    const item = accessList.find((i) => i.id === id)
    if (item && !item.name.includes('РЦГЭ') && !item.name.includes('ОЗ')) {
      setAccessList(accessList.filter((item) => item.id !== id))
    }
  }

  const handleSave = () => {
    onUpdate(accessList)
    onClose()
  }

  return (
    <Modal
      title="Доступ"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Закрыть
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          Сохранить
        </Button>,
      ]}
      width={600}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Input.Search
          placeholder="поиск по наименованию"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />

        <Space>
          <Input
            placeholder="Наименование ЦГЭ"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onPressEnter={handleAdd}
            style={{ width: 300 }}
          />
          <Button icon={<PlusOutlined />} onClick={handleAdd}>
            Добавить
          </Button>
        </Space>

        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
            Уполномоченный орган:
          </div>
          <List
            dataSource={filteredList}
            renderItem={(item) => (
              <List.Item
                actions={[
                  !item.name.includes('РЦГЭ') && !item.name.includes('ОЗ') ? (
                    <Popconfirm
                      title="Удалить из списка?"
                      onConfirm={() => handleDelete(item.id)}
                    >
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        size="small"
                      >
                        Удалить
                      </Button>
                    </Popconfirm>
                  ) : null,
                ].filter(Boolean)}
              >
                {item.name}
                {item.name === 'Полоцкий зональный ЦГЭ' && (
                  <span style={{ color: 'red', marginLeft: '8px' }}>*</span>
                )}
              </List.Item>
            )}
          />
        </div>
      </Space>
    </Modal>
  )
}

export default AccessModal



