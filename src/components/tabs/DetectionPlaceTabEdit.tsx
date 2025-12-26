import { Form, Input, Button, Collapse, DatePicker } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import ManufacturerDetailsEdit from '../common/ManufacturerDetailsEdit'
import type { DetectionPlaceData, BorderCheckpointDetails, GeoCoordinateDetails } from '@/types/card'

interface DetectionPlaceTabEditProps {
  data: DetectionPlaceData
  onChange: (data: DetectionPlaceData) => void
}

const DetectionPlaceTabEdit: React.FC<DetectionPlaceTabEditProps> = ({ data, onChange }) => {
  const handleFieldChange = (field: string, value: any) => {
    onChange({
      ...data,
      [field]: value,
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
      <Form layout="vertical">
        <Form.Item label="Адрес">
          <Input.TextArea
            rows={2}
            value={data.address?.fullAddress}
            onChange={(e) => handleFieldChange('address', { fullAddress: e.target.value })}
          />
        </Form.Item>
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
              <Form layout="vertical">
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
              <Form layout="vertical">
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


