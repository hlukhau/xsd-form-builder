import { Form, Input, Button, Collapse, Space } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import ManufacturerDetailsEdit from '../common/ManufacturerDetailsEdit'
import CountrySelect from '../common/CountrySelect'
import type { DetectionPlaceData, AddressDetails } from '@/types/card'
import { useCountryOptions } from '@/hooks/useCountryOptions'

interface DetectionPlaceTabEditProps {
  data: DetectionPlaceData
  onChange: (data: DetectionPlaceData) => void
}

const DetectionPlaceTabEdit: React.FC<DetectionPlaceTabEditProps> = ({ data, onChange }) => {
  const { countryOptions, loading, normalizeCountryCode } = useCountryOptions()

  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...data,
      [field]: value,
    })
  }

  const handleAddressChange = (field: keyof AddressDetails, value: string) => {
    onChange({
      ...data,
      address: {
        ...data.address,
        [field]: value || undefined,
      },
    })
  }

  const handleCheckpointChange = (field: string, value: string) => {
    onChange({
      ...data,
      borderCheckpoint: {
        ...data.borderCheckpoint,
        [field]: value,
      },
    })
  }

  const handleGeoChange = (field: string, value: string) => {
    onChange({
      ...data,
      geoCoordinates: {
        ...data.geoCoordinates,
        [field]: value,
      },
    })
  }

  return (
    <div>
      <Form layout="vertical" className="field-tag-form">
        {/* Адрес места обнаружения (ObjectAddressDetails) — отдельные поля как в XML */}
        <h4 style={{ marginTop: 0 }}>Адрес места обнаружения</h4>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <CountrySelect
            placeholder="Страна (UnifiedCountryCode)"
            loading={loading}
            value={data.address?.country}
            onChange={(value) => handleAddressChange('country', value || '')}
            countryOptions={countryOptions}
            normalizeCountryCode={normalizeCountryCode}
          />
          <Form.Item label="Код территории (TerritoryCode)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Код территории"
              value={data.address?.territoryCode}
              onChange={(e) => handleAddressChange('territoryCode', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Регион (RegionName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Например: Витебская область"
              value={data.address?.regionName}
              onChange={(e) => handleAddressChange('regionName', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Район (DistrictName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Район"
              value={data.address?.districtName}
              onChange={(e) => handleAddressChange('districtName', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Город (CityName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Город"
              value={data.address?.cityName}
              onChange={(e) => handleAddressChange('cityName', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Населённый пункт (SettlementName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Например: г.п. Ушачи"
              value={data.address?.settlementName}
              onChange={(e) => handleAddressChange('settlementName', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Улица (StreetName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Улица"
              value={data.address?.streetName}
              onChange={(e) => handleAddressChange('streetName', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Номер здания (BuildingNumberId)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Номер дома, корпус"
              value={data.address?.buildingNumberId}
              onChange={(e) => handleAddressChange('buildingNumberId', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Номер помещения (RoomNumberId)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Квартира, офис, кабинет"
              value={data.address?.roomNumberId}
              onChange={(e) => handleAddressChange('roomNumberId', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Почтовый индекс (PostCode)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Индекс"
              value={data.address?.postCode}
              onChange={(e) => handleAddressChange('postCode', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="Полный адрес одной строкой (FullAddress)" style={{ marginBottom: 0 }}>
            <Input.TextArea
              rows={2}
              placeholder="При необходимости — адрес одной строкой"
              value={data.address?.fullAddress}
              onChange={(e) => handleAddressChange('fullAddress', e.target.value)}
            />
          </Form.Item>
        </Space>

        <Form.Item label="Описание">
          <Input.TextArea
            rows={3}
            value={data.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
          />
        </Form.Item>
      </Form>

      <Collapse
        defaultActiveKey={['organization', 'checkpoint', 'coordinates']}
        items={[
          {
            key: 'organization',
            label: 'Организация',
            children: data.organization ? (
              <ManufacturerDetailsEdit
                data={data.organization}
                onChange={(org) => handleFieldChange('organization', org)}
                title="Организация"
              />
            ) : (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => {
                  handleFieldChange('organization', { country: '' })
                }}
              >
                Добавить организацию
              </Button>
            ),
          },
          {
            key: 'checkpoint',
            label: 'Пункт пропуска',
            children: (
              <Form layout="vertical" className="field-tag-form">
                <Form.Item label="Код вида пункта пропуска">
                  <Input
                    value={data.borderCheckpoint?.checkpointCode}
                    onChange={(e) => handleCheckpointChange('checkpointCode', e.target.value)}
                  />
                </Form.Item>
                <Form.Item label="Наименование пункта пропуска">
                  <Input
                    value={data.borderCheckpoint?.checkpointName}
                    onChange={(e) => handleCheckpointChange('checkpointName', e.target.value)}
                  />
                </Form.Item>
              </Form>
            ),
          },
          {
            key: 'coordinates',
            label: 'Географические координаты',
            children: (
              <Form layout="vertical" className="field-tag-form">
                <Form.Item label="Географическая долгота">
                  <Input
                    value={data.geoCoordinates?.longitude}
                    onChange={(e) => handleGeoChange('longitude', e.target.value)}
                  />
                </Form.Item>
                <Form.Item label="Географическая широта">
                  <Input
                    value={data.geoCoordinates?.latitude}
                    onChange={(e) => handleGeoChange('latitude', e.target.value)}
                  />
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />

      {/* Детальная информация об организации */}
      {data.organization && (
        <div style={{ marginTop: '24px' }}>
          <ManufacturerDetailsEdit
            data={data.organization}
            onChange={(org) => handleFieldChange('organization', org)}
            title="Организация"
          />
        </div>
      )}
    </div>
  )
}

export default DetectionPlaceTabEdit









