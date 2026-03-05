import { useState, useEffect } from 'react'
import { Collapse, Form, Input, Button, Space, Select } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { labelWithHelp } from '@/components/common/FieldHelp'
import { FIELD_HELP } from '@/constants/fieldDescriptions'
import type { SupplyChainPartyDetails, AddressDetails, ContactDetails } from '@/types/card'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import CountrySelect from '@/components/common/CountrySelect'
import { useSupplyChainPartyKindOptions } from '@/hooks/useSupplyChainPartyKindOptions'
import { useLegalFormOptions } from '@/hooks/useLegalFormOptions'
import { useIdentificationMethodOptions } from '@/hooks/useIdentificationMethodOptions'
import { checkSupplyChainPartyKindExists } from '@/utils/referenceDataApi'

/** Идентификатор справочника организационно-правовых форм (SESINT.LEGALFORM) */
const LEGAL_FORM_CODE_LIST_ID = '2049'

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
  const countryForLegalForm = normalizeCountryCode(data.country)
  const { getSelectOptions: getLegalFormSelectOptions, getNameByCode: getLegalFormNameByCode, loading: loadingLegalForms } = useLegalFormOptions(countryForLegalForm)
  const { getSelectOptions: getIdentificationMethodSelectOptions, loading: loadingIdMethods } = useIdentificationMethodOptions(countryForLegalForm)
  const [kindCodeError, setKindCodeError] = useState<boolean>(false)

  /** Значение из справочника (код + codeListId 2049): в Select показывается «код — наименование» */
  const isLegalFormFromRef = !!(data.businessEntityTypeCode && data.businessEntityTypeCodeListId === LEGAL_FORM_CODE_LIST_ID)

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
      // Передаём только код вида, чтобы не перезаписать уже введённые поля (наименование и т.д.)
      onChange({ supplyChainPartyKindCode: fixedSupplyChainPartyKindCode })
    }
  }, [fixedSupplyChainPartyKindCode, data.supplyChainPartyKindCode])

  useEffect(() => {
    form.setFieldsValue({
      country: normalizeCountryCode(data.country),
      supplyChainPartyKindCode: effectiveKindCode,
      businessEntityName: data.businessEntityName,
      shortName: data.shortName,
      organizationalForm: data.organizationalForm,
      businessEntityTypeCode: isLegalFormFromRef ? data.businessEntityTypeCode : undefined,
      subjectIdentifier: data.subjectIdentifier,
      identificationMethod: data.identificationMethod,
      customsNumber: data.customsNumber,
      taxpayerId: data.taxpayerId,
    })
  }, [data, form, normalizeCountryCode, effectiveKindCode, isLegalFormFromRef])

  // Обработчик выбора вида участника цепи поставки
  const handleSupplyChainPartyKindSelect = (code: string) => {
    const kindName = getSupplyChainPartyKindNameByCode(code) || ''
    setKindCodeError(false) // Сбрасываем ошибку при выборе из справочника
    onChange({
      ...data,
      supplyChainPartyKindCode: code,
    })
  }

  const handleLegalFormSelect = (code: string | null) => {
    if (!code) {
      onChange({
        ...data,
        businessEntityTypeCode: undefined,
        businessEntityTypeCodeListId: undefined,
      })
      return
    }
    const name = getLegalFormNameByCode(code)
    onChange({
      ...data,
      businessEntityTypeCode: code,
      businessEntityTypeCodeListId: LEGAL_FORM_CODE_LIST_ID,
      organizationalForm: name ?? data.organizationalForm ?? '',
    })
  }

  const handleValuesChange = (changedValues: any, allValues: any) => {
    if (changedValues?.supplyChainPartyKindCode !== undefined) return
    if (changedValues?.businessEntityTypeCode !== undefined) {
      const code = allValues.businessEntityTypeCode
      handleLegalFormSelect(code || null)
      return
    }
    onChange({
      ...data,
      ...allValues,
      businessEntityTypeCode: data.businessEntityTypeCode,
      businessEntityTypeCodeListId: data.businessEntityTypeCodeListId,
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
                  label={labelWithHelp('Вид', FIELD_HELP.supplyChainPartyKind)}
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
                <Form.Item
                  label="Организационно-правовая форма (из справочника)"
                  name="businessEntityTypeCode"
                >
                  <Select
                    showSearch
                    placeholder={countryForLegalForm ? 'Выберите по справочнику (код — наименование)' : 'Сначала укажите страну'}
                    allowClear
                    loading={loadingLegalForms}
                    onChange={handleLegalFormSelect}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={getLegalFormSelectOptions()}
                    disabled={!countryForLegalForm}
                    notFoundContent={loadingLegalForms ? 'Загрузка...' : 'Нет данных по выбранной стране'}
                  />
                </Form.Item>
                {!isLegalFormFromRef && (
                  <Form.Item
                    label="Наименование организационно-правовой формы (вручную)"
                    name="organizationalForm"
                  >
                    <Input placeholder="Если не выбрано из справочника" />
                  </Form.Item>
                )}
                <Form.Item label="Идентификатор субъекта" name="subjectIdentifier">
                  <Input />
                </Form.Item>
                <Form.Item label="Метод идентификации" name="identificationMethod">
                  <Select
                    showSearch
                    placeholder={countryForLegalForm ? 'Выберите из справочника (букв. обозначение — описание)' : 'Сначала укажите страну'}
                    allowClear
                    loading={loadingIdMethods}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={getIdentificationMethodSelectOptions()}
                    disabled={!countryForLegalForm}
                    notFoundContent={loadingIdMethods ? 'Загрузка...' : 'Нет данных по выбранной стране'}
                  />
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





