import { useState } from 'react'
import { Descriptions, Table, Collapse, Button, Modal } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import ProductTab from './ProductTab'
import type { TSDData, ProductBatchDetails, ShippingDocument, ProductDetails, SupplyChainPartyDetails } from '@/types/card'
import {
  getAddressListFromParty,
  formatAddressList,
  getDefaultAddressKindName,
} from '@/utils/addressFormatUtils'
import { useIdentificationMethodOptions } from '@/hooks/useIdentificationMethodOptions'
import { useMeasurementUnitOptions } from '@/hooks/useMeasurementUnitOptions'
import { useShipDocKindOptions } from '@/hooks/useShipDocKindOptions'
import { useCountryOptions } from '@/hooks/useCountryOptions'

interface TSDTabProps {
  data: TSDData
}

const TSDTab: React.FC<TSDTabProps> = ({ data }) => {
  const [selectedBatchIndex, setSelectedBatchIndex] = useState<number | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<ShippingDocument | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductDetails | null>(null)
  const [selectedParty, setSelectedParty] = useState<SupplyChainPartyDetails | null>(null)
  const [productModalVisible, setProductModalVisible] = useState(false)
  const [partyModalVisible, setPartyModalVisible] = useState(false)
  const { getDisplayLabel: getIdentificationMethodDisplayLabel } = useIdentificationMethodOptions(selectedParty?.country ?? '')
  const { getDisplayLabel: getMeasurementUnitDisplayLabel } = useMeasurementUnitOptions()
  const { getDisplayLabel: getShipDocKindDisplayLabel, getNameByCode: getShipDocKindNameByCode } = useShipDocKindOptions()

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const formatMeasure = (measure?: { value: string; unitCode?: string; unitName?: string }) => {
    if (!measure || !measure.value) return '-'
    const unit = measure.unitCode
      ? getMeasurementUnitDisplayLabel(measure.unitCode) || measure.unitName || measure.unitCode
      : (measure.unitName || measure.unitCode || '')
    return `${measure.value} ${unit}`.trim()
  }

  const getSupplyChainPartyKindName = (code?: string): string => {
    // В реальном приложении здесь обращение к справочнику
    const kindMap: Record<string, string> = {
      '41': 'Изготовитель',
      '42': 'Грузоотправитель',
      '43': 'Грузополучатель',
      '44': 'Импортер',
      '45': 'Экспортер',
    }
    return code ? (kindMap[code] || `Вид участника (код: ${code})`) : '-'
  }

  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()

  if (!data || !data.batches || data.batches.length === 0) {
    return <div>Данные о партиях продукции не найдены</div>
  }

  const batches = data.batches

  const shippingDocsColumns = [
    {
      title: 'Вид',
      dataIndex: 'docKindName',
      key: 'docKindName',
      render: (_: string, record: ShippingDocument) => {
        if (record.docKindCode) {
          const fromRef = getShipDocKindDisplayLabel(record.docKindCode)
          return fromRef || record.docName || '-'
        }
        return record.docName || '-'
      },
    },
    {
      title: 'Номер',
      dataIndex: 'docId',
      key: 'docId',
    },
    {
      title: 'Дата',
      dataIndex: 'docCreationDate',
      key: 'docCreationDate',
      render: (date: string) => formatDate(date),
    },
  ]

  const renderDocumentDetailBlock = (doc: ShippingDocument) => (
    <div style={{ marginTop: '16px', padding: 12, background: '#fafafa', borderRadius: 8 }}>
      <h3>
        Детализация документа: {doc.docName || 'Документ'}
        {doc.docId && ` (№ ${doc.docId})`}
      </h3>
      <Collapse
        items={[
          {
            key: 'products',
            label: 'Продукция',
            children: doc.products && doc.products.length > 0 ? (
              <Table
                dataSource={doc.products}
                columns={[
                  { title: 'Идентификатор', dataIndex: 'productId', key: 'productId', render: (t: string) => t || '<штрихкод>' },
                  { title: 'Код ТН ВЭД ЕАЭС', dataIndex: 'commodityCode', key: 'commodityCode' },
                  { title: 'Наименование', dataIndex: 'productName', key: 'productName' },
                  {
                    title: 'Действия',
                    key: 'actions',
                    render: (_: unknown, record: ProductDetails) => (
                      <Button type="link" onClick={() => { setSelectedProduct(record); setProductModalVisible(true) }}>Подробнее</Button>
                    ),
                  },
                ]}
                rowKey={(_, i) => String(i)}
                pagination={false}
                size="small"
              />
            ) : (
              <div>Продукция не указана</div>
            ),
          },
          {
            key: 'parties',
            label: 'Участники цепи поставки',
            children: doc.supplyChainParties && doc.supplyChainParties.length > 0 ? (
              <Table
                dataSource={doc.supplyChainParties}
                columns={[
                  { title: 'Вид', key: 'kind', render: (_: unknown, r: SupplyChainPartyDetails) => getSupplyChainPartyKindName(r.supplyChainPartyKindCode) || '-' },
                  { title: 'Страна', dataIndex: 'country', key: 'country', render: (c: string) => getCountryDisplayLabel(c) },
                  { title: 'Наименование', dataIndex: 'businessEntityName', key: 'businessEntityName', render: (t: string) => t || '-' },
                  {
                    title: 'Адреса',
                    key: 'addresses',
                    render: (_: unknown, record: SupplyChainPartyDetails) => {
                      const list = getAddressListFromParty(record)
                      const lines = formatAddressList(list, getDefaultAddressKindName, getCountryDisplayLabel)
                      return lines.length > 0 ? (
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px' }}>
                          {lines.map((line, idx) => <li key={idx}>{line}</li>)}
                        </ul>
                      ) : '-'
                    },
                  },
                  {
                    title: 'Действия',
                    key: 'actions',
                    render: (_: unknown, record: SupplyChainPartyDetails) => (
                      <Button type="link" onClick={() => { setSelectedParty(record); setPartyModalVisible(true) }}>Подробнее</Button>
                    ),
                  },
                ]}
                rowKey={(_, i) => `party-${i}`}
                pagination={false}
                size="small"
              />
            ) : (
              <div>Участники цепи поставки не указаны</div>
            ),
          },
        ]}
      />
    </div>
  )

  const renderBatchContent = (batch: ProductBatchDetails, batchIndex: number) => (
    <div>
      <Descriptions column={1} bordered size="small" style={{ marginBottom: '12px' }}>
        <Descriptions.Item label="Номер серии товара">{batch.batchId || '-'}</Descriptions.Item>
        <Descriptions.Item label="Дата производства">{formatDate(batch.manufactureDate)}</Descriptions.Item>
        <Descriptions.Item label="Срок годности">{formatDate(batch.productShelfLifeEndDate)}</Descriptions.Item>
        <Descriptions.Item label="Количество товара">{formatMeasure(batch.commodityMeasure)}</Descriptions.Item>
        <Descriptions.Item label="Примечание">{batch.note || '-'}</Descriptions.Item>
        <Descriptions.Item label="Номер товарной партии">{batch.consignmentId || '-'}</Descriptions.Item>
        <Descriptions.Item label="Количество товара в партии">{formatMeasure(batch.batchCommodityMeasure)}</Descriptions.Item>
      </Descriptions>
      <h4 style={{ marginTop: 12, marginBottom: 8 }}>Товаросопроводительные документы</h4>
      <Table
        dataSource={batch.shippingDocuments}
        columns={shippingDocsColumns}
        rowKey={(_, index) => `batch-${batchIndex}-doc-${index}`}
        pagination={false}
        size="small"
        onRow={(record) => ({
          onClick: () => {
            if (selectedDocument === record && selectedBatchIndex === batchIndex) {
              setSelectedDocument(null)
              setSelectedBatchIndex(null)
            } else {
              setSelectedDocument(record)
              setSelectedBatchIndex(batchIndex)
            }
          },
          style: { cursor: 'pointer' },
        })}
        rowClassName={(record) =>
          selectedDocument === record && selectedBatchIndex === batchIndex ? 'ant-table-row-selected' : ''
        }
      />
      {/* Детализация документа — сразу под таблицей этой партии */}
      {selectedDocument && selectedBatchIndex === batchIndex && renderDocumentDetailBlock(selectedDocument)}
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        Партий продукции: <strong>{batches.length}</strong>. Выберите партию для просмотра сведений о серии/партии и ТСД.
      </div>
      <Collapse
        accordion={false}
        items={batches.map((batch, index) => ({
          key: String(index),
          label: `Партия ${index + 1}${batch.batchId ? ` — № ${batch.batchId}` : ''}${batch.manufactureDate ? ` (производство: ${formatDate(batch.manufactureDate)})` : ''}`,
          children: renderBatchContent(batch, index),
        }))}
      />

      {/* Модальное окно с деталями продукции */}
      <Modal
        title="Детализация продукции"
        open={productModalVisible}
        onCancel={() => {
          setProductModalVisible(false)
          setSelectedProduct(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setProductModalVisible(false)
            setSelectedProduct(null)
          }}>
            Закрыть
          </Button>,
        ]}
        width={800}
      >
        {selectedProduct && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Идентификатор">
              {selectedProduct.productId || '<штрихкод>'}
            </Descriptions.Item>
            <Descriptions.Item label="Наименование">
              {selectedProduct.productName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Название продукции">
              {(selectedProduct.tradeNames?.length ? selectedProduct.tradeNames : selectedProduct.tradeName ? [selectedProduct.tradeName] : []).filter(Boolean).join(' ') || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Описание">
              {selectedProduct.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Код ТН ВЭД ЕАЭС">
              {selectedProduct.commodityCode || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Назначение продукции">
              {selectedProduct.productPurpose || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Способ применения">
              {selectedProduct.applicationMethod || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Форма выпуска">
              {selectedProduct.releaseForm || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Условия хранения">
              {selectedProduct.storageCondition || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Информация на этикетке">
              {selectedProduct.labelText || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Техническая документация">
              {selectedProduct.technicalDocs && selectedProduct.technicalDocs.length > 0 ? (
                <div>
                  {selectedProduct.technicalDocs.map((doc, index) => {
                    const kindName = doc.docKindCode ? (getShipDocKindNameByCode(doc.docKindCode) || doc.docKindName || '') : (doc.docKindName || '')
                    const parts = [kindName, doc.docName, doc.docId].filter(Boolean)
                    const dateStr = doc.docCreationDate ? formatDate(doc.docCreationDate) : ''
                    const startStr = doc.docStartDate ? ` действует с ${formatDate(doc.docStartDate)}` : ''
                    return (
                      <div key={index} style={{ marginBottom: '4px' }}>
                        {parts.join(' ')}{dateStr ? ` ${dateStr}` : ''}{startStr}
                      </div>
                    )
                  })}
                </div>
              ) : (
                '—'
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Модальное окно с деталями участника цепи поставки */}
      <Modal
        title="Детализация участника цепи поставки"
        open={partyModalVisible}
        onCancel={() => {
          setPartyModalVisible(false)
          setSelectedParty(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setPartyModalVisible(false)
            setSelectedParty(null)
          }}>
            Закрыть
          </Button>,
        ]}
        width={800}
      >
        {selectedParty && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Вид участника цепи поставки">
              {getSupplyChainPartyKindName(selectedParty.supplyChainPartyKindCode)}
            </Descriptions.Item>
            <Descriptions.Item label="Страна">
              {getCountryDisplayLabel(selectedParty.country)}
            </Descriptions.Item>
            <Descriptions.Item label="Наименование субъекта">
              {selectedParty.businessEntityName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Краткое наименование">
              {selectedParty.shortName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Организационно-правовая форма">
              {selectedParty.organizationalForm || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Идентификатор субъекта">
              {selectedParty.subjectIdentifier || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Метод идентификации">
              {selectedParty.identificationMethod ? getIdentificationMethodDisplayLabel(selectedParty.identificationMethod) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Таможенный номер">
              {selectedParty.customsNumber || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Идентификатор налогоплательщика">
              {selectedParty.taxpayerId || '-'}
            </Descriptions.Item>
            {(() => {
              const list = getAddressListFromParty(selectedParty)
              const lines = formatAddressList(list, getDefaultAddressKindName, getCountryDisplayLabel)
              return lines.length > 0 ? (
                <Descriptions.Item label="Адреса">
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {lines.map((line, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{line}</li>
                    ))}
                  </ul>
                </Descriptions.Item>
              ) : null
            })()}
            {selectedParty.contacts && selectedParty.contacts.length > 0 && (
              <Descriptions.Item label="Контактный реквизит">
                <div>
                  {selectedParty.contacts.map((contact, index) => (
                    <div key={index} style={{ marginBottom: '4px' }}>
                      {contact.contactKind && `${contact.contactKind}: `}{contact.contactValue || '-'}
                    </div>
                  ))}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default TSDTab

