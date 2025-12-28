import { useState } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Collapse, Select } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ManufacturerDetailsEdit from '../common/ManufacturerDetailsEdit'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/useSanitaryMeasureObjKindOptions'
import { useSanitaryMeasureOptions } from '@/hooks/useSanitaryMeasureOptions'
import CountrySelect from '@/components/common/CountrySelect'
import type { CountryOption } from '@/utils/referenceDataApi'
import type {
  MeasuresData,
  SanitaryMeasure,
  MeasureDocDetails,
  MeasureInitiationBasisItem,
  MeasureImplementationItem,
  SubjectDetails,
  DocumentReferenceDetails,
  MeasurePlaceDetails,
  UnifiedAuthorityDetails,
  BusinessEntityDetails,
  IdentityDocDetails,
  AddressDetails,
  ContactDetails,
} from '@/types/card'

interface MeasuresTabEditProps {
  data: MeasuresData
  onChange: (data: MeasuresData) => void
}

const MeasuresTabEdit: React.FC<MeasuresTabEditProps> = ({ data, onChange }) => {
  const [selectedMeasureIndex, setSelectedMeasureIndex] = useState<number | null>(null)
  const [selectedImplementationIndex, setSelectedImplementationIndex] = useState<number | null>(null)
  const { countryOptions, loading: loadingCountries, normalizeCountryCode } = useCountryOptions()
  const { getSelectOptions: getSanitaryMeasureObjKindSelectOptions, getNameByCode: getSanitaryMeasureObjKindNameByCode } = useSanitaryMeasureObjKindOptions()
  const { getSelectOptions: getSanitaryMeasureSelectOptions, loading: loadingSanitaryMeasures } = useSanitaryMeasureOptions()

  const handleAddMeasure = () => {
    const newMeasure: SanitaryMeasure = {
      languageCode: 'ru',
      measureName: '',
      startDate: '',
    }
    onChange({
      ...data,
      measures: [...(data.measures || []), newMeasure],
    })
  }

  const handleRemoveMeasure = (index: number) => {
    const updated = [...(data.measures || [])]
    updated.splice(index, 1)
    onChange({
      ...data,
      measures: updated,
    })
  }

  const handleMeasureChange = (index: number, field: string, value: any) => {
    const updated = [...(data.measures || [])]
    updated[index] = {
      ...updated[index],
      [field]: value,
    }
    onChange({
      ...data,
      measures: updated,
    })
  }

  // MeasureDocDetails handlers
  const handleMeasureDocChange = (measureIndex: number, field: string, value: any) => {
    const measure = data.measures[measureIndex]
    handleMeasureChange(measureIndex, 'measureDocDetails', {
      ...measure.measureDocDetails,
      [field]: value,
    })
  }

  const handleInitialMeasureDocChange = (measureIndex: number, field: string, value: any) => {
    const measure = data.measures[measureIndex]
    handleMeasureChange(measureIndex, 'initialMeasureDocDetails', {
      ...measure.initialMeasureDocDetails,
      [field]: value,
    })
  }

  // MeasureInitiationBasis handlers
  const handleAddBasis = (measureIndex: number) => {
    const measure = data.measures[measureIndex]
    const newBasis: MeasureInitiationBasisItem = {
      docKindName: '',
      docName: '',
      docId: '',
      docCreationDate: '',
    }
    handleMeasureChange(measureIndex, 'measureInitiationBasisDetails', [
      ...(measure.measureInitiationBasisDetails || []),
      newBasis,
    ])
  }

  const handleRemoveBasis = (measureIndex: number, basisIndex: number) => {
    const measure = data.measures[measureIndex]
    const updated = [...(measure.measureInitiationBasisDetails || [])]
    updated.splice(basisIndex, 1)
    handleMeasureChange(measureIndex, 'measureInitiationBasisDetails', updated)
  }

  const handleBasisChange = (measureIndex: number, basisIndex: number, field: string, value: any) => {
    const measure = data.measures[measureIndex]
    const updated = [...(measure.measureInitiationBasisDetails || [])]
    updated[basisIndex] = {
      ...updated[basisIndex],
      [field]: value,
    }
    handleMeasureChange(measureIndex, 'measureInitiationBasisDetails', updated)
  }

  // MeasureImplementation handlers
  const handleAddImplementation = (measureIndex: number) => {
    const measure = data.measures[measureIndex]
    const newImpl: MeasureImplementationItem = {
      country: '',
      startDate: '',
      description: '',
    }
    handleMeasureChange(measureIndex, 'measureImplementationDetails', [
      ...(measure.measureImplementationDetails || []),
      newImpl,
    ])
  }

  const handleRemoveImplementation = (measureIndex: number, implIndex: number) => {
    const measure = data.measures[measureIndex]
    const updated = [...(measure.measureImplementationDetails || [])]
    updated.splice(implIndex, 1)
    handleMeasureChange(measureIndex, 'measureImplementationDetails', updated)
  }

  const handleImplementationChange = (measureIndex: number, implIndex: number, field: string, value: any) => {
    const measure = data.measures[measureIndex]
    const updated = [...(measure.measureImplementationDetails || [])]
    updated[implIndex] = {
      ...updated[implIndex],
      [field]: value,
    }
    handleMeasureChange(measureIndex, 'measureImplementationDetails', updated)
  }

  // MeasureDocDetails component
  const MeasureDocDetailsEdit: React.FC<{
    doc?: MeasureDocDetails
    onChange: (doc: MeasureDocDetails) => void
    title: string
  }> = ({ doc, onChange, title }) => {
    if (!doc) {
      return (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => onChange({})}
          style={{ width: '100%' }}
        >
          Добавить {title}
        </Button>
      )
    }

    return (
      <Form layout="vertical">
        <Form.Item label="Страна">
          <CountrySelect
            value={doc.country}
            onChange={(value) => onChange({ ...doc, country: value || '' })}
            loading={loadingCountries}
            countryOptions={countryOptions}
            normalizeCountryCode={normalizeCountryCode}
          />
        </Form.Item>
        <Form.Item label="Язык">
          <Input
            value={doc.languageCode}
            onChange={(e) => onChange({ ...doc, languageCode: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Вид">
          <Input
            value={doc.docKindName}
            onChange={(e) => onChange({ ...doc, docKindName: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Наименование">
          <Input
            value={doc.docName}
            onChange={(e) => onChange({ ...doc, docName: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Серия">
          <Input
            value={doc.docSeriesId}
            onChange={(e) => onChange({ ...doc, docSeriesId: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Номер">
          <Input
            value={doc.docId}
            onChange={(e) => onChange({ ...doc, docId: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Дата документа">
          <DatePicker
            value={doc.docCreationDate ? dayjs(doc.docCreationDate) : null}
            onChange={(date) => onChange({ ...doc, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined })}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Срок действия. Начало">
          <DatePicker
            value={doc.docStartDate ? dayjs(doc.docStartDate) : null}
            onChange={(date) => onChange({ ...doc, docStartDate: date ? date.format('YYYY-MM-DD') : undefined })}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Срок действия. Окончание">
          <DatePicker
            value={doc.docValidityDate ? dayjs(doc.docValidityDate) : null}
            onChange={(date) => onChange({ ...doc, docValidityDate: date ? date.format('YYYY-MM-DD') : undefined })}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Уполномоченный орган. Идентификатор">
          <Input
            value={doc.authorityId}
            onChange={(e) => onChange({ ...doc, authorityId: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Уполномоченный орган. Наименование">
          <Input
            value={doc.authorityName}
            onChange={(e) => onChange({ ...doc, authorityName: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="Описание">
          <Input.TextArea
            rows={3}
            value={doc.description}
            onChange={(e) => onChange({ ...doc, description: e.target.value })}
          />
        </Form.Item>
        <Button
          type="link"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onChange(undefined as any)}
        >
          Удалить документ
        </Button>
      </Form>
    )
  }

  const columns = [
    {
      title: 'Язык',
      key: 'language',
      width: 100,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <Select
          value={record.languageCode}
          onChange={(value) => handleMeasureChange(index, 'languageCode', value)}
          style={{ width: '100%' }}
        >
          <Select.Option value="ru">Русский</Select.Option>
          <Select.Option value="en">Английский</Select.Option>
        </Select>
      ),
    },
    {
      title: 'Наименование меры',
      key: 'measureName',
      width: 300,
      render: (_: any, record: SanitaryMeasure, index: number) => {
        // Всегда показываем Select для выбора из справочника
        // Если measureCodeListId не указан, устанавливаем его при выборе
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <Select
              showSearch
              placeholder="Выберите меру из справочника"
              loading={loadingSanitaryMeasures}
              value={record.measureCode}
              onChange={(value) => {
                const selectedOption = getSanitaryMeasureSelectOptions().find(opt => opt.value === value)
                if (selectedOption) {
                  // Извлекаем наименование из label (формат: "код - наименование")
                  const measureName = selectedOption.label.includes(' - ') 
                    ? selectedOption.label.split(' - ').slice(1).join(' - ')
                    : selectedOption.label
                  
                  // Обновляем все поля одновременно через один вызов onChange
                  const updatedMeasures = [...(data.measures || [])]
                  updatedMeasures[index] = {
                    ...updatedMeasures[index],
                    measureCode: value,
                    measureCodeListId: '1026', // Идентификатор справочника санитарных мер
                    measureName: measureName,
                  }
                  onChange({
                    ...data,
                    measures: updatedMeasures,
                  })
                } else if (value === null || value === undefined) {
                  // Если значение очищено, сбрасываем все связанные поля
                  const updatedMeasures = [...(data.measures || [])]
                  updatedMeasures[index] = {
                    ...updatedMeasures[index],
                    measureCode: undefined,
                    measureCodeListId: undefined,
                    measureName: undefined,
                  }
                  onChange({
                    ...data,
                    measures: updatedMeasures,
                  })
                } else {
                  // Если опция не найдена, устанавливаем только код
                  handleMeasureChange(index, 'measureCode', value)
                }
              }}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={getSanitaryMeasureSelectOptions()}
              style={{ width: '100%' }}
              allowClear
            />
            {/* Если measureCode не выбран, показываем Input для ручного ввода */}
            {!record.measureCode && (
              <Input
                value={record.measureName || ''}
                onChange={(e) => {
                  handleMeasureChange(index, 'measureName', e.target.value)
                  // Если вводим вручную, сбрасываем measureCode и measureCodeListId
                  if (record.measureCode) {
                    handleMeasureChange(index, 'measureCode', undefined)
                    handleMeasureChange(index, 'measureCodeListId', undefined)
                  }
                }}
                placeholder="Или введите наименование меры вручную"
                size="small"
              />
            )}
          </div>
        )
      },
    },
    {
      title: 'Вид объекта действия',
      key: 'affectedObject',
      width: 200,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <Select
          showSearch
          placeholder="Выберите вид объекта"
          value={record.measureAffectedObjectKindCode}
          onChange={(value) => handleMeasureChange(index, 'measureAffectedObjectKindCode', value)}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getSanitaryMeasureObjKindSelectOptions()}
          style={{ width: '100%' }}
          allowClear
        />
      ),
    },
    {
      title: 'Начальная дата',
      key: 'startDate',
      width: 120,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <DatePicker
          value={record.startDate ? dayjs(record.startDate) : null}
          onChange={(date) => handleMeasureChange(index, 'startDate', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Конечная дата',
      key: 'endDate',
      width: 120,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <DatePicker
          value={record.endDate ? dayjs(record.endDate) : null}
          onChange={(date) => handleMeasureChange(index, 'endDate', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Обоснование',
      key: 'justification',
      width: 200,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <Input.TextArea
          rows={2}
          value={record.measureJustificationText || ''}
          onChange={(e) => handleMeasureChange(index, 'measureJustificationText', e.target.value)}
          placeholder="Текстовое описание обоснования"
        />
      ),
    },
    {
      title: 'Описание',
      key: 'description',
      width: 200,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <Input.TextArea
          rows={2}
          value={record.description || ''}
          onChange={(e) => handleMeasureChange(index, 'description', e.target.value)}
          placeholder="Содержание (описание) вводимой меры"
        />
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      width: 150,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <Space>
          <Button
            type="link"
            onClick={() => setSelectedMeasureIndex(selectedMeasureIndex === index ? null : index)}
          >
            {selectedMeasureIndex === index ? 'Скрыть' : 'Детали'}
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleRemoveMeasure(index)}
          >
            Удалить
          </Button>
        </Space>
      ),
    },
  ]

  const selectedMeasure = selectedMeasureIndex !== null ? data.measures[selectedMeasureIndex] : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3>Принятые меры</h3>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={handleAddMeasure}
        >
          Добавить меру
        </Button>
      </div>
      <Table
        dataSource={data.measures || []}
        columns={columns}
        rowKey={(record, index) => `measure-${index}`}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onRow={(record, index) => ({
          onClick: () => setSelectedMeasureIndex(selectedMeasureIndex === index ? null : index),
          style: { cursor: 'pointer' },
        })}
        rowClassName={(record, index) => selectedMeasureIndex === index ? 'ant-table-row-selected' : ''}
      />

      {/* Детализация меры */}
      {selectedMeasure && selectedMeasureIndex !== null && (
        <div style={{ marginTop: '16px', padding: '16px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
          <h4>Детализация меры</h4>
          <Form layout="vertical">
            <Form.Item label="Обоснование">
              <Input.TextArea
                rows={3}
                value={selectedMeasure.measureJustificationText}
                onChange={(e) => handleMeasureChange(selectedMeasureIndex, 'measureJustificationText', e.target.value)}
              />
            </Form.Item>
            <Form.Item label="Описание">
              <Input.TextArea
                rows={3}
                value={selectedMeasure.description}
                onChange={(e) => handleMeasureChange(selectedMeasureIndex, 'description', e.target.value)}
              />
            </Form.Item>
          </Form>

          <Collapse
            defaultActiveKey={['measureDoc', 'initialMeasureDoc', 'basis', 'implementation']}
            items={[
              {
                key: 'measureDoc',
                label: 'Документ, регламентирующий введение (отмену) меры',
                children: (
                  <MeasureDocDetailsEdit
                    doc={selectedMeasure.measureDocDetails}
                    onChange={(doc) => handleMeasureChange(selectedMeasureIndex, 'measureDocDetails', doc)}
                    title="документ"
                  />
                ),
              },
              {
                key: 'initialMeasureDoc',
                label: 'Документ, регламентирующий введение исходной меры',
                children: (
                  <MeasureDocDetailsEdit
                    doc={selectedMeasure.initialMeasureDocDetails}
                    onChange={(doc) => handleMeasureChange(selectedMeasureIndex, 'initialMeasureDocDetails', doc)}
                    title="исходный документ"
                  />
                ),
              },
              {
                key: 'basis',
                label: 'НПА-основание для введения меры',
                children: (
                  <div>
                    <Table
                      dataSource={selectedMeasure.measureInitiationBasisDetails || []}
                      columns={[
                        {
                          title: 'Вид',
                          key: 'docKindName',
                          render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                            <Input
                              value={record.docKindName}
                              onChange={(e) => handleBasisChange(selectedMeasureIndex, basisIndex, 'docKindName', e.target.value)}
                            />
                          ),
                        },
                        {
                          title: 'Наименование',
                          key: 'docName',
                          render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                            <Input
                              value={record.docName}
                              onChange={(e) => handleBasisChange(selectedMeasureIndex, basisIndex, 'docName', e.target.value)}
                            />
                          ),
                        },
                        {
                          title: 'Номер',
                          key: 'docId',
                          render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                            <Input
                              value={record.docId}
                              onChange={(e) => handleBasisChange(selectedMeasureIndex, basisIndex, 'docId', e.target.value)}
                            />
                          ),
                        },
                        {
                          title: 'Дата',
                          key: 'docCreationDate',
                          render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                            <DatePicker
                              value={record.docCreationDate ? dayjs(record.docCreationDate) : null}
                              onChange={(date) => handleBasisChange(selectedMeasureIndex, basisIndex, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')}
                              style={{ width: '100%' }}
                            />
                          ),
                        },
                        {
                          title: 'Действия',
                          key: 'actions',
                          render: (_: any, record: MeasureInitiationBasisItem, basisIndex: number) => (
                            <Button
                              type="link"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleRemoveBasis(selectedMeasureIndex, basisIndex)}
                            >
                              Удалить
                            </Button>
                          ),
                        },
                      ]}
                      rowKey={(record, index) => `basis-${index}`}
                      pagination={false}
                      size="small"
                    />
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddBasis(selectedMeasureIndex)}
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      Добавить НПА-основание
                    </Button>
                  </div>
                ),
              },
              {
                key: 'implementation',
                label: 'Мероприятия, обеспечивающие соблюдение меры',
                children: (
                  <div>
                    <Table
                      dataSource={selectedMeasure.measureImplementationDetails || []}
                      columns={[
                        {
                          title: 'Страна',
                          key: 'country',
                          render: (_: any, record: MeasureImplementationItem, implIndex: number) => (
                            <Input
                              value={record.country}
                              onChange={(e) => handleImplementationChange(selectedMeasureIndex, implIndex, 'country', e.target.value)}
                            />
                          ),
                        },
                        {
                          title: 'Начальная дата',
                          key: 'startDate',
                          render: (_: any, record: MeasureImplementationItem, implIndex: number) => (
                            <DatePicker
                              value={record.startDate ? dayjs(record.startDate) : null}
                              onChange={(date) => handleImplementationChange(selectedMeasureIndex, implIndex, 'startDate', date ? date.format('YYYY-MM-DD') : '')}
                              style={{ width: '100%' }}
                            />
                          ),
                        },
                        {
                          title: 'Конечная дата',
                          key: 'endDate',
                          render: (_: any, record: MeasureImplementationItem, implIndex: number) => (
                            <DatePicker
                              value={record.endDate ? dayjs(record.endDate) : null}
                              onChange={(date) => handleImplementationChange(selectedMeasureIndex, implIndex, 'endDate', date ? date.format('YYYY-MM-DD') : '')}
                              style={{ width: '100%' }}
                            />
                          ),
                        },
                        {
                          title: 'Описание',
                          key: 'description',
                          render: (_: any, record: MeasureImplementationItem, implIndex: number) => (
                            <Input.TextArea
                              rows={2}
                              value={record.description}
                              onChange={(e) => handleImplementationChange(selectedMeasureIndex, implIndex, 'description', e.target.value)}
                            />
                          ),
                        },
                        {
                          title: 'Вид объекта действия',
                          key: 'measureAffectedObjectKindCode',
                          width: 200,
                          render: (_: any, record: MeasureImplementationItem, implIndex: number) => {
                            const hasError = record.measureAffectedObjectKindCode && !getSanitaryMeasureObjKindNameByCode(record.measureAffectedObjectKindCode)
                            return (
                              <Select
                                value={record.measureAffectedObjectKindCode}
                                onChange={(value) => handleImplementationChange(selectedMeasureIndex, implIndex, 'measureAffectedObjectKindCode', value)}
                                options={getSanitaryMeasureObjKindSelectOptions()}
                                placeholder="Выберите вид объекта действия"
                                style={{ width: '100%', borderColor: hasError ? '#ff4d4f' : undefined }}
                                showSearch
                                filterOption={(input, option) =>
                                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                              />
                            )
                          },
                        },
                        {
                          title: 'Действия',
                          key: 'actions',
                          render: (_: any, record: MeasureImplementationItem, implIndex: number) => (
                            <Space>
                              <Button
                                type="link"
                                onClick={() => setSelectedImplementationIndex(selectedImplementationIndex === implIndex ? null : implIndex)}
                              >
                                {selectedImplementationIndex === implIndex ? 'Скрыть детали' : 'Детализация'}
                              </Button>
                              <Button
                                type="link"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveImplementation(selectedMeasureIndex, implIndex)}
                              >
                                Удалить
                              </Button>
                            </Space>
                          ),
                        },
                      ]}
                      rowKey={(record, index) => `impl-${index}`}
                      pagination={false}
                      size="small"
                    />
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddImplementation(selectedMeasureIndex)}
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      Добавить мероприятие
                    </Button>

                    {/* Детализация мероприятия */}
                    {selectedImplementationIndex !== null && selectedMeasure.measureImplementationDetails && selectedMeasure.measureImplementationDetails[selectedImplementationIndex] && (
                      <MeasureImplementationDetailsEdit
                        measureIndex={selectedMeasureIndex}
                        implIndex={selectedImplementationIndex}
                        item={selectedMeasure.measureImplementationDetails[selectedImplementationIndex]}
                        onChange={(field, value) => handleImplementationChange(selectedMeasureIndex, selectedImplementationIndex, field, value)}
                        countryOptions={countryOptions}
                        loadingCountries={loadingCountries}
                        normalizeCountryCode={normalizeCountryCode}
                      />
                    )}
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  )
}

// Компонент для детализации мероприятия
const MeasureImplementationDetailsEdit: React.FC<{
  measureIndex: number
  implIndex: number
  item: MeasureImplementationItem
  onChange: (field: string, value: any) => void
  countryOptions: CountryOption[]
  loadingCountries: boolean
  normalizeCountryCode: (country: string | undefined) => string | undefined
}> = ({ item, onChange, countryOptions, loadingCountries, normalizeCountryCode }) => {
  return (
    <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
      <h5>Детализация мероприятия</h5>
      <Collapse
        defaultActiveKey={['authority', 'subject', 'document', 'place']}
        items={[
          {
            key: 'authority',
            label: 'Уполномоченный орган',
            children: item.authority ? (
              <Form layout="vertical">
                <Form.Item label="Страна">
                  <CountrySelect
                    value={item.authority.country}
                    onChange={(value) => onChange('authority', { ...item.authority, country: value || '' })}
                    loading={loadingCountries}
                    countryOptions={countryOptions}
                    normalizeCountryCode={normalizeCountryCode}
                  />
                </Form.Item>
                <Form.Item label="Идентификатор">
                  <Input
                    value={item.authority.authorityId}
                    onChange={(e) => onChange('authority', { ...item.authority, authorityId: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Наименование">
                  <Input
                    value={item.authority.authorityName}
                    onChange={(e) => onChange('authority', { ...item.authority, authorityName: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Краткое наименование">
                  <Input
                    value={item.authority.authorityBriefName}
                    onChange={(e) => onChange('authority', { ...item.authority, authorityBriefName: e.target.value })}
                  />
                </Form.Item>
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onChange('authority', undefined)}
                >
                  Удалить уполномоченный орган
                </Button>
              </Form>
            ) : (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => onChange('authority', {})}
                style={{ width: '100%' }}
              >
                Добавить уполномоченный орган
              </Button>
            ),
          },
          {
            key: 'subject',
            label: item.subjectDetails?.businessEntity ? 'Субъект-исполнитель (юрлицо ИП)' : 'Субъект-исполнитель (физлицо)',
            children: item.subjectDetails ? (
              <div>
                {item.subjectDetails.businessEntity ? (
                  <ManufacturerDetailsEdit
                    data={item.subjectDetails.businessEntity as any}
                    onChange={(entity) => onChange('subjectDetails', { ...item.subjectDetails, businessEntity: entity })}
                    title="Субъект-исполнитель (юрлицо ИП)"
                  />
                ) : (
                  <SubjectPersonEdit
                    subject={item.subjectDetails}
                    onChange={(subject) => onChange('subjectDetails', subject)}
                    countryOptions={countryOptions}
                    loadingCountries={loadingCountries}
                    normalizeCountryCode={normalizeCountryCode}
                  />
                )}
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onChange('subjectDetails', undefined)}
                  style={{ marginTop: '8px' }}
                >
                  Удалить субъект-исполнитель
                </Button>
              </div>
            ) : (
              <div>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => onChange('subjectDetails', { businessEntity: {} })}
                  style={{ width: '100%', marginBottom: '8px' }}
                >
                  Добавить субъект-исполнитель (юрлицо ИП)
                </Button>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => onChange('subjectDetails', {})}
                  style={{ width: '100%' }}
                >
                  Добавить субъект-исполнитель (физлицо)
                </Button>
              </div>
            ),
          },
          {
            key: 'document',
            label: 'Документ, устанавливающий мероприятие',
            children: item.documentDetails ? (
              <Form layout="vertical">
                <Form.Item label="Вид">
                  <Input
                    value={item.documentDetails.docKindName}
                    onChange={(e) => onChange('documentDetails', { ...item.documentDetails, docKindName: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Наименование">
                  <Input
                    value={item.documentDetails.docName}
                    onChange={(e) => onChange('documentDetails', { ...item.documentDetails, docName: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Номер">
                  <Input
                    value={item.documentDetails.docId}
                    onChange={(e) => onChange('documentDetails', { ...item.documentDetails, docId: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Дата документа">
                  <DatePicker
                    value={item.documentDetails.docCreationDate ? dayjs(item.documentDetails.docCreationDate) : null}
                    onChange={(date) => onChange('documentDetails', { ...item.documentDetails, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label="Срок действия. Начало">
                  <DatePicker
                    value={item.documentDetails.docStartDate ? dayjs(item.documentDetails.docStartDate) : null}
                    onChange={(date) => onChange('documentDetails', { ...item.documentDetails, docStartDate: date ? date.format('YYYY-MM-DD') : undefined })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onChange('documentDetails', undefined)}
                >
                  Удалить документ
                </Button>
              </Form>
            ) : (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => onChange('documentDetails', {})}
                style={{ width: '100%' }}
              >
                Добавить документ
              </Button>
            ),
          },
          {
            key: 'place',
            label: 'Место проведения мероприятия',
            children: item.placeDetails ? (
              <Form layout="vertical">
                <Form.Item label="Регион">
                  <Input
                    value={item.placeDetails.regionName}
                    onChange={(e) => onChange('placeDetails', { ...item.placeDetails, regionName: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Код пункта пропуска">
                  <Input
                    value={item.placeDetails.borderCheckpointCode}
                    onChange={(e) => onChange('placeDetails', { ...item.placeDetails, borderCheckpointCode: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label="Наименование пункта пропуска">
                  <Input
                    value={item.placeDetails.borderCheckpointName}
                    onChange={(e) => onChange('placeDetails', { ...item.placeDetails, borderCheckpointName: e.target.value })}
                  />
                </Form.Item>
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onChange('placeDetails', undefined)}
                >
                  Удалить место проведения
                </Button>
              </Form>
            ) : (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => onChange('placeDetails', {})}
                style={{ width: '100%' }}
              >
                Добавить место проведения
              </Button>
            ),
          },
        ]}
      />
    </div>
  )
}

// Компонент для редактирования физлица
const SubjectPersonEdit: React.FC<{
  subject: SubjectDetails
  onChange: (subject: SubjectDetails) => void
  countryOptions: CountryOption[]
  loadingCountries: boolean
  normalizeCountryCode: (country: string | undefined) => string | undefined
}> = ({ subject, onChange, countryOptions, loadingCountries, normalizeCountryCode }) => {
  return (
    <Form layout="vertical">
      <Form.Item label="Страна">
        <Input
          value={subject.country}
          onChange={(e) => onChange({ ...subject, country: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="ФИО">
        <Input
          value={subject.subjectName}
          onChange={(e) => onChange({ ...subject, subjectName: e.target.value })}
        />
      </Form.Item>
      {subject.identityDoc && (
        <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
          <h5>Удостоверение личности</h5>
          <Form layout="vertical">
            <Form.Item label="Страна">
              <CountrySelect
                value={subject.identityDoc.country}
                onChange={(value) => onChange({ ...subject, identityDoc: { ...subject.identityDoc, country: value || '' } })}
                loading={loadingCountries}
                countryOptions={countryOptions}
                normalizeCountryCode={normalizeCountryCode}
              />
            </Form.Item>
            <Form.Item label="Вид документа">
              <Input
                value={subject.identityDoc.docKindName}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc, docKindName: e.target.value } })}
              />
            </Form.Item>
            <Form.Item label="Серия">
              <Input
                value={subject.identityDoc.docSeriesId}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc, docSeriesId: e.target.value } })}
              />
            </Form.Item>
            <Form.Item label="Номер">
              <Input
                value={subject.identityDoc.docId}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc, docId: e.target.value } })}
              />
            </Form.Item>
            <Form.Item label="Дата">
              <DatePicker
                value={subject.identityDoc.docCreationDate ? dayjs(subject.identityDoc.docCreationDate) : null}
                onChange={(date) => onChange({ ...subject, identityDoc: { ...subject.identityDoc, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined } })}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Срок действия">
              <DatePicker
                value={subject.identityDoc.docValidityDate ? dayjs(subject.identityDoc.docValidityDate) : null}
                onChange={(date) => onChange({ ...subject, identityDoc: { ...subject.identityDoc, docValidityDate: date ? date.format('YYYY-MM-DD') : undefined } })}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              onClick={() => onChange({ ...subject, identityDoc: undefined })}
            >
              Удалить удостоверение личности
            </Button>
          </Form>
        </div>
      )}
      {!subject.identityDoc && (
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => onChange({ ...subject, identityDoc: {} })}
          style={{ width: '100%', marginTop: '8px' }}
        >
          Добавить удостоверение личности
        </Button>
      )}
    </Form>
  )
}

export default MeasuresTabEdit
