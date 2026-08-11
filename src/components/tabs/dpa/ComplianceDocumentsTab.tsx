import { useState } from 'react'
import { Table, Descriptions, Button, Modal, message, Collapse } from 'antd'
import { EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ComplianceDocument, TSDData, LaboratoryProtocol, LaboratoryDetails, AccreditationCertificateDetails } from '@/types/card'
import {
  getAddressListFromParty,
  formatAddressList,
  formatAddressLine,
  getDefaultAddressKindName,
  getDefaultCountryName,
} from '@/utils/addressFormatUtils'
import { useIdentificationMethodOptions } from '@/hooks/shared/useIdentificationMethodOptions'
import { useConformityDocKindOptions } from '@/hooks/shared/useConformityDocKindOptions'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { useLegalFormOptions } from '@/hooks/shared/useLegalFormOptions'
import { useMediaTypeOptions } from '@/hooks/shared/useMediaTypeOptions'
import { requestLabProtocols, LAB_PROTOCOLS_RESPONSE_ERROR_MESSAGE } from '@/utils/referenceDataApi'
import { parseLabProtocolsXml } from '@/utils/labProtocolsXmlParser'
import type { LaboratoryProtocolsData } from '@/types/card'
import {
  LAB_PROTOCOLS_DOC_ID_COUNTRY_MISMATCH_WARNING,
  registrationCertificateDocIdMatchesAuthorityCountry,
} from '@/utils/registrationCertificateCountryMatch'

interface ComplianceDocumentsTabProps {
  /** По XSD документы соответствия только в tsd.batches[].complianceDocuments */
  tsd: TSDData | null | undefined
  hasEditPermission?: boolean // dangerousProductIn:edit
  /** GUID для запроса протоколов лабораторных исследований (подключение к БД, userId) */
  guid?: string | null
  /** Ссылка «Протоколы лабораторных исследований» (DocKindCode=25); для SMD/ОП 58 отключена */
  showLabProtocolsLink?: boolean
}

export interface LaboratoryBlockContentProps {
  lab: LaboratoryDetails
  addressLines: string[]
  certs: AccreditationCertificateDetails[]
  formatDate: (date: string | null | undefined) => string
  getIdentificationMethodDisplayLabel: (code: string) => string
  getLegalFormNameByCode: (code: string) => string | null
  getMediaTypeNameByCode: (code: string | undefined) => string | null
  showTitle: boolean
}

