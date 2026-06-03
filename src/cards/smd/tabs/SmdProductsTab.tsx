import { useMemo, useState } from 'react'
import { Table, Button, Collapse, Tabs, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CardData, SmdProductBatchItem } from '@/types/card'
import ProductTab from '@/components/tabs/dpa/ProductTab'
import TSDTab from '@/components/tabs/dpa/TSDTab'
import ComplianceDocumentsTab from '@/components/tabs/dpa/ComplianceDocumentsTab'
import ViolationsTab from '@/components/tabs/dpa/ViolationsTab'

interface SmdProductsTabProps {
  data: CardData
}

function batchCardSlice(batch: SmdProductBatchItem): CardData {
  return {
    country: '',
    registrationNumber: '',
    version: 1,
    source: '',
    createdAt: '',
    modifiedAt: '',
    status: '',
    electronicDocument: {
      messageCode: '',
      documentCode: '',
      documentId: '',
      documentDate: '',
      language: 'ru',
      sourceDocumentId: '',
      validityPeriod: { start: '', end: '' },
      updateDateTime: '',
    },
    notification: {
      country: '',
      registrationNumber: '',
      type: '',
      formationDate: '',
      endDate: null,
      authorizedBody: { country: '', identifier: '', name: '', shortName: '' },
    },
    statusHistory: [],
    accessList: [],
    product: batch.product,
    tsd: batch.tsd,
  }
}

const SmdProductsTab: React.FC<SmdProductsTabProps> = ({ data }) => {
  const batches = data.smdProductBatches ?? []
  const [detailKey, setDetailKey] = useState<string | null>(null)

  const tableRows = useMemo(
    () =>
      batches.map((b, i) => ({
        key: b.key || `row-${i}`,
        name: b.product?.productDetails?.productName ?? b.summaryLabel ?? `Продукция ${i + 1}`,
        type: b.product?.typeName ?? b.product?.typeCode ?? '—',
        manufacturer: b.product?.manufacturer?.businessEntityName ?? '—',
        batch: b,
      })),
    [batches]
  )

  const columns: ColumnsType<(typeof tableRows)[0]> = [
    { title: 'Наименование', dataIndex: 'name', key: 'name' },
    { title: 'Вид продукции', dataIndex: 'type', key: 'type', width: 180 },
    { title: 'Изготовитель', dataIndex: 'manufacturer', key: 'manufacturer' },
    {
      title: '',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Button type="link" size="small" onClick={() => setDetailKey(record.key)}>
          Детализация
        </Button>
      ),
    },
  ]

  const detailBatch = batches.find((b, i) => (b.key || `row-${i}`) === detailKey)

  const detailTabs = detailBatch
    ? [
        { key: 'product', label: 'Продукция', children: <ProductTab data={batchCardSlice(detailBatch)} /> },
        { key: 'tsd', label: 'ТСД', children: <TSDTab data={batchCardSlice(detailBatch)} /> },
        {
          key: 'compliance',
          label: 'Документы соответствия',
          children: <ComplianceDocumentsTab data={batchCardSlice(detailBatch)} />,
        },
        { key: 'violations', label: 'Нарушения', children: <ViolationsTab data={batchCardSlice(detailBatch)} /> },
      ]
    : []

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
        style={{ marginBottom: 16 }}
      />
      {detailKey && detailBatch && (
        <Collapse
          activeKey={['detail']}
          items={[
            {
              key: 'detail',
              label: `Детализация: ${detailBatch.summaryLabel ?? detailBatch.product?.productDetails?.productName ?? detailKey}`,
              extra: (
                <Button type="link" size="small" onClick={(e) => { e.stopPropagation(); setDetailKey(null) }}>
                  Свернуть
                </Button>
              ),
              children: <Tabs items={detailTabs} size="small" />,
            },
          ]}
        />
      )}
      {!detailKey && batches.length > 1 && (
        <Collapse
          accordion
          style={{ marginTop: 8 }}
          items={batches.map((b, i) => {
            const k = b.key || `row-${i}`
            const label = b.summaryLabel ?? b.product?.productDetails?.productName ?? `Продукция ${i + 1}`
            const slice = batchCardSlice(b)
            return {
              key: k,
              label,
              children: (
                <Tabs
                  size="small"
                  items={[
                    { key: 'product', label: 'Продукция', children: <ProductTab data={slice} /> },
                    { key: 'tsd', label: 'ТСД', children: <TSDTab data={slice} /> },
                    { key: 'compliance', label: 'Документы соответствия', children: <ComplianceDocumentsTab data={slice} /> },
                    { key: 'violations', label: 'Нарушения', children: <ViolationsTab data={slice} /> },
                  ]}
                />
              ),
            }
          })}
        />
      )}
    </div>
  )
}

export default SmdProductsTab
