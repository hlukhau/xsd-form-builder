import { useState } from 'react'
import { Table, Descriptions, Button, Modal, message, Collapse } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ComplianceDocument, TSDData } from '@/types/card'
import {
  getAddressListFromParty,
  formatAddressList,
  getDefaultAddressKindName,
  getDefaultCountryName,
} from '@/utils/addressFormatUtils'
import { useIdentificationMethodOptions } from '@/hooks/useIdentificationMethodOptions'
import { useConformityDocKindOptions } from '@/hooks/useConformityDocKindOptions'
import { useCountryOptions } from '@/hooks/useCountryOptions'

interface ComplianceDocumentsTabProps {
  /** По XSD документы соответствия только в tsd.batches[].complianceDocuments */
  tsd: TSDData | null | undefined
  hasEditPermission?: boolean // dangerousProductIn:edit
}

const ComplianceDocumentsTab: React.FC<ComplianceDocumentsTabProps> = ({
  tsd,
  hasEditPermission = false,
}) => {
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null)
  const [authorityModalVisible, setAuthorityModalVisible] = useState(false)
  const [protocolsModalVisible, setProtocolsModalVisible] = useState(false)
  const [protocolsLoading, setProtocolsLoading] = useState(false)
  const [protocolsData, setProtocolsData] = useState<any>(null)
  const [protocolsError, setProtocolsError] = useState<'local' | 'source' | null>(null)
  const [selectedLaboratory, setSelectedLaboratory] = useState<any>(null)
  const [laboratoryModalVisible, setLaboratoryModalVisible] = useState(false)
  const labCountry = selectedLaboratory?.registrationAddress?.country ?? selectedLaboratory?.actualAddress?.country ?? selectedLaboratory?.mailingAddress?.country ?? ''
  const { getDisplayLabel: getIdentificationMethodDisplayLabel } = useIdentificationMethodOptions(labCountry)
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const { getDisplayLabel: getConformityDocKindDisplayLabel } = useConformityDocKindOptions()
  const getCountryNameForAddress = (code?: string) => getCountryDisplayLabel(code) || getDefaultCountryName(code) || '-'

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const handleViewAuthority = (doc: ComplianceDocument) => {
    setSelectedDocument(doc)
    setAuthorityModalVisible(true)
  }

  const handleRequestProtocols = async (doc: ComplianceDocument) => {
    if (!doc.registrationCertificateId) {
      message.warning('Номер свидетельства о регистрации не указан')
      return
    }

    setProtocolsLoading(true)
    setProtocolsError(null)
    setProtocolsData(null)
    setSelectedDocument(doc)
    setProtocolsModalVisible(true)

    // Имитация запроса протоколов
    // В реальном приложении здесь должен быть вызов процедуры P.SS.08.PRC.017
    try {
      // Имитируем задержку запроса
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Имитация трех сценариев:
      // 1. Данные отсутствуют в локальной БД
      // 2. Данные отсутствуют у первоисточника
      // 3. Данные присутствуют

      // Для демонстрации используем случайный выбор
      // В реальном приложении это будет определяться ответом от сервера
      const scenario = Math.random()
      
      if (scenario < 0.33) {
        // Сценарий 1: Данные отсутствуют в локальной БД
        setProtocolsError('local')
        message.info('Запрошенные сведения отсутствуют в локальной базе данных. Выполнен запрос сведений к первоисточнику.')
        // Здесь должен быть вызов процедуры P.SS.08.PRC.017
      } else if (scenario < 0.66) {
        // Сценарий 2: Данные отсутствуют у первоисточника
        setProtocolsError('source')
        message.warning('Запрошенные сведения отсутствуют у первоисточника.')
      } else {
        // Сценарий 3: Данные присутствуют
        setProtocolsError(null)
        // В реальном приложении здесь будут реальные данные
        setProtocolsData({
          product: {
            productId: 'штрихкод',
            productName: 'природная вода минеральная газированная "ХАЙ СКАЙ (hi-sky)-2"',
            description: 'питьевая природная минеральная вода, расфасованная в емкости "ХАЙ СКАЙ (Hi-Sky)-2"',
            commodityCode: '2201101100',
          },
          protocols: [
            {
              docKindName: 'Протокол',
              docName: 'Протокол испытаний',
              docId: 'СГР-134',
              docCreationDate: '2020-08-05',
              laboratory: {
                subjectId: '123456987',
                identificationMethod: 'ОГРН - основной государственный регистрационный номер юридического лица, указанный в Едином государственном реестре юридических лиц',
                organizationalForm: 'Общество с ограниченной ответственностью',
                businessEntityName: 'Общество с ограниченной ответственностью "СТАНДАРТ ДИАЛОГ"',
                accreditationCertificate: {
                  docKindName: 'Свидетельство об аккредитации',
                  docId: 'POCC RU.0001.410154',
                  eventDate: '2020-05-05',
                  docStartDate: '2020-05-05',
                  docValidityDate: '2030-06-05',
                },
              },
            },
            {
              docKindName: 'Протокол',
              docName: 'Протокол испытаний',
              docId: 'СГР-135',
              docCreationDate: '2020-08-05',
              laboratory: {
                subjectId: '123456987',
                identificationMethod: 'ОГРН - основной государственный регистрационный номер юридического лица, указанный в Едином государственном реестре юридических лиц',
                organizationalForm: 'Общество с ограниченной ответственностью',
                businessEntityName: 'Общество с ограниченной ответственностью "СТАНДАРТ ДИАЛОГ"',
                accreditationCertificate: {
                  docKindName: 'Свидетельство об аккредитации',
                  docId: 'POCC RU.0001.410154',
                  eventDate: '2020-05-05',
                  docStartDate: '2020-05-05',
                  docValidityDate: '2030-06-05',
                },
              },
            },
          ],
        })
      }
    } catch (error) {
      message.error('Ошибка при запросе протоколов')
    } finally {
      setProtocolsLoading(false)
    }
  }

  const columns = [
    {
      title: 'Вид',
      dataIndex: 'docKindCode',
      key: 'docKindCode',
      render: (_: string, record: ComplianceDocument) => {
        if (record.docKindCode) {
          const codeNameLabel = getConformityDocKindDisplayLabel(record.docKindCode)
          return codeNameLabel || record.docKindName || record.docKindCode || '-'
        }
        return record.docKindName || '-'
      },
    },
    {
      title: 'Наименование',
      dataIndex: 'docName',
      key: 'docName',
      render: (text: string) => text || '-',
    },
    {
      title: 'Номер',
      dataIndex: 'docId',
      key: 'docId',
      render: (text: string) => text || '-',
    },
    {
      title: 'Дата',
      dataIndex: 'docCreationDate',
      key: 'docCreationDate',
      render: (date: string) => formatDate(date),
    },
    {
      title: 'Дата начала срока действия',
      dataIndex: 'docStartDate',
      key: 'docStartDate',
      render: (date: string) => formatDate(date),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: any, record: ComplianceDocument) => (
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewAuthority(record)}
          >
            Уполномоченный орган
          </Button>
          {record.docKindCode === '25' && hasEditPermission && (
            <Button
              type="link"
              onClick={() => handleRequestProtocols(record)}
            >
              Протоколы
            </Button>
          )}
        </div>
      ),
    },
  ]

  const formatDateShort = (date: string | null | undefined) => {
    if (!date) return '-'
    const d = new Date(date)
    return isNaN(d.getTime()) ? date : format(d, 'dd.MM.yyyy', { locale: ru })
  }

  const batchesWithCompliance = tsd?.batches?.filter((b) => (b.complianceDocuments?.length ?? 0) > 0) ?? []

  if (batchesWithCompliance.length === 0) {
    return <div>Данные о документах соответствия не найдены. Добавьте партию во вкладке ТСД и укажите документы в составе партии.</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        Документы соответствия по партиям: <strong>{batchesWithCompliance.length}</strong>.
      </div>
      <Collapse
        accordion={false}
        items={batchesWithCompliance.map((batch) => {
          const batchIndex = tsd!.batches!.indexOf(batch)
          const docs = batch.complianceDocuments ?? []
          return {
            key: String(batchIndex),
            label: `Партия ${batchIndex + 1}${batch.batchId ? ` — № ${batch.batchId}` : ''}${batch.manufactureDate ? ` (производство: ${formatDateShort(batch.manufactureDate)})` : ''} (документов: ${docs.length})`,
            children: (
              <div>
                <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
                  <Descriptions.Item label="Номер серии товара">{batch.batchId || '-'}</Descriptions.Item>
                  <Descriptions.Item label="Дата производства">{formatDateShort(batch.manufactureDate)}</Descriptions.Item>
                  <Descriptions.Item label="Номер товарной партии">{batch.consignmentId || '-'}</Descriptions.Item>
                </Descriptions>
                <Table
                  dataSource={docs}
                  columns={columns}
                  rowKey={(_, i) => `batch-${batchIndex}-doc-${i}`}
                  pagination={false}
                  size="small"
                />
              </div>
            ),
          }
        })}
      />

      {/* Модальное окно с деталями уполномоченного органа */}
      <Modal
        title="Уполномоченный орган"
        open={authorityModalVisible}
        onCancel={() => {
          setAuthorityModalVisible(false)
          setSelectedDocument(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setAuthorityModalVisible(false)
            setSelectedDocument(null)
          }}>
            Закрыть
          </Button>,
        ]}
        width={600}
      >
        {selectedDocument?.authority && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Страна">
              {getCountryDisplayLabel(selectedDocument.authority.country || '')}
            </Descriptions.Item>
            <Descriptions.Item label="Наименование">
              {selectedDocument.authority.authorityName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Краткое наименование">
              {selectedDocument.authority.authorityBriefName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Идентификатор">
              {selectedDocument.authority.authorityId || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Модальное окно с протоколами лабораторных исследований */}
      <Modal
        title="Протоколы лабораторных исследований"
        open={protocolsModalVisible}
        onCancel={() => {
          setProtocolsModalVisible(false)
          setSelectedDocument(null)
          setProtocolsData(null)
          setProtocolsError(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setProtocolsModalVisible(false)
            setSelectedDocument(null)
            setProtocolsData(null)
            setProtocolsError(null)
          }}>
            OK
          </Button>,
        ]}
        width={1000}
      >
        {protocolsLoading ? (
          <div>Загрузка данных...</div>
        ) : protocolsError === 'local' ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Запрошенные сведения отсутствуют в локальной базе данных. Выполнен запрос сведений к первоисточнику.</p>
          </div>
        ) : protocolsError === 'source' ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>Запрошенные сведения отсутствуют у первоисточника.</p>
          </div>
        ) : protocolsData ? (
          <div>
            {/* Информация о продукции */}
            {protocolsData.product && (
              <div style={{ marginBottom: '24px' }}>
                <h3>Набор атрибутов по продукции</h3>
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="Идентификатор продукции">
                    {protocolsData.product.productId || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Наименование продукции">
                    {protocolsData.product.productName || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Описание">
                    {protocolsData.product.description || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Код ТН ВЭД ЕАЭС">
                    {protocolsData.product.commodityCode || '-'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* Таблица протоколов */}
            <div style={{ marginBottom: '24px' }}>
              <h3>Протоколы</h3>
              <Table
                dataSource={protocolsData.protocols}
                columns={[
                  {
                    title: 'Вид',
                    dataIndex: 'docKindName',
                    key: 'docKindName',
                    render: (text: string) => text || '-',
                  },
                  {
                    title: 'Наименование',
                    dataIndex: 'docName',
                    key: 'docName',
                    render: (text: string) => text || '-',
                  },
                  {
                    title: 'Номер',
                    dataIndex: 'docId',
                    key: 'docId',
                    render: (text: string) => text || '-',
                  },
                  {
                    title: 'Дата',
                    dataIndex: 'docCreationDate',
                    key: 'docCreationDate',
                    render: (date: string) => formatDate(date),
                  },
                  {
                    title: 'Действия',
                    key: 'actions',
                    render: (_: any, record: any) => (
                      <Button
                        type="link"
                        onClick={() => {
                          setSelectedLaboratory(record.laboratory)
                          setLaboratoryModalVisible(true)
                        }}
                      >
                        Лаборатория
                      </Button>
                    ),
                  },
                ]}
                rowKey={(record, index) => `protocol-${index}`}
                pagination={false}
              />
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Модальное окно с деталями лаборатории */}
      <Modal
        title="Лаборатория"
        open={laboratoryModalVisible}
        onCancel={() => {
          setLaboratoryModalVisible(false)
          setSelectedLaboratory(null)
        }}
        footer={[
          <Button key="close" onClick={() => {
            setLaboratoryModalVisible(false)
            setSelectedLaboratory(null)
          }}>
            Закрыть
          </Button>,
        ]}
        width={800}
      >
        {selectedLaboratory && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Идентификатор субъекта">
              {selectedLaboratory.subjectId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Метод идентификации">
              {selectedLaboratory.identificationMethod ? getIdentificationMethodDisplayLabel(selectedLaboratory.identificationMethod) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Организационно-правовая форма">
              {selectedLaboratory.organizationalForm || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Наименование субъекта">
              {selectedLaboratory.businessEntityName || '-'}
            </Descriptions.Item>
            {(() => {
              const addressList = getAddressListFromParty(selectedLaboratory)
              const addressLines = formatAddressList(addressList, getDefaultAddressKindName, getCountryNameForAddress)
              return addressLines.length > 0 ? (
                <Descriptions.Item label="Адреса">
                  <ul style={{ margin: 0, paddingLeft: '20px' }}>
                    {addressLines.map((line, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{line}</li>
                    ))}
                  </ul>
                </Descriptions.Item>
              ) : null
            })()}
            {selectedLaboratory.accreditationCertificate && (
              <>
                <Descriptions.Item label="Наименование аттестата аккредитации">
                  {selectedLaboratory.accreditationCertificate.docKindName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Номер документа">
                  {selectedLaboratory.accreditationCertificate.docId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Дата документа">
                  {formatDate(selectedLaboratory.accreditationCertificate.eventDate)}
                </Descriptions.Item>
                <Descriptions.Item label="Срок действия. Начало">
                  {formatDate(selectedLaboratory.accreditationCertificate.docStartDate)}
                </Descriptions.Item>
                <Descriptions.Item label="Срок действия. Окончание">
                  {formatDate(selectedLaboratory.accreditationCertificate.docValidityDate)}
                </Descriptions.Item>
                {selectedLaboratory.accreditationCertificate.docBinaryText && (
                  <Descriptions.Item label="Документ в бинарном виде">
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {selectedLaboratory.accreditationCertificate.docBinaryText.mediaTypeCode && (
                        <Button type="link" size="small">
                          Скачать ({selectedLaboratory.accreditationCertificate.docBinaryText.mediaTypeCode})
                        </Button>
                      )}
                      {selectedLaboratory.accreditationCertificate.xmlDocument && (
                        <Button type="link" size="small">
                          Скачать XML
                        </Button>
                      )}
                    </div>
                  </Descriptions.Item>
                )}
              </>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

export default ComplianceDocumentsTab

