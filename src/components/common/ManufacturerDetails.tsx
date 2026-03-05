import { useState } from 'react'
import { Collapse, Descriptions } from 'antd'
import type { SupplyChainPartyDetails, ContactDetails } from '@/types/card'
import {
  getAddressListFromParty,
  formatAddressList,
  getDefaultAddressKindName,
  getDefaultCountryName,
} from '@/utils/addressFormatUtils'
import { useLegalFormOptions } from '@/hooks/useLegalFormOptions'
import { useIdentificationMethodOptions } from '@/hooks/useIdentificationMethodOptions'

const LEGAL_FORM_CODE_LIST_ID = '2049'

interface ManufacturerDetailsProps {
  data: SupplyChainPartyDetails
  title?: string
}

const ManufacturerDetails: React.FC<ManufacturerDetailsProps> = ({
  data,
  title = 'Изготовитель продукции',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const { getNameByCode: getLegalFormNameByCode } = useLegalFormOptions(data.country)
  const { getDisplayLabel: getIdentificationMethodDisplayLabel } = useIdentificationMethodOptions(data.country)
  const isFromRef = !!(data.businessEntityTypeCode && data.businessEntityTypeCodeListId === LEGAL_FORM_CODE_LIST_ID)
  const organizationalFormDisplay = isFromRef && data.businessEntityTypeCode
    ? (getLegalFormNameByCode(data.businessEntityTypeCode) ? `${data.businessEntityTypeCode} - ${getLegalFormNameByCode(data.businessEntityTypeCode)}` : (data.organizationalForm || data.businessEntityTypeCode))
    : (data.organizationalForm || '-')
  
  console.log('ManufacturerDetails получил данные:', data)
  
  // Проверяем, есть ли данные для отображения
  const hasData = data && (
    data.country ||
    data.businessEntityName ||
    data.shortName ||
    data.subjectIdentifier ||
    data.registrationAddress ||
    data.actualAddress ||
    (data.contacts && data.contacts.length > 0)
  )
  
  if (!hasData) {
    return (
      <div style={{ marginTop: '16px', padding: '8px', background: '#f5f5f5', borderRadius: '4px' }}>
        {title}: данные не указаны
      </div>
    )
  }

  const addressList = getAddressListFromParty(data)
  const addressLines = formatAddressList(
    addressList,
    getDefaultAddressKindName,
    (code) => getDefaultCountryName(code) || code || '-'
  )

  const formatContact = (contact: ContactDetails): string => {
    if (!contact) return '-'
    const kind = contact.contactKind || ''
    const value = contact.contactValue || ''
    
    // Определяем тип контакта по значению или коду
    let contactType = kind
    if (!contactType && value) {
      if (value.includes('@')) contactType = 'электронная почта'
      else if (value.includes('+') || /^\d/.test(value)) contactType = 'телефон'
      else if (value.toLowerCase().includes('fax')) contactType = 'факс'
    }
    
    return contactType && value ? `${contactType}: ${value}` : value || contactType || '-'
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
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Страна">{data.country || '-'}</Descriptions.Item>
                <Descriptions.Item label="Наименование субъекта">
                  {data.businessEntityName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Краткое наименование">
                  {data.shortName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Организационно-правовая форма">
                  {organizationalFormDisplay}
                </Descriptions.Item>
                <Descriptions.Item label="Идентификатор субъекта">
                  {data.subjectIdentifier || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Метод идентификации">
                  {data.identificationMethod ? getIdentificationMethodDisplayLabel(data.identificationMethod) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Таможенный номер">
                  {data.customsNumber || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Идентификатор налогоплательщика">
                  {data.taxpayerId || '-'}
                </Descriptions.Item>
                {addressLines.length > 0 && (
                  <Descriptions.Item label="Адреса">
                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                      {addressLines.map((line, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{line}</li>
                      ))}
                    </ul>
                  </Descriptions.Item>
                )}
                {data.contacts && data.contacts.length > 0 && (
                  <Descriptions.Item label="Контактный реквизит">
                    <div>
                      {data.contacts.map((contact, index) => (
                        <div key={index} style={{ marginBottom: '4px' }}>
                          {formatContact(contact)}
                        </div>
                      ))}
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            ),
          },
        ]}
      />
    </div>
  )
}

export default ManufacturerDetails

