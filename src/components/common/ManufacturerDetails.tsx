import { useState } from 'react'
import { Collapse, Descriptions } from 'antd'
import type { SupplyChainPartyDetails, AddressDetails, ContactDetails } from '@/types/card'

interface ManufacturerDetailsProps {
  data: SupplyChainPartyDetails
  title?: string
}

const ManufacturerDetails: React.FC<ManufacturerDetailsProps> = ({
  data,
  title = 'Изготовитель продукции',
}) => {
  const [isOpen, setIsOpen] = useState(false)
  
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

  const formatAddress = (address?: AddressDetails): string => {
    if (!address) return '-'
    if (address.fullAddress) return address.fullAddress
    
    const parts = []
    if (address.country) parts.push(address.country)
    if (address.cityName) parts.push(address.cityName)
    if (address.streetName) parts.push(address.streetName)
    if (address.buildingNumberId) parts.push(address.buildingNumberId)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

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
                  {data.organizationalForm || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Идентификатор субъекта">
                  {data.subjectIdentifier || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Метод идентификации">
                  {data.identificationMethod || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Таможенный номер">
                  {data.customsNumber || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Идентификатор налогоплательщика">
                  {data.taxpayerId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Адрес регистрации">
                  {formatAddress(data.registrationAddress)}
                </Descriptions.Item>
                <Descriptions.Item label="Фактический адрес">
                  {formatAddress(data.actualAddress)}
                </Descriptions.Item>
                <Descriptions.Item label="Почтовый адрес">
                  {formatAddress(data.mailingAddress)}
                </Descriptions.Item>
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