export const LaboratoryBlockContent: React.FC<LaboratoryBlockContentProps> = ({
  lab,
  addressLines,
  certs,
  formatDate,
  getIdentificationMethodDisplayLabel,
  getLegalFormNameByCode,
  getMediaTypeNameByCode,
  showTitle,
}) => {
  const [certIndex, setCertIndex] = useState(0)
  const cert = certs[certIndex] ?? null
  return (
    <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 12, margin: '8px 0', background: '#fafafa' }}>
      {showTitle && <div style={{ fontWeight: 600, marginBottom: 8 }}>Лаборатория</div>}
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="Идентификатор субъекта">{lab.subjectId || '—'}</Descriptions.Item>
        <Descriptions.Item label="Метод идентификации">
          {lab.identificationMethod ? getIdentificationMethodDisplayLabel(lab.identificationMethod) : '—'}
        </Descriptions.Item>
        <Descriptions.Item label="Организационно-правовая форма">
          {lab.businessEntityTypeCode && lab.businessEntityTypeCodeListId === '2049'
            ? (getLegalFormNameByCode(lab.businessEntityTypeCode)
                ? `${lab.businessEntityTypeCode} — ${getLegalFormNameByCode(lab.businessEntityTypeCode)}`
                : lab.organizationalForm || lab.businessEntityTypeCode)
            : (lab.organizationalForm || '—')}
        </Descriptions.Item>
        <Descriptions.Item label="Наименование субъекта">{lab.businessEntityName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Адреса">
          {addressLines.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {addressLines.map((line, idx) => (
                <li key={idx}>{line}</li>
              ))}
            </ul>
          ) : (
            '—'
          )}
        </Descriptions.Item>
        {certs.length > 0 && (
          <>
            {certs.length >= 1 && (
              <Descriptions.Item label="Аттестаты аккредитации">
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                  <Button type="link" size="small" disabled={certIndex === 0} onClick={() => setCertIndex((i) => Math.max(0, i - 1))}>
                    &lt;&lt; Предыдущая запись
                  </Button>
                  {certs.map((_, i) => (
                    <Button key={i} type={certIndex === i ? 'primary' : 'link'} size="small" onClick={() => setCertIndex(i)}>
                      {i + 1}
                    </Button>
                  ))}
                  <Button type="link" size="small" disabled={certIndex >= certs.length - 1} onClick={() => setCertIndex((i) => Math.min(certs.length - 1, i + 1))}>
                    Следующая запись &gt;&gt;
                  </Button>
                </div>
              </Descriptions.Item>
            )}
            {cert && (
              <>
                <Descriptions.Item label="Наименование аттестата аккредитации">{cert.docKindName || '—'}</Descriptions.Item>
                <Descriptions.Item label="Номер документа">{cert.docId || '—'}</Descriptions.Item>
                <Descriptions.Item label="Дата документа">{formatDate(cert.eventDate)}</Descriptions.Item>
                <Descriptions.Item label="Срок действия. Начало">{formatDate(cert.docStartDate)}</Descriptions.Item>
                <Descriptions.Item label="Срок действия. Окончание">{formatDate(cert.docValidityDate)}</Descriptions.Item>
                {cert.docBinaryText?.content && (
                  <Descriptions.Item label="Документ в бинарном виде">
                    <Button
                      type="link"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => {
                        const bin = cert.docBinaryText
                        if (bin?.content) {
                          try {
                            const blob = new Blob([Uint8Array.from(atob(bin.content), (c) => c.charCodeAt(0))], {
                              type: bin.mediaTypeCode || 'application/octet-stream',
                            })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `document.${bin.mediaTypeCode?.split('/')[1] || 'bin'}`
                            a.click()
                            URL.revokeObjectURL(url)
                          } catch {
                            message.warning('Не удалось скачать бинарный документ')
                          }
                        }
                      }}
                    >
                      Скачать{cert.docBinaryText?.mediaTypeCode ? ` (${getMediaTypeNameByCode(cert.docBinaryText.mediaTypeCode) || cert.docBinaryText.mediaTypeCode})` : ''}
                    </Button>
                  </Descriptions.Item>
                )}
              </>
            )}
          </>
        )}
      </Descriptions>
    </div>
  )
}

