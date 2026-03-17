import { useState } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Modal, Descriptions, Collapse, Select, message } from 'antd'
import { PlusOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { getMaxLength } from '@/constants/xsdFieldConstraints'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import type { ComplianceDocument, TSDData, ProductBatchDetails } from '@/types/card'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import { useConformityDocKindOptions } from '@/hooks/useConformityDocKindOptions'
import CountrySelect from '@/components/common/CountrySelect'
import { requestLabProtocols } from '@/utils/referenceDataApi'

interface ComplianceDocumentsTabEditProps {
  tsd: TSDData
  onTsdChange: (tsd: TSDData) => void
  /** GUID для запроса протоколов лабораторных исследований (DocKindCode=25) */
  guid?: string | null
}

const ComplianceDocumentsTabEdit: React.FC<ComplianceDocumentsTabEditProps> = ({ tsd, onTsdChange, guid }) => {
  const batches = tsd.batches?.length ? tsd.batches : []
  const [authorityModalVisible, setAuthorityModalVisible] = useState(false)
  const [authorityContext, setAuthorityContext] = useState<{ batchIndex: number; docIndex: number } | null>(null)
  const [protocolsModalVisible, setProtocolsModalVisible] = useState(false)
  const [protocolsLoading, setProtocolsLoading] = useState(false)
  const [protocolsError, setProtocolsError] = useState<'local' | 'source' | null>(null)
  const { countryOptions, loading: loadingCountries, normalizeCountryCode } = useCountryOptions()
  const { getSelectOptions: getConformityDocKindSelectOptions, loading: loadingConformityDocKinds } = useConformityDocKindOptions()

  const formatDateShort = (date: string | null | undefined) => {
    if (!date) return '-'
    const d = new Date(date)
    return isNaN(d.getTime()) ? date : format(d, 'dd.MM.yyyy', { locale: ru })
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

  const handleAuthorityChange = (batchIndex: number, docIndex: number, field: string, value: string) => {
    const batch = batches[batchIndex]
    const docs = [...(batch.complianceDocuments || [])]
    docs[docIndex] = {
      ...docs[docIndex],
      authority: { ...docs[docIndex].authority, [field]: value },
    }
    updateBatchCompliance(batchIndex, docs)
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
        setProtocolsModalVisible(false)
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
          setProtocolsModalVisible(true)
          message.info('Разрешите всплывающие окна для просмотра протоколов')
        }
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
    { title: labelWithHelp('Наименование', FIELD_HELP.complianceDocName), key: 'docName', width: 200, render: (_: any, record: ComplianceDocument, docIndex: number) => (<Input value={record.docName} onChange={(e) => handleDocumentChange(batchIndex, docIndex, 'docName', e.target.value)} maxLength={getMaxLength('docName')} showCount />) },
    { title: 'Номер', key: 'docId', width: 150, render: (_: any, record: ComplianceDocument, docIndex: number) => (<Input value={record.docId} onChange={(e) => handleDocumentChange(batchIndex, docIndex, 'docId', e.target.value)} maxLength={getMaxLength('docId')} showCount />) },
    { title: labelWithHelp('Дата', FIELD_HELP.complianceDocCreationDate), key: 'docCreationDate', width: 150, render: (_: any, record: ComplianceDocument, docIndex: number) => (<DatePicker format={DATE_DISPLAY_FORMAT} value={record.docCreationDate ? dayjs(record.docCreationDate) : null} onChange={(date) => handleDocumentChange(batchIndex, docIndex, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')} style={{ width: '100%' }} />) },
    {
      title: 'Действия',
      key: 'actions',
      width: 200,
      render: (_: any, record: ComplianceDocument, docIndex: number) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => { setAuthorityContext({ batchIndex, docIndex }); setAuthorityModalVisible(true) }} style={{ padding: 0, height: 'auto' }}>
            {labelWithHelp('Уполномоченный орган', FIELD_HELP.complianceAuthority)}
          </Button>
          {record.docKindCode === '25' && (
            <Button type="link" onClick={() => handleRequestProtocols(record)} style={{ padding: 0, height: 'auto' }}>
              Протоколы лабораторных исследований
            </Button>
          )}
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveDocument(batchIndex, docIndex)} style={{ padding: 0, height: 'auto' }}>
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
        title={labelWithHelp('Уполномоченный орган', FIELD_HELP.complianceAuthority)}
        open={authorityModalVisible}
        onCancel={() => { setAuthorityModalVisible(false); setAuthorityContext(null) }}
        footer={[<Button key="close" onClick={() => { setAuthorityModalVisible(false); setAuthorityContext(null) }}>Закрыть</Button>]}
        width={600}
      >
        {authorityContext !== null && batches[authorityContext.batchIndex]?.complianceDocuments?.[authorityContext.docIndex] && (
          <Form layout="vertical" className="field-tag-form">
            <Form.Item label="Страна">
              <CountrySelect
                value={batches[authorityContext.batchIndex].complianceDocuments![authorityContext.docIndex].authority?.country}
                onChange={(value) => handleAuthorityChange(authorityContext.batchIndex, authorityContext.docIndex, 'country', value || '')}
                loading={loadingCountries}
                countryOptions={countryOptions}
                normalizeCountryCode={normalizeCountryCode}
              />
            </Form.Item>
            <Form.Item label="Наименование">
              <Input
                value={batches[authorityContext.batchIndex].complianceDocuments![authorityContext.docIndex].authority?.authorityName}
                onChange={(e) => handleAuthorityChange(authorityContext.batchIndex, authorityContext.docIndex, 'authorityName', e.target.value)}
                maxLength={getMaxLength('authorityName')}
                showCount
              />
            </Form.Item>
            <Form.Item label="Краткое наименование">
              <Input
                value={batches[authorityContext.batchIndex].complianceDocuments![authorityContext.docIndex].authority?.authorityBriefName}
                onChange={(e) => handleAuthorityChange(authorityContext.batchIndex, authorityContext.docIndex, 'authorityBriefName', e.target.value)}
                maxLength={getMaxLength('authorityBriefName')}
                showCount
              />
            </Form.Item>
            <Form.Item label="Идентификатор">
              <Input
                value={batches[authorityContext.batchIndex].complianceDocuments![authorityContext.docIndex].authority?.authorityId}
                onChange={(e) => handleAuthorityChange(authorityContext.batchIndex, authorityContext.docIndex, 'authorityId', e.target.value)}
                maxLength={getMaxLength('authorityId')}
                showCount
              />
            </Form.Item>
          </Form>
        )}
      </Modal>

      <Modal
        title="Протоколы лабораторных исследований"
        open={protocolsModalVisible}
        onCancel={() => { setProtocolsModalVisible(false); setProtocolsError(null) }}
        footer={[<Button key="close" onClick={() => { setProtocolsModalVisible(false); setProtocolsError(null) }}>OK</Button>]}
        width={500}
      >
        {protocolsLoading ? (
          <div>Загрузка данных...</div>
        ) : protocolsError === 'local' ? (
          <p>Запрошенные сведения отсутствуют в локальной базе данных. Выполнен запрос сведений к первоисточнику.</p>
        ) : protocolsError === 'source' ? (
          <p>Запрошенные сведения отсутствуют у первоисточника.</p>
        ) : null}
      </Modal>
    </div>
  )
}

export default ComplianceDocumentsTabEdit
