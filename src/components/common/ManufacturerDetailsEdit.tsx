import { useState, useEffect } from 'react'
import { Collapse, Form, Input, Button, Space, Select } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { SupplyChainPartyDetails, AddressDetails, ContactDetails } from '@/types/card'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import CountrySelect from '@/components/common/CountrySelect'
import { useSupplyChainPartyKindOptions } from '@/hooks/useSupplyChainPartyKindOptions'
import { checkSupplyChainPartyKindExists } from '@/utils/referenceDataApi'

interface ManufacturerDetailsEditProps {
  data: SupplyChainPartyDetails
  onChange: (data: SupplyChainPartyDetails) => void
  title?: string
  /** Код вида участника цепи поставки фиксирован (поле нередактируемое, подставляется автоматически). */
  fixedSupplyChainPartyKindCode?: string
}

const ManufacturerDetailsEdit: React.FC<ManufacturerDetailsEditProps> = ({
  data,
  onChange,
  title = 'Изготовитель продукции',
  fixedSupplyChainPartyKindCode,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [form] = Form.useForm()
  const { countryOptions, loading, normalizeCountryCode } = useCountryOptions()
  const { options: supplyChainPartyKindOptions, loading: loadingSupplyChainPartyKinds, getSelectOptions: getSupplyChainPartyKindSelectOptions, getNameByCode: getSupplyChainPartyKindNameByCode } = useSupplyChainPartyKindOptions()
  const [kindCodeError, setKindCodeError] = useState<boolean>(false)

  // Проверяем валидность кода вида участника при загрузке данных
  useEffect(() => {
    if (data.supplyChainPartyKindCode) {
      checkSupplyChainPartyKindExists(data.supplyChainPartyKindCode)
        .then((exists) => {
          setKindCodeError(!exists)
        })
        .catch(() => {
          setKindCodeError(false)
        })
    } else {
      setKindCodeError(false)
    }
  }, [data.supplyChainPartyKindCode])

  // При фиксированном коде вида (например 41 для изготовителя) всегда подставляем его в данные
  const effectiveKindCode = fixedSupplyChainPartyKindCode ?? data.supplyChainPartyKindCode
  useEffect(() => {
    if (fixedSupplyChainPartyKindCode && data.supplyChainPartyKindCode !== fixedSupplyChainPartyKindCode) {
      onChange({
        ...data,
        supplyChainPartyKindCode: fixedSupplyChainPartyKindCode,
      })
    }
  }, [fixedSupplyChainPartyKindCode, data.supplyChainPartyKindCode])

  useEffect(() => {
    form.setFieldsValue({
      country: normalizeCountryCode(data.country),
      supplyChainPartyKindCode: effectiveKindCode,
      businessEntityName: data.businessEntityName,
      shortName: data.shortName,
      organizationalForm: data.organizationalForm,
      subjectIdentifier: data.subjectIdentifier,
      identificationMethod: data.identificationMethod,
      customsNumber: data.customsNumber,
      taxpayerId: data.taxpayerId,
    })
  }, [data, form, normalizeCountryCode, effectiveKindCode])

  // Обработчик выбора вида участника цепи поставки
  const handleSupplyChainPartyKindSelect = (code: string) => {
    const kindName = getSupplyChainPartyKindNameByCode(code) || ''
    setKindCodeError(false) // Сбрасываем ошибку при выборе из справочника
    onChange({
      ...data,
      supplyChainPartyKindCode: code,
    })
  }

  const handleValuesChange = (_: any, allValues: any) => {
    // Игнорируем изменения в supplyChainPartyKindCode (обрабатывается отдельно)
    if (allValues.supplyChainPartyKindCode !== undefined) {
      return
    }
    onChange({
      ...data,
      ...allValues,
    })
  }

  const handleAddressChange = (kindCode: string, field: string, value: string) => {
    const addressField = kindCode === '1' ? 'registrationAddress' :
                        kindCode === '2' ? 'actualAddress' : 'mailingAddress'
    onChange({
      ...data,
      [addressField]: {
        ...(data[addressField as keyof SupplyChainPartyDetails] as AddressDetails || {}),
        addressKindCode: kindCode,
        [field]: value,
      },
    })
  }

  const handleContactAdd = () => {
    const newContact: ContactDetails = {
      contactKind: '',
      contactValue: '',
    }
    onChange({
      ...data,
      contacts: [...(data.contacts || []), newContact],
    })
  }

  const handleContactRemove = (index: number) => {
    const updatedContacts = [...(data.contacts || [])]
    updatedContacts.splice(index, 1)
    onChange({
      ...data,
      contacts: updatedContacts,
    })
  }

  const handleContactChange = (index: number, field: string, value: string) => {
    const updatedContacts = [...(data.contacts || [])]
    updatedContacts[index] = {
      ...updatedContacts[index],
      [field]: value,
    }
    onChange({
      ...data,
      contacts: updatedContacts,
    })
  }

  return (
    <div style={{ marginTop: '16px' }}>
      <Collapse
        activeKey={isOpen ? ['1'] : []}
        onChange={(keys) => setIsOpen(keys.length > 0)}
        items={[
          {
            key: '1',
            label: title,
            children: (
              <Form
                form={form}
                layout="vertical"
                onValuesChange={handleValuesChange}
              >
                <Form.Item label="Страна" name="country">
                  <CountrySelect
                    loading={loading}
                    countryOptions={countryOptions}
                    normalizeCountryCode={normalizeCountryCode}
                  />
                </Form.Item>
                <Form.Item 
                  label="Вид участника цепи поставки" 
                  name="supplyChainPartyKindCode"
                  validateStatus={kindCodeError ? 'error' : ''}
                  help={kindCodeError ? 'Код не найден в справочнике' : ''}
                >
                  {fixedSupplyChainPartyKindCode ? (
                    <Input
                      readOnly
                      value={getSupplyChainPartyKindNameByCode(fixedSupplyChainPartyKindCode) || `Код ${fixedSupplyChainPartyKindCode}`}
                    />
                  ) : (
                    <Select
                      showSearch
                      placeholder="Выберите вид участника"
                      loading={loadingSupplyChainPartyKinds}
                      value={data.supplyChainPartyKindCode}
                      onChange={handleSupplyChainPartyKindSelect}
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={getSupplyChainPartyKindSelectOptions()}
                      allowClear
                      status={kindCodeError ? 'error' : undefined}
                    />
                  )}
                </Form.Item>
                <Form.Item label="Наименование субъекта" name="businessEntityName">
                  <Input />
                </Form.Item>
                <Form.Item label="Краткое наименование" name="shortName">
                  <Input />
                </Form.Item>
                <Form.Item label="Организационно-правовая форма" name="organizationalForm">
                  <Input />
                </Form.Item>
                <Form.Item label="Идентификатор субъекта" name="subjectIdentifier">
                  <Input />
                </Form.Item>
                <Form.Item label="Метод идентификации" name="identificationMethod">
                  <Input />
                </Form.Item>
                <Form.Item label="Таможенный номер" name="customsNumber">
                  <Input />
                </Form.Item>
                <Form.Item label="Идентификатор налогоплательщика" name="taxpayerId">
                  <Input />
                </Form.Item>

                {/* Адреса */}
                <div style={{ marginTop: '16px' }}>
                  <h4>Адрес регистрации</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <CountrySelect
                      placeholder="Страна"
                      loading={loading}
                      value={data.registrationAddress?.country}
                      onChange={(value) => handleAddressChange('1', 'country', value || '')}
                      countryOptions={countryOptions}
                      normalizeCountryCode={normalizeCountryCode}
                    />
                    <Input
                      placeholder="Город"
                      value={data.registrationAddress?.cityName}
                      onChange={(e) => handleAddressChange('1', 'cityName', e.target.value)}
                    />
                    <Input
                      placeholder="Улица"
                      value={data.registrationAddress?.streetName}
                      onChange={(e) => handleAddressChange('1', 'streetName', e.target.value)}
                    />
                    <Input
                      placeholder="Номер здания"
                      value={data.registrationAddress?.buildingNumberId}
                      onChange={(e) => handleAddressChange('1', 'buildingNumberId', e.target.value)}
                    />
                  </Space>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <h4>Фактический адрес</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <CountrySelect
                      placeholder="Страна"
                      loading={loading}
                      value={data.actualAddress?.country}
                      onChange={(value) => handleAddressChange('2', 'country', value || '')}
                      countryOptions={countryOptions}
                      normalizeCountryCode={normalizeCountryCode}
                    />
                    <Input
                      placeholder="Город"
                      value={data.actualAddress?.cityName}
                      onChange={(e) => handleAddressChange('2', 'cityName', e.target.value)}
                    />
                    <Input
                      placeholder="Улица"
                      value={data.actualAddress?.streetName}
                      onChange={(e) => handleAddressChange('2', 'streetName', e.target.value)}
                    />
                    <Input
                      placeholder="Номер здания"
                      value={data.actualAddress?.buildingNumberId}
                      onChange={(e) => handleAddressChange('2', 'buildingNumberId', e.target.value)}
                    />
                  </Space>
                </div>

                <div style={{ marginTop: '16px' }}>
                  <h4>Почтовый адрес</h4>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <CountrySelect
                      placeholder="Страна"
                      loading={loading}
                      value={data.mailingAddress?.country}
                      onChange={(value) => handleAddressChange('3', 'country', value || '')}
                      countryOptions={countryOptions}
                      normalizeCountryCode={normalizeCountryCode}
                    />
                    <Input
                      placeholder="Город"
                      value={data.mailingAddress?.cityName}
                      onChange={(e) => handleAddressChange('3', 'cityName', e.target.value)}
                    />
                    <Input
                      placeholder="Улица"
                      value={data.mailingAddress?.streetName}
                      onChange={(e) => handleAddressChange('3', 'streetName', e.target.value)}
                    />
                    <Input
                      placeholder="Номер здания"
                      value={data.mailingAddress?.buildingNumberId}
                      onChange={(e) => handleAddressChange('3', 'buildingNumberId', e.target.value)}
                    />
                  </Space>
                </div>

                {/* Контакты */}
                <div style={{ marginTop: '16px' }}>
                  <h4>Контактные реквизиты</h4>
                  {data.contacts?.map((contact, index) => (
                    <div key={index} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Input
                          placeholder="Вид контакта (телефон, email, факс)"
                          value={contact.contactKind}
                          onChange={(e) => handleContactChange(index, 'contactKind', e.target.value)}
                        />
                        <Input
                          placeholder="Значение контакта"
                          value={contact.contactValue}
                          onChange={(e) => handleContactChange(index, 'contactValue', e.target.value)}
                        />
                        <Button
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleContactRemove(index)}
                        >
                          Удалить контакт
                        </Button>
                      </Space>
                    </div>
                  ))}
                  <Button
                    type="dashed"
                    icon={<PlusOutlined />}
                    onClick={handleContactAdd}
                    style={{ width: '100%' }}
                  >
                    Добавить контакт
                  </Button>
                </div>
              </Form>
            ),
          },
        ]}
      />
    </div>
  )
}

export default ManufacturerDetailsEdit





