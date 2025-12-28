import { useState, useEffect } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Collapse, Select, Row, Col } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ManufacturerDetailsEdit from '../common/ManufacturerDetailsEdit'
import type { TSDData, ProductBatchDetails, ShippingDocument, ProductDetails, SupplyChainPartyDetails, MeasureWithUnit } from '@/types/card'
import { useMeasurementUnitOptions } from '@/hooks/useMeasurementUnitOptions'
import { useShipDocKindOptions } from '@/hooks/useShipDocKindOptions'
import { checkShipDocKindExists } from '@/utils/referenceDataApi'

interface TSDTabEditProps {
  data: TSDData
  onChange: (data: TSDData) => void
}

const TSDTabEdit: React.FC<TSDTabEditProps> = ({ data, onChange }) => {
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState<number | null>(null)
  const { options: measurementUnitOptions, loading: loadingMeasurementUnits, getSelectOptions: getMeasurementUnitSelectOptions, getUnitByCode } = useMeasurementUnitOptions()
  const { options: shipDocKindOptions, loading: loadingShipDocKinds, getSelectOptions: getShipDocKindSelectOptions, getNameByCode: getShipDocKindNameByCode } = useShipDocKindOptions()
  const [docKindErrors, setDocKindErrors] = useState<Map<number, boolean>>(new Map())

  // Проверяем валидность кодов видов документов при загрузке
  useEffect(() => {
    const batch = data.batches[0]
    if (batch?.shippingDocuments) {
      const errors = new Map<number, boolean>()
      batch.shippingDocuments.forEach((doc, index) => {
        if (doc.docKindCode) {
          checkShipDocKindExists(doc.docKindCode)
            .then((exists) => {
              errors.set(index, !exists)
              setDocKindErrors(new Map(errors))
            })
            .catch(() => {
              errors.set(index, false)
              setDocKindErrors(new Map(errors))
            })
        } else {
          errors.set(index, false)
          setDocKindErrors(new Map(errors))
        }
      })
    }
  }, [data])

  // Проверяем валидность selectedDocumentIndex при изменении данных
  useEffect(() => {
    const batch = data.batches[0]
    if (selectedDocumentIndex !== null && batch?.shippingDocuments) {
      if (selectedDocumentIndex >= batch.shippingDocuments.length) {
        // Индекс стал невалидным, сбрасываем выбор
        setSelectedDocumentIndex(null)
      }
    }
  }, [data, selectedDocumentIndex])

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

  // Обработчик изменения количества товара
  const handleCommodityMeasureChange = (value: string, unitCode: string | undefined) => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const unit = unitCode ? getUnitByCode(unitCode) : undefined
    const commodityMeasure: MeasureWithUnit = {
      value: value || '',
      unitCode: unitCode,
      unitCodeListId: unitCode ? '1025' : undefined, // Идентификатор справочника единиц измерения
      unitName: unit?.name || unit?.briefName,
    }
    onChange({
      ...data,
      batches: [{
        ...batch,
        commodityMeasure: value || unitCode ? commodityMeasure : undefined,
      }],
    })
  }

  // Обработчик изменения количества товара в партии
  const handleBatchCommodityMeasureChange = (value: string, unitCode: string | undefined) => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const unit = unitCode ? getUnitByCode(unitCode) : undefined
    const batchCommodityMeasure: MeasureWithUnit = {
      value: value || '',
      unitCode: unitCode,
      unitCodeListId: unitCode ? '1025' : undefined, // Идентификатор справочника единиц измерения
      unitName: unit?.name || unit?.briefName,
    }
    onChange({
      ...data,
      batches: [{
        ...batch,
        batchCommodityMeasure: value || unitCode ? batchCommodityMeasure : undefined,
      }],
    })
  }

  const handleAddDocument = () => {
    const batch = data.batches[0] || { shippingDocuments: [] }
    const newDoc: ShippingDocument = {
      docKindCode: undefined,
      docKindName: undefined,
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
    
    // Если удаляем выбранный документ, сбрасываем выбор
    if (selectedDocumentIndex === index) {
      setSelectedDocumentIndex(null)
    } else if (selectedDocumentIndex !== null && selectedDocumentIndex > index) {
      // Если удаляем документ перед выбранным, уменьшаем индекс
      setSelectedDocumentIndex(selectedDocumentIndex - 1)
    }
    
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
    // Если изменяется docKindCode, обновляем docKindName из справочника
    if (field === 'docKindCode' && value) {
      const docKindName = getShipDocKindNameByCode(value) || ''
      updated[index].docKindName = docKindName
      const errors = new Map(docKindErrors)
      errors.set(index, false)
      setDocKindErrors(errors)
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

  // Обработчик выбора вида документа
  const handleDocKindSelect = (index: number, code: string) => {
    const errors = new Map(docKindErrors)
    errors.set(index, false) // Сбрасываем ошибку при выборе из справочника
    setDocKindErrors(errors)
    // handleDocumentChange автоматически обновит docKindName
    handleDocumentChange(index, 'docKindCode', code)
  }

  const documentColumns = [
    {
      title: 'Вид',
      key: 'docKindCode',
      width: 120,
      render: (_: any, record: ShippingDocument, index: number) => (
        <Select
          showSearch
          placeholder="Вид"
          loading={loadingShipDocKinds}
          value={record.docKindCode}
          onChange={(code) => handleDocKindSelect(index, code)}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getShipDocKindSelectOptions()}
          allowClear
          status={docKindErrors.get(index) ? 'error' : undefined}
          style={{ width: '100%', minWidth: 100 }}
          size="small"
        />
      ),
    },
    {
      title: 'Наименование',
      key: 'docName',
      width: 200,
      render: (_: any, record: ShippingDocument, index: number) => (
        <Input
          value={record.docName || ''}
          onChange={(e) => handleDocumentChange(index, 'docName', e.target.value)}
          placeholder="Наименование"
          size="small"
        />
      ),
    },
    {
      title: 'Номер',
      key: 'docId',
      width: 120,
      render: (_: any, record: ShippingDocument, index: number) => (
        <Input
          value={record.docId || ''}
          onChange={(e) => handleDocumentChange(index, 'docId', e.target.value)}
          placeholder="Номер"
          size="small"
        />
      ),
    },
    {
      title: 'Дата',
      key: 'docCreationDate',
      width: 120,
      render: (_: any, record: ShippingDocument, index: number) => (
        <DatePicker
          value={record.docCreationDate ? dayjs(record.docCreationDate) : null}
          onChange={(date) => handleDocumentChange(index, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
          size="small"
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: ShippingDocument, index: number) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              console.log('Детализация кликнута, индекс:', index, 'текущий выбранный:', selectedDocumentIndex)
              if (selectedDocumentIndex === index) {
                setSelectedDocumentIndex(null)
              } else {
                setSelectedDocumentIndex(index)
              }
            }}
          >
            {selectedDocumentIndex === index ? 'Скрыть детали' : 'Детализация'}
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              if (selectedDocumentIndex === index) {
                setSelectedDocumentIndex(null)
              }
              handleRemoveDocument(index)
            }}
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
        
        <Form.Item label="Количество товара">
          <Row gutter={8}>
            <Col span={16}>
              <Input
                placeholder="Значение"
                value={batch.commodityMeasure?.value || ''}
                onChange={(e) => handleCommodityMeasureChange(e.target.value, batch.commodityMeasure?.unitCode)}
              />
            </Col>
            <Col span={8}>
              <Select
                placeholder="Единица измерения"
                loading={loadingMeasurementUnits}
                value={batch.commodityMeasure?.unitCode}
                onChange={(code) => handleCommodityMeasureChange(batch.commodityMeasure?.value || '', code)}
                options={getMeasurementUnitSelectOptions()}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Col>
          </Row>
        </Form.Item>
        
        <Form.Item label="Номер товарной партии">
          <Input
            value={batch.consignmentId}
            onChange={(e) => handleBatchChange('consignmentId', e.target.value)}
          />
        </Form.Item>
        
        <Form.Item label="Количество товара в партии">
          <Row gutter={8}>
            <Col span={16}>
              <Input
                placeholder="Значение"
                value={batch.batchCommodityMeasure?.value || ''}
                onChange={(e) => handleBatchCommodityMeasureChange(e.target.value, batch.batchCommodityMeasure?.unitCode)}
              />
            </Col>
            <Col span={8}>
              <Select
                placeholder="Единица измерения"
                loading={loadingMeasurementUnits}
                value={batch.batchCommodityMeasure?.unitCode}
                onChange={(code) => handleBatchCommodityMeasureChange(batch.batchCommodityMeasure?.value || '', code)}
                options={getMeasurementUnitSelectOptions()}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Col>
          </Row>
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
          scroll={{ x: 'max-content' }}
          onRow={(record, index) => ({
            onClick: () => {
              // При клике на строку открываем/закрываем детализацию
              if (selectedDocumentIndex === index) {
                setSelectedDocumentIndex(null)
              } else {
                setSelectedDocumentIndex(index ?? null)
              }
            },
            style: { cursor: 'pointer' },
          })}
        />

        {/* Детализация документа */}
        {selectedDocumentIndex !== null && batch.shippingDocuments && batch.shippingDocuments[selectedDocumentIndex] && (
          <div style={{ marginTop: '16px', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 style={{ margin: 0 }}>
                Детализация документа: {batch.shippingDocuments[selectedDocumentIndex].docName || batch.shippingDocuments[selectedDocumentIndex].docId || `Документ ${selectedDocumentIndex + 1}`}
              </h4>
              <Button
                type="link"
                onClick={() => setSelectedDocumentIndex(null)}
              >
                Закрыть
              </Button>
            </div>
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