const ComplianceDocumentsTab: React.FC<ComplianceDocumentsTabProps> = ({
  tsd,
  hasEditPermission = false,
  guid,
  showLabProtocolsLink = true,
}) => {
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null)
  const [authorityModalVisible, setAuthorityModalVisible] = useState(false)
  const [protocolsModalVisible, setProtocolsModalVisible] = useState(false)
  const [protocolsLoading, setProtocolsLoading] = useState(false)
  const [protocolsData, setProtocolsData] = useState<LaboratoryProtocolsData | null>(null)
  const [protocolsError, setProtocolsError] = useState<'local' | 'source' | 'response_error' | null>(null)
  const [expandedLabCountry, setExpandedLabCountry] = useState<string>('')
  const labCountry = expandedLabCountry
  const { getDisplayLabel: getIdentificationMethodDisplayLabel } = useIdentificationMethodOptions(labCountry)
  const { getNameByCode: getMediaTypeNameByCode } = useMediaTypeOptions()
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const { getDisplayLabel: getConformityDocKindDisplayLabel } = useConformityDocKindOptions()
  const { getDisplayLabel: getShipDocKindDisplayLabel } = useShipDocKindOptions()
  const { getNameByCode: getLegalFormNameByCode } = useLegalFormOptions(labCountry)
  const getCountryNameForAddress = (code?: string) => getCountryDisplayLabel(code) || getDefaultCountryName(code) || '-'

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const renderLaboratoryBlock = (lab: LaboratoryDetails | null, options?: { showTitle?: boolean }) => {
    if (!lab) {
      return (
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 12, margin: '8px 0', background: '#fafafa' }}>
          {(options?.showTitle !== false) && <div style={{ fontWeight: 600, marginBottom: 8 }}>Лаборатория</div>}
          <div style={{ color: '#999' }}>Нет данных по лаборатории</div>
        </div>
      )
    }
    const addressList = getAddressListFromParty(lab)
    const addressLines = formatAddressList(addressList, getDefaultAddressKindName, getCountryNameForAddress)
    const certs = lab.accreditationCertificates ?? (lab.accreditationCertificate ? [lab.accreditationCertificate] : [])
    return (
      <LaboratoryBlockContent
        lab={lab}
        addressLines={addressLines}
        certs={certs}
        formatDate={formatDate}
        getIdentificationMethodDisplayLabel={getIdentificationMethodDisplayLabel}
        getLegalFormNameByCode={getLegalFormNameByCode}
        getMediaTypeNameByCode={getMediaTypeNameByCode}
        showTitle={options?.showTitle !== false}
      />
    )
  }

  const handleViewAuthority = (doc: ComplianceDocument) => {
    setSelectedDocument(doc)
    setAuthorityModalVisible(true)
  }

  const handleRequestProtocols = async (doc: ComplianceDocument) => {
    const docId = doc.docId ?? doc.registrationCertificateId
    if (!docId || !String(docId).trim()) {
      message.warning('Номер документа не указан')
      return
    }
    const countryCode = doc.authority?.country?.trim()
    if (!countryCode) {
      message.warning('Код страны уполномоченного органа не указан')
      return
    }
    if (!registrationCertificateDocIdMatchesAuthorityCountry(docId, countryCode)) {
      message.warning(LAB_PROTOCOLS_DOC_ID_COUNTRY_MISMATCH_WARNING)
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
      } else if (res.status === 'response_error') {
        setProtocolsError('response_error')
        message.error(res.message ?? LAB_PROTOCOLS_RESPONSE_ERROR_MESSAGE)
      } else if (res.status === 'with_info' && res.xml) {
        setProtocolsError(null)
        try {
          const parsed = parseLabProtocolsXml(res.xml)
          setProtocolsData(parsed)
        } catch (parseErr) {
          console.error('Ошибка разбора XML протоколов:', parseErr)
          message.error('Ошибка разбора XML протоколов. Проверьте формат документа.')
          setProtocolsData(null)
        }
        setProtocolsModalVisible(true)
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
      width: 300,
      onCell: () => ({ className: 'compliance-doc-actions-cell' }),
      render: (_: any, record: ComplianceDocument) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewAuthority(record)}
            style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
          >
            Уполномоченный орган
          </Button>
          {showLabProtocolsLink && record.docKindCode === '25' && (
            <Button
              type="link"
              onClick={() => handleRequestProtocols(record)}
              style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}
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
            <Descriptions.Item label="Идентификатор">—</Descriptions.Item>
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
          setExpandedProtocolKeys([])
        }}
        footer={[
          <Button key="close" onClick={() => {
            setProtocolsModalVisible(false)
            setSelectedDocument(null)
            setProtocolsData(null)
            setProtocolsError(null)
            setExpandedProtocolKeys([])
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
        ) : protocolsError === 'response_error' ? (
          <div style={{ padding: '20px', textAlign: 'center' }}>
            <p>{LAB_PROTOCOLS_RESPONSE_ERROR_MESSAGE}</p>
          </div>
        ) : protocolsData ? (
          <div>
            {/* Набор атрибутов по продукции (ProductDetails) */}
            {protocolsData.product && (
              <div style={{ marginBottom: 24 }}>
                <h3>Набор атрибутов по продукции</h3>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Идентификатор продукции">
                    {protocolsData.product.productId || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Наименование">
                    {protocolsData.product.productName || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Название продукции">
                    {(() => {
                      const names = protocolsData.product.tradeNames?.length
                        ? protocolsData.product.tradeNames
                        : protocolsData.product.tradeName
                          ? [protocolsData.product.tradeName]
                          : []
                      const s = names.map((n) => (n ?? '').trim()).filter(Boolean).join('; ')
                      return s || '—'
                    })()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Описание">
                    {protocolsData.product.description || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Код ТН ВЭД ЕАЭС">
                    {protocolsData.product.commodityCode || '—'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Техническая документация">
                    {protocolsData.product.technicalDocs && protocolsData.product.technicalDocs.length > 0 ? (
                      protocolsData.product.technicalDocs.map((doc, idx) => (
                        <div key={idx}>
                          {[doc.docKindName, doc.docName, doc.docId, doc.docCreationDate].filter(Boolean).join(', ') || '—'}
                        </div>
                      ))
                    ) : (
                      '—'
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="Назначение">{protocolsData.product.productPurpose || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Способ применения">{protocolsData.product.applicationMethod || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Форма выпуска">{protocolsData.product.releaseForm || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Условия хранения">{protocolsData.product.storageCondition || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Информация с этикетки">{protocolsData.product.labelText || '—'}</Descriptions.Item>
                </Descriptions>
              </div>
            )}

            {/* Протоколы — при раскрытии строки показывается блок «Лаборатория» (DocBinaryText, AnyDetails/XML только если вложены) */}
            <div style={{ marginBottom: 24 }}>
              <h3>Протоколы</h3>
              <Table
                dataSource={protocolsData.protocols}
                columns={[
                  {
                    title: 'Вид',
                    key: 'docKind',
                    render: (_: unknown, record: LaboratoryProtocol) =>
                      record.docKindCode
                        ? (getShipDocKindDisplayLabel(record.docKindCode) || record.docKindName || record.docKindCode)
                        : (record.docKindName ?? ''),
                  },
                  {
                    title: 'Наименование',
                    dataIndex: 'docName',
                    key: 'docName',
                    render: (text: string) => text || '—',
                  },
                  {
                    title: 'Номер',
                    dataIndex: 'docId',
                    key: 'docId',
                    render: (text: string) => text || '—',
                  },
                  {
                    title: 'Дата',
                    dataIndex: 'docCreationDate',
                    key: 'docCreationDate',
                    render: (date: string) => formatDate(date),
                  },
                  {
                    title: 'Документ в бинарном виде',
                    key: 'docBinaryText',
                    width: 120,
                    render: (_: unknown, record: LaboratoryProtocol) =>
                      record.docBinaryText?.content ? (
                        <Button
                          type="link"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => {
                            const bin = record.docBinaryText
                            if (bin?.content) {
                              try {
                                const blob = new Blob([Uint8Array.from(atob(bin.content), (c) => c.charCodeAt(0))], {
                                  type: bin.mediaTypeCode || 'application/octet-stream',
                                })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `document.${bin.mediaTypeCode?.split('/')[1] || 'bin'}`
                                a.click()
                                URL.revokeObjectURL(url)
                              } catch {
                                message.warning('Не удалось скачать документ')
                              }
                            }
                          }}
                        >
                          Скачать{record.docBinaryText?.mediaTypeCode ? ` (${getMediaTypeNameByCode(record.docBinaryText.mediaTypeCode) || record.docBinaryText.mediaTypeCode})` : ''}
                        </Button>
                      ) : (
                        '—'
                      ),
                  },
                ]}
                rowKey={(record, index) => `protocol-${index}`}
                pagination={false}
                size="small"
                expandable={{
                  onExpand: (expanded, record) => {
                    if (expanded && record.laboratory) {
                      const c =
                        record.laboratory.registrationAddress?.country ??
                        record.laboratory.actualAddress?.country ??
                        record.laboratory.mailingAddress?.country ??
                        ''
                      setExpandedLabCountry(c)
                    }
                  },
                  expandedRowRender: (record: LaboratoryProtocol) =>
                    record.laboratory
                      ? renderLaboratoryBlock(record.laboratory, { showTitle: true })
                      : (
                        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 12, margin: '8px 0', background: '#fafafa' }}>
                          <div style={{ fontWeight: 600, marginBottom: 8 }}>Лаборатория</div>
                          <div style={{ color: '#999' }}>Нет данных по лаборатории</div>
                        </div>
                      ),
                }}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

export default ComplianceDocumentsTab

