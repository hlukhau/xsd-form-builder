import type { CardData } from '@/types/card'
import {
  appendOutgoingPlacesAndMeasuresFormatErrors,
  appendProductTsdFormatErrors,
  dedupeFormatErrorsPreservingOrder,
  type FormatValidationErrors,
} from '@/utils/cardValidation'
import { syncSmdCardFromPrimaryMeasure } from './smdSanitaryMeasureModel'

const SMD_INDICATOR_UNIT_REQUIRED_MESSAGE =
  'При указании «Значения показателя» необходимо указать «Единица измерения»'

/**
 * Форматные проверки карты SMD (шаблоны, длина, парные поля) по аналогии с DPA.
 * Блокирует сохранение и участвует в полной валидации перед направлением сведений.
 */
export function collectSmdFormatValidationErrors(data: CardData): FormatValidationErrors {
  const synced = syncSmdCardFromPrimaryMeasure(data)
  const errors: string[] = []

  appendOutgoingPlacesAndMeasuresFormatErrors(errors, synced)

  for (const [pi, item] of (synced.smdProductBatches ?? []).entries()) {
    const productBase = `Продукция ${pi + 1}`
    const mainCommodityTrimmed = (item.product?.productDetails?.commodityCode ?? '').trim()
    appendProductTsdFormatErrors(errors, item.product, item.tsd, {
      productBase,
      tsdSectionLabel: `${productBase} → ТСД`,
      mainCommodityTrimmed,
      manufacturerPathLabel: 'Организация',
      indicatorUnitRequiredMessage: SMD_INDICATOR_UNIT_REQUIRED_MESSAGE,
    })
  }

  return { errors: dedupeFormatErrorsPreservingOrder(errors) }
}
