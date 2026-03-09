import { useState } from 'react'
import { Form, Input, Button, Table, Space, DatePicker, Collapse, Select, Upload, message } from 'antd'
import { PlusOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import { useSanitaryMeasureObjKindOptions } from '@/hooks/useSanitaryMeasureObjKindOptions'
import { useSanitaryMeasureOptions } from '@/hooks/useSanitaryMeasureOptions'
import { useLanguageOptions } from '@/hooks/useLanguageOptions'
import { useMediaTypeOptions } from '@/hooks/useMediaTypeOptions'
import { useIdentityDocKindOptions } from '@/hooks/useIdentityDocKindOptions'
import CountrySelect from '@/components/common/CountrySelect'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
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
  const { countryOptions, loading: loadingCountries, normalizeCountryCode } = useCountryOptions()
  const { getSelectOptions: getSanitaryMeasureObjKindSelectOptions, getNameByCode: getSanitaryMeasureObjKindNameByCode } = useSanitaryMeasureObjKindOptions()
  const { getSelectOptions: getSanitaryMeasureSelectOptions, loading: loadingSanitaryMeasures } = useSanitaryMeasureOptions()
  const { getLanguageName } = useLanguageOptions()
  const { getSelectOptions: getMediaTypeSelectOptions, loading: loadingMediaTypes } = useMediaTypeOptions()

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
          <Select
            showSearch
            placeholder="Выберите язык"
            value={doc.languageCode}
            onChange={(value) => onChange({ ...doc, languageCode: value })}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            style={{ width: '100%' }}
            allowClear
          >
            <Select.Option value="ru">RU - Русский</Select.Option>
            <Select.Option value="en">EN - Английский</Select.Option>
            <Select.Option value="by">BY - Белорусский</Select.Option>
            <Select.Option value="kk">KK - Казахский</Select.Option>
            <Select.Option value="ky">KY - Киргизский</Select.Option>
            <Select.Option value="hy">HY - Армянский</Select.Option>
            <Select.Option value="az">AZ - Азербайджанский</Select.Option>
            <Select.Option value="ka">KA - Грузинский</Select.Option>
            <Select.Option value="uk">UK - Украинский</Select.Option>
          </Select>
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
            format={DATE_DISPLAY_FORMAT}
            value={doc.docCreationDate ? dayjs(doc.docCreationDate) : null}
            onChange={(date) => onChange({ ...doc, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined })}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Срок действия. Начало">
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            value={doc.docStartDate ? dayjs(doc.docStartDate) : null}
            onChange={(date) => onChange({ ...doc, docStartDate: date ? date.format('YYYY-MM-DD') : undefined })}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label="Срок действия. Окончание">
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
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
        <Form.Item label="Документ в бинарном виде">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Select
              showSearch
              placeholder="Выберите формат данных"
              loading={loadingMediaTypes}
              value={doc.docBinaryText?.mediaTypeCode}
              onChange={(value) => onChange({
                ...doc,
                docBinaryText: {
                  ...doc.docBinaryText,
                  mediaTypeCode: value,
                },
              })}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={getMediaTypeSelectOptions()}
              style={{ width: '100%' }}
              allowClear
            />
            <Upload
              beforeUpload={(file) => {
                const reader = new FileReader()
                reader.onload = (e) => {
                  const result = e.target?.result as string
                  // Если результат начинается с "data:", извлекаем base64 часть
                  const base64Content = result.includes(',') 
                    ? result.split(',')[1] 
                    : result
                  
                  // Определяем MIME тип из файла
                  const fileExtension = file.name.split('.').pop()?.toLowerCase()
                  let detectedMediaType = doc.docBinaryText?.mediaTypeCode
                  
                  // Если формат не выбран, пытаемся определить по расширению
                  if (!detectedMediaType) {
                    const mimeTypeMap: Record<string, string> = {
                      'pdf': 'application/pdf',
                      'doc': 'application/msword',
                      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'xls': 'application/vnd.ms-excel',
                      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                      'jpg': 'image/jpeg',
                      'jpeg': 'image/jpeg',
                      'png': 'image/png',
                      'gif': 'image/gif',
                    }
                    detectedMediaType = mimeTypeMap[fileExtension || ''] || file.type || 'application/octet-stream'
                  }
                  
                  onChange({
                    ...doc,
                    docBinaryText: {
                      content: base64Content,
                      mediaTypeCode: detectedMediaType,
                    },
                  })
                  message.success(`Файл "${file.name}" загружен`)
                }
                reader.onerror = () => {
                  message.error('Ошибка при чтении файла')
                }
                reader.readAsDataURL(file)
                return false // Предотвращаем автоматическую загрузку
              }}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>Загрузить файл</Button>
            </Upload>
            {doc.docBinaryText?.content && (
              <div style={{ fontSize: '12px', color: '#999' }}>
                Документ загружен ({doc.docBinaryText.content.length} символов base64)
              </div>
            )}
            <Input.TextArea
              rows={4}
              placeholder="Или введите содержимое документа в бинарном формате (base64) вручную"
              value={doc.docBinaryText?.content || ''}
              onChange={(e) => onChange({
                ...doc,
                docBinaryText: {
                  ...doc.docBinaryText,
                  content: e.target.value,
                  mediaTypeCode: doc.docBinaryText?.mediaTypeCode,
                },
              })}
            />
          </div>
        </Form.Item>
        <Form.Item label="XML-документ">
          <Input.TextArea
            rows={6}
            placeholder="Введите XML-документ"
            value={doc.xmlDocument || ''}
            onChange={(e) => onChange({ ...doc, xmlDocument: e.target.value })}
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
      title: labelWithHelp('Код языка', FIELD_HELP.languageCode),
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
      title: labelWithHelp('Код / Наименование принятой меры', FIELD_HELP.measureName),
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
      title: labelWithHelp('Вид объекта действия меры', FIELD_HELP.measureAffectedObjectKind),
      key: 'affectedObject',
      width: 200,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <Select
          mode="multiple"
          showSearch
          placeholder="Выберите вид объекта"
          value={record.measureAffectedObjectKindCode ? record.measureAffectedObjectKindCode.split(';').map((c) => c.trim()).filter(Boolean) : undefined}
          onChange={(value) => handleMeasureChange(index, 'measureAffectedObjectKindCode', Array.isArray(value) ? value.join(';') : '')}
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
      title: labelWithHelp('Начальная дата', FIELD_HELP.measureStartDate),
      key: 'startDate',
      width: 120,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={record.startDate ? dayjs(record.startDate) : null}
          onChange={(date) => handleMeasureChange(index, 'startDate', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: labelWithHelp('Конечная дата', FIELD_HELP.measureEndDate),
      key: 'endDate',
      width: 120,
      render: (_: any, record: SanitaryMeasure, index: number) => (
        <DatePicker
          format={DATE_DISPLAY_FORMAT}
          value={record.endDate ? dayjs(record.endDate) : null}
          onChange={(date) => handleMeasureChange(index, 'endDate', date ? date.format('YYYY-MM-DD') : '')}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: labelWithHelp('Обоснование меры', FIELD_HELP.measureJustification),
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
            <Form.Item label={labelWithHelp('Обоснование', FIELD_HELP.measureJustification)}>
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
                label: labelWithHelp('Документ, регламентирующий введение (отмену) меры', FIELD_HELP.measureDocDetails),
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
                label: labelWithHelp('Документ, регламентирующий введение исходной меры', FIELD_HELP.initialMeasureDocDetails),
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
                label: labelWithHelp('Основание для введения меры', FIELD_HELP.measureInitiationBasis),
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
                              format={DATE_DISPLAY_FORMAT}
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
                label: labelWithHelp('Сведения о мероприятии, обеспечивающем соблюдение меры', FIELD_HELP.measureImplementation),
                children: (
                  <div>
                    <Collapse
                      accordion={false}
                      items={(selectedMeasure.measureImplementationDetails || []).map((item, implIndex) => ({
                        key: String(implIndex),
                        label: `Сведения об исполнителе — ${implIndex + 1}`,
                        extra: (
                          <Button
                            type="link"
                            danger
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveImplementation(selectedMeasureIndex, implIndex)
                            }}
                          >
                            Удалить
                          </Button>
                        ),
                        children: (
                          <MeasureImplementationDetailsEdit
                            measureIndex={selectedMeasureIndex}
                            implIndex={implIndex}
                            item={item}
                            onChange={(field, value) => handleImplementationChange(selectedMeasureIndex, implIndex, field, value)}
                            countryOptions={countryOptions}
                            loadingCountries={loadingCountries}
                            normalizeCountryCode={normalizeCountryCode}
                            getSanitaryMeasureObjKindSelectOptions={getSanitaryMeasureObjKindSelectOptions}
                            getSanitaryMeasureObjKindNameByCode={getSanitaryMeasureObjKindNameByCode}
                          />
                        ),
                      }))}
                    />
                    <Button
                      type="dashed"
                      icon={<PlusOutlined />}
                      onClick={() => handleAddImplementation(selectedMeasureIndex)}
                      style={{ width: '100%', marginTop: '8px' }}
                    >
                      Добавить мероприятие
                    </Button>
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
  getSanitaryMeasureObjKindSelectOptions: () => Array<{ value: string; label: string }>
  getSanitaryMeasureObjKindNameByCode: (code: string | undefined) => string | null
}> = ({ item, onChange, countryOptions, loadingCountries, normalizeCountryCode, getSanitaryMeasureObjKindSelectOptions, getSanitaryMeasureObjKindNameByCode }) => {
  return (
    <div style={{ marginTop: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
      <h5>Детализация мероприятия</h5>
      <Form layout="vertical" style={{ marginBottom: '16px' }}>
        <Form.Item label={labelWithHelp('Код страны', FIELD_HELP.executorCountry)}>
          <CountrySelect
            value={item.country}
            onChange={(value) => onChange('country', value || '')}
            loading={loadingCountries}
            countryOptions={countryOptions}
            normalizeCountryCode={normalizeCountryCode}
          />
        </Form.Item>
        <Form.Item label={labelWithHelp('Начальная дата', FIELD_HELP.measureStartDate)}>
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            value={item.startDate ? dayjs(item.startDate) : null}
            onChange={(date) => onChange('startDate', date ? date.format('YYYY-MM-DD') : undefined)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label={labelWithHelp('Конечная дата', FIELD_HELP.measureEndDate)}>
          <DatePicker
            format={DATE_DISPLAY_FORMAT}
            value={item.endDate ? dayjs(item.endDate) : null}
            onChange={(date) => onChange('endDate', date ? date.format('YYYY-MM-DD') : undefined)}
            style={{ width: '100%' }}
          />
        </Form.Item>
        <Form.Item label={labelWithHelp('Вид объекта действия', FIELD_HELP.measureAffectedObjectKind)}>
          <Select
            mode="multiple"
            showSearch
            placeholder="Выберите вид объекта действия"
            value={item.measureAffectedObjectKindCode ? item.measureAffectedObjectKindCode.split(';').map((c) => c.trim()).filter(Boolean) : undefined}
            onChange={(value) => onChange('measureAffectedObjectKindCode', Array.isArray(value) ? value.join(';') : '')}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={getSanitaryMeasureObjKindSelectOptions()}
            style={{ width: '100%' }}
            allowClear
          />
        </Form.Item>
        <Form.Item label="Описание">
          <Input.TextArea
            rows={3}
            value={item.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
            placeholder="Описание мероприятия"
          />
        </Form.Item>
      </Form>
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
            label: 'Субъект-исполнитель',
            children: item.subjectDetails ? (
              <div>
                <SubjectDetailsUnifiedEdit
                  subject={item.subjectDetails}
                  onChange={(subject) => onChange('subjectDetails', subject)}
                  countryOptions={countryOptions}
                  loadingCountries={loadingCountries}
                  normalizeCountryCode={normalizeCountryCode}
                />
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
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => onChange('subjectDetails', {})}
                style={{ width: '100%' }}
              >
                Добавить субъект-исполнитель
              </Button>
            ),
          },
          {
            key: 'document',
            label: labelWithHelp('Документ, устанавливающий мероприятие', FIELD_HELP.documentEstablishingMeasure),
            children: item.documentDetails ? (
              <Form layout="vertical">
                <Form.Item label={labelWithHelp('Код вида документа', FIELD_HELP.implDocKindCode)}>
                  <Input
                    value={item.documentDetails.docKindName}
                    onChange={(e) => onChange('documentDetails', { ...item.documentDetails, docKindName: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label={labelWithHelp('Наименование', FIELD_HELP.implDocName)}>
                  <Input
                    value={item.documentDetails.docName}
                    onChange={(e) => onChange('documentDetails', { ...item.documentDetails, docName: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label={labelWithHelp('Номер', FIELD_HELP.implDocId)}>
                  <Input
                    value={item.documentDetails.docId}
                    onChange={(e) => onChange('documentDetails', { ...item.documentDetails, docId: e.target.value })}
                  />
                </Form.Item>
                <Form.Item label={labelWithHelp('Дата', FIELD_HELP.implDocCreationDate)}>
                  <DatePicker
                    format={DATE_DISPLAY_FORMAT}
                    value={item.documentDetails.docCreationDate ? dayjs(item.documentDetails.docCreationDate) : null}
                    onChange={(date) => onChange('documentDetails', { ...item.documentDetails, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined })}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Form.Item label={labelWithHelp('Дата начала срока действия', FIELD_HELP.implDocStartDate)}>
                  <DatePicker
                    format={DATE_DISPLAY_FORMAT}
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

// Единая форма редактирования субъекта-исполнителя (без разделения на юрлицо/физлицо), порядок полей по ТЗ
const SubjectDetailsUnifiedEdit: React.FC<{
  subject: SubjectDetails
  onChange: (subject: SubjectDetails) => void
  countryOptions: CountryOption[]
  loadingCountries: boolean
  normalizeCountryCode: (country: string | undefined) => string | undefined
}> = ({ subject, onChange, countryOptions, loadingCountries, normalizeCountryCode }) => {
  const { getSelectOptions: getIdentityDocKindSelectOptions, getNameByCode: getIdentityDocKindNameByCode, loading: loadingIdentityDocKinds } = useIdentityDocKindOptions()
  const be = subject.businessEntity
  const ensureBe = () => subject.businessEntity ?? {}

  const upd = (patch: Partial<SubjectDetails>, bePatch?: Partial<BusinessEntityDetails>) => {
    const nextBe = bePatch !== undefined ? { ...ensureBe(), ...bePatch } : subject.businessEntity
    onChange({ ...subject, ...patch, ...(nextBe && Object.keys(nextBe).length > 0 ? { businessEntity: nextBe } : {}) })
  }

  const country = subject.country ?? be?.country
  const subjectName = subject.subjectName ?? be?.businessEntityName
  const briefName = be?.businessEntityBriefName
  const orgForm = be?.businessEntityTypeName
  const subjectId = be?.businessEntityId
  const identificationMethod = be?.identificationMethod
  const customsNumber = be?.customsNumber
  const taxpayerId = be?.taxpayerId

  return (
    <Form layout="vertical">
      <Form.Item label="Страна">
        <CountrySelect
          value={country}
          onChange={(value) => {
            const v = value || ''
            upd({ country: v }, { country: v })
          }}
          loading={loadingCountries}
          countryOptions={countryOptions}
          normalizeCountryCode={normalizeCountryCode}
        />
      </Form.Item>
      <Form.Item label="Наименование субъекта">
        <Input
          value={subjectName}
          onChange={(e) => {
            const v = e.target.value
            upd({ subjectName: v }, { businessEntityName: v })
          }}
        />
      </Form.Item>
      <Form.Item label="Краткое наименование">
        <Input
          value={briefName}
          onChange={(e) => upd({}, { businessEntityBriefName: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="Организационно-правовая форма">
        <Input
          value={orgForm}
          onChange={(e) => upd({}, { businessEntityTypeName: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="Идентификатор субъекта">
        <Input
          value={subjectId}
          onChange={(e) => upd({}, { businessEntityId: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="Метод идентификации">
        <Input
          value={identificationMethod}
          onChange={(e) => upd({}, { identificationMethod: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="Таможенный номер">
        <Input
          value={customsNumber}
          onChange={(e) => upd({}, { customsNumber: e.target.value })}
        />
      </Form.Item>
      <Form.Item label="Идентификатор налогоплательщика">
        <Input
          value={taxpayerId}
          onChange={(e) => upd({}, { taxpayerId: e.target.value })}
        />
      </Form.Item>
      {/* Удостоверение личности */}
      {subject.identityDoc ? (
        <div style={{ marginTop: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 4 }}>
          <h5>Удостоверение личности</h5>
          <Form layout="vertical">
            <Form.Item label="Страна">
              <CountrySelect
                value={subject.identityDoc.country}
                onChange={(value) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, country: value || '' } })}
                loading={loadingCountries}
                countryOptions={countryOptions}
                normalizeCountryCode={normalizeCountryCode}
              />
            </Form.Item>
            <Form.Item label="Вид документа">
              <Select
                allowClear
                placeholder="Выберите из справочника"
                loading={loadingIdentityDocKinds}
                options={getIdentityDocKindSelectOptions()}
                value={subject.identityDoc.docKindCodeListId === '2053' ? subject.identityDoc.docKindCode : undefined}
                onChange={(code) => {
                  onChange({
                    ...subject,
                    identityDoc: {
                      ...subject.identityDoc!,
                      docKindCode: code ?? undefined,
                      docKindCodeListId: code ? '2053' : undefined,
                      docKindName: code ? (getIdentityDocKindNameByCode(code) ?? undefined) : undefined,
                    },
                  })
                }}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Серия">
              <Input
                value={subject.identityDoc.docSeriesId}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, docSeriesId: e.target.value } })}
              />
            </Form.Item>
            <Form.Item label="Номер">
              <Input
                value={subject.identityDoc.docId}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, docId: e.target.value } })}
              />
            </Form.Item>
            <Form.Item label="Дата">
              <DatePicker
                format={DATE_DISPLAY_FORMAT}
                value={subject.identityDoc.docCreationDate ? dayjs(subject.identityDoc.docCreationDate) : null}
                onChange={(date) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, docCreationDate: date ? date.format('YYYY-MM-DD') : undefined } })}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Срок действия">
              <DatePicker
                format={DATE_DISPLAY_FORMAT}
                value={subject.identityDoc.docValidityDate ? dayjs(subject.identityDoc.docValidityDate) : null}
                onChange={(date) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, docValidityDate: date ? date.format('YYYY-MM-DD') : undefined } })}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item label="Уполномоченный орган. Идентификатор">
              <Input
                value={subject.identityDoc.authorityId}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, authorityId: e.target.value } })}
              />
            </Form.Item>
            <Form.Item label="Уполномоченный орган. Наименование">
              <Input
                value={subject.identityDoc.authorityName}
                onChange={(e) => onChange({ ...subject, identityDoc: { ...subject.identityDoc!, authorityName: e.target.value } })}
              />
            </Form.Item>
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => onChange({ ...subject, identityDoc: undefined })}>
              Удалить удостоверение личности
            </Button>
          </Form>
        </div>
      ) : (
        <Button type="dashed" icon={<PlusOutlined />} onClick={() => onChange({ ...subject, identityDoc: {} })} style={{ width: '100%', marginTop: 8 }}>
          Добавить удостоверение личности
        </Button>
      )}
      {/* Адреса и контакты — упрощённо: ссылка на то же subject */}
      {(subject.registrationAddress || subject.actualAddress || subject.mailingAddress || (be?.addresses && be.addresses.length > 0)) && (
        <Form.Item label="Адреса">
          <div style={{ color: '#666', fontSize: 12 }}>Редактирование адресов поддерживается в полной форме субъекта.</div>
        </Form.Item>
      )}
      {((subject.contacts && subject.contacts.length > 0) || (be?.contacts && be.contacts.length > 0)) && (
        <Form.Item label="Контактный реквизит">
          <div style={{ color: '#666', fontSize: 12 }}>Редактирование контактов поддерживается в полной форме субъекта.</div>
        </Form.Item>
      )}
    </Form>
  )
}

export default MeasuresTabEdit
