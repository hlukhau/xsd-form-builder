import { useState } from 'react'
import { Form, Input, Button, Table, Space, Descriptions, Select, Collapse } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { getMaxLength, getFormatHint, validateFieldValue } from '@/constants/xsdFieldConstraints'
import type { ViolationsData, ViolatedRequirement, ViolatedIndicator, DocStructuralElement, TSDData, ProductBatchDetails } from '@/types/card'
import { useTechRegulOptions } from '@/hooks/useTechRegulOptions'
import { useMeasurementUnitOptions } from '@/hooks/useMeasurementUnitOptions'

interface ViolationsTabEditProps {
  /** По XSD нарушения только в tsd.batches[].violations */
  tsd: TSDData
  onTsdChange: (tsd: TSDData) => void
}

const ViolationsTabEdit: React.FC<ViolationsTabEditProps> = ({ tsd, onTsdChange }) => {
  const [form] = Form.useForm()
  const [indicatorValueErrors, setIndicatorValueErrors] = useState<Record<string, string>>({})
  const { options: techRegulOptions, loading: loadingTechReguls, getSelectOptions: getTechRegulSelectOptions, getNameByCode: getTechRegulNameByCode } = useTechRegulOptions()
  const { options: measurementUnitOptions, loading: loadingMeasurementUnits, getSelectOptions: getMeasurementUnitSelectOptions, getUnitByCode } = useMeasurementUnitOptions()

  const indicatorValueErrorKey = (batchIdx: number, violationIdx: number, indicatorIdx: number) =>
    `ind-${batchIdx}-${violationIdx}-${indicatorIdx}`

  const formatDateShort = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const batches = tsd.batches?.length ? tsd.batches : []

  const updateBatchViolations = (batchIndex: number, violationsList: ViolationsData[]) => {
    if (!onTsdChange || !tsd?.batches) return
    const newBatches = [...tsd.batches]
    newBatches[batchIndex] = { ...newBatches[batchIndex], violations: violationsList.length > 0 ? violationsList : undefined }
    onTsdChange({ ...tsd, batches: newBatches })
  }

  /** Возвращает массив нарушений по партии (поддержка старого формата — одно нарушение объектом). */
  const getViolationsListForBatch = (batch: ProductBatchDetails): ViolationsData[] => {
    const raw = batch.violations
    if (Array.isArray(raw)) return raw
    if (raw && typeof raw === 'object') return [raw as ViolationsData]
    return []
  }

  const handleAddViolation = (batchIndex: number) => {
    const list = getViolationsListForBatch(tsd.batches![batchIndex])
    const newViolation: ViolationsData = {
      generalDescription: '',
      violatedRequirements: [],
      violatedIndicators: [],
    }
    updateBatchViolations(batchIndex, [...list, newViolation])
  }

  const handleRemoveViolation = (batchIndex: number, violationIndex: number) => {
    const list = getViolationsListForBatch(tsd.batches![batchIndex])
    const next = list.filter((_, i) => i !== violationIndex)
    updateBatchViolations(batchIndex, next)
  }

  const handleViolationChange = (batchIndex: number, violationIndex: number, next: ViolationsData) => {
    const list = getViolationsListForBatch(tsd.batches![batchIndex])
    const newList = [...list]
    newList[violationIndex] = next
    updateBatchViolations(batchIndex, newList)
  }

  const renderViolationsForm = (vData: ViolationsData, onVChange: (v: ViolationsData) => void, batchIndex: number, violationIndex: number) => {
    const handleGeneralDescriptionChange = (value: string) => onVChange({ ...vData, generalDescription: value })
    const handleAddRequirement = () => {
      const newReq: ViolatedRequirement = {
        technicalRegulationId: '',
        technicalRegulationName: '',
        registrationNumber: '',
        description: '',
      }
      onVChange({ ...vData, violatedRequirements: [...(vData.violatedRequirements || []), newReq] })
    }
    const handleRemoveRequirement = (index: number) => {
      const updated = [...(vData.violatedRequirements || [])]
      updated.splice(index, 1)
      onVChange({ ...vData, violatedRequirements: updated })
    }
    const handleRequirementChange = (index: number, field: string, value: any) => {
      const updated = [...(vData.violatedRequirements || [])]
      updated[index] = { ...updated[index], [field]: value }
      onVChange({ ...vData, violatedRequirements: updated })
    }
    const handleTechRegulSelect = (index: number, code: string) => {
      const techRegulOption = techRegulOptions.find(opt => opt.code === code)
      if (techRegulOption) {
        const updated = [...(vData.violatedRequirements || [])]
        updated[index] = {
          ...updated[index],
          technicalRegulationId: techRegulOption.code,
          technicalRegulationName: techRegulOption.name,
          registrationNumber: techRegulOption.regNum || '',
        }
        onVChange({ ...vData, violatedRequirements: updated })
      }
    }
    const handleAddIndicator = () => {
      const newInd: ViolatedIndicator = {
        isNormative: false,
        indicatorCode: '',
        indicatorName: '',
        indicatorValue: '',
        unitCode: '',
        unitName: '',
        note: '',
      }
      onVChange({ ...vData, violatedIndicators: [...(vData.violatedIndicators || []), newInd] })
    }
    const handleRemoveIndicator = (index: number) => {
      const updated = [...(vData.violatedIndicators || [])]
      updated.splice(index, 1)
      onVChange({ ...vData, violatedIndicators: updated })
    }
    const handleIndicatorChange = (index: number, field: string, value: any) => {
      const updated = [...(vData.violatedIndicators || [])]
      updated[index] = { ...updated[index], [field]: value }
      onVChange({ ...vData, violatedIndicators: updated })
    }
    const handleMeasurementUnitSelect = (index: number, code: string) => {
      const unit = getUnitByCode(code)
      handleIndicatorChange(index, 'unitCode', code)
      handleIndicatorChange(index, 'unitCodeListId', '1025')
      if (unit) handleIndicatorChange(index, 'unitName', unit.name)
    }

    const requirementsColumns = [
      { title: labelWithHelp('Номер техрегламента', FIELD_HELP.technicalRegulationId), key: 'technicalRegulationId', width: 120, render: (_: any, record: ViolatedRequirement, index: number) => (<Input value={record.technicalRegulationId} onChange={(e) => handleRequirementChange(index, 'technicalRegulationId', e.target.value)} maxLength={getMaxLength('technicalRegulationId')} showCount style={{ wordWrap: 'break-word', whiteSpace: 'normal' }} />) },
      { title: labelWithHelp('Наименование техрегламента', FIELD_HELP.technicalRegulationName), key: 'technicalRegulationName', width: 300, render: (_: any, record: ViolatedRequirement, index: number) => (<Select showSearch placeholder="Выберите техрегламент" loading={loadingTechReguls} value={record.technicalRegulationId || undefined} onChange={(code) => code ? handleTechRegulSelect(index, code) : onVChange({ ...vData, violatedRequirements: (vData.violatedRequirements || []).map((r, i) => i === index ? { ...r, technicalRegulationId: '', technicalRegulationName: '' } : r) })} filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} options={getTechRegulSelectOptions()} allowClear style={{ width: '100%' }} />) },
      { title: labelWithHelp('Регистрационный номер', FIELD_HELP.registrationNumber), key: 'registrationNumber', width: 120, render: (_: any, record: ViolatedRequirement, index: number) => (<Input value={record.registrationNumber} onChange={(e) => handleRequirementChange(index, 'registrationNumber', e.target.value)} maxLength={getMaxLength('registrationNumber')} showCount />) },
      { title: 'Описание', key: 'description', width: 500, render: (_: any, record: ViolatedRequirement, index: number) => (<Input.TextArea value={record.description} onChange={(e) => handleRequirementChange(index, 'description', e.target.value)} rows={2} maxLength={getMaxLength('description')} showCount style={{ wordWrap: 'break-word', whiteSpace: 'normal' }} />) },
      { title: 'Действия', key: 'actions', width: 100, render: (_: any, record: ViolatedRequirement, index: number) => (<Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveRequirement(index)}>Удалить</Button>) },
    ]
    const indicatorsColumns = [
      { title: 'Нормативный показатель', key: 'isNormative', width: 150, render: (_: any, record: ViolatedIndicator, index: number) => (<Input type="checkbox" checked={record.isNormative} onChange={(e) => handleIndicatorChange(index, 'isNormative', e.target.checked)} />) },
      { title: labelWithHelp('Наименование показателя', FIELD_HELP.indicatorName), key: 'indicatorName', width: 200, render: (_: any, record: ViolatedIndicator, index: number) => (<Input value={record.indicatorName} onChange={(e) => handleIndicatorChange(index, 'indicatorName', e.target.value)} maxLength={getMaxLength('indicatorName')} showCount />) },
      {
        title: labelWithHelp('Значение показателя', FIELD_HELP.indicatorValue),
        key: 'indicatorValue',
        width: 200,
        render: (_: any, record: ViolatedIndicator, index: number) => {
          const errKey = indicatorValueErrorKey(batchIndex, violationIndex, index)
          const err = indicatorValueErrors[errKey]
          const validate = (value: string) => {
            const msg = validateFieldValue('indicatorValue', value?.trim() || undefined)
            setIndicatorValueErrors((prev) => (msg ? { ...prev, [errKey]: msg } : { ...prev, [errKey]: '' }))
          }
          return (
            <div>
              <Input
                value={record.indicatorValue}
                onChange={(e) => {
                  handleIndicatorChange(index, 'indicatorValue', e.target.value)
                  validate(e.target.value)
                }}
                onBlur={(e) => validate(e.target.value)}
                maxLength={getMaxLength('indicatorValue')}
                showCount
                status={err ? 'error' : undefined}
                placeholder={getFormatHint('indicatorValue')}
              />
              {err && <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>{err}</div>}
            </div>
          )
        },
      },
      { title: 'Единица измерения', key: 'unit', width: 200, render: (_: any, record: ViolatedIndicator, index: number) => (<Select showSearch placeholder="Выберите единицу измерения" loading={loadingMeasurementUnits} value={record.unitCode || undefined} onChange={(code) => handleMeasurementUnitSelect(index, code)} filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())} options={getMeasurementUnitSelectOptions()} allowClear style={{ width: '100%' }} />) },
      { title: labelWithHelp('Примечание', FIELD_HELP.indicatorNote), key: 'note', width: 300, render: (_: any, record: ViolatedIndicator, index: number) => (<Input.TextArea value={record.note} onChange={(e) => handleIndicatorChange(index, 'note', e.target.value)} rows={2} maxLength={getMaxLength('noteText')} showCount />) },
      { title: 'Действия', key: 'actions', width: 100, render: (_: any, record: ViolatedIndicator, index: number) => (<Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveIndicator(index)}>Удалить</Button>) },
    ]

    return (
      <>
        <Form.Item label={labelWithHelp('Описание нарушения', FIELD_HELP.violationDescription)}>
          <Input.TextArea rows={3} value={vData.generalDescription} onChange={(e) => handleGeneralDescriptionChange(e.target.value)} maxLength={getMaxLength('violationDescription')} showCount />
        </Form.Item>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3>Перечень нарушенных требований</h3>
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddRequirement}>Добавить требование</Button>
          </div>
          <Table dataSource={vData.violatedRequirements || []} columns={requirementsColumns} rowKey={(record, index) => `requirement-${index}`} pagination={false} scroll={{ x: 'max-content' }} />
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3>Перечень нарушенных показателей</h3>
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddIndicator}>Добавить показатель</Button>
          </div>
          <Table dataSource={vData.violatedIndicators || []} columns={indicatorsColumns} rowKey={(record, index) => `indicator-${index}`} pagination={false} scroll={{ x: 'max-content' }} />
        </div>
      </>
    )
  }

  if (batches.length === 0) {
    return <div>Нет партий. Добавьте партию во вкладке ТСД.</div>
  }

  return (
      <div>
        <div style={{ marginBottom: 8 }}>
          Нарушения по партиям: <strong>{batches.length}</strong>. Выберите партию для редактирования.
        </div>
        <Collapse
          accordion={false}
          items={batches.map((batch, batchIndex) => {
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
                  {violationsList.length === 0 ? (
                    <div style={{ marginBottom: 16 }}>
                      <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddViolation(batchIndex)} style={{ width: '100%' }}>
                        Добавить нарушение
                      </Button>
                    </div>
                  ) : (
                    violationsList.map((vData, violationIndex) => (
                      <div key={violationIndex} style={{ marginBottom: 24, padding: 16, border: '1px solid #d9d9d9', borderRadius: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <h4 style={{ margin: 0 }}>Нарушение {violationIndex + 1}</h4>
                          <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={() => handleRemoveViolation(batchIndex, violationIndex)}
                            disabled={violationsList.length <= 1}
                          >
                            Удалить нарушение
                          </Button>
                        </div>
                        {renderViolationsForm(vData, (next) => handleViolationChange(batchIndex, violationIndex, next), batchIndex, violationIndex)}
                      </div>
                    ))
                  )}
                  {violationsList.length > 0 && (
                    <Button type="dashed" icon={<PlusOutlined />} onClick={() => handleAddViolation(batchIndex)} style={{ width: '100%' }}>
                      Добавить нарушение
                    </Button>
                  )}
                </div>
              ),
            }
          })}
        />
      </div>
    )
}

export default ViolationsTabEdit







