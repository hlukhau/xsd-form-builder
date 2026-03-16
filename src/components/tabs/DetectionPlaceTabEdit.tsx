import { Form, Input, Button, Collapse, Space, Select } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import ManufacturerDetailsEdit from '../common/ManufacturerDetailsEdit'
import CountrySelect from '../common/CountrySelect'
import type { DetectionPlaceData, AddressDetails } from '@/types/card'
import { useCountryOptions } from '@/hooks/useCountryOptions'
import { useBorderCheckpointOptions } from '@/hooks/useBorderCheckpointOptions'
import { getMaxLength, validateFieldValue, getFormatHint } from '@/constants/xsdFieldConstraints'

interface DetectionPlaceTabEditProps {
  data: DetectionPlaceData
  onChange: (data: DetectionPlaceData) => void
}

const DetectionPlaceTabEdit: React.FC<DetectionPlaceTabEditProps> = ({ data, onChange }) => {
  const { countryOptions, loading, normalizeCountryCode } = useCountryOptions()
  const { getSelectOptions: getCheckpointSelectOptions, loading: loadingCheckpoints } = useBorderCheckpointOptions()

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

  const handleCheckpointSelect = (code: string | undefined) => {
    if (!code) {
      onChange({ ...data, borderCheckpoint: undefined })
      return
    }
    const opts = getCheckpointSelectOptions()
    const opt = opts.find((o) => o.value === code)
    const name = opt?.label != null ? opt.label.split(' - ').slice(1).join(' - ') : ''
    onChange({
      ...data,
      borderCheckpoint: { checkpointCode: code, checkpointName: name },
    })
  }

  const rawGeo = data.geoCoordinates
  const geoList: Array<{ longitude?: string; latitude?: string }> = Array.isArray(rawGeo)
    ? rawGeo
    : rawGeo && typeof rawGeo === 'object' && ('longitude' in rawGeo || 'latitude' in rawGeo)
      ? [rawGeo]
      : []

  const handleCoordinateChange = (index: number, field: 'longitude' | 'latitude', value: string) => {
    const next = [...geoList]
    if (!next[index]) next[index] = {}
    next[index] = { ...next[index], [field]: value || undefined }
    onChange({ ...data, geoCoordinates: next })
  }

  const handleAddCoordinate = () => {
    onChange({ ...data, geoCoordinates: [...geoList, {}] })
  }

  const handleRemoveCoordinate = (index: number) => {
    const next = geoList.filter((_, i) => i !== index)
    onChange({ ...data, geoCoordinates: next.length ? next : undefined })
  }

  return (
    <div>
      <Form layout="vertical" className="field-tag-form">
        {/* Адрес места обнаружения (ObjectAddressDetails) — без почтового индекса и полного адреса одной строкой */}
        <h4 style={{ marginTop: 0 }}>Адрес места обнаружения (ccdo:ObjectAddressDetails)</h4>
        <div style={{ border: '1px solid #d9d9d9', borderRadius: 4, padding: 16, marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
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
              maxLength={getMaxLength('territoryCode')}
              showCount
            />
          </Form.Item>
          <Form.Item label="Регион (RegionName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Например: Витебская область"
              value={data.address?.regionName}
              onChange={(e) => handleAddressChange('regionName', e.target.value)}
              maxLength={getMaxLength('regionName')}
              showCount
            />
          </Form.Item>
          <Form.Item label="Район (DistrictName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Район"
              value={data.address?.districtName}
              onChange={(e) => handleAddressChange('districtName', e.target.value)}
              maxLength={getMaxLength('districtName')}
              showCount
            />
          </Form.Item>
          <Form.Item label="Город (CityName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Город"
              value={data.address?.cityName}
              onChange={(e) => handleAddressChange('cityName', e.target.value)}
              maxLength={getMaxLength('cityName')}
              showCount
            />
          </Form.Item>
          <Form.Item label="Населённый пункт (SettlementName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Например: г.п. Ушачи"
              value={data.address?.settlementName}
              onChange={(e) => handleAddressChange('settlementName', e.target.value)}
              maxLength={getMaxLength('settlementName')}
              showCount
            />
          </Form.Item>
          <Form.Item label="Улица (StreetName)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Улица"
              value={data.address?.streetName}
              onChange={(e) => handleAddressChange('streetName', e.target.value)}
              maxLength={getMaxLength('streetName')}
              showCount
            />
          </Form.Item>
          <Form.Item label="Номер здания (BuildingNumberId)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Номер дома, корпус"
              value={data.address?.buildingNumberId}
              onChange={(e) => handleAddressChange('buildingNumberId', e.target.value)}
              maxLength={getMaxLength('buildingNumberId')}
              showCount
            />
          </Form.Item>
          <Form.Item label="Номер помещения (RoomNumberId)" style={{ marginBottom: 0 }}>
            <Input
              placeholder="Квартира, офис, кабинет"
              value={data.address?.roomNumberId}
              onChange={(e) => handleAddressChange('roomNumberId', e.target.value)}
              maxLength={getMaxLength('roomNumberId')}
              showCount
            />
          </Form.Item>
          </Space>
        </div>

        <Form.Item label="Описание">
          <Input.TextArea
            rows={3}
            value={data.description}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            maxLength={getMaxLength('descriptionPlace')}
            showCount
          />
        </Form.Item>
      </Form>

      <Collapse
        defaultActiveKey={['organization', 'checkpoint', 'coordinates']}
        items={[
          {
            key: 'organization',
            label: 'Организация места обнаружения',
            children: (
              <ManufacturerDetailsEdit
                data={data.organization ?? { country: '' }}
                onChange={(org) => handleFieldChange('organization', org)}
                title="Организация"
              />
            ),
          },
          {
            key: 'checkpoint',
            label: 'Пункт пропуска',
            children: (
              <Form layout="vertical" className="field-tag-form">
                <Form.Item label="Код вида пункта пропуска">
                  <Select
                    showSearch
                    placeholder="Выберите пункт пропуска (код — наименование)"
                    loading={loadingCheckpoints}
                    value={data.borderCheckpoint?.checkpointCode || undefined}
                    onChange={handleCheckpointSelect}
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={getCheckpointSelectOptions()}
                    style={{ width: '100%' }}
                    allowClear
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
                <p style={{ marginBottom: 8, color: '#666' }}>{getFormatHint('geoCoordinate')}</p>
                {geoList.map((coord, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap' }}>
                    <Form.Item label="Долгота" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                      <Input
                        value={coord.longitude ?? ''}
                        onChange={(e) => handleCoordinateChange(idx, 'longitude', e.target.value)}
                        onBlur={(e) => handleCoordinateChange(idx, 'longitude', e.target.value)}
                        placeholder="Число ISO 6709"
                        status={validateFieldValue('geoCoordinate', coord.longitude?.trim()) ? 'error' : undefined}
                      />
                      {validateFieldValue('geoCoordinate', coord.longitude?.trim()) && (
                        <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>
                          {validateFieldValue('geoCoordinate', coord.longitude?.trim())}
                        </div>
                      )}
                    </Form.Item>
                    <Form.Item label="Широта" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
                      <Input
                        value={coord.latitude ?? ''}
                        onChange={(e) => handleCoordinateChange(idx, 'latitude', e.target.value)}
                        onBlur={(e) => handleCoordinateChange(idx, 'latitude', e.target.value)}
                        placeholder="Число ISO 6709"
                        status={validateFieldValue('geoCoordinate', coord.latitude?.trim()) ? 'error' : undefined}
                      />
                      {validateFieldValue('geoCoordinate', coord.latitude?.trim()) && (
                        <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 2 }}>
                          {validateFieldValue('geoCoordinate', coord.latitude?.trim())}
                        </div>
                      )}
                    </Form.Item>
                    <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleRemoveCoordinate(idx)} style={{ marginTop: 30 }}>
                      Удалить
                    </Button>
                  </div>
                ))}
                <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddCoordinate}>
                  Добавить координаты
                </Button>
              </Form>
            ),
          },
        ]}
      />
    </div>
  )
}

export default DetectionPlaceTabEdit









