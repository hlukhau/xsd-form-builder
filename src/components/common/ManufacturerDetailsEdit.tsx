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
import { getAddressListFromParty, getDefaultAddressKindName } from '@/utils/addressFormatUtils'
import { useCommunicationChannelOptions } from '@/hooks/useCommunicationChannelOptions'
import { FieldTagBlock } from '@/components/common/FieldTag'
import { getFormRules, getMaxLength, getFormatHint, validateFieldValue } from '@/constants/xsdFieldConstraints'

/** Идентификатор справочника организационно-правовых форм (SESINT.LEGALFORM) */
const LEGAL_FORM_CODE_LIST_ID = '2049'

interface ManufacturerDetailsEditProps {
  data: SupplyChainPartyDetails
  onChange: (data: SupplyChainPartyDetails) => void
  title?: string
  /** Код вида участника цепи поставки фиксирован (поле нередактируемое, подставляется автоматически). */
  fixedSupplyChainPartyKindCode?: string
  /** Скрыть поле «Вид» (для организации в месте обнаружения — вид не указывается). */
  hideKindField?: boolean
}

const ManufacturerDetailsEdit: React.FC<ManufacturerDetailsEditProps> = ({
  data,
  onChange,
  title = 'Изготовитель продукции',
  fixedSupplyChainPartyKindCode,
  hideKindField = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [form] = Form.useForm()
  const { countryOptions, loading, normalizeCountryCode } = useCountryOptions()
  const { loading: loadingSupplyChainPartyKinds, getSelectOptions: getSupplyChainPartyKindSelectOptions, getNameByCode: getSupplyChainPartyKindNameByCode } = useSupplyChainPartyKindOptions()
  const countryForLegalForm = normalizeCountryCode(data.country)
  const { options: legalFormOptionsList, getSelectOptions: getLegalFormSelectOptions, getNameByCode: getLegalFormNameByCode, loading: loadingLegalForms } = useLegalFormOptions(countryForLegalForm)
  /** Значение из справочника (код + codeListId 2049): в Select показывается «код — наименование» */
  const isLegalFormFromRef = !!(data.businessEntityTypeCode && data.businessEntityTypeCodeListId === LEGAL_FORM_CODE_LIST_ID)
  const legalFormCodeFromRef = isLegalFormFromRef ? data.businessEntityTypeCode : undefined
  const legalFormCodeNotInOptions =
    legalFormCodeFromRef &&
    countryForLegalForm &&
    !loadingLegalForms &&
    legalFormOptionsList.length >= 0 &&
    !legalFormOptionsList.some((o) => String(o.code) === String(legalFormCodeFromRef))
  const { getSelectOptions: getIdentificationMethodSelectOptions, loading: loadingIdMethods } = useIdentificationMethodOptions(countryForLegalForm)
  const { getSelectOptions: getCommunicationChannelSelectOptions, loading: loadingCommunicationChannels } = useCommunicationChannelOptions()
  const [kindCodeError, setKindCodeError] = useState<boolean>(false)
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({})

  // Проверка кода вида участника по справочнику с дебаунсом (не при каждом вводе символа)
  useEffect(() => {
    const code = data.supplyChainPartyKindCode?.trim()
    if (!code) {
      setKindCodeError(false)
      return
    }
    const t = setTimeout(() => {
      checkSupplyChainPartyKindExists(code)
        .then((exists) => setKindCodeError(!exists))
        .catch(() => setKindCodeError(false))
    }, 400)
    return () => clearTimeout(t)
  }, [data.supplyChainPartyKindCode])

  // При фиксированном коде вида (например 41 для изготовителя) всегда подставляем его в данные
  const effectiveKindCode = fixedSupplyChainPartyKindCode ?? data.supplyChainPartyKindCode
  useEffect(() => {
    if (fixedSupplyChainPartyKindCode && data.supplyChainPartyKindCode !== fixedSupplyChainPartyKindCode) {
      // Передаём только код вида, чтобы не перезаписать уже введённые поля (наименование и т.д.)
      onChange({ ...data, supplyChainPartyKindCode: fixedSupplyChainPartyKindCode })
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

  // Подтягивание значения организационно-правовой формы из XML при загрузке опций по стране
  useEffect(() => {
    if (!countryForLegalForm || !data.businessEntityTypeCode || !data.businessEntityTypeCodeListId) return
    if (data.businessEntityTypeCodeListId !== LEGAL_FORM_CODE_LIST_ID) return
    form.setFieldValue('businessEntityTypeCode', data.businessEntityTypeCode)
  }, [countryForLegalForm, data.businessEntityTypeCode, data.businessEntityTypeCodeListId, form])

  // Обработчик выбора вида участника цепи поставки
  const handleSupplyChainPartyKindSelect = (code: string) => {
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

  const addressList = getAddressListFromParty(data)

  const syncAddressesToParty = (list: AddressDetails[]) => {
    onChange({
      ...data,
      addresses: list,
      registrationAddress: list.find((a) => (a.addressKindCode || '') === '1'),
      actualAddress: list.find((a) => (a.addressKindCode || '') === '2'),
      mailingAddress: list.find((a) => (a.addressKindCode || '') === '3'),
    })
  }

  const handleAddressChange = (index: number, field: keyof AddressDetails, value: string | undefined) => {
    const list = [...addressList]
    if (!list[index]) return
    list[index] = { ...list[index], [field]: value }
    syncAddressesToParty(list)
  }

  const handleAddressAdd = () => {
    syncAddressesToParty([...addressList, { addressKindCode: '1' }])
  }

  const handleAddressRemove = (index: number) => {
    const list = addressList.filter((_, i) => i !== index)
    syncAddressesToParty(list)
    setAddressErrors({})
  }

  const handleContactAdd = () => {
    const newContact: ContactDetails = {
      communicationChannelCode: undefined,
      communicationChannelName: undefined,
      communicationChannelId: '',
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
    const next = { ...updatedContacts[index], [field]: value }
    if (field === 'communicationChannelCode') {
      next.communicationChannelCode = value || ''
      if (value) next.communicationChannelName = ''
    }
    if (field === 'communicationChannelName') {
      next.communicationChannelName = value
      if (value.trim()) next.communicationChannelCode = ''
    }
    if (field === 'communicationChannelId' || field === 'contactValue') {
      next.communicationChannelId = value
      next.contactValue = value
    }
    updatedContacts[index] = next
    onChange({ ...data, contacts: updatedContacts })
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
                className="field-tag-form"
                onValuesChange={handleValuesChange}
              >
                <Form.Item label="Страна" name="country">
                  <CountrySelect
                    loading={loading}
                    countryOptions={countryOptions}
                    normalizeCountryCode={normalizeCountryCode}
                  />
                </Form.Item>
                {!hideKindField && (fixedSupplyChainPartyKindCode ? (
                  <Form.Item
                    label={labelWithHelp('Вид', FIELD_HELP.supplyChainPartyKind)}
                    validateStatus={kindCodeError ? 'error' : ''}
                    help={kindCodeError ? 'Код не найден в справочнике' : ''}
                  >
                    <Input
                      readOnly
                      value={`${fixedSupplyChainPartyKindCode} - ${getSupplyChainPartyKindNameByCode(fixedSupplyChainPartyKindCode) || 'загрузка…'}`}
                    />
                  </Form.Item>
                ) : (
                  <Form.Item
                    label={labelWithHelp('Вид', FIELD_HELP.supplyChainPartyKind)}
                    name="supplyChainPartyKindCode"
                    validateStatus={kindCodeError ? 'error' : ''}
                    help={kindCodeError ? 'Код не найден в справочнике' : ''}
                  >
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
                  </Form.Item>
                ))}
                <Form.Item label="Наименование субъекта" name="businessEntityName" rules={getFormRules('businessEntityName')}>
                  <Input maxLength={getMaxLength('businessEntityName')} showCount />
                </Form.Item>
                <Form.Item label="Краткое наименование" name="shortName" rules={getFormRules('shortName')}>
                  <Input maxLength={getMaxLength('shortName')} showCount />
                </Form.Item>
                <Form.Item
                  label="Организационно-правовая форма (из справочника)"
                  name="businessEntityTypeCode"
                  validateStatus={legalFormCodeNotInOptions ? 'warning' : undefined}
                  help={
                    legalFormCodeNotInOptions
                      ? `Значение из документа (${legalFormCodeFromRef}) отсутствует в справочнике для страны ${countryForLegalForm}. Возможные причины: период действия записи в справочнике не включает текущую дату; не совпала страна; запись удалена.`
                      : undefined
                  }
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
                    notFoundContent={loadingLegalForms ? 'Загрузка...' : 'Нет данных по выбранной стране. Проверьте период действия записей (LEGALFORMSDATE–LEGALFORMEDATE) и страну.'}
                  />
                </Form.Item>
                {!isLegalFormFromRef && (
                  <Form.Item
                    label="Наименование организационно-правовой формы (вручную)"
                    name="organizationalForm"
                    rules={getFormRules('organizationalForm')}
                  >
                    <Input placeholder="Если не выбрано из справочника" maxLength={getMaxLength('organizationalForm')} showCount />
                  </Form.Item>
                )}
                <Form.Item label="Идентификатор субъекта" name="subjectIdentifier" rules={getFormRules('subjectIdentifier')}>
                  <Input maxLength={getMaxLength('subjectIdentifier')} showCount />
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
                <Form.Item label="Таможенный номер" name="customsNumber" rules={getFormRules('customsNumber')}>
                  <Input maxLength={getMaxLength('customsNumber')} showCount />
                </Form.Item>
                <Form.Item label="Идентификатор налогоплательщика" name="taxpayerId" rules={getFormRules('taxpayerId')}>
                  <Input maxLength={getMaxLength('taxpayerId')} showCount />
                </Form.Item>

                {/* Адреса — список с добавлением */}
                <div style={{ marginTop: '16px' }}>
                  <h4>Адреса</h4>
                  {addressList.map((addr, index) => (
                    <div key={index} style={{ marginBottom: '16px', padding: '12px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                          <Select
                            placeholder="Вид адреса"
                            value={addr.addressKindCode || undefined}
                            onChange={(value) => handleAddressChange(index, 'addressKindCode', value ?? undefined)}
                            style={{ minWidth: 200 }}
                            options={[
                              { value: '1', label: getDefaultAddressKindName('1') },
                              { value: '2', label: getDefaultAddressKindName('2') },
                              { value: '3', label: getDefaultAddressKindName('3') },
                            ]}
                            allowClear
                          />
                          <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => handleAddressRemove(index)}>
                            Удалить адрес
                          </Button>
                        </Space>
                        <FieldTagBlock label="Страна">
                          <CountrySelect
                            placeholder="Страна"
                            loading={loading}
                            value={addr.country}
                            onChange={(value) => handleAddressChange(index, 'country', value || undefined)}
                            countryOptions={countryOptions}
                            normalizeCountryCode={normalizeCountryCode}
                          />
                        </FieldTagBlock>
                        <FieldTagBlock label="Почтовый индекс">
                          <div>
                            <Input
                              placeholder="Почтовый индекс"
                              value={addr.postCode}
                              onChange={(e) => {
                                const v = e.target.value || undefined
                                handleAddressChange(index, 'postCode', v)
                                const msg = validateFieldValue('postCode', v ?? '')
                                setAddressErrors((prev) => ({ ...prev, [`addr-${index}-postCode`]: msg ?? '' }))
                              }}
                              onBlur={(e) => {
                                const msg = validateFieldValue('postCode', e.target.value?.trim() || undefined)
                                setAddressErrors((prev) => ({ ...prev, [`addr-${index}-postCode`]: msg ?? '' }))
                              }}
                              status={addressErrors[`addr-${index}-postCode`] ? 'error' : undefined}
                            />
                            {addressErrors[`addr-${index}-postCode`] && (
                              <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>
                                {addressErrors[`addr-${index}-postCode`]}
                                {getFormatHint('postCode') && ` (${getFormatHint('postCode')})`}
                              </div>
                            )}
                          </div>
                        </FieldTagBlock>
                        <FieldTagBlock label="Код территории">
                          <Input placeholder="Код территории" value={addr.territoryCode} onChange={(e) => handleAddressChange(index, 'territoryCode', e.target.value || undefined)} maxLength={getMaxLength('territoryCode')} showCount />
                        </FieldTagBlock>
                        <FieldTagBlock label="Регион">
                          <Input placeholder="Регион" value={addr.regionName} onChange={(e) => handleAddressChange(index, 'regionName', e.target.value || undefined)} maxLength={getMaxLength('regionName')} showCount />
                        </FieldTagBlock>
                        <FieldTagBlock label="Район">
                          <Input placeholder="Район" value={addr.districtName} onChange={(e) => handleAddressChange(index, 'districtName', e.target.value || undefined)} maxLength={getMaxLength('districtName')} showCount />
                        </FieldTagBlock>
                        <FieldTagBlock label="Город">
                          <Input placeholder="Город" value={addr.cityName} onChange={(e) => handleAddressChange(index, 'cityName', e.target.value || undefined)} maxLength={getMaxLength('cityName')} showCount />
                        </FieldTagBlock>
                        <FieldTagBlock label="Населённый пункт">
                          <Input placeholder="Населённый пункт" value={addr.settlementName} onChange={(e) => handleAddressChange(index, 'settlementName', e.target.value || undefined)} maxLength={getMaxLength('settlementName')} showCount />
                        </FieldTagBlock>
                        <FieldTagBlock label="Улица">
                          <Input placeholder="Улица" value={addr.streetName} onChange={(e) => handleAddressChange(index, 'streetName', e.target.value || undefined)} maxLength={getMaxLength('streetName')} showCount />
                        </FieldTagBlock>
                        <Space wrap>
                          <FieldTagBlock label="Номер дома" style={{ width: 120 }}>
                            <Input placeholder="Номер дома" value={addr.buildingNumberId} onChange={(e) => handleAddressChange(index, 'buildingNumberId', e.target.value || undefined)} style={{ width: 120 }} maxLength={getMaxLength('buildingNumberId')} showCount />
                          </FieldTagBlock>
                          <FieldTagBlock label="Номер помещения" style={{ width: 120 }}>
                            <Input placeholder="Номер помещения" value={addr.roomNumberId} onChange={(e) => handleAddressChange(index, 'roomNumberId', e.target.value || undefined)} style={{ width: 120 }} maxLength={getMaxLength('roomNumberId')} showCount />
                          </FieldTagBlock>
                        </Space>
                        <FieldTagBlock label="Номер абонентского ящика">
                          <div>
                            <Input
                              placeholder="Номер абонентского ящика"
                              value={addr.postOfficeBoxId}
                              onChange={(e) => {
                                const v = e.target.value || undefined
                                handleAddressChange(index, 'postOfficeBoxId', v)
                                const msg = validateFieldValue('postOfficeBoxId', v ?? '')
                                setAddressErrors((prev) => ({ ...prev, [`addr-${index}-postOfficeBoxId`]: msg ?? '' }))
                              }}
                              onBlur={(e) => {
                                const msg = validateFieldValue('postOfficeBoxId', e.target.value?.trim() || undefined)
                                setAddressErrors((prev) => ({ ...prev, [`addr-${index}-postOfficeBoxId`]: msg ?? '' }))
                              }}
                              maxLength={getMaxLength('postOfficeBoxId')}
                              showCount
                              status={addressErrors[`addr-${index}-postOfficeBoxId`] ? 'error' : undefined}
                            />
                            {addressErrors[`addr-${index}-postOfficeBoxId`] && (
                              <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>{addressErrors[`addr-${index}-postOfficeBoxId`]}</div>
                            )}
                          </div>
                        </FieldTagBlock>
                      </Space>
                    </div>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddressAdd} style={{ width: '100%' }}>
                    Добавить адрес
                  </Button>
                </div>

                {/* Контакты: вид из справочника (код → CommunicationChannelCode) или наименование (→ CommunicationChannelName), значение → CommunicationChannelId */}
                <div style={{ marginTop: '16px' }}>
                  <h4>Контактные реквизиты</h4>
                  {data.contacts?.map((contact, index) => (
                    <div key={index} style={{ marginBottom: '8px', padding: '8px', border: '1px solid #d9d9d9', borderRadius: '4px' }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <FieldTagBlock label="Вид контакта">
                          <Select
                            placeholder="Вид контакта (код — наименование)"
                            allowClear
                            style={{ width: '100%' }}
                            value={contact.communicationChannelCode || undefined}
                            onChange={(value) => handleContactChange(index, 'communicationChannelCode', value ?? '')}
                            loading={loadingCommunicationChannels}
                            options={getCommunicationChannelSelectOptions()}
                            disabled={!!contact.communicationChannelName?.trim()}
                          />
                        </FieldTagBlock>
                        <FieldTagBlock label="Наименование вида связи">
                          <Input
                            placeholder="Наименование вида связи (если не из справочника)"
                            value={contact.communicationChannelName ?? ''}
                            onChange={(e) => handleContactChange(index, 'communicationChannelName', e.target.value)}
                            disabled={!!contact.communicationChannelCode}
                            maxLength={getMaxLength('communicationChannelName')}
                            showCount
                          />
                        </FieldTagBlock>
                        <FieldTagBlock label="Значение">
                          <Input
                            placeholder="Значение (номер, адрес и т.д.)"
                            value={contact.communicationChannelId ?? contact.contactValue ?? ''}
                            onChange={(e) => handleContactChange(index, 'communicationChannelId', e.target.value)}
                            maxLength={getMaxLength('communicationChannelId')}
                            showCount
                          />
                        </FieldTagBlock>
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





