import { useState } from 'react'
import { Button, Table } from 'antd'
import { PlusOutlined, DeleteOutlined, CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons'
import type { CardData, DetectionPlaceData } from '@/types/card'
import { DiseaseTabEdit } from '@/components/tabs/pha'
import PatientGroupTabEdit from '@/components/tabs/pha/PatientGroupTabEdit'
import DetectionPlaceTabEdit from '@/components/tabs/dpa/DetectionPlaceTabEdit'
import { useBorderCheckpointOptions } from '@/hooks/shared/useBorderCheckpointOptions'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import {
  formatPlaceAddressLabel,
  formatPlaceCheckpointLabel,
  formatPlaceDescriptionLabel,
  formatPlaceOrganizationName,
} from '@/utils/placeDisplayUtils'

interface SmdDiseaseTabEditProps {
  data: CardData
  onChange: (next: CardData) => void
}

function spreadingZonesList(data: CardData): DetectionPlaceData[] {
  if (data.spreadingZones && data.spreadingZones.length > 0) return data.spreadingZones
  if (data.spreadingZone) return [data.spreadingZone]
  return []
}

function patchSpreadingZones(data: CardData, zones: DetectionPlaceData[]): CardData {
  return {
    ...data,
    spreadingZones: zones.length > 0 ? zones : undefined,
    spreadingZone: zones.length > 0 ? zones[0] : undefined,
  }
}

/**
 * Болезнь SMD в режиме редактирования — все блоки R.SM.SS.09.001 на одной вкладке.
 */
const SmdDiseaseTabEdit: React.FC<SmdDiseaseTabEditProps> = ({ data, onChange }) => {
  const zones = spreadingZonesList(data)
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(zones.length > 0 ? 0 : null)
  const { getNameByCode: getCheckpointNameByCode } = useBorderCheckpointOptions()
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()

  const setZones = (nextZones: DetectionPlaceData[]) => {
    onChange(patchSpreadingZones(data, nextZones))
    setSelectedZoneIndex((prev) => {
      if (prev == null) return nextZones.length > 0 ? 0 : null
      if (prev >= nextZones.length) return nextZones.length > 0 ? nextZones.length - 1 : null
      return prev
    })
  }

  return (
    <div>
      <DiseaseTabEdit data={data} onChange={onChange} />

      <div style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Группа пациентов</div>
        <PatientGroupTabEdit data={data} onChange={onChange} />
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Место обнаружения</div>
        <DetectionPlaceTabEdit
          data={data.detectionPlace ?? {}}
          onChange={(place) => onChange({ ...data, detectionPlace: place })}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontWeight: 600 }}>Зона распространения</span>
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => {
              const next = [...zones, {}]
              setZones(next)
              setSelectedZoneIndex(next.length - 1)
            }}
          >
            Добавить зону
          </Button>
        </div>
        {zones.length > 0 ? (
          <Table
            size="small"
            rowKey={(_, index) => `spread-zone-edit-${index}`}
            dataSource={zones}
            pagination={false}
            scroll={{ x: 960 }}
            tableLayout="fixed"
            style={{ width: '100%' }}
            columns={[
              {
                title: '',
                key: 'expand',
                width: 40,
                align: 'center' as const,
                render: (_: unknown, __: DetectionPlaceData, index: number) =>
                  selectedZoneIndex === index ? <CaretDownOutlined /> : <CaretRightOutlined />,
              },
              {
                title: 'Организация',
                key: 'organization',
                width: 180,
                ellipsis: true,
                render: (_: unknown, row: DetectionPlaceData) => formatPlaceOrganizationName(row),
              },
              {
                title: 'Пункт пропуска',
                key: 'checkpoint',
                width: 160,
                ellipsis: true,
                render: (_: unknown, row: DetectionPlaceData) =>
                  formatPlaceCheckpointLabel(row, getCheckpointNameByCode),
              },
              {
                title: 'Адрес',
                key: 'address',
                render: (_: unknown, row: DetectionPlaceData) =>
                  formatPlaceAddressLabel(row, getCountryDisplayLabel),
              },
              {
                title: 'Описание',
                key: 'description',
                width: 160,
                render: (_: unknown, row: DetectionPlaceData) => formatPlaceDescriptionLabel(row),
              },
              {
                title: '',
                key: 'actions',
                width: 90,
                render: (_: unknown, __: DetectionPlaceData, index: number) => (
                  <Button
                    type="link"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      setZones(zones.filter((_, i) => i !== index))
                    }}
                  >
                    Удалить
                  </Button>
                ),
              },
            ]}
            onRow={(_, index) => ({
              onClick: () => setSelectedZoneIndex(index ?? null),
              style: { cursor: 'pointer' },
            })}
            rowClassName={(_, index) => (selectedZoneIndex === index ? 'ant-table-row-selected' : '')}
            expandable={{
              expandedRowKeys:
                selectedZoneIndex != null ? [`spread-zone-edit-${selectedZoneIndex}`] : [],
              expandedRowRender: (_, index) => (
                <div className="spread-zone-edit-panel">
                  <DetectionPlaceTabEdit
                    data={zones[index ?? 0] ?? {}}
                    onChange={(nextZone) => {
                      const next = [...zones]
                      next[index ?? 0] = nextZone
                      setZones(next)
                    }}
                  />
                </div>
              ),
              expandIcon: () => null,
              expandIconColumnIndex: -1,
            }}
          />
        ) : (
          <div style={{ color: '#8c8c8c' }}>Нет данных о зонах распространения.</div>
        )}
      </div>
    </div>
  )
}

export default SmdDiseaseTabEdit
