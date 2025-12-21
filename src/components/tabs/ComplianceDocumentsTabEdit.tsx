import { useState } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Modal, Descriptions } from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ComplianceDocumentsData, ComplianceDocument, UnifiedAuthorityDetails } from '@/types/card'

interface ComplianceDocumentsTabEditProps {
  data: ComplianceDocumentsData
  onChange: (data: ComplianceDocumentsData) => void
}

const ComplianceDocumentsTabEdit: React.FC<ComplianceDocumentsTabEditProps> = ({ data, onChange }) => {
  const [selectedDocIndex, setSelectedDocIndex] = useState<number | null>(null)
  const [authorityModalVisible, setAuthorityModalVisible] = useState(false)

  const handleAddDocument = () => {
    const newDoc: ComplianceDocument = {
      docKindCode: '',
      docName: '',
      docId: '',
      docCreationDate: '',
      docStartDate: '',
    }
    onChange({
      ...data,
      documents: [...(data.documents || []), newDoc],
    })
  }

  const handleRemoveDocument = (index: number) => {
    const updated = [...(data.documents || [])]
    updated.splice(index, 1)
    onChange({
      ...data,
      documents: updated,
    })
  }

  const handleDocumentChange = (index: number, field: string, value: any) => {
    const updated = [...(data.documents || [])]
    updated[index] = {
      ...updated[index],
      [field]: value,
    }
    onChange({
      ...data,
      documents: updated,
    })
  }

  const handleAuthorityChange = (index: number, field: string, value: string) => {
    const updated = [...(data.documents || [])]
    updated[index] = {
      ...updated[index],
      authority: {
        ...updated[index].authority,
        [field]: value,
      },
    }
    onChange({
      ...data,
      documents: updated,
    })
  }

  const columns = [
    {
      title: 'Вид',
      key: 'docKindCode',
      width: 150,
      render: (_: any, record: ComplianceDocument, index: number) => (
        <Input
          value={record.docKindCode}
          onChange={(e) => handleDocumentChange(index, 'docKindCode', e.target.value)}
        />
      ),
    },
    {
      title: 'Наименование',
      key: 'docName',
      width: 200,
      render: (_: any, record: ComplianceDocument, index: number) => (
        <Input
          value={record.docName}
          onChange={(e) => handleDocumentChange(index, 'docName', e.target.value)}
        />
      ),
    },
    {
      title: 'Номер',
      key: 'docId',
      width: 150,
      render: (_: any, record: ComplianceDocument, index: number) => (
        <Input
          value={record.docId}
          onChange={(e) => handleDocumentChange(index, 'docId', e.target.value)}
        />
      ),
    },
    {
      title: 'Дата',
      key: 'docCreationDate',
      width: 150,
      render: (_: any, record: ComplianceDocument, index: number) => (
        <DatePicker
          value={record.docCreationDate ? dayjs(record.docCreationDate) : null}
          onChange={(date) => handleDocumentChange(index, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_: any, record: ComplianceDocument, index: number) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedDocIndex(index)
              setAuthorityModalVisible(true)
            }}
          >
            Уполномоченный орган
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveDocument(index)}
          >
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3>Документы соответствия</h3>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddDocument}
        >
          Добавить документ
        </Button>
      </div>
      <Table
        dataSource={data.documents || []}
        columns={columns}
        rowKey={(record, index) => `doc-${index}`}
        pagination={false}
      />

      {/* Модальное окно редактирования уполномоченного органа */}
      <Modal
        title="Уполномоченный орган"
        open={authorityModalVisible}
        onCancel={() => {
          setAuthorityModalVisible(false)
          setSelectedDocIndex(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setAuthorityModalVisible(false)
            setSelectedDocIndex(null)
          }}>
            Закрыть
          </Button>,
        ]}
        width={600}
      >
        {selectedDocIndex !== null && data.documents[selectedDocIndex] && (
          <Form layout="vertical">
            <Form.Item label="Страна">
              <Input
                value={data.documents[selectedDocIndex].authority?.country}
                onChange={(e) => handleAuthorityChange(selectedDocIndex, 'country', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="Наименование">
              <Input
                value={data.documents[selectedDocIndex].authority?.authorityName}
                onChange={(e) => handleAuthorityChange(selectedDocIndex, 'authorityName', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="Краткое наименование">
              <Input
                value={data.documents[selectedDocIndex].authority?.authorityBriefName}
                onChange={(e) => handleAuthorityChange(selectedDocIndex, 'authorityBriefName', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="Идентификатор">
              <Input
                value={data.documents[selectedDocIndex].authority?.authorityId}
                onChange={(e) => handleAuthorityChange(selectedDocIndex, 'authorityId', e.target.value)}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  )
}

export default ComplianceDocumentsTabEdit

