import { useMemo, useState } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Modal, Descriptions, Collapse, Select, message } from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined, DownloadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { getMaxLength } from '@/constants/xsdFieldConstraints'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import type { ComplianceDocument, TSDData, ProductBatchDetails, LaboratoryProtocolsData, LaboratoryProtocol, LaboratoryDetails } from '@/types/card'
import { LaboratoryBlockContent } from './ComplianceDocumentsTab'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useConformityDocKindOptions } from '@/hooks/shared/useConformityDocKindOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { useLegalFormOptions } from '@/hooks/shared/useLegalFormOptions'
import { useIdentificationMethodOptions } from '@/hooks/shared/useIdentificationMethodOptions'
import { useMediaTypeOptions } from '@/hooks/shared/useMediaTypeOptions'
import { DpaEmbeddedUnifiedAuthorityForm } from '@/components/common/DpaEmbeddedUnifiedAuthorityForm'
import { requestLabProtocols, LAB_PROTOCOLS_RESPONSE_ERROR_MESSAGE } from '@/utils/referenceDataApi'
import { parseLabProtocolsXml } from '@/utils/labProtocolsXmlParser'
import {
  LAB_PROTOCOLS_DOC_ID_COUNTRY_MISMATCH_WARNING,
  registrationCertificateDocIdMatchesAuthorityCountry,
} from '@/utils/registrationCertificateCountryMatch'
import {
  getAddressListFromParty,
  formatAddressList,
  formatAddressLine,
  getDefaultAddressKindName,
  getDefaultCountryName,
} from '@/utils/addressFormatUtils'

interface ComplianceDocumentsTabEditProps {
  tsd: TSDData
  onTsdChange: (tsd: TSDData) => void
  /** GUID для запроса протоколов лабораторных исследований (DocKindCode=25) */
  guid?: string | null
  /** Ссылка «Протоколы лабораторных исследований»; для SMD/ОП 58 отключена */
  showLabProtocolsLink?: boolean
}

const EAUE_COUNTRY_CODES = new Set(['AM', 'BY', 'KZ', 'KG', 'RU'])

