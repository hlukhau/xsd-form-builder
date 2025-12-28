import { useState } from 'react'
import { Form, Input, Button, Table, Space, Descriptions, Select } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ViolationsData, ViolatedRequirement, ViolatedIndicator, DocStructuralElement } from '@/types/card'
import { useTechRegulOptions } from '@/hooks/useTechRegulOptions'
import { useMeasurementUnitOptions } from '@/hooks/useMeasurementUnitOptions'

interface ViolationsTabEditProps {
  data: ViolationsData
  onChange: (data: ViolationsData) => void
}

const ViolationsTabEdit: React.FC<ViolationsTabEditProps> = ({ data, onChange }) => {
  const [form] = Form.useForm()
  const { options: techRegulOptions, loading: loadingTechReguls, getSelectOptions: getTechRegulSelectOptions, getNameByCode: getTechRegulNameByCode } = useTechRegulOptions()
  const { options: measurementUnitOptions, loading: loadingMeasurementUnits, getSelectOptions: getMeasurementUnitSelectOptions, getUnitByCode } = useMeasurementUnitOptions()

  const formatDate = (date: string | null | undefined) => {
    if (!date) return '-'
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const handleGeneralDescriptionChange = (value: string) => {
    onChange({
      ...data,
      generalDescription: value,
    })
  }

  const handleAddRequirement = () => {
    const newReq: ViolatedRequirement = {
      technicalRegulationId: '',
      technicalRegulationName: '',
      registrationNumber: '',
      description: '',
    }
    onChange({
      ...data,
      violatedRequirements: [...(data.violatedRequirements || []), newReq],
    })
  }

  const handleRemoveRequirement = (index: number) => {
    const updated = [...(data.violatedRequirements || [])]
    updated.splice(index, 1)
    onChange({
      ...data,
      violatedRequirements: updated,
    })
  }

  const handleRequirementChange = (index: number, field: string, value: any) => {
    console.log(`[ViolationsTabEdit] handleRequirementChange: index=${index}, field=${field}, value=`, value)
    const updated = [...(data.violatedRequirements || [])]
    updated[index] = {
      ...updated[index],
      [field]: value,
    }
    console.log(`[ViolationsTabEdit] Обновленное требование:`, updated[index])
    console.log(`[ViolationsTabEdit] Все требования:`, updated)
    onChange({
      ...data,
      violatedRequirements: updated,
    })
  }

  // Обработчик выбора технического регламента
  const handleTechRegulSelect = (index: number, code: string) => {
    const techRegulOption = techRegulOptions.find(opt => opt.code === code)
    if (techRegulOption) {
      const updated = [...(data.violatedRequirements || [])]
      updated[index] = {
        ...updated[index],
        technicalRegulationId: techRegulOption.code, // Обозначение (код) - TECHREGULCODE
        technicalRegulationName: techRegulOption.name, // Наименование - TECHREGULNAME
        registrationNumber: techRegulOption.regNum || '', // Регистрационный номер - TECHREGULREGNUM
      }
      onChange({
        ...data,
        violatedRequirements: updated,
      })
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
    onChange({
      ...data,
      violatedIndicators: [...(data.violatedIndicators || []), newInd],
    })
  }

  const handleRemoveIndicator = (index: number) => {
    const updated = [...(data.violatedIndicators || [])]
    updated.splice(index, 1)
    onChange({
      ...data,
      violatedIndicators: updated,
    })
  }

  const handleIndicatorChange = (index: number, field: string, value: any) => {
    const updated = [...(data.violatedIndicators || [])]
    updated[index] = {
      ...updated[index],
      [field]: value,
    }
    onChange({
      ...data,
      violatedIndicators: updated,
    })
  }

  // Обработчик выбора единицы измерения
  const handleMeasurementUnitSelect = (index: number, code: string) => {
    const unit = getUnitByCode(code)
    handleIndicatorChange(index, 'unitCode', code)
    handleIndicatorChange(index, 'unitCodeListId', '1025') // measurementUnitCodeListId = 1025
    if (unit) {
      handleIndicatorChange(index, 'unitName', unit.name)
    }
  }

  const requirementsColumns = [
    {
      title: 'Номер техрегламента',
      key: 'technicalRegulationId',
      width: 120,
      render: (_: any, record: ViolatedRequirement, index: number) => (
        <Input
          value={record.technicalRegulationId}
          onChange={(e) => handleRequirementChange(index, 'technicalRegulationId', e.target.value)}
          style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}
        />
      ),
    },
    {
      title: 'Наименование техрегламента',
      key: 'technicalRegulationName',
      width: 300,
      render: (_: any, record: ViolatedRequirement, index: number) => (
        <Select
          showSearch
          placeholder="Выберите техрегламент"
          loading={loadingTechReguls}
          value={record.technicalRegulationId || undefined}
          onChange={(code) => {
            if (code) {
              handleTechRegulSelect(index, code)
            } else {
              // При очистке сбрасываем все поля
              const updated = [...(data.violatedRequirements || [])]
              updated[index] = {
                ...updated[index],
                technicalRegulationId: '',
                technicalRegulationName: '',
              }
              onChange({
                ...data,
                violatedRequirements: updated,
              })
            }
          }}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getTechRegulSelectOptions()}
          allowClear
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Регистрационный номер',
      key: 'registrationNumber',
      width: 120,
      render: (_: any, record: ViolatedRequirement, index: number) => (
        <Input
          value={record.registrationNumber}
          onChange={(e) => handleRequirementChange(index, 'registrationNumber', e.target.value)}
        />
      ),
    },
    {
      title: 'Описание',
      key: 'description',
      width: 500,
      render: (_: any, record: ViolatedRequirement, index: number) => (
        <Input.TextArea
          value={record.description}
          onChange={(e) => handleRequirementChange(index, 'description', e.target.value)}
          rows={2}
          style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: any, record: ViolatedRequirement, index: number) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveRequirement(index)}
        >
          Удалить
        </Button>
      ),
    },
  ]

  const indicatorsColumns = [
    {
      title: 'Нормативный показатель',
      key: 'isNormative',
      width: 150,
      render: (_: any, record: ViolatedIndicator, index: number) => (
        <Input
          type="checkbox"
          checked={record.isNormative}
          onChange={(e) => handleIndicatorChange(index, 'isNormative', e.target.checked)}
        />
      ),
    },
    {
      title: 'Наименование показателя',
      key: 'indicatorName',
      width: 200,
      render: (_: any, record: ViolatedIndicator, index: number) => (
        <Input
          value={record.indicatorName}
          onChange={(e) => handleIndicatorChange(index, 'indicatorName', e.target.value)}
        />
      ),
    },
    {
      title: 'Значение показателя',
      key: 'indicatorValue',
      width: 150,
      render: (_: any, record: ViolatedIndicator, index: number) => (
        <Input
          value={record.indicatorValue}
          onChange={(e) => handleIndicatorChange(index, 'indicatorValue', e.target.value)}
        />
      ),
    },
    {
      title: 'Единица измерения',
      key: 'unit',
      width: 200,
      render: (_: any, record: ViolatedIndicator, index: number) => (
        <Select
          showSearch
          placeholder="Выберите единицу измерения"
          loading={loadingMeasurementUnits}
          value={record.unitCode || undefined}
          onChange={(code) => handleMeasurementUnitSelect(index, code)}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getMeasurementUnitSelectOptions()}
          allowClear
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Примечание',
      key: 'note',
      width: 300,
      render: (_: any, record: ViolatedIndicator, index: number) => (
        <Input.TextArea
          value={record.note}
          onChange={(e) => handleIndicatorChange(index, 'note', e.target.value)}
          rows={2}
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 100,
      render: (_: any, record: ViolatedIndicator, index: number) => (
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveIndicator(index)}
        >
          Удалить
        </Button>
      ),
    },
  ]

  return (
    <div>
      {/* Общая характеристика нарушений */}
      <Form.Item label="Описание нарушения">
        <Input.TextArea
          rows={3}
          value={data.generalDescription}
          onChange={(e) => handleGeneralDescriptionChange(e.target.value)}
        />
      </Form.Item>

      {/* Таблица нарушенных требований */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3>Перечень нарушенных требований</h3>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddRequirement}
          >
            Добавить требование
          </Button>
        </div>
        <Table
          dataSource={data.violatedRequirements || []}
          columns={requirementsColumns}
          rowKey={(record, index) => `requirement-${index}`}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </div>

      {/* Таблица нарушенных показателей */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3>Перечень нарушенных показателей</h3>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddIndicator}
          >
            Добавить показатель
          </Button>
        </div>
        <Table
          dataSource={data.violatedIndicators || []}
          columns={indicatorsColumns}
          rowKey={(record, index) => `indicator-${index}`}
          pagination={false}
          scroll={{ x: 'max-content' }}
        />
      </div>
    </div>
  )
}

export default ViolationsTabEdit







