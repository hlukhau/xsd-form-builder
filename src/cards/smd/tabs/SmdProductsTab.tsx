import { useMemo, useState } from 'react'
import { Table, Button, Tabs, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CardData, SmdProductBatchItem } from '@/types/card'
import ProductTab from '@/components/tabs/dpa/ProductTab'
import TSDTab from '@/components/tabs/dpa/TSDTab'
import ComplianceDocumentsTab from '@/components/tabs/dpa/ComplianceDocumentsTab'
import ViolationsTab from '@/components/tabs/dpa/ViolationsTab'
import { useSanitaryProdTypeOptions } from '@/hooks/shared/useSanitaryProdTypeOptions'
import {
  formatSanitaryProductTypeLabel,
  getSmdBatchPrimaryRow,
  normalizeProductData,
  normalizeTsdData,
} from '../smdProductBatchHelpers'

import SmdProductsTabEdit from './SmdProductsTabEdit'

interface SmdProductsTabProps {
  data: CardData
  editMode?: boolean
  onChange?: (next: CardData) => void
  guid?: string | null
}

function BatchDetailTabs({ batch }: { batch: SmdProductBatchItem }) {
  const product = normalizeProductData(batch.product)
  const tsd = normalizeTsdData(batch.tsd)

  return (
    <Tabs
      className="smd-detail-nested-tabs"
      size="small"
      destroyInactiveTabPane={false}
      items={[
        { key: 'product', label: 'Продукция', children: <ProductTab data={product} /> },
        { key: 'tsd', label: 'ТСД', children: <TSDTab data={tsd} /> },
        {
          key: 'compliance',
          label: 'Документы соответствия',
          children: <ComplianceDocumentsTab tsd={tsd} showLabProtocolsLink={false} />,
        },
        { key: 'violations', label: 'Нарушения', children: <ViolationsTab tsd={tsd} /> },
      ]}
    />
  )
}

/**
 * Продукция SMD: таблица + детализация выбранной партии под таблицей.
 */
const SmdProductsTab: React.FC<SmdProductsTabProps> = ({ data, editMode, onChange, guid }) => {
  if (editMode && onChange) {
    return <SmdProductsTabEdit data={data} onChange={onChange} guid={guid} />
  }

  const batches = data.smdProductBatches ?? []
  const [detailKey, setDetailKey] = useState<string | null>(null)
  const { getNameByCode: getSanitaryProdTypeNameByCode } = useSanitaryProdTypeOptions()

  const tableRows = useMemo(
    () =>
      batches.map((b, i) => {
        const product = b.product
        const pd = product?.productDetails
        const primaryBatch = getSmdBatchPrimaryRow(b)
        return {
          key: b.key || `row-${i}`,
          productName: pd?.productName?.trim() || b.summaryLabel?.trim() || `Продукция ${i + 1}`,
          productType: formatSanitaryProductTypeLabel(
            product?.typeCode,
            product?.typeName,
            getSanitaryProdTypeNameByCode
          ),
          manufacturer: product?.manufacturer?.businessEntityName?.trim() || '—',
          batchId: primaryBatch?.batchDetails?.batchId?.trim() || '—',
          commodityCode: pd?.commodityCode?.trim() || '—',
          batch: b,
        }
      }),
    [batches, getSanitaryProdTypeNameByCode]
  )

  const columns: ColumnsType<(typeof tableRows)[0]> = [
    { title: 'Наименование продукции', dataIndex: 'productName', key: 'productName' },
    { title: 'Вид продукции', dataIndex: 'productType', key: 'productType', width: 200 },
    { title: 'Изготовитель', dataIndex: 'manufacturer', key: 'manufacturer' },
    { title: 'Идентификатор партии', dataIndex: 'batchId', key: 'batchId', width: 140 },
    { title: 'Код ТН ВЭД ЕАЭС', dataIndex: 'commodityCode', key: 'commodityCode', width: 140 },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          onClick={() => setDetailKey((prev) => (prev === record.key ? null : record.key))}
        >
          {detailKey === record.key ? 'Свернуть' : 'Детализация'}
        </Button>
      ),
    },
  ]

  const detailBatch = batches.find((b, i) => (b.key || `row-${i}`) === detailKey)

  if (batches.length === 0) {
    return <Empty description="Нет данных по продукции" />
  }

  return (
    <div>
      <Table
        rowKey="key"
        size="small"
        pagination={false}
        columns={columns}
        dataSource={tableRows}
      />
      {detailKey && detailBatch && (
        <div className="smd-detail-expand-panel">
          <div className="smd-detail-expand-panel__header">
            <span>
              Детализация:{' '}
              {detailBatch.summaryLabel ??
                detailBatch.product?.productDetails?.productName ??
                detailKey}
            </span>
            <Button type="link" size="small" onClick={() => setDetailKey(null)}>
              Закрыть
            </Button>
          </div>
          <BatchDetailTabs batch={detailBatch} />
        </div>
      )}
    </div>
  )
}

export default SmdProductsTab
