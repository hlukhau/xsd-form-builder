import { useState } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Collapse } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ManufacturerDetailsEdit from '../common/ManufacturerDetailsEdit'
import type { TSDData, ProductBatchDetails, ShippingDocument, ProductDetails, SupplyChainPartyDetails } from '@/types/card'

interface TSDTabEditProps {
  data: TSDData
  onChange: (data: TSDData) => void
}

const TSDTabEdit: React.FC<TSDTabEditProps> = ({ data, onChange }) => {
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState<number | null>(null)

  const handleBatchChange = (field: string, value: any) => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const updatedBatch: ProductBatchDetails = {
      ...batch,
      [field]: value,
    }
    onChange({
      ...data,
      batches: [updatedBatch],
    })
  }

  const handleAddDocument = () => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const newDoc: ShippingDocument = {
      docName: '',
      docId: '',
      docCreationDate: '',
      products: [],
      supplyChainParties: [],
    }
    onChange({
      ...data,
      batches: [{
        ...batch,
        shippingDocuments: [...(batch.shippingDocuments || []), newDoc],
      }],
    })
  }

  const handleRemoveDocument = (index: number) => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const updated = [...(batch.shippingDocuments || [])]
    updated.splice(index, 1)
    onChange({
      ...data,
      batches: [{
        ...batch,
        shippingDocuments: updated,
      }],
    })
  }

  const handleDocumentChange = (index: number, field: string, value: any) => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const updated = [...(batch.shippingDocuments || [])]
    updated[index] = {
      ...updated[index],
      [field]: value,
    }
    onChange({
      ...data,
      batches: [{
        ...batch,
        shippingDocuments: updated,
      }],
    })
  }

  const handleAddProduct = (docIndex: number) => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const newProduct: ProductDetails = {
      productId: '',
      productName: '',
    }
    const updated = [...(batch.shippingDocuments || [])]
    updated[docIndex] = {
      ...doc,
      products: [...(doc.products || []), newProduct],
    }
    onChange({
      ...data,
      batches: [{
        ...batch,
        shippingDocuments: updated,
      }],
    })
  }

  const handleAddParty = (docIndex: number) => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const newParty: SupplyChainPartyDetails = {
      country: '',
    }
    const updated = [...(batch.shippingDocuments || [])]
    updated[docIndex] = {
      ...doc,
      supplyChainParties: [...(doc.supplyChainParties || []), newParty],
    }
    onChange({
      ...data,
      batches: [{
        ...batch,
        shippingDocuments: updated,
      }],
    })
  }

  const batch = data.batches[0] || { shippingDocuments: [] }

  const documentColumns = [
    {
      title: 'Вид',
      key: 'docKindName',
      width: 150,
      render: (_: any, record: ShippingDocument, index: number) => (
        <Input
          value={record.docKindName}
          onChange={(e) => handleDocumentChange(index, 'docKindName', e.target.value)}
        />
      ),
    },
    {
      title: 'Номер',
      key: 'docId',
      width: 150,
      render: (_: any, record: ShippingDocument, index: number) => (
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
      render: (_: any, record: ShippingDocument, index: number) => (
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
      render: (_: any, record: ShippingDocument, index: number) => (
        <Space>
          <Button
            type="link"
            onClick={() => setSelectedDocumentIndex(selectedDocumentIndex === index ? null : index)}
          >
            {selectedDocumentIndex === index ? 'Скрыть детали' : 'Детализация'}
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
      <Form layout="vertical">
        <Form.Item label="Номер серии товара">
          <Input
            value={batch.batchId}
            onChange={(e) => handleBatchChange('batchId', e.target.value)}
          />
        </Form.Item>
        <Form.Item label="Дата производства">
          <DatePicker
            value={batch.manufactureDate ? dayjs(batch.manufactureDate) : null}
            onChange={(date) => handleBatchChange('manufactureDate', date ? date.format('YYYY-MM-DD') : '')}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Срок годности">
          <DatePicker
            value={batch.productShelfLifeEndDate ? dayjs(batch.productShelfLifeEndDate) : null}
            onChange={(date) => handleBatchChange('productShelfLifeEndDate', date ? date.format('YYYY-MM-DD') : '')}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Примечание">
          <Input.TextArea
            rows={2}
            value={batch.note}
            onChange={(e) => handleBatchChange('note', e.target.value)}
          />
        </Form.Item>
      </Form>

      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3>Товаросопроводительные документы</h3>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddDocument}
          >
            Добавить документ
          </Button>
        </div>
        <Table
          dataSource={batch.shippingDocuments || []}
          columns={documentColumns}
          rowKey={(record, index) => `doc-${index}`}
          pagination={false}
        />

        {/* Детализация документа */}
        {selectedDocumentIndex !== null && batch.shippingDocuments && batch.shippingDocuments[selectedDocumentIndex] && (
          <div style={{ marginTop: '16px', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
            <h4>Детализация документа: {batch.shippingDocuments[selectedDocumentIndex].docName || batch.shippingDocuments[selectedDocumentIndex].docId}</h4>
            <Collapse
              defaultActiveKey={['products', 'parties']}
              items={[
                {
                  key: 'products',
                  label: 'Продукция',
                  children: (
                    <div>
                      {batch.shippingDocuments[selectedDocumentIndex].products?.map((product, pIndex) => (
                        <div key={pIndex} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                          <Space direction="vertical" style={{ width: '100%' }}>
                            <Input
                              placeholder="Идентификатор"
                              value={product.productId}
                              onChange={(e) => {
                                const updated = [...(batch.shippingDocuments[selectedDocumentIndex].products || [])]
                                updated[pIndex] = { ...updated[pIndex], productId: e.target.value }
                                handleDocumentChange(selectedDocumentIndex, 'products', updated)
                              }}
                            />
                            <Input
                              placeholder="Наименование"
                              value={product.productName}
                              onChange={(e) => {
                                const updated = [...(batch.shippingDocuments[selectedDocumentIndex].products || [])]
                                updated[pIndex] = { ...updated[pIndex], productName: e.target.value }
                                handleDocumentChange(selectedDocumentIndex, 'products', updated)
                              }}
                            />
                            <Button
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => {
                                const updated = [...(batch.shippingDocuments[selectedDocumentIndex].products || [])]
                                updated.splice(pIndex, 1)
                                handleDocumentChange(selectedDocumentIndex, 'products', updated)
                              }}
                            >
                              Удалить продукт
                            </Button>
                          </Space>
                        </div>
                      ))}
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => handleAddProduct(selectedDocumentIndex)}
                        style={{ width: '100%' }}
                      >
                        Добавить продукт
                      </Button>
                    </div>
                  ),
                },
                {
                  key: 'parties',
                  label: 'Участники цепи поставки',
                  children: (
                    <div>
                      {batch.shippingDocuments[selectedDocumentIndex].supplyChainParties?.map((party, pIndex) => (
                        <div key={pIndex} style={{ marginBottom: '16px' }}>
                          <ManufacturerDetailsEdit
                            data={party}
                            onChange={(updatedParty) => {
                              const updated = [...(batch.shippingDocuments[selectedDocumentIndex].supplyChainParties || [])]
                              updated[pIndex] = updatedParty
                              handleDocumentChange(selectedDocumentIndex, 'supplyChainParties', updated)
                            }}
                            title={`Участник ${pIndex + 1}`}
                          />
                          <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={() => {
                              const updated = [...(batch.shippingDocuments[selectedDocumentIndex].supplyChainParties || [])]
                              updated.splice(pIndex, 1)
                              handleDocumentChange(selectedDocumentIndex, 'supplyChainParties', updated)
                            }}
                          >
                            Удалить участника
                          </Button>
                        </div>
                      ))}
                      <Button
                        type="dashed"
                        icon={<PlusOutlined />}
                        onClick={() => handleAddParty(selectedDocumentIndex)}
                        style={{ width: '100%' }}
                      >
                        Добавить участника цепи поставки
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default TSDTabEdit





