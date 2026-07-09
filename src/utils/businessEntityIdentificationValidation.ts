import type { CardData, DetectionPlaceData, MeasuresData, SupplyChainPartyDetails } from '@/types/card'

/** Поля csdo:BusinessEntityId + атрибут kindId (метод идентификации). */
export interface EntityIdMethodSource {
  businessEntityId?: string | null
  subjectIdentifier?: string | null
  identificationMethod?: string | null
}

export function resolveEntityIdentifier(src: EntityIdMethodSource | undefined | null): string {
  if (!src) return ''
  return String(src.businessEntityId ?? src.subjectIdentifier ?? '').trim()
}

export const ENTITY_ID_WITHOUT_METHOD_MSG =
  'Если указан идентификатор субъекта, должен быть указан метод идентификации'

export const ENTITY_METHOD_WITHOUT_ID_MSG =
  'Если указан метод идентификации, должен быть указан идентификатор субъекта'

/** Подсказка под полями в форме (как для страны/города в адресе). */
export function getEntityIdMethodPairInlineHint(src: EntityIdMethodSource | undefined | null): {
  hasError: boolean
  message: string
} {
  const remarks = businessEntityIdMethodPairRemarks(src)
  return {
    hasError: remarks.length > 0,
    message: remarks[0] ?? '',
  }
}

export function entityIdMethodPairInputStatus(
  src: EntityIdMethodSource | undefined | null
): 'error' | undefined {
  return getEntityIdMethodPairInlineHint(src).hasError ? 'error' : undefined
}

/** Для save-blocking / format validation с путём к полю. */
export function pushBusinessEntityIdMethodPairErrors(
  errors: string[],
  path: string,
  src: EntityIdMethodSource | undefined | null
): void {
  if (!src) return
  const id = resolveEntityIdentifier(src)
  const method = (src.identificationMethod ?? '').trim()
  if (!id && !method) return
  if (id && !method) {
    errors.push(`${path}: ${ENTITY_ID_WITHOUT_METHOD_MSG}`)
  }
  if (method && !id) {
    errors.push(`${path}: ${ENTITY_METHOD_WITHOUT_ID_MSG}`)
  }
}

/** Для форматно-логических контролей (без префикса пути). */
export function businessEntityIdMethodPairRemarks(
  src: EntityIdMethodSource | undefined | null,
  options?: { legacyHozyaystvuyushchegoSubektaWording?: boolean }
): string[] {
  if (!src) return []
  const id = resolveEntityIdentifier(src)
  const method = (src.identificationMethod ?? '').trim()
  if (!id && !method) return []
  const remarks: string[] = []
  const legacy = options?.legacyHozyaystvuyushchegoSubektaWording ?? false
  if (id && !method) {
    remarks.push(
      legacy
        ? 'Если указан идентификатор хозяйствующего субъекта, то метод идентификации должен быть указан обязательно'
        : ENTITY_ID_WITHOUT_METHOD_MSG
    )
  }
  if (method && !id) {
    remarks.push(
      legacy
        ? 'Если указан метод идентификации, то идентификатор хозяйствующего субъекта должен быть указан обязательно'
        : ENTITY_METHOD_WITHOUT_ID_MSG
    )
  }
  return remarks
}

function spreadingZonesList(data: CardData): DetectionPlaceData[] {
  if (data.spreadingZones && data.spreadingZones.length > 0) return data.spreadingZones
  if (data.spreadingZone) return [data.spreadingZone]
  return []
}

function pushPartyPair(errors: string[], path: string, party: SupplyChainPartyDetails | undefined): void {
  pushBusinessEntityIdMethodPairErrors(errors, path, party)
}

function pushMeasuresSubjectPairs(errors: string[], measures: MeasuresData | null | undefined): void {
  for (const [mi, m] of (measures?.measures ?? []).entries()) {
    const mPath = `Принятые меры → Мера ${mi + 1}`
    for (const [ii, impl] of (m.measureImplementationDetails ?? []).entries()) {
      const implPath = `${mPath} → Мероприятие ${ii + 1}`
      const subjects =
        impl.subjectDetailsList && impl.subjectDetailsList.length > 0
          ? impl.subjectDetailsList
          : impl.subjectDetails
            ? [impl.subjectDetails]
            : []
      for (const [si, subj] of subjects.entries()) {
        const subjPath =
          subjects.length > 1 ? `${implPath} → Субъект-исполнитель ${si + 1}` : `${implPath} → Субъект-исполнитель`
        pushBusinessEntityIdMethodPairErrors(errors, subjPath, subj.businessEntity)
      }
    }
  }
}

/** Обход карты: все блоки «Организация» / участник с BusinessEntityId + kindId. */
export function collectBusinessEntityIdMethodPairErrorsFromCard(data: CardData): string[] {
  const errors: string[] = []

  if (data.product?.manufacturer) {
    pushPartyPair(errors, 'Продукция → Изготовитель', data.product.manufacturer)
  }

  for (const [bi, batch] of (data.tsd?.batches ?? []).entries()) {
    const batchPath = `ТСД → Партия ${bi + 1}`
    for (const [di, doc] of (batch.shippingDocuments ?? []).entries()) {
      const docPath = `${batchPath} → Товаросопроводительный документ ${di + 1}`
      for (const [pi, party] of (doc.supplyChainParties ?? []).entries()) {
        pushPartyPair(errors, `${docPath} → Участник цепи поставки ${pi + 1}`, party)
      }
    }
  }

  if (data.detectionPlace?.organization) {
    pushBusinessEntityIdMethodPairErrors(errors, 'Место обнаружения → Организация', data.detectionPlace.organization)
  }

  for (const [i, zone] of spreadingZonesList(data).entries()) {
    if (zone.organization) {
      pushBusinessEntityIdMethodPairErrors(errors, `Зона распространения ${i + 1} → Организация`, zone.organization)
    }
  }

  pushMeasuresSubjectPairs(errors, data.measures)

  return errors
}
