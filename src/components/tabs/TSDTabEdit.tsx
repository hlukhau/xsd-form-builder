import { useState, useEffect } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Collapse, Select, Row, Col } from 'antd'
import { PlusOutlined, DeleteOutlined, CaretRightOutlined, CaretDownOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import ManufacturerDetailsEdit from '../common/ManufacturerDetailsEdit'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import type { TSDData, ProductBatchDetails, ShippingDocument, ProductDetails, SupplyChainPartyDetails, MeasureWithUnit, TechnicalDocument } from '@/types/card'
import { useMeasurementUnitOptions } from '@/hooks/useMeasurementUnitOptions'
import { useShipDocKindOptions } from '@/hooks/useShipDocKindOptions'
import { checkShipDocKindExists } from '@/utils/referenceDataApi'

interface TSDTabEditProps {
  data: TSDData
  onChange: (data: TSDData) => void
}

const TSDTabEdit: React.FC<TSDTabEditProps> = ({ data, onChange }) => {
  const batches = data.batches?.length ? data.batches : [{ shippingDocuments: [] as ShippingDocument[] }]
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | null>(null)
  const [selectedDocumentIndex, setSelectedDocumentIndex] = useState<number | null>(null)
  const { options: measurementUnitOptions, loading: loadingMeasurementUnits, getSelectOptions: getMeasurementUnitSelectOptions, getUnitByCode } = useMeasurementUnitOptions()
  const { options: shipDocKindOptions, loading: loadingShipDocKinds, getSelectOptions: getShipDocKindSelectOptions, getNameByCode: getShipDocKindNameByCode } = useShipDocKindOptions()
  const [docKindErrors, setDocKindErrors] = useState<Map<string, boolean>>(new Map())

  const docKindErrorKey = (batchIndex: number, docIndex: number) => `${batchIndex}-${docIndex}`

  useEffect(() => {
    const errors = new Map<string, boolean>()
    batches.forEach((batch, batchIndex) => {
      batch.shippingDocuments?.forEach((doc, docIndex) => {
        if (doc.docKindCode) {
          checkShipDocKindExists(doc.docKindCode)
            .then((exists) => {
              errors.set(docKindErrorKey(batchIndex, docIndex), !exists)
              setDocKindErrors(new Map(errors))
            })
            .catch(() => {
              errors.set(docKindErrorKey(batchIndex, docIndex), false)
              setDocKindErrors(new Map(errors))
            })
        }
      })
    })
  }, [data])

  useEffect(() => {
    if (selectedBatchIndex !== null && selectedDocumentIndex !== null) {
      const batch = batches[selectedBatchIndex]
      if (!batch?.shippingDocuments || selectedDocumentIndex >= batch.shippingDocuments.length) {
        setSelectedDocumentIndex(null)
        setSelectedBatchIndex(null)
      }
    }
  }, [data, selectedBatchIndex, selectedDocumentIndex])

  const updateBatch = (batchIndex: number, updatedBatch: ProductBatchDetails) => {
    const newBatches = [...batches]
    newBatches[batchIndex] = updatedBatch
    onChange({ ...data, batches: newBatches })
  }

  const handleBatchChange = (batchIndex: number, field: string, value: any) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    updateBatch(batchIndex, { ...batch, [field]: value })
  }

  const handleCommodityMeasureChange = (batchIndex: number, value: string, unitCode: string | undefined) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const unit = unitCode ? getUnitByCode(unitCode) : undefined
    const commodityMeasure: MeasureWithUnit = {
      value: value || '',
      unitCode: unitCode,
      unitCodeListId: unitCode ? '1025' : undefined,
      unitName: unit?.name || unit?.briefName,
    }
    updateBatch(batchIndex, {
      ...batch,
      commodityMeasure: value || unitCode ? commodityMeasure : undefined,
    })
  }

  const handleBatchCommodityMeasureChange = (batchIndex: number, value: string, unitCode: string | undefined) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const unit = unitCode ? getUnitByCode(unitCode) : undefined
    const batchCommodityMeasure: MeasureWithUnit = {
      value: value || '',
      unitCode: unitCode,
      unitCodeListId: unitCode ? '1025' : undefined,
      unitName: unit?.name || unit?.briefName,
    }
    updateBatch(batchIndex, {
      ...batch,
      batchCommodityMeasure: value || unitCode ? batchCommodityMeasure : undefined,
    })
  }

  const handleAddDocument = (batchIndex: number) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const newDoc: ShippingDocument = {
      docKindCode: undefined,
      docKindName: undefined,
      docName: '',
      docId: '',
      docCreationDate: '',
      products: [],
      supplyChainParties: [],
    }
    updateBatch(batchIndex, {
      ...batch,
      shippingDocuments: [...(batch.shippingDocuments || []), newDoc],
    })
  }

  const handleRemoveDocument = (batchIndex: number, docIndex: number) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const updated = [...(batch.shippingDocuments || [])]
    updated.splice(docIndex, 1)
    if (selectedBatchIndex === batchIndex && selectedDocumentIndex === docIndex) {
      setSelectedDocumentIndex(null)
      setSelectedBatchIndex(null)
    } else if (selectedBatchIndex === batchIndex && selectedDocumentIndex !== null && selectedDocumentIndex > docIndex) {
      setSelectedDocumentIndex(selectedDocumentIndex - 1)
    }
    updateBatch(batchIndex, { ...batch, shippingDocuments: updated })
  }

  const handleDocumentChange = (batchIndex: number, docIndex: number, field: string, value: any) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const updated = [...(batch.shippingDocuments || [])]
    updated[docIndex] = { ...updated[docIndex], [field]: value }
    if (field === 'docKindCode' && value) {
      updated[docIndex].docKindName = getShipDocKindNameByCode(value) || ''
      const err = new Map(docKindErrors)
      err.set(docKindErrorKey(batchIndex, docIndex), false)
      setDocKindErrors(err)
    }
    updateBatch(batchIndex, { ...batch, shippingDocuments: updated })
  }

  const handleAddProduct = (batchIndex: number, docIndex: number) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const newProduct: ProductDetails = { productId: '', productName: '', tradeNames: [''], technicalDocs: [] }
    const updated = [...(batch.shippingDocuments || [])]
    updated[docIndex] = { ...doc, products: [...(doc.products || []), newProduct] }
    updateBatch(batchIndex, { ...batch, shippingDocuments: updated })
  }

  const updateProduct = (batchIndex: number, docIndex: number, pIndex: number, updatedProduct: ProductDetails) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const products = [...(doc.products || [])]
    products[pIndex] = updatedProduct
    const updated = [...(batch.shippingDocuments || [])]
    updated[docIndex] = { ...doc, products }
    updateBatch(batchIndex, { ...batch, shippingDocuments: updated })
  }

  const handleProductFieldChange = (
    batchIndex: number,
    docIndex: number,
    pIndex: number,
    field: keyof ProductDetails,
    value: string,
  ) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const product = doc.products?.[pIndex]
    if (!product) return
    updateProduct(batchIndex, docIndex, pIndex, { ...product, [field]: value || undefined })
  }

  const handleProductTradeNameChange = (
    batchIndex: number,
    docIndex: number,
    pIndex: number,
    tradeIndex: number,
    value: string,
  ) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const product = doc.products?.[pIndex]
    if (!product) return
    const tradeNames = product.tradeNames?.length
      ? [...product.tradeNames]
      : [product.tradeName || '']
    tradeNames[tradeIndex] = value
    const normalizedTradeNames = tradeNames.some((item) => item.trim()) ? tradeNames : undefined
    updateProduct(batchIndex, docIndex, pIndex, {
      ...product,
      tradeNames: normalizedTradeNames,
      tradeName: normalizedTradeNames?.[0] || undefined,
    })
  }

  const handleAddProductTradeName = (batchIndex: number, docIndex: number, pIndex: number) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const product = doc.products?.[pIndex]
    if (!product) return
    const tradeNames = product.tradeNames?.length
      ? [...product.tradeNames, '']
      : [product.tradeName || '', '']
    updateProduct(batchIndex, docIndex, pIndex, {
      ...product,
      tradeNames,
      tradeName: tradeNames[0] || undefined,
    })
  }

  const handleRemoveProductTradeName = (batchIndex: number, docIndex: number, pIndex: number, tradeIndex: number) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const product = doc.products?.[pIndex]
    if (!product) return
    const tradeNames = product.tradeNames?.length
      ? [...product.tradeNames]
      : [product.tradeName || '']
    tradeNames.splice(tradeIndex, 1)
    const normalizedTradeNames = tradeNames.length > 0 ? tradeNames : undefined
    updateProduct(batchIndex, docIndex, pIndex, {
      ...product,
      tradeNames: normalizedTradeNames,
      tradeName: normalizedTradeNames?.[0] || undefined,
    })
  }

  const renderFieldLabel = (label: string) => (
    <div style={{ marginBottom: 4, fontSize: 12, fontWeight: 500, color: '#595959' }}>
      {label}
    </div>
  )

  const handleAddProductTechnicalDoc = (batchIndex: number, docIndex: number, pIndex: number) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const product = doc.products?.[pIndex]
    if (!product) return
    const newDoc: TechnicalDocument = {
      docKindCode: '',
      docKindName: '',
      docName: '',
      docId: '',
      docCreationDate: '',
      docStartDate: '',
    }
    const technicalDocs = [...(product.technicalDocs || []), newDoc]
    updateProduct(batchIndex, docIndex, pIndex, { ...product, technicalDocs })
  }

  const handleRemoveProductTechnicalDoc = (batchIndex: number, docIndex: number, pIndex: number, tdIndex: number) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const product = doc.products?.[pIndex]
    if (!product) return
    const technicalDocs = [...(product.technicalDocs || [])]
    technicalDocs.splice(tdIndex, 1)
    updateProduct(batchIndex, docIndex, pIndex, { ...product, technicalDocs })
  }

  const handleProductTechnicalDocChange = (batchIndex: number, docIndex: number, pIndex: number, tdIndex: number, field: string, value: string) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const product = doc.products?.[pIndex]
    if (!product) return
    const technicalDocs = [...(product.technicalDocs || [])]
    technicalDocs[tdIndex] = { ...technicalDocs[tdIndex], [field]: value }
    updateProduct(batchIndex, docIndex, pIndex, { ...product, technicalDocs })
  }

  const handleProductTechnicalDocKindSelect = (batchIndex: number, docIndex: number, pIndex: number, tdIndex: number, code: string) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const product = doc.products?.[pIndex]
    if (!product) return
    const name = getShipDocKindNameByCode(code) || ''
    const technicalDocs = [...(product.technicalDocs || [])]
    technicalDocs[tdIndex] = { ...technicalDocs[tdIndex], docKindCode: code, docKindName: name }
    updateProduct(batchIndex, docIndex, pIndex, { ...product, technicalDocs })
  }

  const handleAddParty = (batchIndex: number, docIndex: number) => {
    const batch = batches[batchIndex] || { shippingDocuments: [] }
    const doc = batch.shippingDocuments[docIndex]
    const newParty: SupplyChainPartyDetails = { country: '' }
    const updated = [...(batch.shippingDocuments || [])]
    updated[docIndex] = { ...doc, supplyChainParties: [...(doc.supplyChainParties || []), newParty] }
    updateBatch(batchIndex, { ...batch, shippingDocuments: updated })
  }

  const handleAddBatch = () => {
    const newBatch: ProductBatchDetails = { shippingDocuments: [] }
    onChange({ ...data, batches: [...batches, newBatch] })
  }

  const handleRemoveBatch = (batchIndex: number) => {
    const newBatches = batches.filter((_, i) => i !== batchIndex)
    if (selectedBatchIndex === batchIndex) {
      setSelectedBatchIndex(null)
      setSelectedDocumentIndex(null)
    } else if (selectedBatchIndex !== null && selectedBatchIndex > batchIndex) {
      setSelectedBatchIndex(selectedBatchIndex - 1)
    }
    onChange({ ...data, batches: newBatches.length ? newBatches : [{ shippingDocuments: [] }] })
  }

  const handleDocKindSelect = (batchIndex: number, docIndex: number, code: string) => {
    const err = new Map(docKindErrors)
    err.set(docKindErrorKey(batchIndex, docIndex), false)
    setDocKindErrors(err)
    handleDocumentChange(batchIndex, docIndex, 'docKindCode', code)
  }

  const getDocumentColumns = (batchIndex: number) => [
    {
      title: '',
      key: 'expand',
      width: 40,
      align: 'center' as const,
      render: (_: any, record: ShippingDocument, docIndex: number) => {
        const isExpanded = selectedDocumentIndex === docIndex && selectedBatchIndex === batchIndex
        return isExpanded ? <CaretDownOutlined aria-label="Свернуть" /> : <CaretRightOutlined aria-label="Развернуть" />
      },
    },
    {
      title: labelWithHelp('Код вида документа', FIELD_HELP.tsdDocKindCode),
      key: 'docKindCode',
      width: 120,
      render: (_: any, record: ShippingDocument, docIndex: number) => (
        <Select
          showSearch
          placeholder="Вид"
          loading={loadingShipDocKinds}
          value={record.docKindCode}
          onChange={(code) => handleDocKindSelect(batchIndex, docIndex, code)}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getShipDocKindSelectOptions()}
          allowClear
          status={docKindErrors.get(docKindErrorKey(batchIndex, docIndex)) ? 'error' : undefined}
          style={{ width: '100%', minWidth: 100 }}
          size="small"
        />
      ),
    },
    {
      title: labelWithHelp('Наименование документа', FIELD_HELP.tsdDocName),
      key: 'docName',
      width: 200,
      render: (_: any, record: ShippingDocument, docIndex: number) => (
        <Input
          value={record.docName || ''}
          onChange={(e) => handleDocumentChange(batchIndex, docIndex, 'docName', e.target.value)}
          placeholder="Наименование"
          size="small"
        />
      ),
    },
    {
      title: labelWithHelp('Номер', FIELD_HELP.tsdDocId),
      key: 'docId',
      width: 120,
      render: (_: any, record: ShippingDocument, docIndex: number) => (
        <Input
          value={record.docId || ''}
          onChange={(e) => handleDocumentChange(batchIndex, docIndex, 'docId', e.target.value)}
          placeholder="Номер"
          size="small"
        />
      ),
    },
    {
      title: labelWithHelp('Дата', FIELD_HELP.tsdDocCreationDate),
      key: 'docCreationDate',
      width: 120,
      render: (_: any, record: ShippingDocument, docIndex: number) => (
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={record.docCreationDate ? dayjs(record.docCreationDate) : null}
          onChange={(date) => handleDocumentChange(batchIndex, docIndex, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')}
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
      render: (_: any, record: ShippingDocument, docIndex: number) => (
        <Space>
          <Button
            type="link"
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              if (selectedDocumentIndex === docIndex && selectedBatchIndex === batchIndex) {
                setSelectedDocumentIndex(null)
                setSelectedBatchIndex(null)
              } else {
                setSelectedDocumentIndex(docIndex)
                setSelectedBatchIndex(batchIndex)
              }
            }}
          >
            {selectedDocumentIndex === docIndex && selectedBatchIndex === batchIndex ? 'Скрыть детали' : 'Детализация'}
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              if (selectedBatchIndex === batchIndex && selectedDocumentIndex === docIndex) {
                setSelectedDocumentIndex(null)
                setSelectedBatchIndex(null)
              }
              handleRemoveDocument(batchIndex, docIndex)
            }}
          >
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  const renderDocumentDetailContent = (batchIndex: number, docIndex: number, doc: ShippingDocument) => (
    <div style={{ padding: '16px', background: '#fafafa', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0 }}>
          Детализация документа: {doc.docName || doc.docId || `Документ ${docIndex + 1}`}
        </h4>
        <Button type="link" onClick={() => { setSelectedDocumentIndex(null); setSelectedBatchIndex(null) }}>
          Закрыть
        </Button>
      </div>
      <Collapse
        defaultActiveKey={['products', 'parties']}
        items={[
          {
            key: 'products',
            label: labelWithHelp('Продукция', FIELD_HELP.tsdProducts),
            children: (
              <div>
                {doc.products?.map((product, pIndex) => (
                  <div key={pIndex} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        {renderFieldLabel('Идентификатор')}
                        <Input
                          placeholder="Идентификатор"
                          value={product.productId}
                          onChange={(e) => {
                            const updated = [...(doc.products || [])]
                            updated[pIndex] = { ...updated[pIndex], productId: e.target.value }
                            handleDocumentChange(batchIndex, docIndex, 'products', updated)
                          }}
                        />
                      </div>
                      <div>
                        {renderFieldLabel('Наименование')}
                        <Input
                          placeholder="Наименование"
                          value={product.productName}
                          onChange={(e) => handleProductFieldChange(batchIndex, docIndex, pIndex, 'productName', e.target.value)}
                        />
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 500, color: '#595959' }}>Название продукции</div>
                        {(product.tradeNames?.length ? product.tradeNames : [product.tradeName || '']).map((tradeName, tradeIndex, tradeNames) => (
                          <div key={tradeIndex} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                            <Input
                              placeholder="Название продукции"
                              value={tradeName}
                              onChange={(e) => handleProductTradeNameChange(batchIndex, docIndex, pIndex, tradeIndex, e.target.value)}
                            />
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveProductTradeName(batchIndex, docIndex, pIndex, tradeIndex)}
                              disabled={tradeNames.length === 1}
                            />
                          </div>
                        ))}
                        <Button
                          type="dashed"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => handleAddProductTradeName(batchIndex, docIndex, pIndex)}
                        >
                          Добавить название продукции
                        </Button>
                      </div>
                      <div>
                        {renderFieldLabel('Описание')}
                        <Input.TextArea
                          rows={2}
                          placeholder="Описание"
                          value={product.description || ''}
                          onChange={(e) => handleProductFieldChange(batchIndex, docIndex, pIndex, 'description', e.target.value)}
                        />
                      </div>
                      <div>
                        {renderFieldLabel('Код товара по ТН ВЭД ЕАЭС')}
                        <Input
                          placeholder="Код товара по ТН ВЭД ЕАЭС"
                          value={product.commodityCode || ''}
                          onChange={(e) => handleProductFieldChange(batchIndex, docIndex, pIndex, 'commodityCode', e.target.value)}
                        />
                      </div>
                      <div>
                        {renderFieldLabel('Описание назначения продукции')}
                        <Input.TextArea
                          rows={2}
                          placeholder="Описание назначения продукции"
                          value={product.productPurpose || ''}
                          onChange={(e) => handleProductFieldChange(batchIndex, docIndex, pIndex, 'productPurpose', e.target.value)}
                        />
                      </div>
                      <div>
                        {renderFieldLabel('Описание способа применения продукции')}
                        <Input.TextArea
                          rows={2}
                          placeholder="Описание способа применения продукции"
                          value={product.applicationMethod || ''}
                          onChange={(e) => handleProductFieldChange(batchIndex, docIndex, pIndex, 'applicationMethod', e.target.value)}
                        />
                      </div>
                      <div>
                        {renderFieldLabel('Описание формы выпуска продукции')}
                        <Input.TextArea
                          rows={2}
                          placeholder="Описание формы выпуска продукции"
                          value={product.releaseForm || ''}
                          onChange={(e) => handleProductFieldChange(batchIndex, docIndex, pIndex, 'releaseForm', e.target.value)}
                        />
                      </div>
                      <div>
                        {renderFieldLabel('Описание условий хранения')}
                        <Input.TextArea
                          rows={2}
                          placeholder="Описание условий хранения"
                          value={product.storageCondition || ''}
                          onChange={(e) => handleProductFieldChange(batchIndex, docIndex, pIndex, 'storageCondition', e.target.value)}
                        />
                      </div>
                      <div>
                        {renderFieldLabel('Информация на этикетке')}
                        <Input.TextArea
                          rows={3}
                          placeholder="Информация на этикетке"
                          value={product.labelText || ''}
                          onChange={(e) => handleProductFieldChange(batchIndex, docIndex, pIndex, 'labelText', e.target.value)}
                        />
                      </div>
                      <div style={{ marginTop: 8 }}>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>Техническая документация</div>
                        {(product.technicalDocs || []).map((td, tdIndex) => (
                          <div key={tdIndex} style={{ marginBottom: 12, padding: 8, border: '1px solid #f0f0f0', borderRadius: 4 }}>
                            <Space direction="vertical" style={{ width: '100%' }} size="small">
                              <Select
                                showSearch
                                placeholder="Вид документа (SHIPDOCKIND)"
                                loading={loadingShipDocKinds}
                                value={td.docKindCode || undefined}
                                onChange={(code) => handleProductTechnicalDocKindSelect(batchIndex, docIndex, pIndex, tdIndex, code ?? '')}
                                onClear={() => handleProductTechnicalDocKindSelect(batchIndex, docIndex, pIndex, tdIndex, '')}
                                filterOption={(input, option) =>
                                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                options={getShipDocKindSelectOptions()}
                                allowClear
                                style={{ width: '100%', minWidth: 200 }}
                                size="small"
                              />
                              <Input
                                placeholder="Наименование документа"
                                value={td.docName}
                                onChange={(e) => handleProductTechnicalDocChange(batchIndex, docIndex, pIndex, tdIndex, 'docName', e.target.value)}
                                size="small"
                              />
                              <Input
                                placeholder="Номер документа"
                                value={td.docId}
                                onChange={(e) => handleProductTechnicalDocChange(batchIndex, docIndex, pIndex, tdIndex, 'docId', e.target.value)}
                                size="small"
                              />
                              <Space wrap>
                                <DatePicker
                                  format={DATE_DISPLAY_FORMAT}
                                  placeholder="Дата документа"
                                  value={td.docCreationDate ? dayjs(td.docCreationDate) : null}
                                  onChange={(date) => handleProductTechnicalDocChange(batchIndex, docIndex, pIndex, tdIndex, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')}
                                  size="small"
                                />
                                <DatePicker
                                  format={DATE_DISPLAY_FORMAT}
                                  placeholder="Действует с"
                                  value={td.docStartDate ? dayjs(td.docStartDate) : null}
                                  onChange={(date) => handleProductTechnicalDocChange(batchIndex, docIndex, pIndex, tdIndex, 'docStartDate', date ? date.format('YYYY-MM-DD') : '')}
                                  size="small"
                                />
                              </Space>
                              <Button
                                type="link"
                                danger
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveProductTechnicalDoc(batchIndex, docIndex, pIndex, tdIndex)}
                              >
                                Удалить документ
                              </Button>
                            </Space>
                          </div>
                        ))}
                        <Button
                          type="dashed"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => handleAddProductTechnicalDoc(batchIndex, docIndex, pIndex)}
                        >
                          Добавить технический документ
                        </Button>
                      </div>
                      <Button
                        type="link"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => {
                          const updated = [...(doc.products || [])]
                          updated.splice(pIndex, 1)
                          handleDocumentChange(batchIndex, docIndex, 'products', updated)
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
                  onClick={() => handleAddProduct(batchIndex, docIndex)}
                  style={{ width: '100%' }}
                >
                  Добавить продукт
                </Button>
              </div>
            ),
          },
          {
            key: 'parties',
            label: labelWithHelp('Участник цепи поставки', FIELD_HELP.tsdSupplyChainParty),
            children: (
              <div>
                {doc.supplyChainParties?.map((party, pIndex) => (
                  <div key={pIndex} style={{ marginBottom: '16px' }}>
                    <ManufacturerDetailsEdit
                      data={party}
                      onChange={(updatedParty) => {
                        const updated = [...(doc.supplyChainParties || [])]
                        updated[pIndex] = updatedParty
                        handleDocumentChange(batchIndex, docIndex, 'supplyChainParties', updated)
                      }}
                      title={`Участник ${pIndex + 1}`}
                    />
                    <Button
                      type="link"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => {
                        const updated = [...(doc.supplyChainParties || [])]
                        updated.splice(pIndex, 1)
                        handleDocumentChange(batchIndex, docIndex, 'supplyChainParties', updated)
                      }}
                    >
                      Удалить участника
                    </Button>
                  </div>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => handleAddParty(batchIndex, docIndex)}
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
  )

  const renderBatchPanel = (batch: ProductBatchDetails, batchIndex: number) => {
    const docs = batch.shippingDocuments || []

    return (
      <div key={batchIndex}>
        <Form layout="vertical">
          <Form.Item label={labelWithHelp('Номер серии товара', FIELD_HELP.batchId)}>
            <Input
              value={batch.batchId}
              onChange={(e) => handleBatchChange(batchIndex, 'batchId', e.target.value)}
            />
          </Form.Item>
          <Form.Item label={labelWithHelp('Дата производства', FIELD_HELP.manufactureDate)}>
            <DatePicker
              format={DATE_DISPLAY_FORMAT}
              value={batch.manufactureDate ? dayjs(batch.manufactureDate) : null}
              onChange={(date) => handleBatchChange(batchIndex, 'manufactureDate', date ? date.format('YYYY-MM-DD') : '')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label={labelWithHelp('Срок годности', FIELD_HELP.productShelfLifeEndDate)}>
            <DatePicker
              format={DATE_DISPLAY_FORMAT}
              value={batch.productShelfLifeEndDate ? dayjs(batch.productShelfLifeEndDate) : null}
              onChange={(date) => handleBatchChange(batchIndex, 'productShelfLifeEndDate', date ? date.format('YYYY-MM-DD') : '')}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item label={labelWithHelp('Примечание', FIELD_HELP.note)}>
            <Input.TextArea
              rows={2}
              value={batch.note}
              onChange={(e) => handleBatchChange(batchIndex, 'note', e.target.value)}
            />
          </Form.Item>
          <Form.Item label={labelWithHelp('Количество товара', FIELD_HELP.commodityMeasure)}>
            <Row gutter={8}>
              <Col span={16}>
                <Input
                  placeholder="Значение"
                  value={batch.commodityMeasure?.value || ''}
                  onChange={(e) => handleCommodityMeasureChange(batchIndex, e.target.value, batch.commodityMeasure?.unitCode)}
                />
              </Col>
              <Col span={8}>
                <Select
                  placeholder="Единица измерения"
                  loading={loadingMeasurementUnits}
                  value={batch.commodityMeasure?.unitCode}
                  onChange={(code) => handleCommodityMeasureChange(batchIndex, batch.commodityMeasure?.value || '', code)}
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
          <Form.Item label={labelWithHelp('Номер товарной партии', FIELD_HELP.consignmentId)}>
            <Input
              value={batch.consignmentId}
              onChange={(e) => handleBatchChange(batchIndex, 'consignmentId', e.target.value)}
            />
          </Form.Item>
          <Form.Item label={labelWithHelp('Количество товара в партии', FIELD_HELP.batchCommodityMeasure)}>
            <Row gutter={8}>
              <Col span={16}>
                <Input
                  placeholder="Значение"
                  value={batch.batchCommodityMeasure?.value || ''}
                  onChange={(e) => handleBatchCommodityMeasureChange(batchIndex, e.target.value, batch.batchCommodityMeasure?.unitCode)}
                />
              </Col>
              <Col span={8}>
                <Select
                  placeholder="Единица измерения"
                  loading={loadingMeasurementUnits}
                  value={batch.batchCommodityMeasure?.unitCode}
                  onChange={(code) => handleBatchCommodityMeasureChange(batchIndex, batch.batchCommodityMeasure?.value || '', code)}
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
            <Space>
              <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddDocument(batchIndex)}>
                Добавить документ
              </Button>
              {batches.length > 1 && (
                <Button type="link" danger onClick={() => handleRemoveBatch(batchIndex)}>
                  Удалить партию
                </Button>
              )}
            </Space>
          </div>
          <Table
            dataSource={docs}
            columns={getDocumentColumns(batchIndex)}
            rowKey={(record, index) => `batch-${batchIndex}-doc-${index}`}
            pagination={false}
            scroll={{ x: 'max-content' }}
            onRow={(record, docIndex) => ({
              onClick: () => {
                if (selectedDocumentIndex === docIndex && selectedBatchIndex === batchIndex) {
                  setSelectedDocumentIndex(null)
                  setSelectedBatchIndex(null)
                } else {
                  setSelectedDocumentIndex(docIndex ?? null)
                  setSelectedBatchIndex(batchIndex)
                }
              },
              style: { cursor: 'pointer' },
            })}
            rowClassName={(record, docIndex) =>
              selectedBatchIndex === batchIndex && selectedDocumentIndex === docIndex ? 'ant-table-row-selected' : ''
            }
            expandable={{
              expandedRowKeys:
                selectedBatchIndex === batchIndex && selectedDocumentIndex !== null
                  ? [`batch-${batchIndex}-doc-${selectedDocumentIndex}`]
                  : [],
              expandedRowRender: (record) => renderDocumentDetailContent(batchIndex, docs.indexOf(record), record),
              expandIcon: () => null,
              expandIconColumnIndex: -1,
            }}
          />
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Сведения о серии или партии продукции</h3>
        <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddBatch}>
          Добавить партию
        </Button>
      </div>
      <Collapse
        accordion={false}
        items={batches.map((batch, batchIndex) => ({
          key: String(batchIndex),
          label: `Партия ${batchIndex + 1}${batch.batchId ? ` — № ${batch.batchId}` : ''}${batch.manufactureDate ? ` (производство: ${format(new Date(batch.manufactureDate), 'dd.MM.yyyy', { locale: ru })})` : ''} (документов: ${(batch.shippingDocuments?.length ?? 0)})`,
          children: renderBatchPanel(batch, batchIndex),
        }))}
      />
    </div>
  )
}

export default TSDTabEdit







