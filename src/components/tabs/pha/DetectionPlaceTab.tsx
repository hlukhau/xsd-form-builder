import { Descriptions } from 'antd'
import type { CardData } from '@/types/card'

interface DetectionPlaceTabProps {
  data: CardData
}

/**
 * Место обнаружения — сведения по месту обнаружения болезни.
 */
const DetectionPlaceTab: React.FC<DetectionPlaceTabProps> = ({ data }) => {
  const place = data.detectionPlace
  const addr = place?.address
  const org = place?.organization
  const hasContent = place && (addr || org || place.description)
  return (
    <Descriptions column={1} bordered>
      {hasContent ? (
        <>
          {org && (
            <>
              <Descriptions.Item label="Страна">{org.country ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Организация">{org.businessEntityName ?? org.businessEntityBriefName ?? '-'}</Descriptions.Item>
            </>
          )}
          {addr && (
            <>
              <Descriptions.Item label="Регион">{addr.regionName ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Населённый пункт">{addr.settlementName ?? addr.cityName ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Адрес">{addr.fullAddress ?? '-'}</Descriptions.Item>
            </>
          )}
          {place.description && <Descriptions.Item label="Описание">{place.description}</Descriptions.Item>}
        </>
      ) : (
        <Descriptions.Item label="Сведения о месте обнаружения">
          Данные по схеме PublicHealthAlert будут добавлены при реализации парсера и формы.
        </Descriptions.Item>
      )}
    </Descriptions>
  )
}

export default DetectionPlaceTab
