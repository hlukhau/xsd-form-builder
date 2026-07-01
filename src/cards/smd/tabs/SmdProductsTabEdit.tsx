import { useMemo, useState } from 'react'
import { Button, Table, Tabs, Empty, Modal } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { CardData, ProductData, SmdProductBatchItem, TSDData } from '@/types/card'
import ProductTabEdit from '@/components/tabs/dpa/ProductTabEdit'
import TSDTabEdit from '@/components/tabs/dpa/TSDTabEdit'
import ComplianceDocumentsTabEdit from '@/components/tabs/dpa/ComplianceDocumentsTabEdit'
import ViolationsTabEdit from '@/components/tabs/dpa/ViolationsTabEdit'
import { useSanitaryProdTypeOptions } from '@/hooks/shared/useSanitaryProdTypeOptions'
import {
  buildSmdProductBatchSummaryLabel,
  createEmptySmdProductBatch,
  formatSanitaryProductTypeLabel,
  getSmdBatchPrimaryRow,
  normalizeProductData,
  normalizeTsdData,
  patchSmdProductBatchSummary,
} from '../smdProductBatchHelpers'

interface SmdProductsTabEditProps {
  data: CardData
  onChange: (next: CardData) => void
  guid?: string | null
}

function ensureBatchTsd(tsd?: TSDData): TSDData {
  const normalized = normalizeTsdData(tsd)
  if (normalized.batches.length > 0) return normalized
  return { batches: [{ shippingDocuments: [] }] }
}

function BatchDetailTabsEdit({
  batch,
  guid,
  onProductChange,
  onTsdChange,
}: {
  batch: SmdProductBatchItem
  guid?: string | null
  onProductChange: (product: ProductData) => void
  onTsdChange: (tsd: TSDData) => void
}) {
  const product = normalizeProductData(batch.product)
  const tsd = ensureBatchTsd(batch.tsd)

  return (
    <Tabs
      className="smd-detail-nested-tabs"
      size="small"
      destroyInactiveTabPane={false}
      items={[
        {
          key: 'product',
          label: 'Продукция',
          children: <ProductTabEdit data={product} onChange={onProductChange} />,
        },
        {
          key: 'tsd',
          label: 'ТСД',
          children: <TSDTabEdit data={tsd} onChange={onTsdChange} />,
        },
        {
          key: 'compliance',
          label: 'Документы соответствия',
          children: (
            <ComplianceDocumentsTabEdit
              tsd={tsd}
              onTsdChange={onTsdChange}
              guid={guid}
              showLabProtocolsLink={false}
            />
          ),
        },
        {
          key: 'violations',
          label: 'Нарушения',
          children: <ViolationsTabEdit tsd={tsd} onTsdChange={onTsdChange} />,
        },
      ]}
    />
  )
}

/**
 * Продукция SMD в режиме редактирования: таблица + кнопка «Добавить продукцию».
 */
const SmdProductsTabEdit: React.FC<SmdProductsTabEditProps> = ({ data, onChange, guid }) => {
  const batches = data.smdProductBatches ?? []
  const [detailKey, setDetailKey] = useState<string | null>(batches[0]?.key ?? null)
  const { getNameByCode: getSanitaryProdTypeNameByCode } = useSanitaryProdTypeOptions()

  const patchBatches = (nextBatches: SmdProductBatchItem[]) => {
    onChange({
      ...data,
      smdProductBatches: nextBatches.map(patchSmdProductBatchSummary),
    })
  }

  const patchBatch = (key: string, patch: Partial<SmdProductBatchItem>) => {
    patchBatches(
      batches.map((item) => (item.key === key ? patchSmdProductBatchSummary({ ...item, ...patch }) : item))
    )
  }

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

  const handleAdd = () => {
    const nextItem = createEmptySmdProductBatch()
    const next = [...batches, nextItem]
    patchBatches(next)
    setDetailKey(nextItem.key)
  }

  const handleRemove = (key: string) => {
    Modal.confirm({
      title: 'Удалить продукцию?',
      content:
        'Будут удалены сведения о продукции, ТСД, документах соответствия и нарушениях по выбранной строке.',
      okText: 'Удалить',
      okType: 'danger',
      cancelText: 'Отмена',
      onOk: () => {
        const next = batches.filter((b) => b.key !== key)
        patchBatches(next)
        setDetailKey((prev) => {
          if (prev !== key) return prev
          return next[0]?.key ?? null
        })
      },
    })
  }

  const columns: ColumnsType<(typeof tableRows)[0]> = [
    { title: 'Наименование продукции', dataIndex: 'productName', key: 'productName' },
    { title: 'Вид продукции', dataIndex: 'productType', key: 'productType', width: 200 },
    { title: 'Изготовитель', dataIndex: 'manufacturer', key: 'manufacturer' },
    { title: 'Идентификатор партии', dataIndex: 'batchId', key: 'batchId', width: 140 },
    { title: 'Код ТН ВЭД ЕАЭС', dataIndex: 'commodityCode', key: 'commodityCode', width: 140 },
    {
      title: '',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <>
          <Button
            type="link"
            size="small"
            onClick={() => setDetailKey((prev) => (prev === record.key ? null : record.key))}
          >
            {detailKey === record.key ? 'Свернуть' : 'Детализация'}
          </Button>
          <Button
            type="link"
            danger
            size="small"
            icon={<DeleteOutlined />}
            onClick={() => handleRemove(record.key)}
          >
            Удалить
          </Button>
        </>
      ),
    },
  ]

  const detailBatch = batches.find((b) => b.key === detailKey)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="dashed" icon={<PlusOutlined />} onClick={handleAdd}>
          Добавить продукцию
        </Button>
      </div>
      {batches.length === 0 ? (
        <Empty description="Нет данных по продукции" />
      ) : (
        <>
          <Table
            rowKey="key"
            size="small"
            pagination={false}
            columns={columns}
            dataSource={tableRows}
            onRow={(record) => ({
              onClick: () => setDetailKey(record.key),
              style: { cursor: 'pointer' },
            })}
            rowClassName={(record) => (detailKey === record.key ? 'ant-table-row-selected' : '')}
          />
          {detailKey && detailBatch && (
            <div className="smd-detail-expand-panel">
              <div className="smd-detail-expand-panel__header">
                <span>Детализация: {buildSmdProductBatchSummaryLabel(detailBatch)}</span>
                <Button type="link" size="small" onClick={() => setDetailKey(null)}>
                  Закрыть
                </Button>
              </div>
              <BatchDetailTabsEdit
                batch={detailBatch}
                guid={guid}
                onProductChange={(product) => patchBatch(detailKey, { product })}
                onTsdChange={(tsd) => patchBatch(detailKey, { tsd })}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SmdProductsTabEdit
