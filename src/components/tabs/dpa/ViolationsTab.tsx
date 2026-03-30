import { Descriptions, Table, Collapse } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ViolationsData, ViolatedRequirement, ViolatedIndicator, TSDData } from '@/types/card'
import { useMeasurementUnitOptions } from '@/hooks/shared/useMeasurementUnitOptions'

interface ViolationsTabProps {
  /** По XSD нарушения только в tsd.batches[].violations */
  tsd: TSDData | null | undefined
}

const ViolationsTab: React.FC<ViolationsTabProps> = ({ tsd }) => {
  const { getDisplayLabel: getMeasurementUnitDisplayLabel } = useMeasurementUnitOptions()
  const formatStructuralElements = (elements?: Array<{ elementName?: string; elementId?: string }>) => {
    if (!elements || elements.length === 0) return '-'
    return elements.map((el, idx) => {
      const name = el.elementName || ''
      const id = el.elementId || ''
      return `${name}${id ? ` ${id}` : ''}`
    }).join('; ')
  }

  const requirementsColumns = [
    {
      title: 'Номер техрегламента',
      dataIndex: 'technicalRegulationId',
      key: 'technicalRegulationId',
      width: 120,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Наименование техрегламента',
      dataIndex: 'technicalRegulationName',
      key: 'technicalRegulationName',
      width: 180,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Регистрационный номер',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
      width: 120,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Вид структурного элемента',
      key: 'structuralElementName',
      width: 120,
      render: (_: any, record: ViolatedRequirement) => {
        if (!record.structuralElements || record.structuralElements.length === 0) return '-'
        const text = record.structuralElements.map(el => el.elementName || '-').join('; ')
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Номер структурного элемента',
      key: 'structuralElementId',
      width: 120,
      render: (_: any, record: ViolatedRequirement) => {
        if (!record.structuralElements || record.structuralElements.length === 0) return '-'
        const text = record.structuralElements.map(el => el.elementId || '-').join('; ')
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Описание',
      dataIndex: 'description',
      key: 'description',
      width: 500,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
  ]

  const indicatorsColumns = [
    {
      title: 'Нормативный показатель',
      key: 'isNormative',
      width: 150,
      render: (_: any, record: ViolatedIndicator) => {
        const text = record.isNormative === undefined 
          ? '-' 
          : (record.isNormative ? 'Да (нормативный)' : 'Нет (фактический)')
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text}
          </div>
        )
      },
    },
    {
      title: 'Наименование показателя',
      dataIndex: 'indicatorName',
      key: 'indicatorName',
      width: 200,
      render: (text: string, record: ViolatedIndicator) => {
        const displayText = text || record.indicatorCode || '-'
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {displayText}
          </div>
        )
      },
    },
    {
      title: 'Значения показателя',
      dataIndex: 'indicatorValue',
      key: 'indicatorValue',
      width: 150,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
    {
      title: 'Единица измерения',
      key: 'unit',
      width: 150,
      render: (_: any, record: ViolatedIndicator) => {
        const text = record.unitCode
          ? (getMeasurementUnitDisplayLabel(record.unitCode) || record.unitName || record.unitCode)
          : (record.unitName || record.unitCode || '-')
        return (
          <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
            {text || '-'}
          </div>
        )
      },
    },
    {
      title: 'Примечание',
      dataIndex: 'note',
      key: 'note',
      width: 300,
      render: (text: string) => (
        <div style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
          {text || '-'}
        </div>
      ),
    },
  ]

  const formatDateShort = (date: string | null | undefined) => {
    if (!date) return '-'
    const d = new Date(date)
    return isNaN(d.getTime()) ? date : format(d, 'dd.MM.yyyy', { locale: ru })
  }

  const hasViolationContent = (v: ViolationsData) =>
    (v.violatedRequirements?.length ?? 0) > 0 ||
    (v.violatedIndicators?.length ?? 0) > 0 ||
    !!v.generalDescription

  const getViolationsListForBatch = (batch: { violations?: ViolationsData[] }) => {
    const raw = batch.violations
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') return [raw as ViolationsData]
    return []
  }

  const batchesWithViolations = tsd?.batches?.filter((b) => getViolationsListForBatch(b).some(hasViolationContent)) ?? []
  const useBatches = batchesWithViolations.length > 0

  const renderViolationsContent = (violationsData: ViolationsData) => (
    <>
      {violationsData.generalDescription && (
        <div style={{ marginBottom: '16px' }}>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="Описание нарушения">
              {violationsData.generalDescription}
            </Descriptions.Item>
          </Descriptions>
        </div>
      )}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ marginBottom: 8 }}>Перечень нарушенных требований</h4>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <Table
            dataSource={violationsData.violatedRequirements || []}
            columns={requirementsColumns}
            rowKey={(record, index) => `req-${index}`}
            pagination={false}
            size="small"
            style={{ width: '100%' }}
          />
        </div>
      </div>
      <div>
        <h4 style={{ marginBottom: 8 }}>Перечень нарушенных показателей</h4>
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <Table
            dataSource={violationsData.violatedIndicators || []}
            columns={indicatorsColumns}
            rowKey={(record, index) => `ind-${index}`}
            pagination={false}
            size="small"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </>
  )

  if (!useBatches) {
    return <div>Данные о нарушениях не найдены. Добавьте партию во вкладке ТСД и укажите нарушения в составе партии.</div>
  }

  return (
      <div>
        <div style={{ marginBottom: 8 }}>
          Нарушения по партиям: <strong>{batchesWithViolations.length}</strong>.
        </div>
        <Collapse
          accordion={false}
          items={batchesWithViolations.map((batch, idx) => {
            const batchIndex = tsd!.batches!.indexOf(batch)
            const violationsList = getViolationsListForBatch(batch)
            const totalReqs = violationsList.reduce((s, v) => s + (v.violatedRequirements?.length ?? 0), 0)
            const totalInds = violationsList.reduce((s, v) => s + (v.violatedIndicators?.length ?? 0), 0)
            return {
              key: String(batchIndex),
              label: `Партия ${batchIndex + 1}${batch.batchId ? ` — № ${batch.batchId}` : ''}${batch.manufactureDate ? ` (производство: ${formatDateShort(batch.manufactureDate)})` : ''} (нарушений: ${violationsList.length}, требований: ${totalReqs}, показателей: ${totalInds})`,
              children: (
                <div>
                  <Descriptions column={1} bordered size="small" style={{ marginBottom: 12 }}>
                    <Descriptions.Item label="Номер серии товара">{batch.batchId || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Дата производства">{formatDateShort(batch.manufactureDate)}</Descriptions.Item>
                    <Descriptions.Item label="Номер товарной партии">{batch.consignmentId || '-'}</Descriptions.Item>
                  </Descriptions>
                  {violationsList.map((v, violationIndex) => (
                    <div key={violationIndex} style={{ marginBottom: 24 }}>
                      <h4 style={{ marginBottom: 8 }}>Нарушение {violationIndex + 1}</h4>
                      {renderViolationsContent(v)}
                    </div>
                  ))}
                </div>
              ),
            }
          })}
        />
      </div>
  )
}

export default ViolationsTab

