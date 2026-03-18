import { useState } from 'react'
import { Collapse, Descriptions } from 'antd'
import type { SupplyChainPartyDetails, ContactDetails } from '@/types/card'
import {
  getAddressListFromParty,
  formatAddressList,
  getDefaultAddressKindName,
  getDefaultCountryName,
} from '@/utils/addressFormatUtils'
import { useLegalFormOptions } from '@/hooks/shared/useLegalFormOptions'
import { useIdentificationMethodOptions } from '@/hooks/shared/useIdentificationMethodOptions'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useSupplyChainPartyKindOptions } from '@/hooks/shared/useSupplyChainPartyKindOptions'
import { useCommunicationChannelOptions } from '@/hooks/shared/useCommunicationChannelOptions'

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
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const { getNameByCode: getSupplyChainPartyKindNameByCode } = useSupplyChainPartyKindOptions()
  const { getNameByCode: getCommunicationChannelNameByCode } = useCommunicationChannelOptions()
  const isFromRef = !!(data.businessEntityTypeCode && data.businessEntityTypeCodeListId === LEGAL_FORM_CODE_LIST_ID)
  const kindDisplay = data.supplyChainPartyKindCode
    ? `${data.supplyChainPartyKindCode} - ${getSupplyChainPartyKindNameByCode(data.supplyChainPartyKindCode) || data.supplyChainPartyKindCode}`
    : '-'
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
    (code) => getCountryDisplayLabel(code) || getDefaultCountryName(code) || '-'
  )

  const formatContactLabel = (contact: ContactDetails): string => {
    if (!contact) return ''
    if (contact.communicationChannelCode) {
      const name = getCommunicationChannelNameByCode(contact.communicationChannelCode)
      return name ? `${contact.communicationChannelCode} - ${name}` : contact.communicationChannelCode
    }
    if (contact.communicationChannelName) return contact.communicationChannelName
    if (contact.contactKind) return contact.contactKind
    return ''
  }

  const contactValue = (contact: ContactDetails): string =>
    (contact.communicationChannelId ?? contact.contactValue ?? '').trim()

  // Группируем контакты по виду (код/наименование); при нескольких значениях одного вида — через пробел
  const contactGroups = (data.contacts || []).reduce(
    (acc, contact) => {
      const label = formatContactLabel(contact) || 'Контакт'
      const value = contactValue(contact)
      if (!value) return acc
      if (!acc[label]) acc[label] = []
      acc[label].push(value)
      return acc
    },
    {} as Record<string, string[]>
  )
  const contactDisplayLines = Object.entries(contactGroups).map(
    ([label, values]) => `${label}: ${values.join(' ')}`
  )

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
                <Descriptions.Item label="Страна">{getCountryDisplayLabel(data.country)}</Descriptions.Item>
                <Descriptions.Item label="Вид">{kindDisplay}</Descriptions.Item>
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
                {contactDisplayLines.length > 0 && (
                  <Descriptions.Item label="Контактный реквизит">
                    <div>
                      {contactDisplayLines.map((line, index) => (
                        <div key={index} style={{ marginBottom: '4px' }}>{line}</div>
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

