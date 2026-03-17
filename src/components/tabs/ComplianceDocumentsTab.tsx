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
import { requestLabProtocols } from '@/utils/referenceDataApi'

interface ComplianceDocumentsTabProps {
  /** По XSD документы соответствия только в tsd.batches[].complianceDocuments */
  tsd: TSDData | null | undefined
  hasEditPermission?: boolean // dangerousProductIn:edit
  /** GUID для запроса протоколов лабораторных исследований (подключение к БД, userId) */
  guid?: string | null
}

const ComplianceDocumentsTab: React.FC<ComplianceDocumentsTabProps> = ({
  tsd,
  hasEditPermission = false,
  guid,
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
    const docId = doc.docId ?? doc.registrationCertificateId
    if (!docId || !String(docId).trim()) {
      message.warning('Номер документа (csdo:DocId) не указан')
      return
    }
    const countryCode = doc.authority?.country?.trim()
    if (!countryCode) {
      message.warning('Код страны уполномоченного органа не указан')
      return
    }

    setProtocolsLoading(true)
    setProtocolsError(null)
    setProtocolsData(null)
    setSelectedDocument(doc)
    setProtocolsModalVisible(true)

    try {
      const res = await requestLabProtocols(docId, countryCode, guid ?? undefined)
      if (res.status === 'requested') {
        setProtocolsError('local')
        message.info(res.message ?? 'Запрошенные сведения отсутствуют в локальной базе данных. Выполнен запрос сведений к первоисточнику.')
      } else if (res.status === 'no_info') {
        setProtocolsError('source')
        message.warning(res.message ?? 'Запрошенные сведения отсутствуют у первоисточника.')
      } else if (res.status === 'with_info' && res.xml) {
        setProtocolsError(null)
        const escaped = res.xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const w = window.open('', '_blank', 'width=900,height=700,scrollbars=yes')
        if (w) {
          w.document.write(
            '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Протоколы лабораторных исследований</title></head><body><pre style="white-space:pre-wrap;font-family:monospace;padding:12px;">' +
            escaped +
            '</pre></body></html>'
          )
          w.document.close()
        } else {
          setProtocolsData({ xml: res.xml })
          setProtocolsModalVisible(true)
        }
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Ошибка при запросе протоколов')
      setProtocolsModalVisible(false)
    } finally {
      setProtocolsLoading(false)
    }
  }

  const columns = [
    {
      title: 'Вид',
      dataIndex: 'docKindCode',
      key: 'docKindCode',
      width: '30%',
      render: (_: string, record: ComplianceDocument) => {
        let text: string
        if (record.docKindCode) {
          const fromRef = getConformityDocKindDisplayLabel(record.docKindCode)
          text = fromRef || record.docKindCode || '-'
          if (record.docKindName && (text === record.docKindCode || !fromRef)) {
            text = `${record.docKindCode} - ${record.docKindName}`
          }
        } else {
          text = record.docKindName || '-'
        }
        return <div className="compliance-doc-kind-view-cell" style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>{text}</div>
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewAuthority(record)}
            style={{ padding: 0, height: 'auto' }}
          >
            Уполномоченный орган
          </Button>
          {record.docKindCode === '25' && (
            <Button
              type="link"
              onClick={() => handleRequestProtocols(record)}
              style={{ padding: 0, height: 'auto' }}
            >
              Протоколы лабораторных исследований
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
                  tableLayout="fixed"
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
            {/* XML протоколов (если открытие в новом окне заблокировано) */}
            {protocolsData.xml && !protocolsData.protocols && (
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12, maxHeight: 500, overflow: 'auto' }}>
                {protocolsData.xml}
              </pre>
            )}
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

