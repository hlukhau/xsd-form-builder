import { useState } from 'react'
import { Table } from 'antd'
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons'
import type { DetectionPlaceData } from '@/types/card'
import DetectionPlaceTab from '@/components/tabs/dpa/DetectionPlaceTab'
import { useBorderCheckpointOptions } from '@/hooks/shared/useBorderCheckpointOptions'
import { useCountryOptions } from '@/hooks/shared/useCountryOptions'
import {
  formatPlaceAddressLabel,
  formatPlaceCheckpointLabel,
  formatPlaceDescriptionLabel,
  formatPlaceOrganizationName,
} from '@/utils/placeDisplayUtils'

interface SpreadingZonesTableProps {
  zones: DetectionPlaceData[]
  emptyText?: string
}

/**
 * Таблица зон распространения (типовой объект «Место»): организация, пункт пропуска, адрес, описание + детализация строки.
 */
const SpreadingZonesTable: React.FC<SpreadingZonesTableProps> = ({
  zones,
  emptyText = 'Нет данных о зонах распространения.',
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(zones.length > 0 ? 0 : null)
  const { getNameByCode: getCheckpointNameByCode } = useBorderCheckpointOptions()
  const { getDisplayLabel: getCountryDisplayLabel } = useCountryOptions()

  if (zones.length === 0) {
    return <div style={{ color: '#8c8c8c' }}>{emptyText}</div>
  }

  const columns = [
    {
      title: '',
      key: 'expand',
      width: 40,
      align: 'center' as const,
      render: (_: unknown, __: DetectionPlaceData, index: number) =>
        selectedIndex === index ? <CaretDownOutlined /> : <CaretRightOutlined />,
    },
    {
      title: 'Организация',
      key: 'organization',
      render: (_: unknown, row: DetectionPlaceData) => formatPlaceOrganizationName(row),
    },
    {
      title: 'Пункт пропуска',
      key: 'checkpoint',
      width: 200,
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
      width: 180,
      render: (_: unknown, row: DetectionPlaceData) => formatPlaceDescriptionLabel(row),
    },
  ]

  return (
    <Table
      size="small"
      rowKey={(_, index) => `spread-zone-${index}`}
      dataSource={zones}
      columns={columns}
      pagination={false}
      onRow={(_, index) => ({
        onClick: () => setSelectedIndex((prev) => (prev === index ? null : index ?? null)),
        style: { cursor: 'pointer' },
      })}
      rowClassName={(_, index) => (selectedIndex === index ? 'ant-table-row-selected' : '')}
      expandable={{
        expandedRowKeys: selectedIndex != null ? [`spread-zone-${selectedIndex}`] : [],
        expandedRowRender: (_, index) => (
          <DetectionPlaceTab data={zones[index ?? 0] ?? {}} label="зоне распространения" />
        ),
        expandIcon: () => null,
        expandIconColumnIndex: -1,
      }}
    />
  )
}

export default SpreadingZonesTable
