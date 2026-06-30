import type { ProductData, SmdProductBatchItem, TSDData } from '@/types/card'

let smdProductBatchKeySeq = 0

export function createNextSmdProductBatchKey(): string {
  smdProductBatchKeySeq += 1
  return `batch-new-${Date.now()}-${smdProductBatchKeySeq}`
}

export function createEmptyProductData(): ProductData {
  return {
    typeName: '',
    typeCode: '',
    productDetails: { productName: '' },
    manufacturer: { country: '' },
  }
}

export function normalizeProductData(product?: ProductData): ProductData {
  if (!product) return createEmptyProductData()
  return {
    typeName: product.typeName ?? '',
    typeCode: product.typeCode ?? '',
    productDetails: product.productDetails ?? { productName: '' },
    manufacturer: product.manufacturer ?? { country: '' },
  }
}

export function normalizeTsdData(tsd?: TSDData): TSDData {
  return tsd?.batches?.length ? tsd : { batches: [] }
}

export function getSmdBatchPrimaryRow(batchItem: SmdProductBatchItem) {
  return batchItem.tsd?.batches?.[0]
}

export function createEmptySmdProductBatch(): SmdProductBatchItem {
  return {
    key: createNextSmdProductBatchKey(),
    product: createEmptyProductData(),
    tsd: { batches: [{ shippingDocuments: [] }] },
  }
}

export function buildSmdProductBatchSummaryLabel(item: SmdProductBatchItem): string {
  const name = item.product?.productDetails?.productName?.trim()
  if (name) return name
  const batchId = getSmdBatchPrimaryRow(item)?.batchDetails?.batchId?.trim()
  if (batchId) return batchId
  return item.summaryLabel?.trim() || 'Новая продукция'
}

export function patchSmdProductBatchSummary(item: SmdProductBatchItem): SmdProductBatchItem {
  return { ...item, summaryLabel: buildSmdProductBatchSummaryLabel(item) }
}

export function formatSanitaryProductTypeLabel(
  typeCode: string | undefined,
  typeName: string | undefined,
  getNameByCode: (code: string) => string | null
): string {
  const code = typeCode?.trim()
  const name = typeName?.trim()
  if (code) {
    const catalog = getNameByCode(code)
    return catalog ? `${code} — ${catalog}` : code
  }
  return name || '—'
}
