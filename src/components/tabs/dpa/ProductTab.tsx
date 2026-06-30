import { Descriptions } from 'antd'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import ManufacturerDetails from '../../common/ManufacturerDetails'
import type { ProductData, TechnicalDocument } from '@/types/card'
import { useShipDocKindOptions } from '@/hooks/shared/useShipDocKindOptions'
import { useSanitaryProdTypeOptions } from '@/hooks/shared/useSanitaryProdTypeOptions'

interface ProductTabProps {
  data: ProductData
}

const ProductTab: React.FC<ProductTabProps> = ({ data }) => {
  const { getNameByCode: getShipDocKindNameByCode } = useShipDocKindOptions()
  const { getNameByCode: getSanitaryProdTypeNameByCode } = useSanitaryProdTypeOptions()

  if (!data) {
    return <div>Данные о продукции не найдены</div>
  }

  const productDetails = data.productDetails ?? { productName: '' }
  const manufacturer = data.manufacturer ?? { country: '' }

  const productTypeNameDisplay = data.typeCode?.trim()
    ? (getSanitaryProdTypeNameByCode(data.typeCode) || data.typeName || '-')
    : (data.typeName || '-')
  const tradeNamesDisplay = (productDetails.tradeNames?.length
    ? productDetails.tradeNames
    : productDetails.tradeName
      ? [productDetails.tradeName]
      : []
  )
    .filter(Boolean)
    .join(' ')

  const formatDate = (date: string | null | undefined) => {
    if (!date) return ''
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) return date
    return format(dateObj, 'dd.MM.yyyy', { locale: ru })
  }

  const formatTechnicalDoc = (doc: TechnicalDocument) => {
    const kindName = doc.docKindCode ? (getShipDocKindNameByCode(doc.docKindCode) || doc.docKindName || '') : (doc.docKindName || '')
    const parts: string[] = []
    if (kindName) parts.push(kindName)
    if (doc.docName) parts.push(doc.docName)
    if (doc.docId) parts.push(doc.docId)
    if (doc.docCreationDate) parts.push(formatDate(doc.docCreationDate))
    if (doc.docStartDate) parts.push(`действует с ${formatDate(doc.docStartDate)}`)
    return parts.length > 0 ? parts.join(' ') : '-'
  }

  return (
    <div>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Код вида">
          {data.typeCode || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Наименование вида">
          {productTypeNameDisplay}
        </Descriptions.Item>
        <Descriptions.Item label="Идентификатор">
          {productDetails.productId || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Наименование">
          {productDetails.productName || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Название продукции">
          {tradeNamesDisplay || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Описание">
          {productDetails.description || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Код ТН ВЭД ЕАЭС">
          {productDetails.commodityCode || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Назначение продукции">
          {productDetails.productPurpose || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Способ применения">
          {productDetails.applicationMethod || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Форма выпуска">
          {productDetails.releaseForm || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Условия хранения">
          {productDetails.storageCondition || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Информация на этикетке">
          {productDetails.labelText || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Техническая документация">
          {productDetails.technicalDocs && productDetails.technicalDocs.length > 0 ? (
            <div>
              {productDetails.technicalDocs.map((doc, index) => (
                <div key={index} style={{ marginBottom: '8px' }}>
                  {formatTechnicalDoc(doc)}
                </div>
              ))}
            </div>
          ) : (
            '-'
          )}
        </Descriptions.Item>
      </Descriptions>

      <ManufacturerDetails data={manufacturer} title="Изготовитель продукции" />
    </div>
  )
}

export default ProductTab

