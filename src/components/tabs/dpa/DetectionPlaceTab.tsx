import { Descriptions, Collapse } from 'antd'
import type { DetectionPlaceData, BusinessEntityDetails, SupplyChainPartyDetails } from '@/types/card'
import {
  getAddressListFromOrganization,
  formatAddressList,
  formatAddressLineObjectAddress,
  getDefaultAddressKindName,
  getDefaultCountryName,
} from '@/utils/addressFormatUtils'
import { useIdentificationMethodOptions } from '@/hooks/shared/useIdentificationMethodOptions'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import { useLegalFormOptions } from '@/hooks/shared/useLegalFormOptions'

interface DetectionPlaceTabProps {
  data: DetectionPlaceData
  /** Подпись для пустого состояния, например "место обнаружения" или "зона распространения". По умолчанию — "место обнаружения". */
  label?: string
}

const DetectionPlaceTab: React.FC<DetectionPlaceTabProps> = ({ data, label = 'место обнаружения' }) => {
  const { getDisplayLabel: getIdentificationMethodDisplayLabel } = useIdentificationMethodOptions(data?.organization?.country ?? '')
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()
  const { getNameByCode: getLegalFormNameByCode } = useLegalFormOptions(data?.organization?.country)
  const getCountryNameForAddress = (code?: string) => getCountryDisplayLabel(code) || getDefaultCountryName(code) || '-'

  const formatOrgLegalForm = (org: BusinessEntityDetails) => {
    const isFromRef = !!(org.businessEntityTypeCode && org.businessEntityTypeCodeListId === '2049')
    if (isFromRef && org.businessEntityTypeCode) {
      const n = getLegalFormNameByCode(org.businessEntityTypeCode)
      return n ? `${org.businessEntityTypeCode} — ${n}` : org.businessEntityTypeCode
    }
    return org.businessEntityTypeName || (org as unknown as SupplyChainPartyDetails).organizationalForm
  }

  const formatCheckpoint = (checkpoint?: { checkpointCode?: string; checkpointName?: string }): string => {
    if (!checkpoint) return '-'
    if (checkpoint.checkpointCode && checkpoint.checkpointName) {
      return `${checkpoint.checkpointCode} - ${checkpoint.checkpointName}`
    }
    return checkpoint.checkpointCode || checkpoint.checkpointName || '-'
  }

  if (!data) {
    return <div>Данные о {label} не найдены</div>
  }

  console.log('DetectionPlaceTab получил данные:', data)
  console.log('borderCheckpoint:', data.borderCheckpoint)
  console.log('geoCoordinates:', data.geoCoordinates)

  const hasData = data.organization || data.borderCheckpoint || data.address || data.geoCoordinates || data.description

  if (!hasData) {
    return <div>Данные о {label} не указаны</div>
  }

  return (
    <div>
      {/* Адрес и Описание сверху (не в раскрывающихся секциях) */}
      <Descriptions column={1} bordered style={{ marginBottom: '16px' }}>
        {data.address && (
          <Descriptions.Item label="Адрес места обнаружения">
            {formatAddressLineObjectAddress(data.address, getCountryNameForAddress)}
          </Descriptions.Item>
        )}
        {data.description && data.description !== 'csdo:DescriptionText' && (
          <Descriptions.Item label="Описание">
            {data.description}
          </Descriptions.Item>
        )}
      </Descriptions>

      {/* Раскрывающиеся секции - Организация, Пункт пропуска, Географические координаты */}
      <Collapse
        defaultActiveKey={[]}
        expandIconPosition="end"
        items={[
          // Организация
          {
            key: 'organization',
            label: 'Организация',
            children: data.organization ? (
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Страна">
                  {getCountryDisplayLabel(data.organization.country)}
                </Descriptions.Item>
                <Descriptions.Item label="Наименование субъекта">
                  {data.organization.businessEntityName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Краткое наименование">
                  {data.organization.businessEntityBriefName || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Организационно-правовая форма">
                  {formatOrgLegalForm(data.organization) || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Идентификатор субъекта">
                  {data.organization.businessEntityId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Метод идентификации">
                  {data.organization.identificationMethod ? getIdentificationMethodDisplayLabel(data.organization.identificationMethod) : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Таможенный номер">
                  {data.organization.customsNumber || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Идентификатор налогоплательщика">
                  {data.organization.taxpayerId || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="Код причины постановки на учёт">
                  {data.organization.taxRegistrationReasonCode || '-'}
                </Descriptions.Item>
                {(() => {
                  const list = getAddressListFromOrganization(data.organization)
                  const lines = formatAddressList(list, getDefaultAddressKindName, getCountryNameForAddress)
                  return lines.length > 0 ? (
                    <Descriptions.Item label="Адреса">
                      <ul style={{ margin: 0, paddingLeft: '20px' }}>
                        {lines.map((line, idx) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>{line}</li>
                        ))}
                      </ul>
                    </Descriptions.Item>
                  ) : null
                })()}
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
            ) : (
              <div style={{ color: '#999', fontStyle: 'italic' }}>
                Данные об организации не указаны
              </div>
            ),
          },
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
            children: (() => {
              const coords = Array.isArray(data.geoCoordinates) ? data.geoCoordinates : (data.geoCoordinates && typeof data.geoCoordinates === 'object' ? [data.geoCoordinates] : [])
              return coords.length > 0 ? (
              <div>
                {coords.map((coord: { longitude?: string; latitude?: string }, idx: number) => (
                  <Descriptions key={idx} column={1} bordered size="small" style={{ marginBottom: idx < coords.length - 1 ? 8 : 0 }}>
                    <Descriptions.Item label="Долгота">{coord.longitude || '-'}</Descriptions.Item>
                    <Descriptions.Item label="Широта">{coord.latitude || '-'}</Descriptions.Item>
                  </Descriptions>
                ))}
              </div>
            ) : (
              <div style={{ color: '#999', fontStyle: 'italic' }}>
                Координаты не указаны
              </div>
            )
            })(),
          },
        ]}
      />
    </div>
  )
}

export default DetectionPlaceTab

