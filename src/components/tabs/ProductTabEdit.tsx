import { useState, useEffect } from 'react'
import { Form, Input, Button, Space, Select } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import ManufacturerDetailsEdit from '../common/ManufacturerDetailsEdit'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import type { ProductData, TechnicalDocument } from '@/types/card'
import { useSanitaryProdTypeOptions } from '@/hooks/useSanitaryProdTypeOptions'
import { useShipDocKindOptions } from '@/hooks/useShipDocKindOptions'
import { checkSanitaryProdTypeExists } from '@/utils/referenceDataApi'

interface ProductTabEditProps {
  data: ProductData
  onChange: (data: ProductData) => void
}

const ProductTabEdit: React.FC<ProductTabEditProps> = ({ data, onChange }) => {
  const [form] = Form.useForm()
  const { options: sanitaryProdTypeOptions, loading: loadingSanitaryProdTypes, getSelectOptions: getSanitaryProdTypeSelectOptions, getNameByCode } = useSanitaryProdTypeOptions()
  const { getSelectOptions: getShipDocKindSelectOptions, getNameByCode: getShipDocKindNameByCode, loading: loadingShipDocKinds } = useShipDocKindOptions()
  const [typeCodeError, setTypeCodeError] = useState<boolean>(false)

  // Проверяем валидность кода при загрузке данных
  useEffect(() => {
    form.setFieldsValue({
      typeName: data.typeName,
      typeCode: data.typeCode,
      productId: data.productDetails.productId,
      productName: data.productDetails.productName,
      tradeName: data.productDetails.tradeName,
      description: data.productDetails.description,
      commodityCode: data.productDetails.commodityCode,
      productPurpose: data.productDetails.productPurpose,
      applicationMethod: data.productDetails.applicationMethod,
      releaseForm: data.productDetails.releaseForm,
      storageCondition: data.productDetails.storageCondition,
      labelText: data.productDetails.labelText,
    })
    
    // Проверяем валидность кода типа продукции
    if (data.typeCode) {
      checkSanitaryProdTypeExists(data.typeCode)
        .then((exists) => {
          setTypeCodeError(!exists)
        })
        .catch(() => {
          // Если справочник недоступен, не показываем ошибку
          setTypeCodeError(false)
        })
    } else {
      setTypeCodeError(false)
    }
  }, [data, form])

  // Обработчик выбора типа санитарной продукции
  const handleSanitaryProdTypeSelect = (code: string) => {
    const typeName = getNameByCode(code) || ''
    setTypeCodeError(false) // Сбрасываем ошибку при выборе из справочника
    onChange({
      ...data,
      typeCode: code,
      typeName: typeName,
    })
  }

  const handleValuesChange = (changedValues: any, allValues: any) => {
    // Пропускаем только когда пользователь изменил именно тип продукции (обрабатывается handleSanitaryProdTypeSelect)
    if (changedValues.typeCode !== undefined || changedValues.typeName !== undefined) {
      return
    }
    // Берём значения из формы, при отсутствии — из текущих data, чтобы не затирать поля при частичном allValues
    const pd = data.productDetails
    const updatedData: ProductData = {
      ...data,
      typeName: data.typeName,
      typeCode: data.typeCode,
      productDetails: {
        ...pd,
        productId: allValues.productId !== undefined ? allValues.productId : pd.productId,
        productName: allValues.productName !== undefined ? allValues.productName : pd.productName,
        tradeName: allValues.tradeName !== undefined ? allValues.tradeName : pd.tradeName,
        description: allValues.description !== undefined ? allValues.description : pd.description,
        commodityCode: allValues.commodityCode !== undefined ? allValues.commodityCode : pd.commodityCode,
        productPurpose: allValues.productPurpose !== undefined ? allValues.productPurpose : pd.productPurpose,
        applicationMethod: allValues.applicationMethod !== undefined ? allValues.applicationMethod : pd.applicationMethod,
        releaseForm: allValues.releaseForm !== undefined ? allValues.releaseForm : pd.releaseForm,
        storageCondition: allValues.storageCondition !== undefined ? allValues.storageCondition : pd.storageCondition,
        labelText: allValues.labelText !== undefined ? allValues.labelText : pd.labelText,
      },
    }
    onChange(updatedData)
  }

  const handleManufacturerChange = (manufacturer: any) => {
    onChange({
      ...data,
      manufacturer: {
        ...data.manufacturer,
        ...manufacturer,
      },
    })
  }

  const handleAddTechnicalDoc = () => {
    const newDoc: TechnicalDocument = {
      docKindCode: '',
      docKindName: '',
      docName: '',
      docId: '',
      docCreationDate: '',
      docStartDate: '',
    }
    const updatedData: ProductData = {
      ...data,
      productDetails: {
        ...data.productDetails,
        technicalDocs: [...(data.productDetails.technicalDocs || []), newDoc],
      },
    }
    onChange(updatedData)
  }

  const handleRemoveTechnicalDoc = (index: number) => {
    const updatedDocs = [...(data.productDetails.technicalDocs || [])]
    updatedDocs.splice(index, 1)
    const updatedData: ProductData = {
      ...data,
      productDetails: {
        ...data.productDetails,
        technicalDocs: updatedDocs,
      },
    }
    onChange(updatedData)
  }

  const handleTechnicalDocChange = (index: number, field: string, value: string) => {
    const updatedDocs = [...(data.productDetails.technicalDocs || [])]
    updatedDocs[index] = {
      ...updatedDocs[index],
      [field]: value,
    }
    const updatedData: ProductData = {
      ...data,
      productDetails: {
        ...data.productDetails,
        technicalDocs: updatedDocs,
      },
    }
    onChange(updatedData)
  }

  const handleTechnicalDocKindSelect = (index: number, code: string) => {
    const name = getShipDocKindNameByCode(code) || ''
    const updatedDocs = [...(data.productDetails.technicalDocs || [])]
    updatedDocs[index] = { ...updatedDocs[index], docKindCode: code, docKindName: name }
    onChange({
      ...data,
      productDetails: { ...data.productDetails, technicalDocs: updatedDocs },
    })
  }

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={handleValuesChange}
    >
      <Form.Item 
        label={labelWithHelp('Код вида продукции', FIELD_HELP.productTypeCode)}
        name="typeCode"
        validateStatus={typeCodeError ? 'error' : ''}
        help={typeCodeError ? 'Код не найден в справочнике' : ''}
      >
        <Select
          showSearch
          placeholder="Выберите вид продукции"
          loading={loadingSanitaryProdTypes}
          value={data.typeCode}
          onChange={handleSanitaryProdTypeSelect}
          filterOption={(input, option) =>
            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
          }
          options={getSanitaryProdTypeSelectOptions()}
          allowClear
          status={typeCodeError ? 'error' : undefined}
        />
      </Form.Item>
      <Form.Item label={labelWithHelp('Наименование вида продукции', FIELD_HELP.productTypeName)}>
        <Input readOnly value={data.typeName || ''} />
      </Form.Item>
      <Form.Item label="Идентификатор" name="productId">
        <Input placeholder="штрихкод" />
      </Form.Item>
      <Form.Item label="Наименование" name="productName">
        <Input />
      </Form.Item>
      <Form.Item label="Название" name="tradeName">
        <Input />
      </Form.Item>
      <Form.Item label="Описание" name="description">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item label="Код ТН ВЭД ЕАЭС" name="commodityCode">
        <Input />
      </Form.Item>
      <Form.Item label="Назначение продукции" name="productPurpose">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item label="Способ применения" name="applicationMethod">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item label="Форма выпуска" name="releaseForm">
        <Input />
      </Form.Item>
      <Form.Item label="Условия хранения" name="storageCondition">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item label="Информация на этикетке" name="labelText">
        <Input.TextArea rows={3} />
      </Form.Item>
      
      <Form.Item label="Техническая документация">
        <div>
          {data.productDetails.technicalDocs?.map((doc, index) => (
            <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item label="Вид документа" style={{ marginBottom: 8 }}>
                  <Select
                    showSearch
                    placeholder="Код — наименование вида (справочник SHIPDOCKIND)"
                    loading={loadingShipDocKinds}
                    value={doc.docKindCode || undefined}
                    onChange={(code) => handleTechnicalDocKindSelect(index, code ?? '')}
                    onClear={() => handleTechnicalDocKindSelect(index, '')}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={getShipDocKindSelectOptions()}
                    allowClear
                    style={{ width: '100%' }}
                  />
                </Form.Item>
                <Input
                  placeholder="Наименование документа"
                  value={doc.docName}
                  onChange={(e) => handleTechnicalDocChange(index, 'docName', e.target.value)}
                />
                <Input
                  placeholder="Номер документа"
                  value={doc.docId}
                  onChange={(e) => handleTechnicalDocChange(index, 'docId', e.target.value)}
                />
                <Input
                  placeholder="Дата документа (YYYY-MM-DD)"
                  value={doc.docCreationDate}
                  onChange={(e) => handleTechnicalDocChange(index, 'docCreationDate', e.target.value)}
                />
                <Input
                  placeholder="Дата начала действия (YYYY-MM-DD)"
                  value={doc.docStartDate}
                  onChange={(e) => handleTechnicalDocChange(index, 'docStartDate', e.target.value)}
                />
                <Button
                  type="link"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemoveTechnicalDoc(index)}
                >
                  Удалить документ
                </Button>
              </Space>
            </div>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddTechnicalDoc}
            style={{ width: '100%' }}
          >
            Добавить технический документ
          </Button>
        </div>
      </Form.Item>

      <ManufacturerDetailsEdit
        data={data.manufacturer}
        onChange={handleManufacturerChange}
        title="Изготовитель продукции"
        fixedSupplyChainPartyKindCode="41"
      />
    </Form>
  )
}

export default ProductTabEdit

