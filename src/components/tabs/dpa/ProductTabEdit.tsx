import { useState, useEffect } from 'react'
import { Form, Input, Button, Space, Select, DatePicker, Radio } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { DATE_DISPLAY_FORMAT } from '@/constants/dateFormat'
import ManufacturerDetailsEdit from '../../common/ManufacturerDetailsEdit'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import { getFormRules, getMaxLength, getFormatHint } from '@/constants/xsdFieldConstraints'
import type { ProductData, TechnicalDocument } from '@/types/card'
import { useSanitaryProdTypeOptions } from '@/hooks/shared/useSanitaryProdTypeOptions'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { checkSanitaryProdTypeExists } from '@/utils/referenceDataApi'

interface ProductTabEditProps {
  data: ProductData
  onChange: (data: ProductData) => void
}

const ProductTabEdit: React.FC<ProductTabEditProps> = ({ data, onChange }) => {
  const [form] = Form.useForm()
  const { options: sanitaryProdTypeOptions, loading: loadingSanitaryProdTypes, getSelectOptions: getSanitaryProdTypeSelectOptions } = useSanitaryProdTypeOptions()
  const { getSelectOptions: getShipDocKindSelectOptions, getNameByCode: getShipDocKindNameByCode, loading: loadingShipDocKinds } = useShipDocKindOptions()
  const [typeCodeError, setTypeCodeError] = useState<boolean>(false)
  // Режим переключателя «Код / Наименование» храним в state, чтобы при переключении на «Код» не откатываться обратно (когда оба поля пусты)
  const [productTypeMode, setProductTypeMode] = useState<'code' | 'name'>(() =>
    data.typeCode?.trim() ? 'code' : data.typeName?.trim() ? 'name' : 'code'
  )

  const tradeNamesList = data.productDetails.tradeNames?.length
    ? data.productDetails.tradeNames
    : (data.productDetails.tradeName ? [data.productDetails.tradeName] : [''])

  // Синхронизируем режим переключателя с данными при загрузке карты (когда пришли typeCode или typeName)
  useEffect(() => {
    if (data.typeCode?.trim()) setProductTypeMode('code')
    else if (data.typeName?.trim()) setProductTypeMode('name')
    else setProductTypeMode('code')
  }, [data.typeCode, data.typeName])

  // Синхронизация формы с data — без обращения к справочнику
  useEffect(() => {
    form.setFieldsValue({
      typeName: data.typeName,
      typeCode: data.typeCode,
      productId: data.productDetails.productId,
      productName: data.productDetails.productName,
      description: data.productDetails.description,
      commodityCode: data.productDetails.commodityCode,
      productPurpose: data.productDetails.productPurpose,
      applicationMethod: data.productDetails.applicationMethod,
      releaseForm: data.productDetails.releaseForm,
      storageCondition: data.productDetails.storageCondition,
      labelText: data.productDetails.labelText,
    })
  }, [data, form])

  // Проверка кода типа продукции по справочнику только при изменении typeCode, с дебаунсом (не при каждом вводе символа)
  const typeCodeToValidate = data.typeCode?.trim() || ''
  useEffect(() => {
    if (!typeCodeToValidate) {
      setTypeCodeError(false)
      return
    }
    const t = setTimeout(() => {
      checkSanitaryProdTypeExists(typeCodeToValidate)
        .then((exists) => setTypeCodeError(!exists))
        .catch(() => setTypeCodeError(false))
    }, 400)
    return () => clearTimeout(t)
  }, [typeCodeToValidate])

  // Обработчик выбора типа санитарной продукции (только код → SANITARYPRODTYPEID, наименование не сохраняем)
  const handleSanitaryProdTypeSelect = (code: string) => {
    setTypeCodeError(false)
    onChange({
      ...data,
      typeCode: code || '',
      typeName: '',
    })
  }

  const handleProductTypeNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...data,
      typeCode: '',
      typeName: e.target.value ?? '',
    })
  }

  const handleTradeNamesChange = (index: number, value: string) => {
    const next = [...tradeNamesList]
    next[index] = value
    onChange({
      ...data,
      productDetails: { ...data.productDetails, tradeNames: next, tradeName: next[0] || undefined },
    })
  }

  const handleAddTradeName = () => {
    onChange({
      ...data,
      productDetails: {
        ...data.productDetails,
        tradeNames: [...tradeNamesList, ''],
        tradeName: tradeNamesList[0] || undefined,
      },
    })
  }

  const handleRemoveTradeName = (index: number) => {
    const next = tradeNamesList.filter((_, i) => i !== index)
    onChange({
      ...data,
      productDetails: {
        ...data.productDetails,
        tradeNames: next.length ? next : undefined,
        tradeName: next[0] || undefined,
      },
    })
  }

  const handleValuesChange = (changedValues: any, allValues: any) => {
    // Пропускаем когда пользователь изменил тип продукции (обрабатывается переключателем код/наименование)
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
        tradeName: pd.tradeNames?.[0] ?? pd.tradeName,
        tradeNames: pd.tradeNames,
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
      className="field-tag-form"
      onValuesChange={handleValuesChange}
    >
      <Form.Item label="Вид продукции" style={{ marginBottom: 4 }}>
        <Radio.Group
          value={productTypeMode}
          onChange={(e) => {
            const mode = e.target.value as 'code' | 'name'
            setProductTypeMode(mode)
            if (mode === 'code') {
              onChange({ ...data, typeCode: data.typeCode || '', typeName: '' })
            } else {
              onChange({ ...data, typeCode: '', typeName: data.typeName || '' })
            }
          }}
          style={{ marginBottom: 0 }}
        >
          <Radio value="code">Код вида продукции</Radio>
          <Radio value="name">Наименование вида продукции</Radio>
        </Radio.Group>
      </Form.Item>
      {productTypeMode === 'code' && (
        <Form.Item
          label={labelWithHelp('Код вида продукции', FIELD_HELP.productTypeCode)}
          name="typeCode"
          style={{ marginTop: 0 }}
          validateStatus={typeCodeError ? 'error' : ''}
          help={typeCodeError ? 'Код не найден в справочнике' : ''}
        >
          <Select
            showSearch
            placeholder="Выберите вид продукции"
            loading={loadingSanitaryProdTypes}
            value={data.typeCode || undefined}
            onChange={handleSanitaryProdTypeSelect}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={getSanitaryProdTypeSelectOptions()}
            allowClear
            status={typeCodeError ? 'error' : undefined}
          />
        </Form.Item>
      )}
      {productTypeMode === 'name' && (
        <Form.Item
          label={labelWithHelp('Наименование вида продукции', FIELD_HELP.productTypeName)}
          name="typeName"
          style={{ marginTop: 0 }}
        >
          <Input
            placeholder="Введите наименование вида продукции"
            value={data.typeName ?? ''}
            onChange={handleProductTypeNameChange}
          />
        </Form.Item>
      )}
      <Form.Item label="Идентификатор" name="productId" rules={getFormRules('productId')}>
        <Input placeholder="штрихкод" maxLength={getMaxLength('productId')} showCount />
      </Form.Item>
      <Form.Item label="Наименование" name="productName" rules={getFormRules('productName')}>
        <Input maxLength={getMaxLength('productName')} showCount />
      </Form.Item>
      <Form.Item label={labelWithHelp('Название продукции', FIELD_HELP.tradeName)}>
        <div>
          {tradeNamesList.map((value, index) => (
            <Space key={index} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
              <Input
                placeholder="Название продукции (торговое наименование)"
                value={value}
                onChange={(e) => handleTradeNamesChange(index, e.target.value)}
                style={{ flex: 1 }}
                maxLength={getMaxLength('tradeName')}
                showCount
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveTradeName(index)}
                disabled={tradeNamesList.length <= 1}
              />
            </Space>
          ))}
          <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddTradeName} style={{ width: '100%' }}>
            Добавить название
          </Button>
        </div>
      </Form.Item>
      <Form.Item label="Описание" name="description" rules={getFormRules('description')}>
        <Input.TextArea rows={3} maxLength={getMaxLength('description')} showCount />
      </Form.Item>
      <Form.Item label="Код ТН ВЭД ЕАЭС" name="commodityCode" rules={getFormRules('commodityCode')} help={getFormatHint('commodityCode')}>
        <Input placeholder="2, 4, 6 или 8–10 цифр" maxLength={10} />
      </Form.Item>
      <Form.Item label="Назначение продукции" name="productPurpose" rules={getFormRules('productPurpose')}>
        <Input.TextArea rows={2} maxLength={getMaxLength('productPurpose')} showCount />
      </Form.Item>
      <Form.Item label="Способ применения" name="applicationMethod" rules={getFormRules('applicationMethod')}>
        <Input.TextArea rows={2} maxLength={getMaxLength('applicationMethod')} showCount />
      </Form.Item>
      <Form.Item label="Форма выпуска" name="releaseForm" rules={getFormRules('releaseForm')}>
        <Input maxLength={getMaxLength('releaseForm')} showCount />
      </Form.Item>
      <Form.Item label="Условия хранения" name="storageCondition" rules={getFormRules('storageCondition')}>
        <Input.TextArea rows={2} maxLength={getMaxLength('storageCondition')} showCount />
      </Form.Item>
      <Form.Item label="Информация на этикетке" name="labelText" rules={getFormRules('labelText')}>
        <Input.TextArea rows={3} maxLength={getMaxLength('labelText')} showCount />
      </Form.Item>
      
      <Form.Item label="Техническая документация">
        <div>
          {data.productDetails.technicalDocs?.map((doc, index) => (
            <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Form.Item label="Вид документа" style={{ marginBottom: 8 }}>
                  <Select
                    showSearch
                    placeholder="Код — наименование вида документа"
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
                <Form.Item label="Наименование документа">
                  <Input
                    placeholder="Наименование документа"
                    value={doc.docName}
                    onChange={(e) => handleTechnicalDocChange(index, 'docName', e.target.value)}
                    maxLength={getMaxLength('docName500')}
                    showCount
                  />
                </Form.Item>
                <Form.Item label="Номер документа">
                  <Input
                    placeholder="Номер документа"
                    value={doc.docId}
                    onChange={(e) => handleTechnicalDocChange(index, 'docId', e.target.value)}
                    maxLength={getMaxLength('docId')}
                    showCount
                  />
                </Form.Item>
                <DatePicker
                  format={DATE_DISPLAY_FORMAT}
                  placeholder="Дата документа"
                  value={doc.docCreationDate ? dayjs(doc.docCreationDate) : null}
                  onChange={(date) => handleTechnicalDocChange(index, 'docCreationDate', date ? date.format('YYYY-MM-DD') : '')}
                  style={{ minWidth: 140 }}
                />
                <DatePicker
                  format={DATE_DISPLAY_FORMAT}
                  placeholder="Дата начала действия"
                  value={doc.docStartDate ? dayjs(doc.docStartDate) : null}
                  onChange={(date) => handleTechnicalDocChange(index, 'docStartDate', date ? date.format('YYYY-MM-DD') : '')}
                  style={{ minWidth: 140 }}
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

