import { Descriptions, Collapse } from 'antd'
import type { DetectionPlaceData, BusinessEntityDetails, AddressDetails } from '@/types/card'

interface DetectionPlaceTabProps {
  data: DetectionPlaceData
}

const DetectionPlaceTab: React.FC<DetectionPlaceTabProps> = ({ data }) => {
  const getCountryName = (code?: string): string => {
    const countryMap: Record<string, string> = {
      'RU': 'Россия',
      'BY': 'Беларусь',
      'KZ': 'Казахстан',
    }
    return code ? (countryMap[code] || code) : '-'
  }

  const formatAddress = (address?: AddressDetails): string => {
    if (!address) return '-'
    if (address.fullAddress) return address.fullAddress

    const parts = []
    if (address.country) parts.push(getCountryName(address.country))
    if (address.cityName) parts.push(address.cityName)
    if (address.streetName) parts.push(address.streetName)
    if (address.buildingNumberId) parts.push(address.buildingNumberId)
    return parts.length > 0 ? parts.join(', ') : '-'
  }

  const getAddressKindName = (code?: string): string => {
    const kindMap: Record<string, string> = {
      '1': 'Регистрационный',
      '2': 'Фактический',
      '3': 'Почтовый',
    }
    return code ? (kindMap[code] || `Вид адреса (код: ${code})`) : ''
  }

  const formatCheckpoint = (checkpoint?: { checkpointCode?: string; checkpointName?: string }): string => {
    if (!checkpoint) return '-'
    if (checkpoint.checkpointCode && checkpoint.checkpointName) {
      return `${checkpoint.checkpointCode} - ${checkpoint.checkpointName}`
    }
    return checkpoint.checkpointCode || checkpoint.checkpointName || '-'
  }

  if (!data) {
    return <div>Данные о месте обнаружения не найдены</div>
  }

  console.log('DetectionPlaceTab получил данные:', data)
  console.log('borderCheckpoint:', data.borderCheckpoint)
  console.log('geoCoordinates:', data.geoCoordinates)

  const hasData = data.organization || data.borderCheckpoint || data.address || data.geoCoordinates || data.description

  if (!hasData) {
    return <div>Данные о месте обнаружения не указаны</div>
  }

  return (
    <div>
      {/* Адрес и Описание сверху (не в раскрывающихся секциях) */}
      <Descriptions column={1} bordered style={{ marginBottom: '16px' }}>
        {data.address && (
          <Descriptions.Item label="Адрес">
            {formatAddress(data.address)}
          </Descriptions.Item>
        )}
        {data.description && data.description !== 'csdo:DescriptionText' && (
          <Descriptions.Item label="Описание">
            {data.description}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Раскрывающиеся секции - всегда показываем, даже если пустые */}
      <Collapse
        defaultActiveKey={[]}
        expandIconPosition="end"
        items={[
          // Пункт пропуска
          {
            key: 'checkpoint',
            label: 'Пункт пропуска',
            children: data.borderCheckpoint ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Код вида пункта пропуска">
                  {formatCheckpoint(data.borderCheckpoint)}
                </Descriptions.Item>
                <Descriptions.Item label="Наименование пункта пропуска">
                  {data.borderCheckpoint.checkpointName || '-'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ color: '#999', fontStyle: 'italic' }}>
                Данные о пункте пропуска не указаны
              </div>
            ),
          },
          // Географические координаты
          {
            key: 'coordinates',
            label: 'Географические координаты',
            children: data.geoCoordinates ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Географическая долгота">
                  {data.geoCoordinates.longitude || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Географическая широта">
                  {data.geoCoordinates.latitude || '-'}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <div style={{ color: '#999', fontStyle: 'italic' }}>
                &lt;может быть перечень координат в составе (долгота, широта)&gt;
              </div>
            ),
          },
        ]}
      />

      {/* Детальная информация об организации (отдельный блок внизу) */}
      {data.organization && (
        <div style={{ marginTop: '24px' }}>
          <h3 style={{ marginBottom: '16px' }}>Организация</h3>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Страна">
              {getCountryName(data.organization.country)}
            </Descriptions.Item>
            <Descriptions.Item label="Наименование субъекта">
              {data.organization.businessEntityName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Краткое наименование">
              {data.organization.businessEntityBriefName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Организационно-правовая форма">
              {data.organization.businessEntityTypeName || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Идентификатор субъекта">
              {data.organization.businessEntityId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Метод идентификации">
              {data.organization.identificationMethod || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Таможенный номер">
              {data.organization.taxpayerId || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Идентификатор налогоплательщика">
              {data.organization.taxpayerId || '-'}
            </Descriptions.Item>
            {data.organization.addresses && data.organization.addresses.length > 0 && (
              <>
                {data.organization.addresses.find(addr => addr.addressKindCode === '1') && (
                  <Descriptions.Item label="Адрес регистрации">
                    {formatAddress(data.organization.addresses.find(addr => addr.addressKindCode === '1'))}
                  </Descriptions.Item>
                )}
                {data.organization.addresses.find(addr => addr.addressKindCode === '2') && (
                  <Descriptions.Item label="Фактический адрес">
                    {formatAddress(data.organization.addresses.find(addr => addr.addressKindCode === '2'))}
                  </Descriptions.Item>
                )}
                {data.organization.addresses.find(addr => addr.addressKindCode === '3') && (
                  <Descriptions.Item label="Почтовый адрес">
                    {formatAddress(data.organization.addresses.find(addr => addr.addressKindCode === '3'))}
                  </Descriptions.Item>
                )}
              </>
            )}
            {data.organization.contacts && data.organization.contacts.length > 0 && (
              <Descriptions.Item label="Контактный реквизит">
                <div>
                  {data.organization.contacts.map((contact, index) => (
                    <div key={index} style={{ marginBottom: '4px' }}>
                      {contact.contactKind || ''}: {contact.contactValue || ''}
                    </div>
                  ))}
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      )}
    </div>
  )
}

export default DetectionPlaceTab

