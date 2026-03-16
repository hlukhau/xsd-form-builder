import { useState } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Modal, Descriptions, Collapse, Select } from 'antd'
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

interface ComplianceDocumentsTabEditProps {
  tsd: TSDData
  onTsdChange: (tsd: TSDData) => void
}

const ComplianceDocumentsTabEdit: React.FC<ComplianceDocumentsTabEditProps> = ({ tsd, onTsdChange }) => {
  const batches = tsd.batches?.length ? tsd.batches : []
  const [authorityModalVisible, setAuthorityModalVisible] = useState(false)
  const [authorityContext, setAuthorityContext] = useState<{ batchIndex: number; docIndex: number } | null>(null)
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

  const getColumns = (batchIndex: number) => [
    {
      title: labelWithHelp('Вид', FIELD_HELP.complianceDocKindCode),
      key: 'docKindCode',
      width: 220,
      render: (_: any, record: ComplianceDocument, docIndex: number) => (
        <Select
          showSearch
          placeholder="Код — наименование (CONFDOCKIND)"
          loading={loadingConformityDocKinds}
          value={record.docKindCode || undefined}
          onChange={(code) => handleDocumentChange(batchIndex, docIndex, 'docKindCode', code ?? '')}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getConformityDocKindSelectOptions()}
          allowClear
          style={{ width: '100%', minWidth: 180 }}
          size="small"
        />
      ),
    },
    { title: labelWithHelp('Наименование', FIELD_HELP.complianceDocName), key: 'docName', width: 200, render: (_: any, record: ComplianceDocument, docIndex: number) => (<Input value={record.docName} onChange={(e) => handleDocumentChange(batchIndex, docIndex, 'docName', e.target.value)} maxLength={getMaxLength('docName')} showCount />) },
    { title: 'Номер', key: 'docId', width: 150, render: (_: any, record: ComplianceDocument, docIndex: number) => (<Input value={record.docId} onChange={(e) => handleDocumentChange(batchIndex, docIndex, 'docId', e.target.value)} maxLength={getMaxLength('docId')} showCount />) },
    { title: labelWithHelp('Дата', FIELD_HELP.complianceDocCreationDate), key: 'docCreationDate', width: 150, render: (_: any, record: ComplianceDocument, docIndex: number) => (<DatePicker format={DATE_DISPLAY_FORMAT} value={record.docCreationDate ? dayjs(record.docCreationDate) : null} onChange={(date) => handleDocumentChange(batchIndex, docIndex, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')} style={{ width: '100%' }} />) },
    { title: 'Действия', key: 'actions', width: 200, render: (_: any, record: ComplianceDocument, docIndex: number) => (<Space><Button type="link" icon={<EyeOutlined />} onClick={() => { setAuthorityContext({ batchIndex, docIndex }); setAuthorityModalVisible(true) }}>{labelWithHelp('Уполномоченный орган', FIELD_HELP.complianceAuthority)}</Button><Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveDocument(batchIndex, docIndex)}>Удалить</Button></Space>) },
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
                  dataSource={docs}
                  columns={getColumns(batchIndex)}
                  rowKey={(_, i) => `batch-${batchIndex}-doc-${i}`}
                  pagination={false}
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
    </div>
  )
}

export default ComplianceDocumentsTabEdit
