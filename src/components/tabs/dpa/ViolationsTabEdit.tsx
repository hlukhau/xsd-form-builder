import { useState, useEffect } from 'react'
import { Form, Input, Button, Table, Descriptions, Select, Collapse } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { getMaxLength, validateFieldValue } from '@/constants/xsdFieldConstraints'
import type { ViolationsData, ViolatedRequirement, ViolatedIndicator, DocStructuralElement, TSDData, ProductBatchDetails } from '@/types/card'
import { useTechRegulOptions } from '@/hooks/shared/useTechRegulOptions'
import { useMeasurementUnitOptions } from '@/hooks/shared/useMeasurementUnitOptions'
import { patchTsdTechRegulFromDictionary } from '@/utils/techRegulViolationUtils'

interface ViolationsTabEditProps {
  /** По XSD нарушения только в tsd.batches[].violations */
  tsd: TSDData
  onTsdChange: (tsd: TSDData) => void
}

const ViolationsTabEdit: React.FC<ViolationsTabEditProps> = ({ tsd, onTsdChange }) => {
  const [form] = Form.useForm()
  const [indicatorValueErrors, setIndicatorValueErrors] = useState<Record<string, string>>({})
  const [structuralElementErrors, setStructuralElementErrors] = useState<Record<string, string>>({})
  const { options: techRegulOptions, loading: loadingTechReguls, getSelectOptions: getTechRegulSelectOptions } = useTechRegulOptions()
  const { options: measurementUnitOptions, loading: loadingMeasurementUnits, getSelectOptions: getMeasurementUnitSelectOptions, getUnitByCode } = useMeasurementUnitOptions()
  const [techRegulManualNumErrors, setTechRegulManualNumErrors] = useState<Record<string, string>>({})

  /** После загрузки справочника: TECHREGULCODE из XML → привязка к строке справочника, в номере — REGNUM. */
  useEffect(() => {
    if (loadingTechReguls || techRegulOptions.length === 0 || !onTsdChange) return
    const { next, changed } = patchTsdTechRegulFromDictionary(tsd, techRegulOptions)
    if (changed) onTsdChange(next)
  }, [tsd, loadingTechReguls, techRegulOptions, onTsdChange])

  const indicatorValueErrorKey = (batchIdx: number, violationIdx: number, indicatorIdx: number) =>
    `ind-${batchIdx}-${violationIdx}-${indicatorIdx}`

  const structuralElementErrorKey = (
    batchIdx: number,
    violationIdx: number,
    reqIdx: number,
    elIdx: number,
    field: 'name' | 'id'
  ) => `struct-${batchIdx}-${violationIdx}-${reqIdx}-${elIdx}-${field}`

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
        techRegulDictionaryCode: undefined,
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

    const manualRegErrKey = (reqIndex: number) => `b${batchIndex}-v${violationIndex}-r${reqIndex}`

    const applyTechRegulByCode = (index: number, code: string | undefined) => {
      const list = [...(vData.violatedRequirements || [])]
      if (!code) {
        list[index] = {
          ...list[index],
          technicalRegulationId: '',
          technicalRegulationName: '',
          techRegulDictionaryCode: undefined,
        }
        onVChange({ ...vData, violatedRequirements: list })
        setTechRegulManualNumErrors((prev) => ({ ...prev, [manualRegErrKey(index)]: '' }))
        return
      }
      const opt = techRegulOptions.find((o) => o.code === code)
      if (!opt) return
      const regNum = (opt.regNum ?? '').trim() || opt.code
      list[index] = {
        ...list[index],
        techRegulDictionaryCode: opt.code,
        technicalRegulationId: regNum,
        technicalRegulationName: opt.name,
      }
      onVChange({ ...vData, violatedRequirements: list })
      setTechRegulManualNumErrors((prev) => ({ ...prev, [manualRegErrKey(index)]: '' }))
    }

    const setManualRequirementNumber = (index: number, value: string) => {
      const list = [...(vData.violatedRequirements || [])]
      list[index] = {
        ...list[index],
        technicalRegulationId: value,
        techRegulDictionaryCode: undefined,
      }
      onVChange({ ...vData, violatedRequirements: list })
    }

    const setManualRequirementName = (index: number, value: string) => {
      const list = [...(vData.violatedRequirements || [])]
      list[index] = {
        ...list[index],
        technicalRegulationName: value,
        techRegulDictionaryCode: undefined,
      }
      onVChange({ ...vData, violatedRequirements: list })
    }

    const validateManualRegNum = (index: number, value: string) => {
      const k = manualRegErrKey(index)
      const v = value.trim()
      if (!v) {
        setTechRegulManualNumErrors((prev) => ({ ...prev, [k]: '' }))
        return
      }
      const msg = validateFieldValue('technicalRegulationManualRegNum', v)
      setTechRegulManualNumErrors((prev) => ({ ...prev, [k]: msg || '' }))
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
    const handleMeasurementUnitSelect = (index: number, code: string | undefined) => {
      const updated = [...(vData.violatedIndicators || [])]
      if (!code) {
        updated[index] = { ...updated[index], unitCode: '', unitCodeListId: undefined, unitName: '' }
        onVChange({ ...vData, violatedIndicators: updated })
        return
      }
      const unit = getUnitByCode(code)
      updated[index] = {
        ...updated[index],
        unitCode: code,
        unitCodeListId: '2064',
        unitName: unit?.name ?? updated[index].unitName,
      }
      onVChange({ ...vData, violatedIndicators: updated })
    }

    const getStructuralEditRows = (record: ViolatedRequirement): DocStructuralElement[] =>
      record.structuralElements && record.structuralElements.length > 0
        ? record.structuralElements.map((e) => ({ ...e }))
        : [{ elementName: '', elementId: '' }]

    const commitStructuralElements = (reqIndex: number, rows: DocStructuralElement[]) => {
      const updated = [...(vData.violatedRequirements || [])]
      updated[reqIndex] = { ...updated[reqIndex], structuralElements: rows.length > 0 ? rows : undefined }
      onVChange({ ...vData, violatedRequirements: updated })
    }

    const patchStructuralRow = (reqIndex: number, elIndex: number, patch: Partial<DocStructuralElement>) => {
      const record = (vData.violatedRequirements || [])[reqIndex]
      const rows = getStructuralEditRows(record)
      rows[elIndex] = { ...rows[elIndex], ...patch }
      commitStructuralElements(reqIndex, rows)
    }

    const addStructuralRow = (reqIndex: number) => {
      const record = (vData.violatedRequirements || [])[reqIndex]
      commitStructuralElements(reqIndex, [...getStructuralEditRows(record), { elementName: '', elementId: '' }])
    }

    const removeStructuralRow = (reqIndex: number, elIndex: number) => {
      const record = (vData.violatedRequirements || [])[reqIndex]
      const rows = getStructuralEditRows(record)
      if (rows.length <= 1) {
        commitStructuralElements(reqIndex, [])
        return
      }
      rows.splice(elIndex, 1)
      commitStructuralElements(reqIndex, rows)
    }

    const techRegulSelectProps = {
      showSearch: true,
      loading: loadingTechReguls,
      filterOption: (input: string, option: { label?: unknown; searchText?: string } | undefined) => {
        const q = input.trim().toLowerCase()
        if (!q) return true
        const hay = String(option?.searchText ?? option?.label ?? '').toLowerCase()
        return hay.includes(q)
      },
      optionRender: (oriOption: { data?: { searchText?: string; label?: unknown } }) => {
        const d = oriOption.data
        const text = (d?.searchText ?? d?.label ?? '') as string
        return (
          <span style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{text}</span>
        )
      },
      options: getTechRegulSelectOptions(),
      allowClear: true,
      style: { width: '100%' } as const,
      placeholder: 'Поиск по номеру или наименованию' as const,
    }

    const requirementsColumns = [
      {
        title: labelWithHelp('Номер техрегламента', FIELD_HELP.technicalRegulationId),
        key: 'technicalRegulationId',
        width: 200,
        render: (_: unknown, record: ViolatedRequirement, index: number) => {
          const fromDict = (record.techRegulDictionaryCode ?? '').trim() !== ''
          const errK = manualRegErrKey(index)
          const err = techRegulManualNumErrors[errK]
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Select
                {...techRegulSelectProps}
                value={record.techRegulDictionaryCode || undefined}
                onChange={(code) => applyTechRegulByCode(index, code)}
              />
              {!fromDict ? (
                <div>
                  <Input
                    value={record.technicalRegulationId ?? ''}
                    onChange={(e) => {
                      setManualRequirementNumber(index, e.target.value)
                      validateManualRegNum(index, e.target.value)
                    }}
                    onBlur={(e) => validateManualRegNum(index, e.target.value)}
                    maxLength={getMaxLength('technicalRegulationId')}
                    showCount
                    placeholder="Или номер вручную: ТР ТС 003/2012"
                    status={err ? 'error' : undefined}
                    style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}
                  />
                  {err ? <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>{err}</div> : null}
                </div>
              ) : null}
            </div>
          )
        },
      },
      {
        title: labelWithHelp('Наименование техрегламента', FIELD_HELP.technicalRegulationName),
        key: 'technicalRegulationName',
        width: 320,
        render: (_: unknown, record: ViolatedRequirement, index: number) => {
          const fromDict = (record.techRegulDictionaryCode ?? '').trim() !== ''
          if (fromDict) {
            const id = (record.technicalRegulationId ?? '').trim()
            const name = (record.technicalRegulationName ?? '').trim()
            const line = [id, name].filter(Boolean).join(' — ')
            return (
              <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.65)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                {line || '—'}
                <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', marginTop: 4 }}>Из справочника (редактирование — в колонке «Номер»)</div>
              </div>
            )
          }
          return (
            <Input
              value={record.technicalRegulationName ?? ''}
              onChange={(e) => setManualRequirementName(index, e.target.value)}
              maxLength={getMaxLength('violationTechnicalRegulationName')}
              showCount
              placeholder="Необязательно при вводе номера вручную"
            />
          )
        },
      },
      {
        title: labelWithHelp('Регистрационный номер', FIELD_HELP.registrationNumber),
        key: 'registrationNumber',
        width: 140,
        render: (_: unknown, record: ViolatedRequirement, index: number) => (
          <Input
            value={record.registrationNumber ?? ''}
            onChange={(e) => handleRequirementChange(index, 'registrationNumber', e.target.value)}
            maxLength={getMaxLength('registrationNumber')}
            showCount
          />
        ),
      },
      {
        title: labelWithHelp('Структурные элементы документа', FIELD_HELP.structuralElement),
        key: 'structuralElements',
        width: 460,
        render: (_: unknown, record: ViolatedRequirement, reqIndex: number) => {
          const rows = getStructuralEditRows(record)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 420 }}>
              {rows.map((el, elIdx) => (
                <div
                  key={elIdx}
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 8,
                    flexWrap: 'nowrap',
                    width: '100%',
                  }}
                >
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <Input
                      placeholder="Вид структурного документа"
                      value={el.elementName ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        patchStructuralRow(reqIndex, elIdx, { elementName: v })
                        const k = structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'name')
                        const msg = validateFieldValue('docStructuralElementName', v?.trim() || undefined)
                        setStructuralElementErrors((prev) => (msg ? { ...prev, [k]: msg } : { ...prev, [k]: '' }))
                      }}
                      onBlur={(e) => {
                        const k = structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'name')
                        const msg = validateFieldValue('docStructuralElementName', e.target.value?.trim() || undefined)
                        setStructuralElementErrors((prev) => (msg ? { ...prev, [k]: msg } : { ...prev, [k]: '' }))
                      }}
                      maxLength={getMaxLength('docStructuralElementName')}
                      showCount
                      status={
                        structuralElementErrors[
                          structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'name')
                        ]
                          ? 'error'
                          : undefined
                      }
                      style={{ width: '100%' }}
                    />
                    {structuralElementErrors[
                      structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'name')
                    ] && (
                      <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>
                        {structuralElementErrors[
                          structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'name')
                        ]}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: '1 1 0', minWidth: 0 }}>
                    <Input
                      placeholder="Номер структурного элемента"
                      value={el.elementId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        patchStructuralRow(reqIndex, elIdx, { elementId: v })
                        const k = structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'id')
                        const msg = validateFieldValue('docStructuralElementId', v?.trim() || undefined)
                        setStructuralElementErrors((prev) => (msg ? { ...prev, [k]: msg } : { ...prev, [k]: '' }))
                      }}
                      onBlur={(e) => {
                        const k = structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'id')
                        const msg = validateFieldValue('docStructuralElementId', e.target.value?.trim() || undefined)
                        setStructuralElementErrors((prev) => (msg ? { ...prev, [k]: msg } : { ...prev, [k]: '' }))
                      }}
                      maxLength={getMaxLength('docStructuralElementId')}
                      showCount
                      status={
                        structuralElementErrors[
                          structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'id')
                        ]
                          ? 'error'
                          : undefined
                      }
                      style={{ width: '100%' }}
                    />
                    {structuralElementErrors[
                      structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'id')
                    ] && (
                      <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>
                        {structuralElementErrors[
                          structuralElementErrorKey(batchIndex, violationIndex, reqIndex, elIdx, 'id')
                        ]}
                      </div>
                    )}
                  </div>
                  {rows.length > 1 && (
                    <Button type="link" danger size="small" style={{ padding: 0, height: 'auto', flexShrink: 0 }} onClick={() => removeStructuralRow(reqIndex, elIdx)}>
                      Удалить строку
                    </Button>
                  )}
                </div>
              ))}
              <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => addStructuralRow(reqIndex)}>
                + структурный элемент
              </Button>
            </div>
          )
        },
      },
      { title: 'Описание', key: 'description', width: 400, render: (_: any, record: ViolatedRequirement, index: number) => (<Input.TextArea value={record.description} onChange={(e) => handleRequirementChange(index, 'description', e.target.value)} rows={2} maxLength={getMaxLength('description')} showCount style={{ wordWrap: 'break-word', whiteSpace: 'normal' }} />) },
      { title: 'Действия', key: 'actions', width: 100, render: (_: any, record: ViolatedRequirement, index: number) => (<Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveRequirement(index)}>Удалить</Button>) },
    ]
    const indicatorsColumns = [
      { title: 'Нормативный показатель', key: 'isNormative', width: 150, render: (_: any, record: ViolatedIndicator, index: number) => (<Input type="checkbox" checked={record.isNormative} onChange={(e) => handleIndicatorChange(index, 'isNormative', e.target.checked)} />) },
      { title: labelWithHelp('Наименование показателя', FIELD_HELP.indicatorName), key: 'indicatorName', width: 200, render: (_: any, record: ViolatedIndicator, index: number) => (<Input value={record.indicatorName} onChange={(e) => handleIndicatorChange(index, 'indicatorName', e.target.value)} maxLength={getMaxLength('indicatorName')} showCount />) },
      {
        title: labelWithHelp('Значения показателя', FIELD_HELP.indicatorValue),
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
              />
              {err && <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>{err}</div>}
            </div>
          )
        },
      },
      {
        title: labelWithHelp('Единица измерения', 'Обязательна при указании значения показателя'),
        key: 'unit',
        width: 200,
        render: (_: any, record: ViolatedIndicator, index: number) => {
          const hasValue = (record.indicatorValue ?? '').trim() !== ''
          const missingUnit = hasValue && !(record.unitCode ?? '').trim()
          return (
            <div>
              <Select
                showSearch
                placeholder="Выберите единицу измерения"
                loading={loadingMeasurementUnits}
                value={record.unitCode || undefined}
                onChange={(code) => handleMeasurementUnitSelect(index, code)}
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={getMeasurementUnitSelectOptions()}
                allowClear
                style={{ width: '100%' }}
                status={missingUnit ? 'error' : undefined}
              />
              {missingUnit && <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>Обязательно укажите единицу измерения при указании значения показателя</div>}
            </div>
          )
        },
      },
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
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', marginBottom: 8, maxWidth: 960 }}>
            Техрегламент из справочника: в колонке «Номер техрегламента» в списке показаны строки вида «номер — наименование», доступен поиск по номеру и по наименованию; в карту и XML в поле номера техрегламента попадает только номер (REGNUM), наименование — в отдельное поле. Регистрационный номер вводится отдельно. Вручную: очистите список (×) и укажите номер по шаблону; наименование — по желанию.
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