const ComplianceDocumentsTabEdit: React.FC<ComplianceDocumentsTabEditProps> = ({
  tsd,
  onTsdChange,
  guid,
  showLabProtocolsLink = true,
}) => {
  const batches = tsd.batches?.length ? tsd.batches : []
  const [authorityModalVisible, setAuthorityModalVisible] = useState(false)
  const [authorityContext, setAuthorityContext] = useState<{ batchIndex: number; docIndex: number } | null>(null)
  const [protocolsModalVisible, setProtocolsModalVisible] = useState(false)
  const [protocolsLoading, setProtocolsLoading] = useState(false)
  const [protocolsError, setProtocolsError] = useState<'local' | 'source' | 'response_error' | null>(null)
  const [protocolsData, setProtocolsData] = useState<LaboratoryProtocolsData | null>(null)
  const [expandedLabCountry, setExpandedLabCountry] = useState<string>('')
  const { countryOptions, loading: loadingCountries, normalizeCountryCode, getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const eaueCountryOptions = useMemo(
    () => countryOptions.filter((opt) => EAUE_COUNTRY_CODES.has(String(opt.code || '').toUpperCase())),
    [countryOptions]
  )
  const { getSelectOptions: getConformityDocKindSelectOptions, loading: loadingConformityDocKinds } = useConformityDocKindOptions()
  const labCountry = expandedLabCountry
  const { getDisplayLabel: getShipDocKindDisplayLabel } = useShipDocKindOptions()
  const { getNameByCode: getMediaTypeNameByCode } = useMediaTypeOptions()
  const { getNameByCode: getLegalFormNameByCode } = useLegalFormOptions(labCountry)
  const { getDisplayLabel: getIdentificationMethodDisplayLabel } = useIdentificationMethodOptions(labCountry)
  const getCountryNameForAddress = (code?: string) => getCountryDisplayLabel(code) || getDefaultCountryName(code) || '—'
  const formatDate = (date: string | null | undefined) => {
    if (!date) return '—'
    const d = new Date(date)
    return isNaN(d.getTime()) ? date : format(d, 'dd.MM.yyyy', { locale: ru })
  }

  const formatDateShort = (date: string | null | undefined) => {
    if (!date) return '-'
    const d = new Date(date)
    return isNaN(d.getTime()) ? date : format(d, 'dd.MM.yyyy', { locale: ru })
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

  const updateBatchCompliance = (batchIndex: number, docs: ComplianceDocument[]) => {
    const newBatches = [...tsd.batches]
    newBatches[batchIndex] = { ...newBatches[batchIndex], complianceDocuments: docs }
    onTsdChange({ ...tsd, batches: newBatches })
  }

  const handleAddDocument = (batchIndex: number) => {
    const batch = batches[batchIndex]
    const docs = [...(batch.complianceDocuments || []), { docKindCode: '', docName: '', docId: '', docCreationDate: '', docStartDate: '' } as ComplianceDocument]
    updateBatchCompliance(batchIndex, docs)
  }

  const handleRemoveDocument = (batchIndex: number, docIndex: number) => {
    const batch = batches[batchIndex]
    const docs = [...(batch.complianceDocuments || [])]
    docs.splice(docIndex, 1)
    updateBatchCompliance(batchIndex, docs)
  }

  const handleDocumentChange = (batchIndex: number, docIndex: number, field: string, value: any) => {
    const batch = batches[batchIndex]
    const docs = [...(batch.complianceDocuments || [])]
    docs[docIndex] = { ...docs[docIndex], [field]: value }
    updateBatchCompliance(batchIndex, docs)
  }

  const handleAuthoritySectionChange = (batchIndex: number, docIndex: number, next: NonNullable<ComplianceDocument['authority']>) => {
    const batch = batches[batchIndex]
    const docs = [...(batch.complianceDocuments || [])]
    const { authorityId: _omit, ...sanitized } = next
    docs[docIndex] = {
      ...docs[docIndex],
      authority: sanitized,
    }
    updateBatchCompliance(batchIndex, docs)
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

  const getColumns = (batchIndex: number) => [
    {
      title: labelWithHelp('Вид', FIELD_HELP.complianceDocKindCode),
      key: 'docKindCode',
      width: '30%',
      ellipsis: false,
      onCell: () => ({ className: 'compliance-doc-kind-edit-cell' }),
      render: (_: any, record: ComplianceDocument, docIndex: number) => (
        <div className="compliance-doc-kind-cell">
          <Select
            showSearch
            placeholder="Код — наименование"
            loading={loadingConformityDocKinds}
            value={record.docKindCode || undefined}
            onChange={(code) => handleDocumentChange(batchIndex, docIndex, 'docKindCode', code ?? '')}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={getConformityDocKindSelectOptions()}
            allowClear
            style={{ width: '100%' }}
            size="small"
            dropdownStyle={{ minWidth: 320 }}
            optionLabelProp="label"
          />
        </div>
      ),
    },
    { title: labelWithHelp('Наименование', FIELD_HELP.complianceDocName), key: 'docName', width: 200, render: (_: any, record: ComplianceDocument, docIndex: number) => (<Input value={record.docName} onChange={(e) => handleDocumentChange(batchIndex, docIndex, 'docName', e.target.value)} maxLength={getMaxLength('docName500')} showCount />) },
    { title: 'Номер', key: 'docId', width: 150, render: (_: any, record: ComplianceDocument, docIndex: number) => (<Input value={record.docId} onChange={(e) => handleDocumentChange(batchIndex, docIndex, 'docId', e.target.value)} maxLength={getMaxLength('docId')} showCount />) },
    { title: labelWithHelp('Дата', FIELD_HELP.complianceDocCreationDate), key: 'docCreationDate', width: 150, render: (_: any, record: ComplianceDocument, docIndex: number) => (<DatePicker format={DATE_DISPLAY_FORMAT} value={record.docCreationDate ? dayjs(record.docCreationDate) : null} onChange={(date) => handleDocumentChange(batchIndex, docIndex, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')} style={{ width: '100%' }} />) },
    {
      title: labelWithHelp('Дата начала срока действия', FIELD_HELP.complianceDocStartDate),
      key: 'docStartDate',
      width: 200,
      render: (_: any, record: ComplianceDocument, docIndex: number) => (
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={record.docStartDate ? dayjs(record.docStartDate) : null}
          onChange={(date) =>
            handleDocumentChange(batchIndex, docIndex, 'docStartDate', date ? date.format('YYYY-MM-DD') : '')
          }
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 300,
      onCell: () => ({ className: 'compliance-doc-actions-cell' }),
      render: (_: any, record: ComplianceDocument, docIndex: number) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => { setAuthorityContext({ batchIndex, docIndex }); setAuthorityModalVisible(true) }} style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}>
            Уполномоченный орган
          </Button>
          {showLabProtocolsLink && record.docKindCode === '25' && (
            <Button type="link" onClick={() => handleRequestProtocols(record)} style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}>
              Протоколы лабораторных исследований
            </Button>
          )}
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveDocument(batchIndex, docIndex)} style={{ padding: 0, height: 'auto', whiteSpace: 'normal', textAlign: 'left' }}>
            Удалить
          </Button>
        </div>
      ),
    },
  ]

  if (batches.length === 0) {
    return <div>Нет партий. Добавьте партию во вкладке ТСД.</div>
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>Документы соответствия по партиям: <strong>{batches.length}</strong>.</div>
      <Collapse
        accordion={false}
        items={batches.map((batch, batchIndex) => {
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h4 style={{ margin: 0 }}>Документы соответствия</h4>
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddDocument(batchIndex)}>Добавить документ</Button>
                </div>
                <Table
                  className="compliance-docs-edit-table"
                  dataSource={docs}
                  columns={getColumns(batchIndex)}
                  rowKey={(_, i) => `batch-${batchIndex}-doc-${i}`}
                  pagination={false}
                  tableLayout="fixed"
                />
              </div>
            ),
          }
        })}
      />

      <Modal
        title="Уполномоченный орган"
        open={authorityModalVisible}
        onCancel={() => { setAuthorityModalVisible(false); setAuthorityContext(null) }}
        footer={[<Button key="close" onClick={() => { setAuthorityModalVisible(false); setAuthorityContext(null) }}>Закрыть</Button>]}
        width={600}
      >
        {authorityContext !== null && batches[authorityContext.batchIndex]?.complianceDocuments?.[authorityContext.docIndex] && (
          <Form layout="vertical">
            <DpaEmbeddedUnifiedAuthorityForm
              value={batches[authorityContext.batchIndex].complianceDocuments![authorityContext.docIndex].authority ?? {}}
              onChange={(next) => handleAuthoritySectionChange(authorityContext.batchIndex, authorityContext.docIndex, next)}
              countryOptions={eaueCountryOptions}
              loadingCountries={loadingCountries}
              normalizeCountryCode={normalizeCountryCode}
              userFacingLabels
            />
          </Form>
        )}
      </Modal>

      <Modal
        title="Протоколы лабораторных исследований"
        open={protocolsModalVisible}
        onCancel={() => { setProtocolsModalVisible(false); setProtocolsError(null); setProtocolsData(null) }}
        footer={[<Button key="close" onClick={() => { setProtocolsModalVisible(false); setProtocolsError(null); setProtocolsData(null) }}>OK</Button>]}
        width={1000}
      >
        {protocolsLoading ? (
          <div>Загрузка данных...</div>
        ) : protocolsError === 'local' ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <p>Запрошенные сведения отсутствуют в локальной базе данных. Выполнен запрос сведений к первоисточнику.</p>
          </div>
        ) : protocolsError === 'source' ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <p>Запрошенные сведения отсутствуют у первоисточника.</p>
          </div>
        ) : protocolsError === 'response_error' ? (
          <div style={{ padding: 20, textAlign: 'center' }}>
            <p>{LAB_PROTOCOLS_RESPONSE_ERROR_MESSAGE}</p>
          </div>
        ) : protocolsData ? (
          <div>
            {protocolsData.product && (
              <div style={{ marginBottom: 24 }}>
                <h3>Набор атрибутов по продукции</h3>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Идентификатор продукции">{protocolsData.product.productId || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Наименование">{protocolsData.product.productName || '—'}</Descriptions.Item>
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
                  <Descriptions.Item label="Описание">{protocolsData.product.description || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Код ТН ВЭД ЕАЭС">{protocolsData.product.commodityCode || '—'}</Descriptions.Item>
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
            <div style={{ marginBottom: 24 }}>
              <h3>Протоколы</h3>
              <Table
                dataSource={protocolsData.protocols}
                size="small"
                rowKey={(_, i) => `protocol-${i}`}
                pagination={false}
                columns={[
                  { title: 'Вид', key: 'docKind', render: (_: unknown, r: LaboratoryProtocol) => r.docKindCode ? (getShipDocKindDisplayLabel(r.docKindCode) || r.docKindName || r.docKindCode) : (r.docKindName ?? '') },
                  { title: 'Наименование', dataIndex: 'docName', key: 'docName', render: (t: string) => t || '—' },
                  { title: 'Номер', dataIndex: 'docId', key: 'docId', render: (t: string) => t || '—' },
                  { title: 'Дата', dataIndex: 'docCreationDate', key: 'docCreationDate', render: (d: string) => formatDate(d) },
                  {
                    title: 'Документ в бинарном виде',
                    key: 'docBinaryText',
                    width: 120,
                    render: (_: unknown, r: LaboratoryProtocol) =>
                      r.docBinaryText?.content ? (
                        <Button
                          type="link"
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() => {
                            const bin = r.docBinaryText
                            if (bin?.content) {
                              try {
                                const blob = new Blob([Uint8Array.from(atob(bin.content), (c) => c.charCodeAt(0))], { type: bin.mediaTypeCode || 'application/octet-stream' })
                                const a = document.createElement('a')
                                a.href = URL.createObjectURL(blob)
                                a.download = `document.${bin.mediaTypeCode?.split('/')[1] || 'bin'}`
                                a.click()
                                URL.revokeObjectURL(a.href)
                              } catch {
                                message.warning('Не удалось скачать документ')
                              }
                            }
                          }}
                        >
                          Скачать{r.docBinaryText?.mediaTypeCode ? ` (${getMediaTypeNameByCode(r.docBinaryText.mediaTypeCode) || r.docBinaryText.mediaTypeCode})` : ''}
                        </Button>
                      ) : '—',
                  },
                ]}
                expandable={{
                  onExpand: (expanded, record) => {
                    if (expanded && record.laboratory) setExpandedLabCountry(record.laboratory.registrationAddress?.country ?? record.laboratory.actualAddress?.country ?? record.laboratory.mailingAddress?.country ?? '')
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

export default ComplianceDocumentsTabEdit
