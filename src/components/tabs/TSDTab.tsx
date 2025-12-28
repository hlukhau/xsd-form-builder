import { useState } from 'react'
import { Descriptions, Table, Collapse, Button, Modal } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import ProductTab from './ProductTab'
import type { TSDData, ProductBatchDetails, ShippingDocument, ProductDetails, SupplyChainPartyDetails } from '@/types/card'

interface TSDTabProps {
  data: TSDData
}

const TSDTab: React.FC<TSDTabProps> = ({ data }) => {
  const [selectedDocument, setSelectedDocument] = useState<ShippingDocument | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductDetails | null>(null)
  const [selectedParty, setSelectedParty] = useState<SupplyChainPartyDetails | null>(null)
  const [productModalVisible, setProductModalVisible] = useState(false)
  const [partyModalVisible, setPartyModalVisible] = useState(false)
  
  console.log('TSDTab получил данные:', data)
  if (data?.batches?.[0]?.shippingDocuments) {
    console.log('Документы в партии:', data.batches[0].shippingDocuments)
    data.batches[0].shippingDocuments.forEach((doc, index) => {
      console.log(`Документ ${index}:`, {
        docName: doc.docName,
        docId: doc.docId,
        productsCount: doc.products?.length || 0,
        partiesCount: doc.supplyChainParties?.length || 0,
      })
    })
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const formatMeasure = (measure?: { value: string; unitCode?: string; unitName?: string }) => {
    if (!measure || !measure.value) return '-'
    const unit = measure.unitName || measure.unitCode || ''
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

  const getCountryName = (code?: string): string => {
    // В реальном приложении здесь обращение к справочнику стран
    const countryMap: Record<string, string> = {
      'RU': 'Россия',
      'BY': 'Беларусь',
      'KZ': 'Казахстан',
    }
    return code ? (countryMap[code] || code) : '-'
  }

  if (!data || !data.batches || data.batches.length === 0) {
    return <div>Данные о партиях продукции не найдены</div>
  }

  // Берем первую партию (в XML обычно одна)
  const batch = data.batches[0]

  // Таблица товаросопроводительных документов
  const shippingDocsColumns = [
    {
      title: 'Вид',
      dataIndex: 'docKindName',
      key: 'docKindName',
      render: (text: string, record: ShippingDocument) => {
        return record.docKindName || record.docName || '-'
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

  return (
    <div>
      {/* Информация по серии и партии */}
      <Descriptions column={1} bordered style={{ marginBottom: '16px' }}>
        <Descriptions.Item label="Номер серии товара">
          {batch.batchId || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Дата производства">
          {formatDate(batch.manufactureDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Срок годности">
          {formatDate(batch.productShelfLifeEndDate)}
        </Descriptions.Item>
        <Descriptions.Item label="Количество товара">
          {formatMeasure(batch.commodityMeasure)}
        </Descriptions.Item>
        <Descriptions.Item label="Примечание">
          {batch.note || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Номер товарной партии">
          {batch.consignmentId || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Количество товара в партии">
          {formatMeasure(batch.batchCommodityMeasure)}
        </Descriptions.Item>
      </Descriptions>

      {/* Таблица товаросопроводительных документов */}
      <div style={{ marginBottom: '16px' }}>
        <h3>Товаросопроводительные документы</h3>
        <Table
          dataSource={batch.shippingDocuments}
          columns={shippingDocsColumns}
          rowKey={(record, index) => index?.toString() || ''}
          pagination={false}
          onRow={(record, index) => ({
            onClick: () => {
              // Переключаем детализацию: если уже выбран этот документ, скрываем, иначе показываем
              if (selectedDocument === record) {
                setSelectedDocument(null)
              } else {
                setSelectedDocument(record)
              }
            },
            style: { cursor: 'pointer' },
          })}
          rowClassName={(record, index) => {
            // Выделяем выбранную строку
            return selectedDocument === record ? 'ant-table-row-selected' : ''
          }}
        />
      </div>

      {/* Детализация по выбранному документу */}
      {selectedDocument && (
        <div style={{ marginTop: '16px' }}>
          <h3>
            Детализация документа: {selectedDocument.docName || 'Документ'}
            {selectedDocument.docId && ` (№ ${selectedDocument.docId})`}
          </h3>
          
          <Collapse
            items={[
              {
                key: 'products',
                label: 'Продукция',
                children: selectedDocument.products && selectedDocument.products.length > 0 ? (
                  <Table
                    dataSource={selectedDocument.products}
                    columns={[
                      {
                        title: 'Идентификатор',
                        dataIndex: 'productId',
                        key: 'productId',
                        render: (text: string) => text || '<штрихкод>',
                      },
                      {
                        title: 'Код ТН ВЭД ЕАЭС',
                        dataIndex: 'commodityCode',
                        key: 'commodityCode',
                      },
                      {
                        title: 'Наименование',
                        dataIndex: 'productName',
                        key: 'productName',
                      },
                      {
                        title: 'Действия',
                        key: 'actions',
                        render: (_: any, record: ProductDetails) => (
                          <Button
                            type="link"
                            onClick={() => {
                              setSelectedProduct(record)
                              setProductModalVisible(true)
                            }}
                          >
                            Подробнее
                          </Button>
                        ),
                      },
                    ]}
                    rowKey={(record, index) => index?.toString() || ''}
                    pagination={false}
                  />
                ) : (
                  <div>Продукция не указана</div>
                ),
              },
              {
                key: 'parties',
                label: 'Участники цепи поставки',
                children: (() => {
                  console.log('Проверка участников для документа:', {
                    docName: selectedDocument.docName,
                    docId: selectedDocument.docId,
                    hasParties: !!selectedDocument.supplyChainParties,
                    partiesLength: selectedDocument.supplyChainParties?.length || 0,
                    parties: selectedDocument.supplyChainParties,
                  })
                  
                  if (selectedDocument.supplyChainParties && selectedDocument.supplyChainParties.length > 0) {
                    // Логируем детали каждого участника
                    selectedDocument.supplyChainParties.forEach((party, index) => {
                      console.log(`Участник ${index + 1}:`, {
                        country: party.country,
                        businessEntityName: party.businessEntityName,
                        supplyChainPartyKindCode: party.supplyChainPartyKindCode,
                        shortName: party.shortName,
                        subjectIdentifier: party.subjectIdentifier,
                        taxpayerId: party.taxpayerId,
                      })
                    })
                    
                    return (
                      <Table
                        dataSource={selectedDocument.supplyChainParties}
                        columns={[
                          {
                            title: 'Вид',
                            key: 'kind',
                            render: (_: any, record: SupplyChainPartyDetails) => {
                              const kindName = getSupplyChainPartyKindName(record.supplyChainPartyKindCode)
                              return kindName || '-'
                            },
                          },
                          {
                            title: 'Страна',
                            dataIndex: 'country',
                            key: 'country',
                            render: (code: string) => getCountryName(code),
                          },
                          {
                            title: 'Наименование',
                            dataIndex: 'businessEntityName',
                            key: 'businessEntityName',
                            render: (text: string) => text || '-',
                          },
                          {
                            title: 'Адреса',
                            key: 'addresses',
                            render: (_: any, record: SupplyChainPartyDetails) => {
                              const addresses: string[] = []
                              
                              if (record.registrationAddress) {
                                const addr = record.registrationAddress.fullAddress || 
                                  [record.registrationAddress.country, 
                                   record.registrationAddress.cityName, 
                                   record.registrationAddress.streetName, 
                                   record.registrationAddress.buildingNumberId].filter(Boolean).join(', ')
                                if (addr) addresses.push(`Адрес регистрации (код 1): ${addr}`)
                              }
                              
                              if (record.actualAddress) {
                                const addr = record.actualAddress.fullAddress || 
                                  [record.actualAddress.country, 
                                   record.actualAddress.cityName, 
                                   record.actualAddress.streetName, 
                                   record.actualAddress.buildingNumberId].filter(Boolean).join(', ')
                                if (addr) addresses.push(`Фактический адрес (код 2): ${addr}`)
                              }
                              
                              if (record.mailingAddress) {
                                const addr = record.mailingAddress.fullAddress || 
                                  [record.mailingAddress.country, 
                                   record.mailingAddress.cityName, 
                                   record.mailingAddress.streetName, 
                                   record.mailingAddress.buildingNumberId].filter(Boolean).join(', ')
                                if (addr) addresses.push(`Почтовый адрес (код 3): ${addr}`)
                              }
                              
                              return addresses.length > 0 ? (
                                <div>
                                  {addresses.map((addr, idx) => (
                                    <div key={idx} style={{ marginBottom: '4px', fontSize: '12px' }}>
                                      {addr}
                                    </div>
                                  ))}
                                </div>
                              ) : '-'
                            },
                          },
                          {
                            title: 'Действия',
                            key: 'actions',
                            render: (_: any, record: SupplyChainPartyDetails) => (
                              <Button
                                type="link"
                                onClick={() => {
                                  setSelectedParty(record)
                                  setPartyModalVisible(true)
                                }}
                              >
                                Подробнее
                              </Button>
                            ),
                          },
                        ]}
                        rowKey={(record, index) => `party-${index}`}
                        pagination={false}
                      />
                    )
                  } else {
                    return <div>Участники цепи поставки не указаны</div>
                  }
                })(),
              },
            ]}
          />
        </div>
      )}

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
            <Descriptions.Item label="Название">
              {selectedProduct.tradeName || '-'}
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
            {selectedProduct.technicalDocs && selectedProduct.technicalDocs.length > 0 && (
              <Descriptions.Item label="Техническая документация">
                <div>
                  {selectedProduct.technicalDocs.map((doc, index) => (
                    <div key={index} style={{ marginBottom: '4px' }}>
                      {doc.docKindName || ''} {doc.docName || ''} {doc.docId || ''} {doc.docCreationDate ? formatDate(doc.docCreationDate) : ''}
                      {doc.docStartDate && ` действует с ${formatDate(doc.docStartDate)}`}
                    </div>
                  ))}
                </div>
              </Descriptions.Item>
            )}
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
              {getCountryName(selectedParty.country)}
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
              {selectedParty.identificationMethod || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Таможенный номер">
              {selectedParty.customsNumber || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Идентификатор налогоплательщика">
              {selectedParty.taxpayerId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Адрес регистрации">
              {selectedParty.registrationAddress?.fullAddress || 
               (selectedParty.registrationAddress ? 
                 [selectedParty.registrationAddress.country, 
                  selectedParty.registrationAddress.cityName, 
                  selectedParty.registrationAddress.streetName, 
                  selectedParty.registrationAddress.buildingNumberId].filter(Boolean).join(', ') 
                : '-')}
            </Descriptions.Item>
            <Descriptions.Item label="Фактический адрес">
              {selectedParty.actualAddress?.fullAddress || 
               (selectedParty.actualAddress ? 
                 [selectedParty.actualAddress.country, 
                  selectedParty.actualAddress.cityName, 
                  selectedParty.actualAddress.streetName, 
                  selectedParty.actualAddress.buildingNumberId].filter(Boolean).join(', ') 
                : '-')}
            </Descriptions.Item>
            <Descriptions.Item label="Почтовый адрес">
              {selectedParty.mailingAddress?.fullAddress || 
               (selectedParty.mailingAddress ? 
                 [selectedParty.mailingAddress.country, 
                  selectedParty.mailingAddress.cityName, 
                  selectedParty.mailingAddress.streetName, 
                  selectedParty.mailingAddress.buildingNumberId].filter(Boolean).join(', ') 
                : '-')}
            </Descriptions.Item>
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

